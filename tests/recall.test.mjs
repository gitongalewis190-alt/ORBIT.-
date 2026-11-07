// Recall tests. Run: esbuild tests/recall.test.mjs --bundle --platform=node --outfile=/tmp/recall.mjs && node /tmp/recall.mjs
import assert from 'node:assert/strict';
import { pickRecall, bandFor, ageInDays, heuristicReview, keyTerms, entryWeight, BANDS } from '../lib/recall';

const DAY = 86400000;
const NOW = Date.parse('2026-11-07T12:00:00Z');
const ago = d => new Date(NOW - d * DAY).toISOString();
const entry = (id, d, extra = {}) => ({ id, topic_id: 't' + id, topic_title: 'Topic ' + id, created_at: ago(d), lastScore: null, ...extra });

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };

console.log('Recall');
check('age bands cover yesterday through a year and beyond', () => {
  assert.equal(bandFor(1).key, '1d');
  assert.equal(bandFor(45).key, '1m');
  assert.equal(bandFor(400).key, '1y');
  assert.equal(bandFor(0), null);
  assert.equal(ageInDays(ago(3), NOW), 3);
});
check('same-day entries are never asked', () => {
  assert.equal(pickRecall([entry('a', 0)], { now: NOW }), null);
});
check('each band is equally likely regardless of how many entries it holds', () => {
  const cands = [entry('r1', 2), entry('r2', 3), entry('r3', 4), entry('r4', 5), entry('y1', 400)];
  const counts = { '1d': 0, '1y': 0 };
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 4000; i++) counts[pickRecall(cands, { now: NOW, rng }).band.key]++;
  assert.ok(Math.abs(counts['1d'] - counts['1y']) < 300, JSON.stringify(counts));
});
check('weak past scores weigh more than strong ones', () => {
  assert.ok(entryWeight({ lastScore: 40 }) > entryWeight({ lastScore: 90 }));
});
check('recently asked entries are skipped while others remain', () => {
  const cands = [entry('a', 10), entry('b', 10)];
  const picked = pickRecall(cands, { now: NOW, rng: () => 0, recentAsks: { a: NOW - DAY } });
  assert.equal(picked.entry.id, 'b');
});
check('cooldown relaxes when nothing else is left', () => {
  const picked = pickRecall([entry('a', 10)], { now: NOW, recentAsks: { a: NOW - DAY } });
  assert.equal(picked.entry.id, 'a');
});
check('local scorer rewards recalled key terms and caps very short answers', () => {
  const src = { body: 'Photosynthesis converts sunlight into chemical energy inside chloroplasts using chlorophyll.', key_points: ['chlorophyll absorbs light'] };
  const good = heuristicReview('Plants use chlorophyll to absorb light and convert sunlight into chemical energy.', src);
  const short = heuristicReview('chlorophyll', src);
  assert.ok(good.score >= 40 && good.score <= 100, String(good.score));
  assert.ok(short.score <= 30);
  assert.match(good.comment, /You missed/);
});
check('key terms include the learner key points', () => {
  assert.ok(keyTerms({ body: 'alpha', key_points: ['glacier melt'] }).includes('glacier'));
});
console.log(`\n${passed} passed`);
