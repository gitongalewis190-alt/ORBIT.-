// Attention. The app's own helper. It only uses the words already on the page.
// It answers from the journal, shortens a draft, and pulls key lines. It does not
// choose topics or change review spacing.
import { askJournal, wordsOf } from './assist.js';

export const ATTENTION = 'Attention';

const FILLERS = [
  [/\bit is important to note that\b/gi, ''],
  [/\bit should be noted that\b/gi, ''],
  [/\bi think that\b/gi, ''],
  [/\bi believe that\b/gi, ''],
  [/\bin order to\b/gi, 'to'],
  [/\bdue to the fact that\b/gi, 'because'],
  [/\ba lot of\b/gi, 'many'],
];

function tidy(text) {
  let out = String(text || '');
  for (const [pattern, next] of FILLERS) out = out.replace(pattern, next);
  return out.replace(/[ \t]{2,}/g, ' ').replace(/ +\n/g, '\n').trim();
}

function sentences(text) {
  return tidy(text).split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
}

function weight(sentence) {
  const words = wordsOf(sentence);
  const numbers = (sentence.match(/\d/g) || []).length;
  return words.length + numbers;
}

// Keeps the opening point, then later sentences that add new words, until about two thirds of the length.
export function shorten(text) {
  const parts = sentences(text);
  if (parts.length < 2) return tidy(text);
  const total = parts.join(' ').split(/\s+/).filter(Boolean).length;
  const budget = Math.max(8, Math.round(total * 0.65));
  const kept = [];
  const seen = new Set();
  let used = 0;
  for (const sentence of parts) {
    const words = sentence.split(/\s+/).filter(Boolean);
    const fresh = wordsOf(sentence).filter(word => !seen.has(word));
    const room = used + words.length <= budget;
    if (kept.length === 0 || (fresh.length >= 2 && room)) {
      kept.push(sentence);
      used += words.length;
      wordsOf(sentence).forEach(word => seen.add(word));
    }
  }
  return kept.join(' ');
}

export function keyLines(text) {
  const parts = sentences(text);
  return [...parts.map((sentence, index) => ({ sentence, index, weight: weight(sentence) }))]
    .filter(item => item.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .slice(0, 3)
    .sort((a, b) => a.index - b.index)
    .map(item => item.sentence.replace(/[.!?]$/, ''));
}

// One request. A shorten or key-point instruction uses the draft. Anything else is a journal question.
export function attend({ entries, text, request }) {
  const q = String(request || '').trim();
  const lower = q.toLowerCase();
  if (/^(shorten|make shorter|make this shorter|condense)\b/.test(lower)) {
    return { name: ATTENTION, kind: 'shorten', text: shorten(text), hits: [], recommendations: [] };
  }
  if (/key point/.test(lower)) {
    return { name: ATTENTION, kind: 'points', text: keyLines(text).join('\n'), hits: [], recommendations: [] };
  }
  const found = askJournal(entries, q);
  return {
    name: ATTENTION,
    kind: 'answer',
    text: found.answer || '',
    hits: found.hits,
    recommendations: found.recommendations,
  };
}
