// Parallax: measurement-validity report. It never rewrites a prediction.
import { daysBetween, recallProbability } from './memory.js';
import { WEAK_SCORE, COOLDOWN_DAYS } from './recall.js';

export const PARALLAX_VERSION = 'p1';
export { WEAK_SCORE, COOLDOWN_DAYS };

const BANDS = [[0, 0.5], [0.5, 0.7], [0.7, 0.85], [0.85, 1]];

export function wilsonInterval(successes, n, z = 1.96) {
  if (!n) return { low: null, high: null, mean: null };
  const phat = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (phat + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((phat * (1 - phat) + z2 / (4 * n)) / n)) / denom;
  return {
    mean: phat,
    low: Math.min(1, Math.max(0, centre - margin)),
    high: Math.min(1, Math.max(0, centre + margin)),
  };
}

export function corrected(value, eps) {
  if (!eps) return Math.min(1, Math.max(0, value));
  const denom = 1 - 2 * eps;
  if (denom === 0) return Math.min(1, Math.max(0, value));
  return Math.min(1, Math.max(0, (value - eps) / denom));
}

export function identifiedSet(low, high, epsMax) {
  const points = [corrected(low, 0), corrected(high, 0), corrected(low, epsMax), corrected(high, epsMax)];
  return { min: Math.min(...points), max: Math.max(...points) };
}

function direction(pbar, set) {
  if (pbar == null || set.min == null) return 'unknown';
  if (pbar > set.max) return 'optimistic';
  if (pbar < set.min) return 'pessimistic';
  return 'none';
}

export function gapReport(rows, { epsMax = 0.2, threshold = WEAK_SCORE } = {}) {
  const graded = (rows || []).filter(row => row && row.verifier && row.verifier !== 'local' && row.p != null && row.score != null);
  const n = graded.length;
  if (n < 20) {
    return { status: 'insufficient evidence yet', n, pbar: null, interval: null, set: null, epsMax, threshold };
  }
  const y = graded.map(row => (row.score >= threshold ? 1 : 0));
  const successes = y.reduce((sum, value) => sum + value, 0);
  const interval = wilsonInterval(successes, n);
  const set = identifiedSet(interval.low, interval.high, epsMax);
  const pbar = graded.reduce((sum, row) => sum + Number(row.p), 0) / n;
  return { status: direction(pbar, set), n, pbar, interval, set, epsMax, threshold, ybar: interval.mean };
}

export function agreedGap(rows, epsMax = 0.2) {
  const reports = [50, 60, 70].map(threshold => gapReport(rows, { epsMax, threshold }));
  if (reports.some(report => report.status === 'insufficient evidence yet')) {
    return { ...reports[1], status: 'insufficient evidence yet', reports };
  }
  const flags = reports.map(report => report.status);
  const same = flags.every(flag => flag === flags[0]);
  if (!same) return { ...reports[1], status: 'threshold-sensitive', reports };
  return { ...reports[1], reports };
}

export function aucScore(pairs) {
  const usable = (pairs || []).filter(pair => pair && pair.c != null && (pair.y === 0 || pair.y === 1));
  const pos = usable.filter(pair => pair.y === 1);
  const neg = usable.filter(pair => pair.y === 0);
  const n1 = pos.length;
  const n0 = neg.length;
  if (n1 < 5 || n0 < 5) return { auc: null, se: null, n1, n0, flag: false, reason: 'insufficient' };
  let wins = 0;
  for (const good of pos) {
    for (const bad of neg) {
      if (good.c > bad.c) wins += 1;
      else if (good.c === bad.c) wins += 0.5;
    }
  }
  const auc = wins / (n1 * n0);
  const q1 = auc / (2 - auc);
  const q2 = (2 * auc * auc) / (1 + auc);
  const se2 = (auc * (1 - auc) + (n1 - 1) * (q1 - auc * auc) + (n0 - 1) * (q2 - auc * auc)) / (n1 * n0);
  const se = Math.sqrt(Math.max(0, se2));
  return { auc, se, n1, n0, flag: auc - 1.96 * se > 0.5, reason: null };
}

function betaVar(a, b) {
  const total = a + b;
  return (a * b) / (total * total * (total + 1));
}

export function probeGain(successes, failures) {
  const a = 1 + successes;
  const b = 1 + failures;
  const q = a / (a + b);
  const current = betaVar(a, b);
  const next = q * betaVar(a + 1, b) + (1 - q) * betaVar(a, b + 1);
  return current - next;
}

export function illusionList(rows, limit = 10) {
  return (rows || [])
    .filter(row => row && row.y === 0 && (row.c >= 4 || row.p >= 0.8))
    .sort((a, b) => String(a.topic_id).localeCompare(String(b.topic_id)) || String(a.entry_id).localeCompare(String(b.entry_id)))
    .slice(0, limit);
}

export function bandTable(rows, epsMax = 0.2) {
  return BANDS.map(([low, high]) => {
    const inside = (rows || []).filter(row => row && row.verifier !== 'local' && row.p != null && row.p >= low && (high === 1 ? row.p <= high : row.p < high));
    const report = gapReport(inside.map(row => ({ ...row })), { epsMax, threshold: WEAK_SCORE });
    return {
      low,
      high,
      n: inside.length,
      set: report.set,
      status: inside.length < 20 ? 'insufficient evidence yet' : report.status,
    };
  });
}

export function rankProbes(topics) {
  return (topics || [])
    .map(topic => ({ ...topic, gain: probeGain(topic.successes || 0, topic.failures || 0) }))
    .sort((a, b) => b.gain - a.gain || (b.stake || 0) - (a.stake || 0) || String(a.topic_id).localeCompare(String(b.topic_id)));
}

export function parallaxReport(rows, { epsMax = 0.2 } = {}) {
  const gap = agreedGap(rows, epsMax);
  const confidence = aucScore((rows || []).filter(row => row.c != null).map(row => ({ c: row.c, y: row.y })));
  const prediction = aucScore((rows || []).map(row => ({ c: row.p, y: row.y })));
  const distinguishable = confidence.auc != null && prediction.auc != null && confidence.se != null && prediction.se != null
    ? Math.abs(confidence.auc - prediction.auc) > 1.96 * Math.sqrt(confidence.se ** 2 + prediction.se ** 2)
    : false;
  return {
    version: PARALLAX_VERSION,
    epsMax,
    gap,
    confidence,
    predictionAuc: prediction,
    distinguishable,
    illusions: illusionList(rows),
    bands: bandTable(rows, epsMax),
    assumption: `Quiz grading is done by a small AI model or a keyword matcher, so some results are wrong; Orbit assumes at most ${Math.round(epsMax * 100)} percent are.`,
  };
}

export function pairProbe(event, question, fit) {
  if (!event || event.stability_after == null || !question) return null;
  const eventDay = new Date(event.reviewed_at).toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
  const askedDay = new Date(question.asked_at).toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
  if (String(event.reviewed_at) >= String(question.asked_at)) return null;
  const t = daysBetween(eventDay, askedDay);
  const p = recallProbability(t, Number(event.stability_after), fit?.k ?? 1);
  return {
    p,
    y: question.score >= WEAK_SCORE ? 1 : 0,
    c: event.confidence == null ? null : Number(event.confidence),
    score: question.score,
    verifier: question.verifier,
    topic_id: question.topic_id,
    entry_id: question.entry_id,
    band: question.band,
  };
}
