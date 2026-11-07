// Recall: pure selection and scoring. No imports, so it bundles and tests cleanly.
//
// Selection is two-stage randomness so recent entries cannot crowd out old ones:
//   1. pick an age band uniformly at random (yesterday, weeks, months, a year+)
//   2. pick an entry inside that band, weighted toward weak results and untested entries
// Anything asked within COOLDOWN_DAYS is skipped unless nothing else is left.

export const BANDS = [
  { key: '1d', min: 1, max: 6, label: 'Yesterday to six days ago' },
  { key: '1w', min: 7, max: 29, label: 'One to four weeks ago' },
  { key: '1m', min: 30, max: 89, label: 'One to three months ago' },
  { key: '3m', min: 90, max: 364, label: 'Three to twelve months ago' },
  { key: '1y', min: 365, max: Infinity, label: 'A year or more ago' },
];

export const COOLDOWN_DAYS = 14;
export const WEAK_SCORE = 60;
const DAY_MS = 86400000;

export function ageInDays(createdAt, now = Date.now()) {
  return Math.floor((now - new Date(createdAt).getTime()) / DAY_MS);
}

export function bandFor(days) {
  return BANDS.find(b => days >= b.min && days <= b.max) ?? null;
}

// Weight inside a band. Weak past scores count more, untested entries count a little more.
export function entryWeight(c) {
  let w = 1;
  if (c.lastScore == null) w *= 1.4;
  else if (c.lastScore < 40) w *= 2.8;
  else if (c.lastScore < WEAK_SCORE) w *= 2.2;
  else if (c.lastScore < 80) w *= 1.35;
  return w;
}

export function weightedPick(items, weights, rng) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

// candidates: [{ id, topic_id, topic_title, created_at, lastScore }]
// recentAsks: { [entryId]: askedAtMs }
export function pickRecall(candidates, { now = Date.now(), rng = Math.random, recentAsks = {} } = {}) {
  const dated = candidates
    .map(c => ({ ...c, days: ageInDays(c.created_at, now) }))
    .filter(c => c.days >= 1 && bandFor(c.days));
  if (dated.length === 0) return null;

  const cooldownMs = COOLDOWN_DAYS * DAY_MS;
  const fresh = dated.filter(c => !recentAsks[c.id] || now - recentAsks[c.id] >= cooldownMs);
  const pool = fresh.length ? fresh : dated;

  const bands = BANDS.filter(b => pool.some(c => bandFor(c.days) === b));
  const band = bands[Math.floor(rng() * bands.length)];
  const inBand = pool.filter(c => bandFor(c.days) === band);

  const entry = weightedPick(inBand, inBand.map(entryWeight), rng);
  return { entry, band };
}

// The question shown to the learner. It always names the topic and the date logged.
export function buildQuestion(entry, dateLabel) {
  return `From ${dateLabel}, in your own words: what did you log about "${entry.topic_title}"? Include the key ideas you took from it.`;
}

const STOP = new Set((
  'the and for that with this from have into your what when were will they their about ' +
  'which would there been more also just than then them some such only other over could ' +
  'should because while where these those being does doing very much most make made each'
).split(' '));

export function terms(text) {
  const words = String(text || '').toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? [];
  return words.filter(w => !STOP.has(w));
}

// Key terms of the source: the most frequent content words, plus the learner's own key points.
export function keyTerms(source, limit = 15) {
  const freq = new Map();
  for (const w of terms(source.body)) freq.set(w, (freq.get(w) ?? 0) + 1);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit).map(([w]) => w);
  const fromPoints = terms((source.key_points ?? []).join(' '));
  return [...new Set([...fromPoints, ...top])];
}

// Local scorer. Used when no AI verifier answers, so grading always works.
export function heuristicReview(answer, source) {
  const keys = keyTerms(source);
  const answerSet = new Set(terms(answer));
  const covered = keys.filter(k => answerSet.has(k));
  const missed = keys.filter(k => !answerSet.has(k));

  let score = keys.length ? Math.round((100 * covered.length) / keys.length) : 0;
  const words = String(answer || '').trim().split(/\s+/).filter(Boolean).length;
  if (words < 5) score = Math.min(score, 30);

  const parts = [];
  if (covered.length) parts.push(`You recalled: ${covered.slice(0, 6).join(', ')}.`);
  if (missed.length) parts.push(`You missed: ${missed.slice(0, 6).join(', ')}.`);
  if (!parts.length) parts.push('Nothing in your answer matched the entry.');
  return { score, comment: parts.join(' '), verifier: 'local' };
}

export function clampScore(n) {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : null;
}
