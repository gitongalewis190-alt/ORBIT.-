// Logic tests for the pure modules: autocorrect, spring, tab geometry and duration wording.
// Run with esbuild, which the app uses for bundling: esbuild tests/logic.test.mjs --bundle --platform=node --outfile=/tmp/logic.mjs && node /tmp/logic.mjs
import assert from 'node:assert/strict';
import { autocorrectInput, correctWord, atSentenceStart } from '../lib/autocorrect';
import { stepSpring, settled, SPRING } from '../lib/spring';
import { activeTabIndex, tabCentre, barPath, NAV, tabIndexAt } from '../lib/tabs';
import { dayLabel, minutesLabel } from '../lib/format';
import { prettyDate } from '../lib/dates';

const typed = (value, cursor, ch) => autocorrectInput(value, cursor, ch);
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };

console.log('Autocorrect');
check('typo fixed when a space ends the word', () => {
  assert.deepEqual(typed('I went teh ', 11, ' '), { text: 'I went the ', cursor: 11 });
});
check('typo keeps a capital at the start', () => {
  assert.deepEqual(typed('Teh ', 4, ' '), { text: 'The ', cursor: 4 });
});
check('typo keeps an all-capitals word', () => {
  assert.deepEqual(typed('TEH ', 4, ' '), { text: 'THE ', cursor: 4 });
});
check('apostrophe contraction fixed on punctuation', () => {
  assert.deepEqual(typed('dont.', 5, '.'), { text: "don't.", cursor: 6 });
});
check('standalone i becomes I', () => {
  assert.deepEqual(typed('so i ', 5, ' '), { text: 'so I ', cursor: 5 });
});
check('im becomes I\'m', () => {
  assert.deepEqual(typed('im ', 3, ' '), { text: "I'm ", cursor: 4 });
});
check('a word inside a longer word is not changed', () => {
  assert.deepEqual(typed('hi ', 3, ' '), { text: 'hi ', cursor: 3 });
});
check('Enter finishes a word too', () => {
  assert.deepEqual(typed('teh\n', 4, '\n'), { text: 'the\n', cursor: 4 });
});
check('letter at the start of a sentence is capitalised', () => {
  assert.deepEqual(typed('Hello. w', 8, 'w'), { text: 'Hello. W', cursor: 8 });
});
check('letter at the start of a line is capitalised', () => {
  assert.deepEqual(typed('a\nb', 3, 'b'), { text: 'a\nB', cursor: 3 });
});
check('letter after a bullet marker is capitalised', () => {
  assert.deepEqual(typed('- x', 3, 'x'), { text: '- X', cursor: 3 });
});
check('letter in the middle of a sentence is not capitalised', () => {
  assert.deepEqual(typed('the cat', 7, 't'), { text: 'the cat', cursor: 7 });
});
check('space before punctuation is removed', () => {
  assert.deepEqual(typed('word ,', 6, ','), { text: 'word,', cursor: 5 });
});
check('space is added after a comma before a letter', () => {
  assert.deepEqual(typed('a,b', 3, 'b'), { text: 'a, b', cursor: 4 });
});
check('double space becomes one space', () => {
  assert.deepEqual(typed('a  ', 3, ' '), { text: 'a ', cursor: 2 });
});
check('-- becomes an en dash', () => {
  assert.deepEqual(typed('x--', 3, '-'), { text: 'x–', cursor: 2 });
});
check('(c) becomes a copyright sign', () => {
  assert.deepEqual(typed('(c)', 3, ')'), { text: '©', cursor: 1 });
});
check('a character that does not match the cursor changes nothing', () => {
  assert.deepEqual(typed('abc', 2, 'z'), { text: 'abc', cursor: 2 });
});
check('correctWord returns null for an unknown word', () => {
  assert.equal(correctWord('orbit'), null);
});
check('atSentenceStart at the very start', () => {
  assert.equal(atSentenceStart(''), true);
  assert.equal(atSentenceStart('word '), false);
});

