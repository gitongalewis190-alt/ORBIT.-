// Run: esbuild tests/dayRules.test.mjs --bundle --platform=node --format=cjs --outfile=/tmp/dayRules.cjs && node /tmp/dayRules.cjs
import assert from 'node:assert/strict';
import { canChangeTopic, changesToday, completesAssignment, OVERRIDES_PER_DAY } from '../lib/dayRules.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };

console.log('Day rules');
check('no topic yet means a draw is always allowed', () => {
  assert.equal(canChangeTopic({ assignment: null }).ok, true);
});
check('a topic cannot be changed until what you learned is logged', () => {
  const r = canChangeTopic({ assignment: { status: 'accepted' }, overridesToday: 0 });
  assert.equal(r.ok, false);
  assert.match(r.reason, /Log what you learned/);
});
check('after logging, one change is allowed', () => {
  assert.equal(canChangeTopic({ assignment: { status: 'completed' }, overridesToday: 0 }).ok, true);
});
check('a second change the same day is refused', () => {
  assert.equal(OVERRIDES_PER_DAY, 1);
  assert.equal(canChangeTopic({ assignment: { status: 'completed' }, overridesToday: 1 }).ok, false);
});
check('the first draw is not counted as a change', () => {
  assert.equal(changesToday(1), 0);
  assert.equal(changesToday(2), 1);
  assert.equal(changesToday(0), 0);
});
check('reflections never complete a day, research does', () => {
  assert.equal(completesAssignment('reflection'), false);
  assert.equal(completesAssignment('research'), true);
  assert.equal(completesAssignment(undefined), true);
});
console.log(`\n${passed} passed`);
