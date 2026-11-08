import { supabase } from './supabase';
import { addDays } from './dates';
import {
  gradeFromConfidence, observedRecall, initialMemory, recallProbability,
  nextStability, nextDifficulty, targetInterval, fitPersonal, predictRecall,
  recallPhrase, validateChronological, calibrationBands, daysBetween, asFitRows,
} from './memory.js';

const TZ = 'Africa/Nairobi';

export function reviewDay(iso) {
  return new Date(iso || Date.now()).toLocaleDateString('en-CA', { timeZone: TZ });
}

export async function advanceReview({ uid, topicId, quality, entry, current }) {
  const grade = gradeFromConfidence(quality);
  const day = reviewDay(entry?.reviewedAt);
  const history = await supabase.from('review_events')
    .select('reviewed_at,elapsed_days,stability_before,observed_recall,derived')
    .eq('user_id', uid)
    .eq('derived', false);
  if (history.error) throw history.error;
  const fit = fitPersonal(asFitRows(history.data));
  const priorS = current?.stability == null ? null : Number(current.stability);
  const priorD = current?.difficulty == null ? null : Number(current.difficulty);
  const elapsed = priorS == null || !current?.last_reviewed_on ? 0 : daysBetween(current.last_reviewed_on, day);
  let stability;
  let difficulty;
  if (priorS == null) {
    const initial = initialMemory(grade);
    stability = initial.stability;
    difficulty = initial.difficulty;
  } else {
    const predicted = recallProbability(elapsed, priorS, fit.k);
    stability = nextStability(priorS, priorD ?? 5, grade, predicted);
    difficulty = nextDifficulty(priorD ?? 5, grade);
  }
  const dueOn = addDays(day, targetInterval(stability, fit.k));
  if (entry?.id) {
    const wrote = await supabase.from('review_events').upsert({
      id: entry.id,
      user_id: uid,
      topic_id: topicId,
      reviewed_at: entry.reviewedAt || new Date().toISOString(),
      confidence: quality,
      grade,
      observed_recall: observedRecall(grade),
      elapsed_days: elapsed,
      stability_before: priorS,
      difficulty_before: priorD,
      k_used: fit.k,
      stability_after: stability,
      difficulty_after: difficulty,
      derived: false,
    }, { onConflict: 'id', ignoreDuplicates: true });
    if (wrote.error) throw wrote.error;
  }
  return { due_on: dueOn, stability, difficulty, reviewed_on: day, k: fit.k };
}

export async function loadRecallView(uid) {
  const [events, reviews] = await Promise.all([
    supabase.from('review_events')
      .select('id,topic_id,reviewed_at,elapsed_days,stability_before,observed_recall,derived')
      .eq('user_id', uid)
      .order('reviewed_at', { ascending: true }),
    supabase.from('reviews')
      .select('topic_id,due_on,stability,difficulty,last_reviewed_on,topics(title)')
      .eq('user_id', uid),
  ]);
  if (events.error) throw events.error;
  if (reviews.error) throw reviews.error;
  const rows = asFitRows(events.data);
  const fit = fitPersonal(rows);
  const validation = validateChronological(rows);
  const today = reviewDay();
  const points = (reviews.data || []).filter(row => row.stability != null).map(row => {
    const t = row.last_reviewed_on ? daysBetween(row.last_reviewed_on, today) : 0;
    const prediction = predictRecall(t, Number(row.stability), fit);
    return {
      id: row.topic_id,
      name: row.topics?.title || 'Topic',
      due: row.due_on,
      stability: Number(row.stability),
      ...prediction,
      phrase: recallPhrase(prediction, fit.n),
    };
  });
  return { fit, validation, bands: calibrationBands(heldOut(rows), validation.k), points };
}

function heldOut(rows) {
  const sorted = rows.filter(row => row.t > 0 && row.stabilityBefore != null && !row.derived)
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return sorted.slice(Math.floor(sorted.length * 0.7));
}

async function pageAll(run) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await run().range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

export async function loadKeystoneInputs(uid) {
  const today = reviewDay();
  const [concepts, edges, evidence, reviews, events, entries] = await Promise.all([
    pageAll(() => supabase.from('atlas_concepts').select('id,status,name').eq('user_id', uid)),
    pageAll(() => supabase.from('atlas_edges').select('source_id,target_id,relationship,confidence,verification').eq('user_id', uid)),
    pageAll(() => supabase.from('atlas_evidence').select('concept_id,journal_entry_id').eq('user_id', uid)),
    pageAll(() => supabase.from('reviews').select('topic_id,due_on,stability,last_reviewed_on,topics(title)').eq('user_id', uid)),
    pageAll(() => supabase.from('review_events').select('id,topic_id,reviewed_at,elapsed_days,stability_before,stability_after,observed_recall,derived,confidence').eq('user_id', uid)),
    pageAll(() => supabase.from('journal_entries').select('id,topic_id').eq('user_id', uid)),
  ]);
  const topicByEntry = new Map((entries || []).map(entry => [entry.id, entry.topic_id]));
  return {
    today,
    concepts: concepts || [],
    edges: edges || [],
    evidence: (evidence || []).map(row => ({ concept_id: row.concept_id, topic_id: topicByEntry.get(row.journal_entry_id) })).filter(row => row.topic_id),
    reviews: (reviews || []).map(row => ({ topic_id: row.topic_id, title: row.topics?.title || 'Topic', due_on: row.due_on, stability: row.stability, last_reviewed_on: row.last_reviewed_on })),
    events: events || [],
    names: Object.fromEntries((concepts || []).map(concept => [concept.id, concept.name])),
  };
}

export async function loadParallaxInputs(uid) {
  const [questions, events] = await Promise.all([
    pageAll(() => supabase.from('recall_questions').select('id,entry_id,topic_id,topic_title,asked_at,score,verifier,band').eq('user_id', uid)),
    pageAll(() => supabase.from('review_events').select('id,topic_id,reviewed_at,stability_after,confidence,derived,observed_recall,elapsed_days,stability_before').eq('user_id', uid)),
  ]);
  return { questions: questions || [], events: events || [] };
}
