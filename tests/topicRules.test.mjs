import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ruleFor, blockFor, noteFor, kindChangeBlock } from '../lib/topicRules.js';

const L = ids => new Set(ids);

test('a new topic is learned, not reflected', () => {
  const r = ruleFor('psych', { learned: L([]), due: L([]) });
  assert.equal(r.mode, 'learn');
  assert.equal(r.canLearn, true);
  assert.equal(r.canReflect, false);
  assert.equal(blockFor('learn', r), '');
  assert.notEqual(blockFor('reflect', r), '');
});

test('a learned topic defaults to reflect and cannot be learned again', () => {
  const r = ruleFor('ethics', { learned: L(['ethics']), due: L([]) });
  assert.equal(r.mode, 'reflect');
  assert.equal(r.canLearn, false);
  assert.equal(blockFor('reflect', r), '');
  assert.notEqual(blockFor('learn', r), '');
});

test('a learned topic is never learned again, even when its review is due', () => {
  const r = ruleFor('ethics', { learned: L(['ethics']), due: L(['ethics']) });
  assert.equal(r.canLearn, false);
  assert.notEqual(blockFor('learn', r), '');
  assert.equal(blockFor('reflect', r), '');
  assert.match(noteFor('reflect', r), /review/);
});

test('no topic chosen means nothing is blocked yet', () => {
  assert.equal(blockFor('learn', null), '');
  assert.equal(noteFor('learn', null), '');
});

test('changing a Learn entry to Reflect needs a learned topic elsewhere', () => {
  assert.notEqual(kindChangeBlock('reflection', { otherResearch: 0 }), '');
  assert.equal(kindChangeBlock('reflection', { otherResearch: 1 }), '');
});

test('changing a Reflect entry to Learn is blocked for a learned topic', () => {
  assert.notEqual(kindChangeBlock('research', { otherResearch: 1 }), '');
  assert.equal(kindChangeBlock('research', { otherResearch: 0 }), '');
});
