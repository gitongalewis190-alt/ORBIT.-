// Heuristic starting values. The curve uses the power-law shape used by the
// FSRS family. These are not published trained weights and they are not facts
// about memory. Recency weighting is intentionally absent: it would add a free
// parameter this history cannot identify reliably.

export const MODEL = Object.freeze({
  F: 19 / 81,
  C: -0.5,
  target: 0.9,
  W0: Object.freeze([0.4, 1.2, 3.0, 8.0]),
  priorMean: 0,
  priorVariance: 0.25,
  kMin: 0.4,
  kMax: 2.5,
  gridSize: 41,
  minEvents: 8,
  earlyEvents: 30,
  probFloor: 1e-6,
});

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

export function gradeFromConfidence(confidence) {
  const value = Number(confidence);
  if (value <= 2) return 1;
  if (value === 3) return 2;
  if (value === 4) return 3;
  return 4;
}

// The only definition of observed recall in this feature. Confidence is not mastery.
export function observedRecall(grade) {
  return grade >= 2 ? 1 : 0;
}

// R(t) = (1 + F · t / (S · k))^C. Equals the target exactly when t = S · k.
export function recallProbability(t, stability, k = 1) {
  const time = Math.max(0, Number(t) || 0);
  const S = Math.max(Number(stability) || 0, 1e-9);
  const scale = Math.max(Number(k) || 0, 1e-9);
  const value = (1 + (MODEL.F * time) / (S * scale)) ** MODEL.C;
  return Number.isFinite(value) ? value : 0;
}

export function initialMemory(grade) {
  return {
    stability: MODEL.W0[grade - 1],
    difficulty: clamp(5 - 0.8 * (grade - 3), 1, 10),
  };
}

// Success gain is zero when R = 1 and positive when R < 1, because
// (exp(1.2·(1−R)) − 1) is the only term that can shrink the multiplier,
// and it is never negative for R in [0, 1]. S' is still guarded so a
// non-finite result cannot wipe a stored stability.
export function nextStability(stability, difficulty, grade, predicted) {
  const S = Number(stability);
  const D = clamp(Number(difficulty), 1, 10);
  const R = clamp(Number(predicted), 0, 1);
  if (grade >= 2) {
    const hardPenalty = grade === 2 ? 0.6 : 1;
    const easyBonus = grade === 4 ? 1.5 : 1;
    const gain = Math.exp(1.5) * (11 - D) * (S ** -0.15) * (Math.exp(1.2 * (1 - R)) - 1) * hardPenalty * easyBonus;
    const next = S * (1 + gain);
    if (!Number.isFinite(next) || next < S) return S;
    return next;
  }
  const raw = 1.2 * (D ** -0.6) * (((S + 1) ** 0.3) - 1) * Math.exp(1.2 * (1 - R));
  const next = Math.min(S, raw);
  if (!Number.isFinite(next) || next <= 0) return Math.min(S, 0.01);
  return next;
}

export function nextDifficulty(difficulty, grade) {
  const D = Number(difficulty);
  return clamp(0.5 + 0.9 * (D - 0.8 * (grade - 3)), 1, 10);
}

// t = S · k · ((target)^(1/C) − 1) / F. With these constants the fraction is 1,
// so the interval is S · k, rounded to at least one day.
export function targetInterval(stability, k = 1) {
  const exact = stability * k * ((MODEL.target ** (1 / MODEL.C)) - 1) / MODEL.F;
  if (!Number.isFinite(exact)) return 1;
  return Math.max(1, Math.round(exact));
}

export function kGrid() {
  const start = Math.log(MODEL.kMin);
  const end = Math.log(MODEL.kMax);
  return Array.from({ length: MODEL.gridSize }, (_, index) => (
    Math.exp(start + (end - start) * index / (MODEL.gridSize - 1))
  ));
}

export function weightedPercentile(values, weights, p) {
  const pairs = values.map((value, index) => ({ value, weight: weights[index] }))
    .sort((a, b) => a.value - b.value);
  let cum = 0;
  for (const pair of pairs) {
    cum += pair.weight;
    if (cum >= p) return pair.value;
  }
  return pairs[pairs.length - 1].value;
}

function eligible(events) {
  return (events || []).filter(event => (
    event && event.t > 0 && event.stabilityBefore != null && !event.derived && !event.backfilled
  ));
}

