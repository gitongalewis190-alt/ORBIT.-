import { extractConcepts, sentencesOf } from './extractor.js';
import { edgeFromSentence, validEdge } from './relationships.js';
import { bridgeScore } from './scoring.js';
import { canonicalKey } from './normalizer.js';

// Turns one journal entry into candidate concepts, claims, links, and comparisons.
// Nothing in the result is marked verified. Running it twice on the same text
// returns the same keys, so the database can ignore duplicates.
export function compileRecord(entry, existing = []) {
  const extracted = extractConcepts(entry || {});
  const concepts = extracted.concepts.map(concept => ({ ...concept }));
  const body = String(entry?.body || '');
  for (const concept of concepts) {
    if (!concept.description && concept.origin === 'topic') concept.description = body.slice(0, 180);
  }

  const edges = [];
  const remember = edge => {
    if (!validEdge(edge)) return;
    const seen = edges.some(item => item.sourceKey === edge.sourceKey && item.targetKey === edge.targetKey && item.relationship === edge.relationship);
    if (!seen) edges.push(edge);
  };

  for (const sentence of sentencesOf([body, ...(entry?.key_points || [])].join(' '))) {
    remember(edgeFromSentence(sentence, concepts));
  }

  if (entry?.prerequisite_title && entry?.topic_title) {
    remember({
      sourceKey: canonicalKey(entry.prerequisite_title),
      targetKey: canonicalKey(entry.topic_title),
      relationship: 'prerequisite_of',
      confidence: 0.55,
      verification: 'candidate',
      origin: 'topic_link',
      evidence: { topic_id: entry.topic_id || null },
    });
  }

  const pool = new Map();
  for (const concept of existing) {
    const key = concept.normalized_name || canonicalKey(concept.name);
    if (!key || pool.has(key)) continue;
    pool.set(key, { ...concept, key, name: concept.name, evidenceCount: concept.evidenceCount || 0 });
  }
  for (const concept of concepts) {
    if (!pool.has(concept.key)) pool.set(concept.key, { ...concept, evidenceCount: 1 });
  }

  const discoveries = [];
  const list = [...pool.values()];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (!a.discipline || !b.discipline || a.discipline === b.discipline) continue;
      const scored = bridgeScore(a, b);
      if (!scored.shared.length || scored.sem < 0.2 || scored.score < 0.45) continue;
      const names = [a.name, b.name].sort((left, right) => left.localeCompare(right));
      discoveries.push({
        title: `Comparison: ${names[0]} and ${names[1]}`,
        discovery_type: 'analogy',
        explanation: `${names[0]} and ${names[1]} share the recorded words ${scored.shared.join(', ')}. This compares ${a.discipline} with ${b.discipline}. It does not mean the mechanisms are the same.`,
        score: Number(scored.score.toFixed(3)),
        verification: 'candidate',
        keys: [a.key, b.key].sort(),
        evidence: { shared: scored.shared, version: scored.version },
      });
    }
  }

  return {
    concepts,
    claims: extracted.claims,
    edges,
    discoveries: discoveries.slice(0, 4),
  };
}
