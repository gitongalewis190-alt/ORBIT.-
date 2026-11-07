import { canonicalKey, normalizeName } from './normalizer.js';

const STOP = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'were', 'they', 'them', 'your', 'about', 'into', 'what', 'when', 'where', 'which']);

function clean(raw) {
  return String(raw || '').replace(/\s+/g, ' ').trim();
}

function addConcept(map, raw, fields) {
  const name = clean(raw);
  if (name.length < 3 || name.length > 80) return null;
  const key = canonicalKey(name);
  if (!key || key.length < 3) return null;
  if (!map.has(key)) {
    map.set(key, {
      key,
      name,
      normalized_name: key,
      description: fields.description || '',
      category: fields.category || 'concept',
      discipline: fields.discipline || null,
      origin: fields.origin || 'journal',
      topic_id: fields.topic_id || null,
    });
  } else if (fields.description && !map.get(key).description) {
    map.get(key).description = fields.description;
  }
  return map.get(key);
}

export function extractConcepts(entry) {
  const map = new Map();
  const claims = [];
  const topic = addConcept(map, entry.topic_title, {
    description: clean(entry.key_points?.[0] || '').slice(0, 280),
    discipline: entry.discipline || null,
    category: 'concept',
    origin: 'topic',
    topic_id: entry.topic_id || null,
  });

  for (const point of entry.key_points || []) {
    const text = clean(point);
    if (!text) continue;
    claims.push({ conceptKey: topic?.key || null, claim_text: text.slice(0, 500), claim_type: 'key_point', source_span: text.slice(0, 180) });
    if (text.split(' ').length <= 6 && !/[.?!]/.test(text)) {
      addConcept(map, text, { discipline: entry.discipline || null, origin: 'key_point', topic_id: entry.topic_id || null });
    }
  }

  const body = clean(entry.body);
  const quoted = body.match(/"([^"]{3,80})"/g) || [];
  for (const quote of quoted) addConcept(map, quote.replace(/"/g, ''), { discipline: entry.discipline, origin: 'quote', topic_id: entry.topic_id });

  if (entry.prerequisite_title) {
    addConcept(map, entry.prerequisite_title, {
      discipline: entry.prerequisite_discipline || null,
      origin: 'prerequisite',
      topic_id: entry.prerequisite_id || null,
      category: 'concept',
    });
  }

  const concepts = [...map.values()].slice(0, 8);
  const allowed = new Set(concepts.map(concept => concept.key));
  return {
    concepts,
    claims: claims.filter(claim => !claim.conceptKey || allowed.has(claim.conceptKey)).slice(0, 12),
  };
}

export function sentencesOf(text) {
  return clean(text).split(/(?<=[.?!])\s+/).map(sentence => sentence.trim()).filter(Boolean);
}

export function meaningful(word) {
  const plain = normalizeName(word);
  return plain.length > 3 && !STOP.has(plain);
}
