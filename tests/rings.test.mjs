import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reflectDay, REFLECT_TARGET } from '../lib/rings.js';

test('no reflections today: nothing counts', () => {
  const d = reflectDay([], new Set());
  assert.equal(d.any, false);
  assert.equal(d.closed, false);
});

test('reflection on an earlier topic closes all three rings when targets are met', () => {
  const entries = [{ topic_id: 't1', minutes_spent: REFLECT_TARGET.minutes, word_count: REFLECT_TARGET.words }];
  const d = reflectDay(entries, new Set(['t1']));
  assert.equal(d.revisits, 1);
  assert.equal(d.closed, true);
});

test('a reflection on a brand-new topic does not count as a revisit', () => {
  const entries = [{ topic_id: 'new', minutes_spent: 20, word_count: 300 }];
  const d = reflectDay(entries, new Set(['t1']));
  assert.equal(d.revisits, 0);
  assert.equal(d.values.revisit, 0);
  assert.equal(d.closed, false);
});

test('rings never exceed 1', () => {
  const entries = [{ topic_id: 't1', minutes_spent: 999, word_count: 9999 }];
  const d = reflectDay(entries, new Set(['t1']));
  assert.equal(d.values.minutes, 1);
  assert.equal(d.values.words, 1);
});
