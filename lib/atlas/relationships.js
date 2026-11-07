export const RELATIONSHIPS = [
  'prerequisite_of', 'part_of', 'contains', 'causes', 'influences', 'analogous_to',
  'contrasts_with', 'applies_to', 'derived_from', 'depends_on', 'example_of', 'related_to',
];

const ALLOWED = new Set(RELATIONSHIPS);

export function validEdge(edge) {
  if (!edge) return false;
  if (!edge.sourceKey || !edge.targetKey) return false;
  if (edge.sourceKey === edge.targetKey) return false;
  if (!ALLOWED.has(edge.relationship)) return false;
  return true;
}

// A sentence can support one typed link. Similarity is never stored as identity.
export function edgeFromSentence(sentence, concepts) {
  const text = String(sentence || '');
  const present = concepts.filter(concept => text.toLowerCase().includes(concept.name.toLowerCase()));
  if (present.length < 2) return null;
  const [a, b] = present;
  let relationship = null;
  if (/depends on|requires|prerequisite/i.test(text)) relationship = 'depends_on';
  else if (/part of/i.test(text)) relationship = 'part_of';
  else if (/unlike|contrasts with|rather than/i.test(text)) relationship = 'contrasts_with';
  else if (/similar to|analogous|like a/i.test(text)) relationship = 'analogous_to';
  else if (/for example|is an example/i.test(text)) relationship = 'example_of';
  else if (/causes|leads to/i.test(text)) relationship = 'causes';
  else if (/derived from/i.test(text)) relationship = 'derived_from';
  if (!relationship) return null;
  const edge = {
    sourceKey: a.key,
    targetKey: b.key,
    relationship,
    confidence: 0.45,
    verification: 'candidate',
    origin: 'sentence',
    evidence: { sentence: text.slice(0, 400) },
  };
  return validEdge(edge) ? edge : null;
}
