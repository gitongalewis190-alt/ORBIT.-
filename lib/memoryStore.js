import { supabase } from './supabase';
import { addDays } from './dates';
import {
  gradeFromConfidence, observedRecall, initialMemory, recallProbability,
  nextStability, nextDifficulty, targetInterval, fitPersonal, predictRecall,
  recallPhrase, validateChronological, calibrationBands, daysBetween,
} from './memory.js';

const TZ = 'Africa/Nairobi';

export function reviewDay(iso) {
  return new Date(iso || Date.now()).toLocaleDateString('en-CA', { timeZone: TZ });
}

function asFitRows(rows) {
  return (rows || []).map(row => ({
    t: Number(row.elapsed_days),
    stabilityBefore: row.stability_before,
    y: row.observed_recall,
    at: row.reviewed_at,
    derived: row.derived,
    backfilled: row.derived,
  }));
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
