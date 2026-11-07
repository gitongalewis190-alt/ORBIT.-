// Autocorrect for the journal. Pure functions with no DOM, so they can be tested in Node.
//
// Called once for each character the writer types. It only looks at the text
// next to the cursor, so it never rewrites an entry as a whole. Rules:
//   - common typos are fixed when the word is finished (space, Enter or punctuation)
//   - "i" on its own becomes "I"
//   - a letter at the start of a sentence or line is capitalised
//   - a space before , . ; : ! ? is removed, and a letter after , ; : gets a space
//   - a double space becomes one space
//   - "--" becomes an en dash, and "(c)" becomes ©
// Turn it off in Settings. The setting lives on this phone only.

export const TYPOS = {
  teh: 'the', adn: 'and', recieve: 'receive', recieved: 'received', seperate: 'separate',
  seperately: 'separately', definately: 'definitely', occured: 'occurred', untill: 'until',
  wich: 'which', becuase: 'because', becasue: 'because', thier: 'their', goverment: 'government',
  wierd: 'weird', alot: 'a lot', dont: "don't", doesnt: "doesn't", didnt: "didn't",
  cant: "can't", isnt: "isn't", arent: "aren't", wasnt: "wasn't", werent: "weren't",
  couldnt: "couldn't", shouldnt: "shouldn't", wouldnt: "wouldn't", havent: "haven't",
  hasnt: "hasn't", youre: "you're", theyre: "they're", thats: "that's", whats: "what's",
  im: "I'm", ive: "I've", lenght: 'length', beleive: 'believe', acheive: 'achieve',
  freind: 'friend', begining: 'beginning', existance: 'existence', independant: 'independent',
  accomodate: 'accommodate', occassion: 'occasion', tommorow: 'tomorrow', tomorow: 'tomorrow',
  neccessary: 'necessary', calender: 'calendar', enviroment: 'environment', wether: 'whether',
  succesful: 'successful', knowlege: 'knowledge', priviledge: 'privilege', reccomend: 'recommend',
  suprise: 'surprise', writting: 'writing', truely: 'truly', diffrent: 'different',
  diffent: 'different', embarass: 'embarrass', goverments: 'governments',
  thsi: 'this', taht: 'that', hte: 'the', jsut: 'just', becuz: 'because', alredy: 'already',
  allready: 'already', peices: 'pieces', peice: 'piece', wehn: 'when', whcih: 'which',
  waht: 'what', reserch: 'research', resaerch: 'research', understnad: 'understand',
  comprehention: 'comprehension', concious: 'conscious',
};

// Words that are real words elsewhere are left out on purpose ("its", "ill", "id", "wont").

const BOUNDARY = /^[\s.,;:!?)]$/;

// Whether the next letter starts a sentence or a line.
// `before` is all the text before that letter.
export function atSentenceStart(before) {
  if (before === '') return true;
  // Start of a line, optionally after a list marker: "- ", "1. " or "# ".
  if (/(^|\n)[ \t]*(?:(?:-|\d+\.|#{1,3})[ \t]+)?$/.test(before)) return true;
  // After sentence-ending punctuation and at least one space.
  return /[.!?][ \t]+$/.test(before);
}

// The corrected form of one word, or null when it is not in the list.
export function correctWord(word) {
  const key = word.toLowerCase();
  const rep = key === 'i' ? 'I' : TYPOS[key];
  if (!rep) return null;
  // Keep an all-capitals word all capitals.
  if (word.length > 1 && word === word.toUpperCase()) return rep.toUpperCase();
  // Keep a capital at the start.
  if (word[0] !== word[0].toLowerCase()) return rep[0].toUpperCase() + rep.slice(1);
  return rep;
}

// Applies the rules to one character just typed.
// value: the whole text after the typed character went in.
// cursor: the position just after that character.
// ch: the character typed.
// Returns { text, cursor }. When nothing changes, the input is returned as it was.
export function autocorrectInput(value, cursor, ch) {
  if (typeof ch !== 'string' || ch.length !== 1) return { text: value, cursor };
  const pos = cursor - 1;
  if (pos < 0 || value[pos] !== ch) return { text: value, cursor };

  let before = value.slice(0, pos);
  const after = value.slice(cursor);
  let insert = ch;

  // A second space after a space is dropped.
  if (ch === ' ' && / $/.test(before)) {
    return { text: before + after, cursor: pos };
  }

  if (ch === '-' && before.endsWith('-')) {
    before = before.slice(0, -1);
    insert = '–';
  } else if (ch === ')' && /\(c$/i.test(before)) {
    before = before.slice(0, -2);
    insert = '©';
  } else if (',.;:!?'.includes(ch)) {
    // Remove spaces typed before punctuation, but not at the start of a line.
    before = before.replace(/([^\s]) +$/, '$1');
  } else if (/^[A-Za-z]$/.test(ch)) {
    // A letter straight after , ; or : gets a space first.
    if (/[,;:]$/.test(before)) before += ' ';
    if (atSentenceStart(before)) insert = ch.toUpperCase();
  }

  // Finish the word just before a boundary.
  if (BOUNDARY.test(ch) || ch === '\n') {
    const m = before.match(/([A-Za-z]+(?:'[A-Za-z]+)?)$/);
    if (m) {
      const fixed = correctWord(m[1]);
      if (fixed) before = before.slice(0, before.length - m[1].length) + fixed;
    }
  }

  return { text: before + insert + after, cursor: before.length + insert.length };
}

// Reads the setting. Defaults to on. Storage can fail in private windows, so any error means "on".
export function autocorrectOn() {
  try {
    return localStorage.getItem('orbit.autocorrect') !== 'off';
  } catch {
    return true;
  }
}

export function setAutocorrect(on) {
  try {
    localStorage.setItem('orbit.autocorrect', on ? 'on' : 'off');
  } catch {}
}
