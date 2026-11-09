// Swap trade-offs. A swap is free once a day. After that, a swap is earned by passing a trade-off.
// Each trade-off is drawn uniformly at random from the ones you are able to do today.
// No trade-off is weighted toward another, and none is favoured because it came up before.

export const MAX_EARNED_PER_DAY = 3;   // the most swaps you can earn in one day
export const ODD_WORDS = ['pelican', 'lantern', 'marble', 'orchard', 'tuba', 'compass', 'velvet'];

// rng returns a number in [0, 1). The app passes a cryptographic one; tests pass a seeded one.
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}
export function pickOne(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// The five trade-offs. needs: how many learned topics the trade-off requires.
export const KINDS = {
  reflect_topic: { needs: 1, label: 'Reflect on a learned topic' },
  focus_minutes: { needs: 0, label: 'Focus for a set time' },
  two_topics: { needs: 2, label: 'Reflect on two learned topics' },
  odd_word: { needs: 1, label: 'Use an unusual word' },
  letter_tag: { needs: 1, label: 'Write a letter' },
};

// Draws one trade-off. learned: array of { id, title } the user has learned.
export function drawChallenge(learned, rng = Math.random) {
  const eligible = Object.keys(KINDS).filter(k => learned.length >= KINDS[k].needs);
  if (!eligible.length) return null;
  const kind = pickOne(rng, eligible);
  const id = `c${Date.now().toString(36)}${Math.floor(rng() * 1e9).toString(36)}`;
  const topic = pickOne(rng, learned);
  const params = {};
  let text = '';
  switch (kind) {
    case 'reflect_topic': {
      params.topicId = topic.id; params.title = topic.title; params.words = randInt(rng, 120, 300);
      text = `Reflect on “${topic.title}” in at least ${params.words} words.`;
      break;
    }
    case 'focus_minutes': {
      params.minutes = randInt(rng, 10, 25);
      text = `Reflect for ${params.minutes} minutes on the reflection timer in the Journal.`;
      break;
    }
    case 'two_topics': {
      const other = pickOne(rng, learned.filter(t => t.id !== topic.id)) ?? topic;
      params.a = topic.id; params.aTitle = topic.title;
      params.b = other.id; params.bTitle = other.title;
      params.words = 60;
      text = `Reflect on “${topic.title}” and on “${other.title}”, at least ${params.words} words each.`;
      break;
    }
    case 'odd_word': {
      params.topicId = topic.id; params.title = topic.title; params.word = pickOne(rng, ODD_WORDS); params.words = randInt(rng, 100, 220);
      text = `Reflect on “${topic.title}” in at least ${params.words} words, and use the word “${params.word}”.`;
      break;
    }
    case 'letter_tag': {
      params.topicId = topic.id; params.title = topic.title; params.words = randInt(rng, 100, 200);
      text = `Write a letter to “${topic.title}” in at least ${params.words} words, and tag the reflection “letter”.`;
      break;
    }
  }
  return { id, kind, text, params };
}

// Checks progress against a started challenge.
// entries: journal rows created after the challenge started (topic_id, entry_kind, word_count, body, tags).
// focusSince: focus minutes today since the challenge started.
export function verifyChallenge(c, { entries = [], focusSince = 0 }) {
  const reflections = entries.filter(e => e.entry_kind === 'reflection');
  const wordsOn = topicId => reflections
    .filter(e => e.topic_id === topicId).reduce((t, e) => t + (Number(e.word_count) || 0), 0);
  const p = c.params;
  switch (c.kind) {
    case 'reflect_topic': {
      const done = wordsOn(p.topicId);
      return { passed: done >= p.words, done, need: p.words, label: `${Math.min(done, p.words)} of ${p.words} words` };
    }
    case 'focus_minutes': {
      return { passed: focusSince >= p.minutes, done: focusSince, need: p.minutes, label: `${Math.min(focusSince, p.minutes)} of ${p.minutes} minutes` };
    }
    case 'two_topics': {
      const a = Math.min(wordsOn(p.a), p.words);
      const b = Math.min(wordsOn(p.b), p.words);
      return { passed: a >= p.words && b >= p.words, done: a + b, need: p.words * 2, label: `${a} of ${p.words} and ${b} of ${p.words} words` };
    }
    case 'odd_word': {
      const hasWord = reflections.some(e => e.topic_id === p.topicId && String(e.body || '').toLowerCase().includes(p.word));
      const done = wordsOn(p.topicId);
      return {
        passed: hasWord && done >= p.words,
        done, need: p.words,
        label: `${Math.min(done, p.words)} of ${p.words} words${hasWord ? '' : `, and “${p.word}” not used yet`}`,
      };
    }
    case 'letter_tag': {
      const tagged = reflections.some(e => e.topic_id === p.topicId && (e.tags || []).includes('letter'));
      const done = wordsOn(p.topicId);
      return {
        passed: tagged && done >= p.words,
        done, need: p.words,
        label: `${Math.min(done, p.words)} of ${p.words} words${tagged ? '' : ', and the “letter” tag not added yet'}`,
      };
    }
    default:
      return { passed: false, done: 0, need: 0, label: '' };
  }
}

// Swap allowance for the day: one free swap, plus one for each passed trade-off.
export function swapsLeft({ earned = 0, swapped = 0 }) {
  return 1 + earned - swapped;
}
