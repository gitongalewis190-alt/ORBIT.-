// Topic search. Several words all have to match. Matching ignores case and accents,
// accepts a word's beginning ("neuro" finds "neuroscience"), and forgives a single typo
// in longer words ("memroy" finds "memory"). Title matches rank above field or section matches.

export function normalise(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function queryTokens(query) {
  return normalise(query).split(/[^a-z0-9]+/).filter(Boolean);
}

// True when a and b differ by at most one insertion, deletion or substitution.
function withinOneEdit(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    edits++;
    if (edits > 1) return false;
    // Two neighbouring letters swapped ("memroy" for "memory") is one typo.
    if (a.length === b.length && i + 1 < a.length && j + 1 < b.length && a[i] === b[j + 1] && a[i + 1] === b[j]) {
      i += 2;
      j += 2;
      continue;
    }
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  edits += (a.length - i) + (b.length - j);
  return edits <= 1;
}

// Score for one query token against one word. 0 means no match.
function tokenScore(token, word) {
  if (word.startsWith(token)) return 3;
  if (word.includes(token)) return 2;
  if (token.length >= 5 && Math.abs(token.length - word.length) <= 1 && withinOneEdit(token, word)) return 1;
  return 0;
}

// Weighted fields. Title counts most.
const WEIGHTS = { title: 4, field: 2, section: 2, difficulty: 1, description: 1 };

export function scoreTopic(topic, tokens) {
  if (tokens.length === 0) return 1;
  const fields = Object.entries(WEIGHTS).map(([key, weight]) => ({
    words: normalise(topic[key] ?? '').split(/[^a-z0-9]+/).filter(Boolean),
    weight,
  }));
  let total = 0;
  for (const token of tokens) {
    let best = 0;
    for (const field of fields) {
      for (const word of field.words) {
        const s = tokenScore(token, word) * field.weight;
        if (s > best) best = s;
      }
    }
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

// Filters and ranks topics. Topics are expected to carry title, field, section, difficulty and
// optionally description. Returns the matching topics, best first.
export function searchTopics(topics, query) {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return topics.slice();
  return topics
    .map(t => ({ t, score: scoreTopic(t, tokens) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.t.title.localeCompare(b.t.title))
    .map(x => x.t);
}

// Splits text into plain and matched segments, so the UI can highlight what matched.
export function highlightSegments(text, query) {
  const tokens = queryTokens(query);
  const source = String(text ?? '');
  if (tokens.length === 0) return [{ text: source, hit: false }];
  const lower = normalise(source);
  const marks = new Array(source.length).fill(false);
  for (const token of tokens) {
    let from = 0;
    while (from < lower.length) {
      const at = lower.indexOf(token, from);
      if (at === -1) break;
      for (let k = at; k < at + token.length; k++) marks[k] = true;
      from = at + token.length;
    }
  }
  const out = [];
  let buf = '';
  let hit = marks[0] ?? false;
  for (let k = 0; k < source.length; k++) {
    if (marks[k] !== hit) {
      out.push({ text: buf, hit });
      buf = '';
      hit = marks[k];
    }
    buf += source[k];
  }
  if (buf) out.push({ text: buf, hit });
  return out;
}
