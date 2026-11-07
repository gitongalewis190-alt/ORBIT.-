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

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const NEAR = {
  technology: ['tech', 'tool', 'tools', 'machine', 'digital', 'software'],
  ethics: ['moral', 'morals', 'morality', 'right', 'wrong', 'value'],
  shift: ['change', 'changed', 'turn', 'move', 'moved'],
  review: ['recall', 'remember', 'quiz', 'revise'],
  confidence: ['sure', 'unsure', 'certain', 'doubt'],
};

function stem(word) {
  return String(word).toLowerCase().replace(/(ing|ed|es|s)$/, '');
}

function closeWord(a, b) {
  if (a === b) return true;
  const sa = stem(a);
  const sb = stem(b);
  if (sa === sb) return true;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a) || sa.startsWith(sb) || sb.startsWith(sa))) return true;
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 5) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i += 1; j += 1; continue; }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else { i += 1; j += 1; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function plain(body) {
  return String(body || '').replace(/[*_=#]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function excerpt(body) {
  const text = plain(body);
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

function sentences(body) {
  return plain(body).split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.split(/\s+/).length >= 6);
}

function wanted(query) {
  const extra = new Set(wordsOf(query));
  for (const [key, group] of Object.entries(NEAR)) {
    const hit = [...extra].some(word => word === key || group.some(item => closeWord(word, item)));
    if (hit) {
      extra.add(key);
      group.forEach(item => extra.add(item));
    }
  }
  return [...extra];
}

function mentioned(hay, word) {
  const tokens = hay.match(/[a-z0-9][a-z0-9'-]{2,}/g) ?? [];
  return tokens.some(token => closeWord(token, word));
}

// Answers a question from the journal. Dates, paraphrases, and the kind of question all count.
export function askJournal(entries, query) {
  const list = entries || [];
  const average = averageWords(list);
  const raw = String(query || '').trim();
  const q = raw.toLowerCase();
  const words = wanted(raw);
  if (!words.length && !/\b(last|first|latest|recent|today|yesterday)\b/.test(q)) {
    return { hits: [], recommendations: [], average, answer: '' };
  }

  const when = /\b(when|date|day|last|latest|first|recent|yesterday|today|ago)\b/.test(q) || Object.keys(MONTHS).some(m => q.includes(m));
  const why = /\b(why|because|reason|cause)\b/.test(q);
  const count = /\b(how many|count|number of)\b/.test(q);
  const low = /\b(unsure|low confidence|weak|struggled|confus)\b/.test(q);
  const year = (q.match(/\b(19|20)\d{2}\b/) || [])[0];
  const month = Object.keys(MONTHS).find(name => q.includes(name));

  const scored = [];
  for (const entry of list) {
    const title = (entry.topic_title || entry.topics?.title || '').toLowerCase();
    const points = Array.isArray(entry.key_points) ? entry.key_points.join(' ') : '';
    const tags = Array.isArray(entry.tags) ? entry.tags.join(' ') : '';
    const body = plain(entry.body);
    const hay = `${title} ${body} ${points} ${tags}`.toLowerCase();
    const created = String(entry.created_at || '');
    let score = 0;
    for (const word of words) {
      if (mentioned(title, word)) score += 6;
      else if (mentioned(`${points} ${tags}`.toLowerCase(), word)) score += 3;
      else if (mentioned(hay, word)) score += 2;
    }
    const phrase = words.slice(0, 3).join(' ');
    if (phrase.length > 8 && hay.includes(phrase)) score += 5;
    if (year && created.startsWith(year)) score += 4;
    if (month && created.slice(5, 7) === String(MONTHS[month]).padStart(2, '0')) score += 4;
    if (low && entry.confidence != null && entry.confidence <= 2) score += 4;
    if (score > 0) scored.push({ entry, score });
  }

  if (!scored.length && /\b(last|latest|recent|first)\b/.test(q)) {
    const ordered = [...list].filter(entry => entry.created_at).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const pick = /\bfirst\b/.test(q) ? ordered[0] : ordered[ordered.length - 1];
    if (pick) scored.push({ entry: pick, score: 1 });
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

  const top = hits[0];
  const recommendations = [];
  let answer = '';
  if (top) {
    const day = String(top.created_at).slice(0, 10);
    const source = scored[0].entry;
    const lines = sentences(source.body);
    const useful = lines.find(line => words.some(word => mentioned(line.toLowerCase(), word))) || lines[0] || excerpt(source.body);
    if (count) answer = `${scored.length} entr${scored.length === 1 ? 'y mentions' : 'ies mention'} that. The latest is ${top.title} on ${day}.`;
    else if (why) answer = `On ${day}, in ${top.title}: ${useful}`;
    else if (when) answer = `You wrote this on ${day}, in ${top.title}. ${useful}`;
    else answer = `${top.title}, ${day}. ${useful}`;
    if (top.confidence != null && top.confidence < 3) {
      recommendations.push({ kind: 'relearn', topic_id: top.topic_id, label: 'Put this topic in today’s reviews' });
    }
    if (/review|recall|remember|quiz/.test(q)) {
      recommendations.push({ kind: 'recall', entry_id: top.id, label: 'Ask a recall question on this entry' });
    } else {
      recommendations.push({ kind: 'open', entry_id: top.id, label: 'Open this entry' });
    }
    if (average && entryWords(source) < average * 0.6) {
      recommendations.push({ kind: 'pace', label: `Shorter than your usual ${average} words` });
    }
  }

  return { hits, recommendations, average, answer };
}

// One note from the learner's own recent entries. It does not choose today's topic.
export function nextAdvice(entries) {
  const list = [...(entries || [])].filter(entry => entry.created_at)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if (list.length < 2) return '';
  const recent = list.slice(0, 3);
  const titles = recent.map(entry => entry.topic_title || entry.topics?.title).filter(Boolean);
  if (titles.length >= 2 && titles.every(title => title === titles[0])) {
    return `The last entries stay on ${titles[0]}. One entry on another topic would widen the record.`;
  }
  const low = recent.find(entry => entry.confidence != null && entry.confidence <= 2);
  if (low) {
    const name = low.topic_title || low.topics?.title || 'a recent entry';
    return `Confidence on ${name} was ${low.confidence} of 5. A short revisit would lock it in.`;
  }
  const average = averageWords(list);
  if (average && entryWords(list[0]) < average * 0.6) return `The last entry was shorter than your usual ${average} words.`;
  return '';
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
