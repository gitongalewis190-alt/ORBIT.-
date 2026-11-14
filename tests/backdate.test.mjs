import assert from 'node:assert/strict';
import { computeStreak, todayIn } from '../lib/stats.js';
import { addDays, TZ } from '../lib/dates.js';

// Back-dated journal entries are stamped at noon on the chosen day, so they land in the streak like any other day.
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };
console.log('Back-dated entries');

const today = todayIn(TZ);
const noonOn = day => `${day}T12:00:00+03:00`;
const dayOf = iso => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });

check('a back-dated entry lands on the chosen day', () => {
  assert.equal(dayOf(noonOn(addDays(today, -2))), addDays(today, -2));
});

check('back-dated days bridge a gap and extend the streak', () => {
  const days = new Set([today, addDays(today, -1), addDays(today, -2), addDays(today, -3)]);
  assert.equal(computeStreak(days, TZ), 4);
});

check('a back-dated day fills a gap in the middle of a streak', () => {
  const days = new Set([today, addDays(today, -2)]);
  assert.equal(computeStreak(days, TZ), 1, 'without the middle day the streak stops at today');
  days.add(addDays(today, -1));
  assert.equal(computeStreak(days, TZ), 3);
});

check('a back-dated entry does not move today or the streak start', () => {
  const days = new Set([addDays(today, -3)]);
  assert.equal(computeStreak(days, TZ), 0);
});

console.log(`${passed} back-dating checks passed`);
