import { supabase } from '../supabase';
import { compileRecord } from './compiler.js';
import { canonicalKey, normalizeName } from './normalizer.js';
import { makeChallenge, scoreAnswer } from './challenges.js';
import { applyAssessment, emptyMastery } from './mastery.js';
import { rankOpportunities } from './scoring.js';
import { RELATIONSHIPS } from './relationships.js';

const VERSION = 'v1';

export function scheduleAtlas(uid, entryId) {
  if (!uid || !entryId) return;
  compileEntry(uid, entryId).catch(() => {});
}

async function finishJob(key, patch) {
  await supabase.from('atlas_processing_jobs').update({ ...patch, updated_at: new Date().toISOString() }).eq('idempotency_key', key);
}

export async function compileEntry(uid, entryId) {
  const key = `compile:${entryId}:${VERSION}`;
  const { data: existing, error: readError } = await supabase
    .from('atlas_processing_jobs').select('id,status,attempts').eq('idempotency_key', key).maybeSingle();
  if (readError) throw readError;
  if (existing?.status === 'done') return { skipped: true };

  const job = {
    user_id: uid,
    source_entry_id: entryId,
    job_type: 'compile',
    status: 'running',
    attempts: (existing?.attempts || 0) + 1,
    idempotency_key: key,
    processing_version: VERSION,
    updated_at: new Date().toISOString(),
    error: null,
  };
  const saved = existing
    ? await supabase.from('atlas_processing_jobs').update(job).eq('id', existing.id)
    : await supabase.from('atlas_processing_jobs').insert(job);
  if (saved.error) throw saved.error;

  try {
    const { data: row, error } = await supabase.from('journal_entries')
      .select('id,user_id,topic_id,body,key_points,topics(title,prerequisite_id,subfields(fields(name)))')
      .eq('id', entryId).maybeSingle();
    if (error) throw error;
    if (!row || row.user_id !== uid) throw new Error('Entry not found.');

    let prerequisite = null;
    if (row.topics?.prerequisite_id) {
      const pre = await supabase.from('topics').select('id,title,subfields(fields(name))').eq('id', row.topics.prerequisite_id).maybeSingle();
      prerequisite = pre.data;
    }

    const known = await supabase.from('atlas_concepts')
      .select('id,name,normalized_name,discipline,description,status').eq('user_id', uid);
    if (known.error) throw known.error;

    const record = compileRecord({
      topic_id: row.topic_id,
      topic_title: row.topics?.title,
      discipline: row.topics?.subfields?.fields?.name || null,
      body: row.body,
      key_points: row.key_points || [],
      prerequisite_title: prerequisite?.title || null,
      prerequisite_id: prerequisite?.id || null,
      prerequisite_discipline: prerequisite?.subfields?.fields?.name || null,
    }, known.data || []);

    const idByKey = new Map((known.data || []).map(concept => [concept.normalized_name, concept.id]));
    for (const concept of record.concepts) {
      if (idByKey.has(concept.key)) continue;
      const inserted = await supabase.from('atlas_concepts').insert({
        user_id: uid,
        name: concept.name,
        normalized_name: concept.key,
        description: concept.description || null,
        category: concept.category || 'concept',
        discipline: concept.discipline,
        status: 'candidate',
        metadata: { origin: concept.origin, topic_id: concept.topic_id },
      }).select('id').single();
      if (inserted.error) {
        const again = await supabase.from('atlas_concepts').select('id').eq('user_id', uid).eq('normalized_name', concept.key).maybeSingle();
        if (!again.data) throw inserted.error;
        idByKey.set(concept.key, again.data.id);
      } else {
        idByKey.set(concept.key, inserted.data.id);
      }
      if (normalizeName(concept.name) !== concept.key) {
        await supabase.from('atlas_aliases').upsert({
          user_id: uid,
          concept_id: idByKey.get(concept.key),
          alias: concept.name,
          normalized_alias: concept.key,
        }, { onConflict: 'user_id,normalized_alias', ignoreDuplicates: true });
      }
    }

    const priorClaims = await supabase.from('atlas_claims').select('id').contains('provenance', { entry_id: entryId }).limit(1);
    if (!priorClaims.data?.length) {
      for (const claim of record.claims) {
        const conceptId = idByKey.get(claim.conceptKey);
        if (!conceptId) continue;
        const wrote = await supabase.from('atlas_claims').insert({
          user_id: uid,
          concept_id: conceptId,
          claim_text: claim.claim_text,
          claim_type: claim.claim_type,
          source_span: claim.source_span,
          provenance: { entry_id: entryId, origin: 'compiler' },
        });
        if (wrote.error) throw wrote.error;
      }
    }

    for (const concept of record.concepts) {
      const conceptId = idByKey.get(concept.key);
      if (!conceptId) continue;
      await supabase.from('atlas_evidence').upsert({
        user_id: uid, concept_id: conceptId, journal_entry_id: entryId, kind: 'journal',
      }, { onConflict: 'user_id,concept_id,journal_entry_id', ignoreDuplicates: true });
    }

    for (const edge of record.edges) {
      const source = idByKey.get(edge.sourceKey);
      const target = idByKey.get(edge.targetKey);
      if (!source || !target || source === target) continue;
      await supabase.from('atlas_edges').upsert({
        user_id: uid,
        source_id: source,
        target_id: target,
        relationship: edge.relationship,
        confidence: edge.confidence,
        verification: 'candidate',
        origin: edge.origin,
        evidence: edge.evidence || {},
      }, { onConflict: 'user_id,source_id,target_id,relationship', ignoreDuplicates: true });
    }

    for (const discovery of record.discoveries) {
      const ids = discovery.keys.map(item => idByKey.get(item)).filter(Boolean);
      if (ids.length < 2) continue;
      await supabase.from('atlas_discoveries').upsert({
        user_id: uid,
        concept_ids: ids,
        discovery_type: discovery.discovery_type,
        title: discovery.title,
        explanation: discovery.explanation,
        score: discovery.score,
        verification: 'candidate',
        evidence: discovery.evidence,
      }, { onConflict: 'user_id,title', ignoreDuplicates: true });
    }

    await finishJob(key, { status: 'done', error: null });
    return { ok: true, concepts: record.concepts.length };
  } catch (error) {
    await finishJob(key, { status: 'failed', error: String(error.message || error).slice(0, 500) });
    throw error;
  }
}

