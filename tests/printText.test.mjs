// Run with env set: NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... esbuild tests/printText.test.mjs --bundle --platform=node --format=cjs --outfile=/tmp/printText.cjs && node /tmp/printText.cjs
import assert from 'node:assert/strict';
import { plainText } from '../lib/richtext';
import { clean, pageDims, pickColour, configurePage, richRuns } from '../lib/export';
import { customRange } from '../lib/printRecord';
import { RETENTION_OPTIONS, expiresAt, DEFAULT_PRINT } from '../lib/printSettings';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };
console.log('Printed record');
check('bold markers are removed from printed entries', () => {
  assert.equal(plainText('**Key idea** matters'), 'Key idea matters');
});
check('em dash survives into the PDF as an em dash', () => {
  assert.equal(clean('one \u2014 two'), 'one \u2014 two');
});
check('en dash still prints as a hyphen, quotes stay readable', () => {
  assert.equal(clean('a \u2013 b \u201Chi\u201D'), 'a - b "hi"');
});
check('A4 and Letter sizes, with landscape swapping them', () => {
  assert.deepEqual(pageDims('a4', 'portrait'), { w: 210, h: 297 });
  assert.deepEqual(pageDims('letter', 'landscape'), { w: 279.4, h: 215.9 });
});
check('black and white turns colour into grey, colour leaves it alone', () => {
  configurePage({ colour: false });
  const g = pickColour([196, 98, 61]);
  assert.equal(g[0], g[1]); assert.equal(g[1], g[2]);
  configurePage({ colour: true });
  assert.deepEqual(pickColour([196, 98, 61]), [196, 98, 61]);
});
check('custom range needs both dates and from on or before to', () => {
  assert.equal(customRange('', '2026-04-01'), null);
  assert.equal(customRange('2026-05-01', '2026-04-01'), null);
  assert.deepEqual(customRange('2024-04-02', '2026-04-01').range, { from: '2024-04-02', to: '2026-04-01' });
});
check('bold, italic, underline and highlight runs are split out', () => {
  assert.deepEqual(richRuns('a **b** c'), [{ text: 'a ' }, { text: 'b', bold: true }, { text: ' c' }]);
  assert.deepEqual(richRuns('==x=='), [{ text: 'x', highlight: 'yellow' }]);
  assert.deepEqual(richRuns('==teal:x=='), [{ text: 'x', highlight: 'teal' }]);
  assert.deepEqual(richRuns('*i* __u__'), [{ text: 'i', italic: true }, { text: ' ' }, { text: 'u', underline: true }]);
});
check('retention offers a range, and the default is one year', () => {
  assert.ok(RETENTION_OPTIONS.length >= 5);
  assert.equal(DEFAULT_PRINT.retentionDays, 365);
  const ms = Date.parse(expiresAt(30, 0));
  assert.equal(ms, 30 * 86400000);
});
console.log(`\n${passed} passed`);