console.log('Spring');
check('spring reaches its target and settles', () => {
  let s = { x: 0, v: 0 };
  let frames = 0;
  while (!settled(s, 100) && frames < 600) {
    s = stepSpring(s, 100, 1 / 60);
    frames++;
  }
  assert.ok(settled(s, 100), 'did not settle');
  assert.ok(frames < 120, `took ${frames} frames`);
});
check('spring overshoots slightly, by less than 10%', () => {
  let s = { x: 0, v: 0 };
  let peak = 0;
  for (let i = 0; i < 300; i++) {
    s = stepSpring(s, 100, 1 / 60);
    peak = Math.max(peak, s.x);
  }
  assert.ok(peak > 100, 'expected a small overshoot');
  assert.ok(peak < 110, `overshoot too large: ${peak}`);
});
check('spring is stable for a long frame (clamped step)', () => {
  const s = stepSpring({ x: 0, v: 0 }, 100, 5);
  assert.ok(Number.isFinite(s.x) && Math.abs(s.x) < 200);
  assert.equal(SPRING.stiffness > 0 && SPRING.damping > 0, true);
});

console.log('Navigation geometry');
const tabs = [['/', 'Today'], ['/topics', 'Topics'], ['/journal', 'Journal'], ['/awards', 'Awards'], ['/log', 'Logs']];
check('activeTabIndex finds each tab and nested pages', () => {
  assert.equal(activeTabIndex(tabs, '/'), 0);
  assert.equal(activeTabIndex(tabs, '/journal'), 2);
  assert.equal(activeTabIndex(tabs, '/journal/new'), 2);
  assert.equal(activeTabIndex(tabs, '/logs/x'), -1);
});
check('settings, guide and stats are not tabs, so the bar hides', () => {
  assert.equal(activeTabIndex(tabs, '/settings'), -1);
  assert.equal(activeTabIndex(tabs, '/guide'), -1);
  assert.equal(activeTabIndex(tabs, '/stats'), -1);
});
check('Today does not light up for every page', () => {
  assert.equal(activeTabIndex(tabs, '/topicsfoo'), -1);
});
check('tab centres are evenly spread and inside the bar', () => {
  const w = 400;
  const centres = tabs.map((_, i) => tabCentre(i, tabs.length, w));
  assert.equal(centres[0], 40);
  assert.equal(centres[4], 360);
  assert.ok(centres.every((c, i) => i === 0 || Math.abs(c - centres[i - 1] - 80) < 1e-9));
});
check('tapping position maps to a tab', () => {
  assert.equal(tabIndexAt(0, 0, 400, 5), 0);
  assert.equal(tabIndexAt(399, 0, 400, 5), 4);
  assert.equal(tabIndexAt(-50, 0, 400, 5), 0);
});
check('notch radius is larger than its centre line, so it opens through the top edge', () => {
  assert.ok(NAV.r + NAV.gap > NAV.cy);
});
check('bar path carves the notch and keeps it inside the bar', () => {
  const d = barPath({ width: 400, cx: 40 });
  const dx = Math.sqrt((NAV.r + NAV.gap) ** 2 - NAV.cy ** 2);
  assert.ok(d.includes(`A ${NAV.r + NAV.gap} ${NAV.r + NAV.gap} 0 1 0 ${(40 + dx).toFixed(2)} 0`), d);
  assert.ok(d.startsWith('M '));
  assert.ok(d.endsWith('Z'));
});
check('bar path notch follows the selector centre', () => {
  const a = barPath({ width: 400, cx: 40 });
  const b = barPath({ width: 400, cx: 120 });
  assert.notEqual(a, b);
});

console.log('Duration and day wording');
const now = '2026-11-06';
check('dayLabel says Today and Yesterday', () => {
  assert.equal(dayLabel('2026-11-06', now, prettyDate), 'Today');
  assert.equal(dayLabel('2026-11-05', now, prettyDate), 'Yesterday');
});
check('dayLabel gives a date for older days', () => {
  assert.equal(dayLabel('2026-10-01', now, prettyDate), prettyDate('2026-10-01'));
  assert.equal(dayLabel(null, now, prettyDate), '');
});
check('minutesLabel reads naturally', () => {
  assert.equal(minutesLabel(30), '30 min');
  assert.equal(minutesLabel(90), '1 h 30 min');
  assert.equal(minutesLabel(120), '2 h');
  assert.equal(minutesLabel(0), '0 min');
  assert.equal(minutesLabel(null), '0 min');
});

console.log(`\n${passed} checks passed.`);