export function fitPersonal(events) {
  const rows = eligible(events);
  const n = rows.length;
  if (n < MODEL.minEvents) {
    return { k: 1, lo: null, hi: null, n, grid: null, weights: null, learning: true, early: false };
  }
  const grid = kGrid();
  const logs = grid.map(k => {
    const theta = Math.log(k);
    let ll = 0;
    for (const event of rows) {
      const p = clamp(recallProbability(event.t, event.stabilityBefore, k), MODEL.probFloor, 1 - MODEL.probFloor);
      ll += event.y * Math.log(p) + (1 - event.y) * Math.log(1 - p);
    }
    return ll - (theta ** 2) / (2 * MODEL.priorVariance);
  });
  const peak = Math.max(...logs);
  const raw = logs.map(value => Math.exp(value - peak));
  const total = raw.reduce((sum, value) => sum + value, 0);
  const weights = raw.map(value => value / total);
  let best = 0;
  for (let index = 1; index < logs.length; index++) if (logs[index] > logs[best]) best = index;
  return {
    k: grid[best],
    lo: weightedPercentile(grid, weights, 0.05),
    hi: weightedPercentile(grid, weights, 0.95),
    n,
    grid,
    weights,
    learning: false,
    early: n < MODEL.earlyEvents,
  };
}

export function predictRecall(t, stability, fit) {
  if (!fit?.weights) {
    const mean = recallProbability(t, stability, 1);
    return { mean, lo: mean, hi: mean, width: 0 };
  }
  const values = fit.grid.map(k => recallProbability(t, stability, k));
  const mean = values.reduce((sum, value, index) => sum + fit.weights[index] * value, 0);
  const lo = weightedPercentile(values, fit.weights, 0.05);
  const hi = weightedPercentile(values, fit.weights, 0.95);
  return { mean, lo, hi, width: hi - lo };
}

export function recallPhrase(prediction, n) {
  const pct = Math.round(prediction.mean * 100);
  if (n < MODEL.minEvents) return `Estimated recall: about ${pct}%, the model is still learning`;
  if (prediction.width >= 0.15) return `Estimated recall: about ${pct}%, with substantial uncertainty`;
  return `Estimated recall: about ${pct}%`;
}

function meanLogLoss(rows, k) {
  if (!rows.length) return null;
  const total = rows.reduce((sum, event) => {
    const p = clamp(recallProbability(event.t, event.stabilityBefore, k), MODEL.probFloor, 1 - MODEL.probFloor);
    return sum + -(event.y * Math.log(p) + (1 - event.y) * Math.log(1 - p));
  }, 0);
  return total / rows.length;
}

export function validateChronological(events) {
  const rows = eligible(events).slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const cut = Math.floor(rows.length * 0.7);
  const train = rows.slice(0, cut);
  const test = rows.slice(cut);
  const fit = fitPersonal(train);
  const fittedLoss = meanLogLoss(test, fit.k);
  const baseLoss = meanLogLoss(test, 1);
  const nTest = test.length;
  const claim = nTest >= 20 && fittedLoss != null && baseLoss != null && fittedLoss < baseLoss;
  return { nTest, fittedLoss, baseLoss, difference: fittedLoss == null ? null : fittedLoss - baseLoss, claim, k: fit.k };
}

export function calibrationBands(events, k) {
  const rows = eligible(events);
  const edges = [0, 0.2, 0.4, 0.6, 0.8, 1];
  return edges.slice(0, -1).map((lo, index) => {
    const hi = edges[index + 1];
    const band = rows.filter(event => {
      const p = recallProbability(event.t, event.stabilityBefore, k);
      return p >= lo && (index === edges.length - 2 ? p <= hi : p < hi);
    });
    if (band.length < 10) return { lo, hi, count: band.length, rate: null, label: 'too few reviews' };
    const rate = band.reduce((sum, event) => sum + event.y, 0) / band.length;
    return { lo, hi, count: band.length, rate, label: null };
  });
}

export function daysBetween(earlier, later) {
  const a = new Date(`${String(earlier).slice(0, 10)}T12:00:00Z`);
  const b = new Date(`${String(later).slice(0, 10)}T12:00:00Z`);
  return Math.max(0, Math.round((b - a) / 86400000));
}

// Rows the personal fit accepts. Moved here so Keystone and the store share one definition.
export function asFitRows(rows) {
  return (rows || []).map(row => ({
    t: Number(row.elapsed_days),
    stabilityBefore: row.stability_before,
    y: row.observed_recall,
    at: row.reviewed_at,
    derived: row.derived,
    backfilled: row.derived,
  }));
}
