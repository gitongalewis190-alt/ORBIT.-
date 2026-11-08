import assert from 'node:assert/strict';
import { explainWeight, CONTROL_WEIGHT } from '../lib/selector.js';
import { topicChoiceDrawer, reviewDrawer, whatIfRows, dataBackupCard, dataBackupMembers, show, hasSecretKey, cardShell } from '../lib/inspect.js';
import { gradeFromConfidence, nextStability, nextDifficulty, targetInterval } from '../lib/memory.js';
import { addDays } from '../lib/dates.js';

const topic = { id: 't1', fieldId: 'f1', difficulty: 'advanced' };
const ctx = {
  controls: new Map([['t1', 'show_more']]),
  recentFieldIds: new Set(['f1']),
  fieldConfidence: new Map([['f1', 2]]),
  atlasTopicIds: new Set(['t1']),
};
const explained = explainWeight(topic, ctx, 'reinforce', 'advanced');
const product = explained.factors.reduce((total, factor) => total * factor.value, 1);
assert.equal(product, explained.weight);
assert.equal(explained.weight, CONTROL_WEIGHT.show_more * 0.4 * 3 * 2 * 1.6);

const drawer = topicChoiceDrawer(topic, ctx, 'reinforce', 'advanced', { share: '5 percent', pool: 12, recomputed: false });
for (const key of ['title', 'verdict', 'numbers', 'method', 'provenance', 'controls', 'raw']) {
  assert.ok(key in drawer, key);
}
assert.equal(hasSecretKey(drawer), false);

const review = { stability: 4, difficulty: 5, last_reviewed_on: '2026-11-01', ease: 2.5, reps: 3, interval_days: 4 };
const fit = { k: 1, n: 8 };
const today = '2026-11-08';
const rows = whatIfRows(review, fit, today);
assert.equal(rows.length, 6);
for (const row of rows) {
  const grade = gradeFromConfidence(row.confidence);
  const stability = nextStability(review.stability, review.difficulty, grade, null);
  assert.equal(row.stability, stability);
  assert.equal(row.due, addDays(today, targetInterval(stability, fit.k)));
  assert.equal(row.difficulty, nextDifficulty(review.difficulty, grade));
}
const unknown = whatIfRows({ stability: null }, fit, today);
assert.equal(unknown[0].due, null);
assert.equal(show(null), '\u2014');
assert.equal(show(undefined), '\u2014');

const reviewCard = reviewDrawer(review, fit, today);
assert.ok(reviewCard.numbers.some(item => item.value === '\u2014' || item.label));
assert.equal(hasSecretKey(reviewCard), false);

const members = dataBackupMembers();
assert.ok(members.length >= 6);
const card = dataBackupCard({ lastBackup: null, queue: 0, drive: null, storage: null });
const ids = new Set(card.controls.map(item => item.id));
for (const member of members) {
  assert.ok(ids.has(member.id), member.id);
  assert.ok(member.route || member.action, member.id);
  const control = card.controls.find(item => item.id === member.id);
  assert.ok(control.route || control.action, member.id);
}
assert.equal(card.numbers.find(item => item.label === 'Last backup').value, '\u2014');
assert.equal(hasSecretKey(card), false);

const shell = cardShell('Quiz grading', 'No external call has been recorded on this phone.', []);
for (const key of ['title', 'verdict', 'numbers', 'method', 'provenance', 'controls', 'raw']) {
  assert.ok(key in shell, key);
}
assert.equal(hasSecretKey(shell), false);
console.log('inspect ok');
