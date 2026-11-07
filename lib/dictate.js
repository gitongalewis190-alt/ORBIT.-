const FILLERS = [
  'um', 'uh', 'er', 'ah', 'hmm',
  'you know', 'i mean', 'sort of', 'kind of',
];

const SPOKEN = [
  ['full stop', '. '],
  ['period', '. '],
  ['question mark', '? '],
  ['exclamation point', '! '],
  ['exclamation mark', '! '],
  ['new line', '\n'],
  ['newline', '\n'],
  ['comma', ', '],
  ['colon', ': '],
  ['semicolon', '; '],
];

function tidy(text) {
  return String(text || '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

function stripFillers(text) {
  let out = ` ${text} `;
  const parts = [...FILLERS].sort((a, b) => b.length - a.length);
  for (const filler of parts) {
    const re = new RegExp(`\\s+${filler.replace(' ', '\\s+')}\\s+`, 'gi');
    out = out.replace(re, ' ');
  }
  return tidy(out);
}

function applySpokenPunctuation(text) {
  let out = ` ${text} `;
  for (const [word, mark] of SPOKEN) {
    const re = new RegExp(`\\s+${word.replace(' ', '\\s+')}\\s+`, 'gi');
    out = out.replace(re, mark === '\n' ? '\n' : mark);
  }
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.!?])/g, '$1')
    .trim();
}

function capitalise(text) {
  return text.replace(/(^|[.!?]\s+|\n)([a-z])/g, (_, lead, ch) => lead + ch.toUpperCase());
}

// One recognition chunk, cleaned. Empty when only fillers remain.
export function shapePhrase(raw) {
  const punctuated = applySpokenPunctuation(tidy(raw));
  const stripped = stripFillers(punctuated);
  if (!stripped) return '';
  return capitalise(stripped);
}

// Split a final utterance into phrases the field can take one at a time.
export function splitUtterance(raw) {
  const shaped = shapePhrase(raw);
  if (!shaped) return [];
  const parts = shaped.split(/\n+|(?<=[.!?])\s+/);
  return parts.map(part => shapePhrase(part)).filter(Boolean);
}