export async function loadAtlas(uid) {
  const [concepts, edges, discoveries, mastery, challenges, evidence, claims] = await Promise.all([
    supabase.from('atlas_concepts').select('*').eq('user_id', uid).order('updated_at', { ascending: false }),
    supabase.from('atlas_edges').select('*').eq('user_id', uid),
    supabase.from('atlas_discoveries').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    supabase.from('atlas_mastery').select('*').eq('user_id', uid),
    supabase.from('atlas_challenges').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(40),
    supabase.from('atlas_evidence').select('id,concept_id,journal_entry_id,created_at').eq('user_id', uid),
    supabase.from('atlas_claims').select('id,concept_id,claim_text,verification,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(200),
  ]);
  for (const result of [concepts, edges, discoveries, mastery, challenges, evidence, claims]) {
    if (result.error) throw result.error;
  }
  const masteryById = new Map((mastery.data || []).map(row => [row.concept_id, row]));
  const visible = (concepts.data || []).filter(concept => concept.status !== 'archived');
  return {
    concepts: concepts.data || [],
    edges: edges.data || [],
    discoveries: discoveries.data || [],
    mastery: mastery.data || [],
    challenges: challenges.data || [],
    evidence: evidence.data || [],
    claims: claims.data || [],
    opportunities: rankOpportunities(visible.map(concept => ({
      ...concept,
      origin: concept.metadata?.origin,
    })), edges.data || [], masteryById),
  };
}

export async function createConcept(uid, { name, discipline, description }) {
  const key = canonicalKey(name);
  if (!key) throw new Error('Give the concept a name.');
  const { data, error } = await supabase.from('atlas_concepts').insert({
    user_id: uid,
    name: name.trim(),
    normalized_name: key,
    description: description?.trim() || null,
    discipline: discipline?.trim() || null,
    category: 'concept',
    status: 'candidate',
    metadata: { origin: 'manual' },
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function createEdge(uid, { sourceId, targetId, relationship }) {
  if (!RELATIONSHIPS.includes(relationship)) throw new Error('Choose a relationship.');
  if (!sourceId || !targetId || sourceId === targetId) throw new Error('Choose two different concepts.');
  const { data, error } = await supabase.from('atlas_edges').insert({
    user_id: uid,
    source_id: sourceId,
    target_id: targetId,
    relationship,
    confidence: 1,
    verification: 'candidate',
    origin: 'manual',
    evidence: { by: 'user' },
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function setEdgeVerification(uid, id, verification) {
  const { error } = await supabase.from('atlas_edges').update({ verification }).eq('id', id).eq('user_id', uid);
  if (error) throw error;
}

export async function setConceptStatus(uid, id, status) {
  const { error } = await supabase.from('atlas_concepts')
    .update({ status, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', uid);
  if (error) throw error;
}

export async function setDiscoveryVerification(uid, id, verification) {
  const { error } = await supabase.from('atlas_discoveries').update({ verification }).eq('id', id).eq('user_id', uid);
  if (error) throw error;
  await supabase.from('atlas_feedback').insert({
    user_id: uid, target_type: 'discovery', target_id: id, action: verification,
  });
}

export async function openChallenge(uid, concept, mastery) {
  const draft = makeChallenge(concept, mastery);
  const { data, error } = await supabase.from('atlas_challenges').insert({
    user_id: uid,
    concept_id: concept.id,
    kind: draft.kind,
    title: draft.title,
    prompt: draft.prompt,
    difficulty: draft.difficulty,
    rubric: draft.rubric,
    status: 'open',
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function submitChallenge(uid, challenge, concept, claims, response, predicted) {
  const judged = scoreAnswer(concept, claims, response);
  if (judged.score == null) throw new Error(judged.note);
  const y = judged.score >= 0.6 ? 1 : 0;
  const { data: assessment, error: assessmentError } = await supabase.from('atlas_assessments').insert({
    user_id: uid,
    challenge_id: challenge.id,
    concept_id: concept.id,
    response: response.slice(0, 4000),
    predicted: predicted == null ? null : predicted,
    score: judged.score,
    result: { ...judged, y, rubric: challenge.rubric },
  }).select('id').single();
  if (assessmentError) throw assessmentError;
  await supabase.from('atlas_challenges').update({ status: 'answered' }).eq('id', challenge.id).eq('user_id', uid);

  const dimension = challenge.kind === 'reconstruction' ? 'recall'
    : challenge.kind === 'application' ? 'application'
    : challenge.kind === 'transfer' ? 'transfer'
    : 'explanation';
  const current = await supabase.from('atlas_mastery').select('*').eq('concept_id', concept.id).maybeSingle();
  const next = applyAssessment(current.data || emptyMastery(), dimension, judged.score);
  const row = {
    concept_id: concept.id,
    user_id: uid,
    recall: next.recall,
    explanation: next.explanation,
    application: next.application,
    transfer: next.transfer,
    retention: next.retention,
    n_recall: next.n_recall,
    n_explanation: next.n_explanation,
    n_application: next.n_application,
    n_transfer: next.n_transfer,
    n_retention: next.n_retention,
    uncertainty: next.uncertainty,
    last_assessed: next.last_assessed,
    algorithm_version: next.algorithm_version,
  };
  const wrote = await supabase.from('atlas_mastery').upsert(row);
  if (wrote.error) throw wrote.error;
  if (judged.score < 0.45 && concept.metadata?.topic_id) {
    await supabase.from('atlas_concepts').update({
      metadata: { ...concept.metadata, reinforce: true },
      updated_at: new Date().toISOString(),
    }).eq('id', concept.id).eq('user_id', uid);
  }
  return { ...judged, assessmentId: assessment.id };
}

export async function disputeAssessment(uid, assessmentId, note) {
  const { error } = await supabase.from('atlas_feedback').insert({
    user_id: uid, target_type: 'assessment', target_id: assessmentId, action: 'dispute', note: note || null,
  });
  if (error) throw error;
}
