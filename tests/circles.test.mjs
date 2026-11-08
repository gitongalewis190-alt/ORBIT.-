// Run: esbuild tests/circles.test.mjs --bundle --platform=node --format=cjs --outfile=/tmp/circles.cjs && node /tmp/circles.cjs
import assert from 'node:assert/strict';
import { awardProgress, awardByKey, chainOf } from '../lib/awards.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };
console.log('Three circles');
check('the chain is five, fifteen, forty days, in order', () => {
  assert.deepEqual(chainOf(awardByKey.circles_5).map(a => a.key), ['circles_5', 'circles_15', 'circles_40']);
});
check('five closed days earns the first step only', () => {
  assert.equal(awardProgress(awardByKey.circles_5, { circleDays: 5 }).done, true);
  assert.equal(awardProgress(awardByKey.circles_15, { circleDays: 5 }).done, false);
});
check('missing history counts as zero', () => {
  assert.equal(awardProgress(awardByKey.circles_5, {}).value, 0);
});
console.log(`\n${passed} passed`);
