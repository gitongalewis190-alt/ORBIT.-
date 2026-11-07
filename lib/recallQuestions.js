// Recall questions, built from what you logged. No external service is needed, so this always works.
//
// Each entry becomes questions of several kinds: a blank to fill, a reason to rebuild, a key point to
// name, an explanation, or a link to another topic. Older entries get harder kinds, so a question about
// something logged two months ago asks for more than a question about yesterday. Answers are graded on
// the key terms they must contain. A weak score sends you back to the concept.
import { terms, keyTerms, WEAK_SCORE } from './recall';

const CONNECTIVE = /\b(because|therefore|so that|since|which means|leads to|results in|causes?)\b/i;

export function sentencesOf(body) {
  return String(body ?? '')
    .replace(/[*_=#]+/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => {
      const n = s.split(/\s+/).length;
      return n >= 6 && n <= 40;
    });
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function blankWord(sentence, word) {
  return sentence.replace(new RegExp(`\\b${escapeRe(word)}\\b`, 'i'), '_____');
}

// The most telling word in a sentence: a word from the learner's own key points if one appears,
// otherwise the longest content word.
function anchorOf(sentence, preferred) {
  const ws = [...new Set(terms(sentence))];
  if (!ws.length) return null;
  const pref = ws.filter(w => preferred.includes(w));
  const pool = pref.length ? pref : ws;
  return [...pool].sort((a, b) => b.length - a.length || a.localeCompare(b))[0];
}

// The question kinds allowed for an entry of this age in days.
export function kindsFor(days) {
  if (days < 30) return ['cloze', 'keypoint', 'explain'];
  if (days < 180) return ['cloze', 'why', 'keypoint'];
  return ['cloze2', 'why', 'connect', 'explain'];
}

// Candidate questions for one entry. Each has a kind, a prompt, and the target terms a good answer contains.
// others: other entries, [{ topic_title }], used for connection questions.
export function buildQuestions(entry, days, others = []) {
  const topic = entry.topic_title;
  const preferred = keyTerms({ body: '', key_points: entry.key_points ?? [] });
  const out = [];

  for (const s of sentencesOf(entry.body)) {
    const word = anchorOf(s, preferred);
    if (!word) continue;
    out.push({
      kind: 'cloze',
      prompt: `Fill in the blank from what you logged on "${topic}": ${blankWord(s, word)}`,
      targets: [word],
    });
    const second = [...new Set(terms(s))].filter(x => x !== word).sort((a, b) => b.length - a.length)[0];
    if (second) {
      out.push({
        kind: 'cloze2',
        prompt: `Fill in both blanks on "${topic}": ${blankWord(blankWord(s, word), second)}`,
        targets: [word, second],
      });
    }
    const m = s.match(CONNECTIVE);
    if (m) {
      const cause = [...new Set(terms(s.slice(m.index + m[0].length)))].slice(0, 3);
      if (cause.length) {
        out.push({
          kind: 'why',
          prompt: `Rebuild the reason behind this point on "${topic}", in your own words: ${s.slice(0, m.index).trim()} …`,
          targets: cause,
        });
      }
    }
  }

  for (const p of entry.key_points ?? []) {
    const t = [...new Set(terms(p))].slice(0, 3);
    if (t.length) out.push({ kind: 'keypoint', prompt: `From memory, state one key point you recorded on "${topic}".`, targets: t });
  }

  const top = keyTerms(entry).slice(0, 3);
  if (top.length) {
    out.push({ kind: 'explain', prompt: `Explain "${topic}" in your own words. Name the main idea and one detail.`, targets: top });
  }

  for (const o of others) {
    if (!o.topic_title || o.topic_title === topic || !top.length) continue;
    const linkWords = [...new Set(terms(o.topic_title))].slice(0, 2);
    out.push({
      kind: 'connect',
      prompt: `How does "${topic}" connect to "${o.topic_title}"? Give one real link between them.`,
      targets: [...linkWords, top[0]],
    });
  }

  const allowed = kindsFor(days);
  return out.filter(q => allowed.includes(q.kind) && q.targets.length > 0);
}

// Picks a kind at random, then a question of that kind, so no single kind dominates.
export function pickQuestion(candidates, rng = Math.random) {
  if (!candidates.length) return null;
  const kinds = [...new Set(candidates.map(c => c.kind))];
  const kind = kinds[Math.floor(rng() * kinds.length)];
  const pool = candidates.filter(c => c.kind === kind);
  return pool[Math.floor(rng() * pool.length)];
}

// Scores an answer by how many target terms it contains. Very short answers are capped.
export function gradeQuestion(q, answer) {
  const have = new Set(terms(answer));
  const missed = q.targets.filter(t => !have.has(t));
  let score = Math.round((100 * (q.targets.length - missed.length)) / q.targets.length);
  const words = String(answer ?? '').trim().split(/\s+/).filter(Boolean).length;
  if (words < 3) score = Math.min(score, 30);
  const comment = missed.length ? `You missed: ${missed.join(', ')}.` : 'You covered every key term.';
  return { score, missed, comment, weak: score < WEAK_SCORE };
}
