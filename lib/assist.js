// Questions over the learner's own journal. No network. The words they wrote are the only source.

const SKIP = new Set((
  'the and for that with this from have into your what when were will they their about ' +
  'which would there been more also just than then them some such only other over did ' +
  'does doing very much most make made each show tell find give want like recall review'
).split(' '));

export function wordsOf(text) {
  return (String(text || '').toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) ?? [])
    .filter(w => !SKIP.has(w));
}

export function entryWords(entry) {
  const n = Number(entry?.word_count);
  if (n > 0) return n;
  return String(entry?.body || '').trim().split(/\s+/).filter(Boolean).length;
}

export function averageWords(entries) {
  const nums = (entries || []).map(entryWords).filter(n => n > 0);
  if (!nums.length) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function haystack(entry) {
  const title = entry.topic_title || entry.topics?.title || '';
  const points = Array.isArray(entry.key_points) ? entry.key_points.join(' ') : '';
  const tags = Array.isArray(entry.tags) ? entry.tags.join(' ') : '';
  return `${title} ${entry.body || ''} ${points} ${tags}`.toLowerCase();
}

function excerpt(body) {
  const plain = String(body || '').replace(/[*_=#]+/g, '').replace(/\s+/g, ' ').trim();
  return plain.length > 180 ? `${plain.slice(0, 177)}…` : plain;
}

// Answers a question from the journal. Returns the closest entries and a short next step.
export function askJournal(entries, query) {
  const words = wordsOf(query);
  const list = entries || [];
  if (!words.length) return { hits: [], recommendations: [], average: averageWords(list) };

  const scored = [];
  for (const entry of list) {
    const hay = haystack(entry);
    let score = 0;
    for (const word of words) if (hay.includes(word)) score += 1;
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score || String(b.entry.created_at).localeCompare(String(a.entry.created_at)));

  const hits = scored.slice(0, 5).map(({ entry, score }) => ({
    id: entry.id,
    topic_id: entry.topic_id,
    title: entry.topic_title || entry.topics?.title || 'Entry',
    created_at: entry.created_at,
    confidence: entry.confidence ?? null,
    excerpt: excerpt(entry.body),
    score,
  }));

  const recommendations = [];
  const top = hits[0];
  const q = String(query || '').toLowerCase();
  if (top && (top.confidence != null && top.confidence < 3)) {
    recommendations.push({ kind: 'relearn', topic_id: top.topic_id, label: 'Put this topic in today’s reviews' });
  }
  if (top && /review|recall|remember|quiz/.test(q)) {
    recommendations.push({ kind: 'recall', entry_id: top.id, label: 'Ask a recall question on this entry' });
  } else if (top) {
    recommendations.push({ kind: 'open', entry_id: top.id, label: 'Open this entry' });
  }
  const average = averageWords(list);
  if (average && top && entryWords(scored[0].entry) < average * 0.6) {
    recommendations.push({ kind: 'pace', label: `Shorter than your usual ${average} words` });
  }
  return { hits, recommendations, average };
}

export const ASSIST_DEFAULTS = {
  pace: true,
  suggestions: true,
  ask: true,
  dictate: true,
  autoBackup: true,
};

export function readAssist(storage) {
  try {
    const raw = storage.getItem('orbit.assist');
    return { ...ASSIST_DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...ASSIST_DEFAULTS };
  }
}

export function assistPrefs() {
  if (typeof localStorage === 'undefined') return { ...ASSIST_DEFAULTS };
  return readAssist(localStorage);
}

export function writeAssist(storage, patch) {
  const next = { ...readAssist(storage), ...patch };
  storage.setItem('orbit.assist', JSON.stringify(next));
  return next;
}
