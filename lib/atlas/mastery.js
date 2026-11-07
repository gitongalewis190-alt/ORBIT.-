// Understanding is separate from the journal confidence score of 0 to 5.
// A missing dimension stays unknown. It is never treated as zero or perfect.

export const MASTERY_VERSION = 'm1';

export const DIMENSIONS = ['recall', 'explanation', 'application', 'transfer', 'retention'];

export const WEIGHTS = {
  recall: 0.15,
  explanation: 0.2,
  application: 0.25,
  transfer: 0.2,
  retention: 0.2,
};

const KIND_DIMENSION = {
  reconstruction: 'recall',
  explanation: 'explanation',
  application: 'application',
  transfer: 'transfer',
  critique: 'explanation',
};

export function dimensionForKind(kind) {
  return KIND_DIMENSION[kind] || null;
}

export function emptyMastery() {
  return {
    recall: null,
    explanation: null,
    application: null,
    transfer: null,
    retention: null,
    n_recall: 0,
    n_explanation: 0,
    n_application: 0,
    n_transfer: 0,
    n_retention: 0,
  };
}

export function composite(mastery) {
  let weight = 0;
  let total = 0;
  let known = 0;
  for (const key of DIMENSIONS) {
    const value = mastery?.[key];
    if (value == null || Number.isNaN(Number(value))) continue;
    weight += WEIGHTS[key];
    total += WEIGHTS[key] * Number(value);
    known += 1;
  }
  if (!weight) return { score: null, known: 0, version: MASTERY_VERSION };
  return { score: total / weight, known, version: MASTERY_VERSION };
}

export function masteryLabel(mastery) {
  const { score, known } = composite(mastery || {});
  if (!known) return 'Not assessed';
  if (known < 2) return 'Uncertain';
  if (score >= 0.75) return 'Demonstrated';
  if (score >= 0.45) return 'Developing';
  return 'Needs practice';
}

export function applyAssessment(current, dimension, score) {
  if (!DIMENSIONS.includes(dimension)) throw new Error('Unknown mastery dimension.');
  const value = Number(score);
  if (!(value >= 0 && value <= 1)) throw new Error('A score must be between 0 and 1.');
  const next = { ...emptyMastery(), ...current };
  const countKey = `n_${dimension}`;
  const count = next[countKey] || 0;
  const previous = next[dimension];
  next[dimension] = previous == null ? value : (previous * count + value) / (count + 1);
  next[countKey] = count + 1;
  const observations = DIMENSIONS.reduce((sum, key) => sum + (next[`n_${key}`] || 0), 0);
  next.uncertainty = 1 / Math.sqrt(observations);
  next.last_assessed = new Date().toISOString();
  next.algorithm_version = MASTERY_VERSION;
  return next;
}

// Mean squared error between a predicted probability and a correct (1) or missed (0) result.
export function brierScore(pairs) {
  const usable = (pairs || []).filter(pair => pair.p != null && (pair.y === 0 || pair.y === 1));
  if (!usable.length) return null;
  const total = usable.reduce((sum, pair) => sum + (Number(pair.p) - pair.y) ** 2, 0);
  return total / usable.length;
}

export function weakestDimension(mastery) {
  const known = DIMENSIONS.filter(key => mastery?.[key] != null);
  if (!known.length) return null;
  return known.sort((a, b) => mastery[a] - mastery[b])[0];
}
