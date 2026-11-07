import { contentWords } from './normalizer.js';

export const SCORE_VERSION = 's1';

function clamp01(value) {
  if (value == null || Number.isNaN(Number(value))) return 0;
  return Math.min(1, Math.max(0, Number(value)));
}

export function jaccard(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  if (!a.size && !b.size) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / (a.size + b.size - shared);
}

// A high score is a candidate comparison, not scientific proof.
export function bridgeScore(a, b) {
  const left = contentWords(`${a.name} ${a.description || ''}`);
  const right = contentWords(`${b.name} ${b.description || ''}`);
  const shared = left.filter(word => right.includes(word));
  const sem = jaccard(left, right);
  const struct = a.category && a.category === b.category ? 1 : 0.25;
  const evidence = clamp01(((a.evidenceCount || 0) + (b.evidenceCount || 0)) / 4);
  const novelty = a.alreadyLinked || b.alreadyLinked ? 0.2 : 1;
  const relevance = 1;
  const score = 0.3 * sem + 0.25 * struct + 0.2 * evidence + 0.15 * novelty + 0.1 * relevance;
  return { score, sem, struct, evidence, novelty, relevance, shared, version: SCORE_VERSION };
}

export function opportunityScore(parts) {
  const G = clamp01(parts.gap);
  const R = clamp01(parts.relevance);
  const I = clamp01(parts.interdisciplinary);
  const N = clamp01(parts.novelty);
  const F = clamp01(parts.feasibility);
  const score = 0.3 * G + 0.25 * R + 0.2 * I + 0.15 * N + 0.1 * F;
  return { score, G, R, I, N, F, version: SCORE_VERSION };
}

export function challengePriority(parts) {
  const G = clamp01(parts.weakness);
  const U = clamp01(parts.urgency);
  const D = clamp01(parts.difficultyFit);
  const V = clamp01(parts.value);
  const score = 0.35 * G + 0.25 * U + 0.2 * D + 0.2 * V;
  return { score, version: SCORE_VERSION };
}

export function rankOpportunities(concepts, edges, masteryById) {
  const byId = new Map(concepts.map(concept => [concept.id, concept]));
  const items = [];
  for (const concept of concepts) {
    if (concept.status === 'archived') continue;
    const mastery = masteryById.get(concept.id);
    const assessed = mastery && ['recall', 'explanation', 'application', 'transfer', 'retention']
      .some(key => mastery[key] != null);
    const weak = assessed && ['recall', 'explanation', 'application', 'transfer', 'retention']
      .some(key => mastery[key] != null && mastery[key] < 0.45);
    const prereq = edges.find(edge => (
      edge.target_id === concept.id && (edge.relationship === 'prerequisite_of' || edge.relationship === 'depends_on')
    ));
    const bridge = edges.some(edge => (
      (edge.source_id === concept.id || edge.target_id === concept.id) && edge.relationship === 'analogous_to'
    ));
    let category = null;
    let why = '';
    const parts = { gap: 0, relevance: 0.4, interdisciplinary: bridge ? 1 : 0, novelty: assessed ? 0.2 : 1, feasibility: 0.8 };
    if (prereq && byId.get(prereq.source_id)) {
      category = 'foundation';
      parts.gap = 1;
      parts.relevance = 1;
      why = `${byId.get(prereq.source_id).name} is recorded as support for ${concept.name}, and that support is not verified understanding.`;
    } else if (weak) {
      category = 'repair';
      parts.gap = 0.8;
      parts.relevance = 0.9;
      why = `${concept.name} has a weak assessed dimension. Another attempt would tighten the estimate.`;
    } else if (!assessed && concept.origin !== 'manual') {
      category = 'expansion';
      parts.relevance = 0.7;
      why = `You wrote about ${concept.name}, and it has not been assessed. The journal confidence score is not used as mastery.`;
    }
    if (!category) continue;
    const scored = opportunityScore(parts);
    items.push({
      conceptId: concept.id,
      name: concept.name,
      category,
      why,
      minutes: 15,
      score: scored.score,
    });
  }
  return items.sort((a, b) => b.score - a.score).slice(0, 8);
}
