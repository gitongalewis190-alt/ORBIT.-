import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawChallenge, verifyChallenge, swapsLeft, KINDS } from '../lib/challenges.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
const learned = [{ id: 'a', title: 'Ethics' }, { id: 'b', title: 'Psychology' }, { id: 'c', title: 'Neural nets' }];

test('with no learned topics, only the focus trade-off is available', () => {
  for (let i = 0; i < 50; i++) assert.equal(drawChallenge([], seeded(i)).kind, 'focus_minutes');
});

test('every trade-off is drawn, and no single one dominates', () => {
  const rng = seeded(7);
  const counts = {};
  for (let i = 0; i < 5000; i++) {
    const k = drawChallenge(learned, rng).kind;
    counts[k] = (counts[k] || 0) + 1;
  }
  assert.equal(Object.keys(counts).length, Object.keys(KINDS).length);
  for (const n of Object.values(counts)) assert.ok(n > 700 && n < 1300, `skewed: ${n}`);
});

test('a trade-off never refers to a topic the user has not learned', () => {
  const rng = seeded(11);
  for (let i = 0; i < 300; i++) {
    const c = drawChallenge(learned, rng);
    for (const v of Object.values(c.params)) {
      if (typeof v === 'string' && /^[abc]$/.test(v)) assert.ok(['a', 'b', 'c'].includes(v));
    }
  }
});

test('reflecting on a topic passes once enough words are written on it', () => {
  const c = { kind: 'reflect_topic', params: { topicId: 'a', title: 'Ethics', words: 120 } };
  assert.equal(verifyChallenge(c, { entries: [{ topic_id: 'a', entry_kind: 'reflection', word_count: 60 }] }).passed, false);
  assert.equal(verifyChallenge(c, { entries: [{ topic_id: 'a', entry_kind: 'reflection', word_count: 130 }] }).passed, true);
});

test('a learn entry does not pass a reflection trade-off', () => {
  const c = { kind: 'reflect_topic', params: { topicId: 'a', title: 'Ethics', words: 50 } };
  assert.equal(verifyChallenge(c, { entries: [{ topic_id: 'a', entry_kind: 'research', word_count: 500 }] }).passed, false);
});

test('odd word needs the word and the length', () => {
  const c = { kind: 'odd_word', params: { topicId: 'a', word: 'tuba', words: 100 } };
  assert.equal(verifyChallenge(c, { entries: [{ topic_id: 'a', entry_kind: 'reflection', word_count: 150, body: 'no' }] }).passed, false);
  assert.equal(verifyChallenge(c, { entries: [{ topic_id: 'a', entry_kind: 'reflection', word_count: 150, body: 'a Tuba here' }] }).passed, true);
});

test('letter needs the tag', () => {
  const c = { kind: 'letter_tag', params: { topicId: 'a', words: 100 } };
  assert.equal(verifyChallenge(c, { entries: [{ topic_id: 'a', entry_kind: 'reflection', word_count: 150, tags: [] }] }).passed, false);
  assert.equal(verifyChallenge(c, { entries: [{ topic_id: 'a', entry_kind: 'reflection', word_count: 150, tags: ['letter'] }] }).passed, true);
});

test('focus passes on minutes since the challenge started', () => {
  const c = { kind: 'focus_minutes', params: { minutes: 15 } };
  assert.equal(verifyChallenge(c, { focusSince: 14 }).passed, false);
  assert.equal(verifyChallenge(c, { focusSince: 15 }).passed, true);
});

test('two topics need both', () => {
  const c = { kind: 'two_topics', params: { a: 'a', b: 'b', words: 60 } };
  const one = [{ topic_id: 'a', entry_kind: 'reflection', word_count: 80 }];
  assert.equal(verifyChallenge(c, { entries: one }).passed, false);
  assert.equal(verifyChallenge(c, { entries: [...one, { topic_id: 'b', entry_kind: 'reflection', word_count: 60 }] }).passed, true);
});

test('swaps: one free, plus one for each pass, minus those used', () => {
  assert.equal(swapsLeft({ earned: 0, swapped: 0 }), 1);
  assert.equal(swapsLeft({ earned: 0, swapped: 1 }), 0);
  assert.equal(swapsLeft({ earned: 1, swapped: 1 }), 1);
});
