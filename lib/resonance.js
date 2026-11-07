// Resonance: conceptual gravity between what you have already learned.
// The field densifies as journal entries accumulate. Shared concepts,
// especially across different fields, become visible bridges.

import { supabase } from './supabase';

const STOP = new Set([
  'the','and','for','are','but','not','you','all','can','her','was','one','our','out','day','get','has','him','his','how','man','new','now','old','see','two','way','who','boy','did','its','let','put','say','she','too','use','with','from','that','this','have','will','your','about','into','than','them','then','they','what','when','where','which','while','would','could','should','been','being','also','just','like','more','some','such','very','into','over','under','after','before','between','through','during','without','within','among','across','against','around','because','therefore','however','although','though','while','where','when','why','how','what','which','who','whom','whose','these','those','there','here','then','than','that','this','those','these','their','they','them','then','than','that','with','from','have','will','would','could','should','been','being','also','just','like','more','some','such','very','into','over','under','after','before','between','through','during','without','within','among','across','against','around','because','therefore','however','although','though'
]);

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w));
}

function unique(arr) {
  return [...new Set(arr)];
}

function jaccard(a, b) {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const x of setA) if (setB.has(x)) inter++;
  const union = setA.size + setB.size - inter;
  return union ? inter / union : 0;
}

function sharedTerms(a, b, limit = 6) {
  const setB = new Set(b);
  const hits = a.filter(t => setB.has(t));
  const freq = {};
  hits.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
  return Object.entries(freq)
    .sort((x, y) => y[1] - x[1])
    .slice(0, limit)
    .map(([term]) => term);
}

export async function loadResonance(uid, { limit = 120 } = {}) {
  const { data, error } = await supabase
    .from('journal_entries')
    .select(`
      id, body, key_points, confidence, created_at, tags,
      topics(title, difficulty, subfields(name, fields(name)))
    `)
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  if (!data?.length) return emptyField();

  // Aggregate terms and metadata per topic
  const topics = new Map();

  for (const row of data) {
    const topic = row.topics;
    if (!topic) continue;
    const key = topic.title;
    if (!topics.has(key)) {
      topics.set(key, {
        title: key,
        field: topic.subfields?.fields?.name || 'Unknown',
        subfield: topic.subfields?.name || '',
        difficulty: topic.difficulty,
        terms: [],
        entries: [],
        avgConfidence: 0,
        confidences: [],
      });
    }
    const t = topics.get(key);
    const terms = unique([
      ...tokenize((row.key_points || []).join(' ')),
      ...tokenize(row.body || '').slice(0, 40),
    ]);
    t.terms.push(...terms);
    t.entries.push({
      id: row.id,
      excerpt: (row.body || '').slice(0, 180).trim() + ((row.body || '').length > 180 ? '…' : ''),
      keyPoints: row.key_points || [],
      confidence: row.confidence,
      created: row.created_at,
    });
    if (typeof row.confidence === 'number') t.confidences.push(row.confidence);
  }

  for (const t of topics.values()) {
    t.terms = unique(t.terms);
    t.avgConfidence = t.confidences.length
      ? t.confidences.reduce((a, b) => a + b, 0) / t.confidences.length
      : null;
  }

  const topicList = [...topics.values()].filter(t => t.terms.length >= 3);

  // Pairwise resonances
  const pairs = [];
  for (let i = 0; i < topicList.length; i++) {
    for (let j = i + 1; j < topicList.length; j++) {
      const a = topicList[i];
      const b = topicList[j];
      const score = jaccard(a.terms, b.terms);
      if (score < 0.08) continue;
      const shared = sharedTerms(a.terms, b.terms);
      if (shared.length < 2) continue;
      pairs.push({
        a: a.title,
        b: b.title,
        fieldA: a.field,
        fieldB: b.field,
        score: Math.round(score * 1000) / 1000,
        shared,
        crossField: a.field !== b.field,
        strength: score * (a.field !== b.field ? 1.35 : 1),
      });
    }
  }

  pairs.sort((x, y) => y.strength - x.strength);

  const connected = new Set();
  pairs.slice(0, 40).forEach(p => { connected.add(p.a); connected.add(p.b); });

  const density = topicList.length
    ? Math.round((connected.size / topicList.length) * 100)
    : 0;

  // Synthesis prompts from strongest cross-field pairs
  const bridges = pairs
    .filter(p => p.crossField && p.shared.length >= 2)
    .slice(0, 5)
    .map(p => ({
      prompt: `How does ${p.shared[0]} in “${p.a}” relate to ${p.shared[1] || p.shared[0]} in “${p.b}”?`,
      topics: [p.a, p.b],
      shared: p.shared.slice(0, 3),
    }));

  return {
    topics: topicList.map(t => ({
      title: t.title,
      field: t.field,
      termCount: t.terms.length,
      entryCount: t.entries.length,
      avgConfidence: t.avgConfidence,
    })),
    resonances: pairs.slice(0, 18),
    density,
    bridges,
    entryCount: data.length,
    topicCount: topicList.length,
  };
}

export async function loadWeaves(uid) {
  const { data, error } = await supabase
    .from('resonance_weaves')
    .select('id,prompt,topics,shared,created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(12);
  if (error) throw error;
  return data ?? [];
}

export async function saveWeave(uid, bridge) {
  const { error } = await supabase.from('resonance_weaves').insert({
    user_id: uid,
    prompt: String(bridge.prompt || '').slice(0, 500),
    topics: (bridge.topics || []).slice(0, 4),
    shared: (bridge.shared || []).slice(0, 6),
  });
  if (error) throw error;
}

function emptyField() {
  return {
    topics: [],
    resonances: [],
    density: 0,
    bridges: [],
    entryCount: 0,
    topicCount: 0,
  };
}

export function resonancePhrase(density) {
  if (density === 0) return 'The field is still quiet. Journal with clear key points and it will begin to answer.';
  if (density < 20) return 'First threads are appearing.';
  if (density < 45) return 'A living web is forming.';
  if (density < 70) return 'Strong conceptual gravity.';
  return 'A dense, resonant knowledge field.';
}
