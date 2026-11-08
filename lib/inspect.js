// Evidence drawers. Pure builders only. No React, no Supabase, no jsPDF.
import { explainWeight } from './selector.js';
import { gradeFromConfidence, nextStability, nextDifficulty, targetInterval, daysBetween } from './memory.js';
import { addDays } from './dates.js';
import { RECORDS } from './navMap.js';

const DASH = '\u2014';

export function show(value) {
  if (value == null || value === '') return DASH;
  if (typeof value === 'number' && !Number.isFinite(value)) return DASH;
  return String(value);
}

function drawer({ title, verdict, numbers, method, provenance, controls, raw }) {
  return {
    title,
    verdict,
    numbers: numbers || [],
    method,
    provenance: provenance || { tables: [], rows: null, updated: null, version: null },
    controls: controls || [],
    raw: raw || {},
  };
}

export function topicChoiceDrawer(topic, ctx, mode, level, meta = {}) {
  const explanation = explainWeight(topic, ctx, mode, level);
  return drawer({
    title: 'Why this topic',
    verdict: meta.recomputed
      ? 'Recomputed now, may differ from the moment it was chosen.'
      : `Estimated weight ${explanation.weight} in the ${mode} draw.`,
    numbers: [
      { label: 'Mode share', value: show(meta.share) },
      { label: 'Level', value: show(level) },
      { label: 'Pool', value: show(meta.pool) },
      { label: 'Weight', value: show(explanation.weight) },
      ...explanation.factors.map(factor => ({ label: factor.label, value: show(factor.value) })),
    ],
    method: 'The weight is the product of the mark, a recent-field factor, reinforcement, a level match and an Atlas factor. The mode shares are 70, 15, 10 and 5. A prerequisite can replace the draw.',
    provenance: { tables: ['assignments', 'topic_controls'], rows: meta.pool ?? null, updated: meta.updated || null, version: 'selector' },
    controls: [],
    raw: { factors: explanation.factors, weight: explanation.weight, replaced: Boolean(meta.replaced) },
  });
}

export function whatIfRows(review, fit, today) {
  const priorS = review?.stability == null ? null : Number(review.stability);
  const priorD = review?.difficulty == null ? null : Number(review.difficulty);
  const elapsed = priorS == null || !review?.last_reviewed_on ? 0 : daysBetween(review.last_reviewed_on, today);
  return [0, 1, 2, 3, 4, 5].map(confidence => {
    const grade = gradeFromConfidence(confidence);
    if (priorS == null || grade == null) {
      return { confidence, due: null, stability: null };
    }
    const stability = nextStability(priorS, priorD ?? 5, grade, null);
    const due = addDays(today, targetInterval(stability, fit?.k ?? 1));
    return { confidence, due, stability, difficulty: nextDifficulty(priorD ?? 5, grade) };
  });
}

export function reviewDrawer(review, fit, today) {
  const rows = whatIfRows(review, fit, today);
  return drawer({
    title: 'How reviews are scheduled',
    verdict: review?.stability == null ? 'No stability is stored yet, so the estimate stays unknown.' : 'Estimated recall uses the stored stability and your personal multiplier.',
    numbers: [
      { label: 'Ease', value: show(review?.ease) },
      { label: 'Reps', value: show(review?.reps) },
      { label: 'Interval (days)', value: show(review?.interval_days) },
      { label: 'Stability (days)', value: show(review?.stability) },
      { label: 'Difficulty', value: show(review?.difficulty) },
      { label: 'Last reviewed', value: show(review?.last_reviewed_on) },
      { label: 'Personal multiplier', value: show(fit?.k) },
      { label: 'Events', value: show(fit?.n) },
    ],
    method: 'SM-2 still stores ease, reps and interval. The memory model stores stability and difficulty. A rating from 0 to 5 is converted with the existing grade function, then the next stability and the 90 percent interval. Nothing in this table is written.',
    provenance: { tables: ['reviews', 'review_events'], rows: fit?.n ?? null, updated: review?.last_reviewed_on || null, version: 'memory' },
    controls: [],
    raw: { whatIf: rows },
  });
}

export function dataBackupMembers() {
  return RECORDS.filter(row => row.cluster === 'Data and backup');
}

export function dataBackupCard(snapshot = {}) {
  const members = dataBackupMembers();
  return drawer({
    title: 'Data and backup',
    verdict: 'Backup, restore, the PDF, storage, the offline queue and Drive stay in one place. Restore never runs from this card.',
    numbers: [
      { label: 'Last backup', value: show(snapshot.lastBackup) },
      { label: 'Queue', value: show(snapshot.queue) },
      { label: 'Drive', value: show(snapshot.drive) },
      { label: 'Storage', value: show(snapshot.storage) },
    ],
    method: 'Counts come from the backup file time, the offline queue, the Drive session and the storage meter. Sync now only sends the existing queue.',
    provenance: { tables: ['profiles'], rows: snapshot.queue ?? null, updated: snapshot.lastBackup || null, version: 'backup-6' },
    controls: members.map(row => ({
      id: row.id,
      title: row.title,
      route: row.route || null,
      action: row.action || null,
    })),
    raw: { members: members.map(row => row.id) },
  });
}

export function cardShell(title, verdict, numbers) {
  return drawer({
    title,
    verdict,
    numbers: numbers || [],
    method: 'Status is computed from the counts on this card. Unknown stays unknown.',
    provenance: { tables: [], rows: null, updated: null, version: null },
    controls: [],
    raw: {},
  });
}

const SECRET = /secret|password|api[_-]?key|token/i;

export function hasSecretKey(value) {
  if (!value || typeof value !== 'object') return false;
  for (const [key, child] of Object.entries(value)) {
    if (SECRET.test(key)) return true;
    if (child && typeof child === 'object' && hasSecretKey(child)) return true;
  }
  return false;
}
