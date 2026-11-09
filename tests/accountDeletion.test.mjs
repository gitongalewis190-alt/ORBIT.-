import assert from 'node:assert/strict';
import { daysLeft, DELETION_WINDOW_DAYS } from '../lib/deletionWindow.js';

const DAY = 86400000;
const now = Date.parse('2026-11-09T12:00:00Z');
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };
console.log('Account deletion window');
check('the window is 60 days', () => { assert.equal(DELETION_WINDOW_DAYS, 60); });
check('a full 60 days left reads 60', () => { assert.equal(daysLeft(new Date(now + 60 * DAY).toISOString(), now), 60); });
check('part of a day still counts as a day left', () => { assert.equal(daysLeft(new Date(now + DAY / 2).toISOString(), now), 1); });
check('a passed date never reads below zero', () => { assert.equal(daysLeft(new Date(now - 3 * DAY).toISOString(), now), 0); });
console.log(`${passed} passed`);
