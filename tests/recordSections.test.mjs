import assert from 'node:assert/strict';
import { recallSection, memorySection, atlasSection, resultsSection, dash } from '../lib/recordSections.js';

const window = iso => {
  const day = String(iso || '').slice(0, 10);
  return day >= '2026-01-01' && day <= '2026-06-01';
};

const quizzes = Array.from({ length: 151 }, (_, index) => ({
  asked_at: '2026-02-01T00:00:00.000Z',
  topic_title: index === 0 ? null : `Topic ${index}`,
  question: 'Q'.repeat(180),
  answer: index === 2 ? null : 'A'.repeat(240),
  score: index === 3 ? null : 40 + (index % 50),
  verifier: index % 2 ? 'groq' : 'local',
}));
quizzes.push({ asked_at: '2020-01-01', topic_title: 'Old', question: 'Old', answer: 'Old', score: 10, verifier: 'local' });

const recall = recallSection(quizzes, window);
assert.equal(recall.rows.length, 150);
assert.match(recall.note, /and 1 more are in the app/);
assert.equal(recall.rows[0][1], '\u2014');
assert.ok(recall.rows[0][2].length <= 140);
assert.equal(recall.rows[2][3], '\u2014');
assert.equal(recall.rows[3][4], '\u2014');
assert.equal(recallSection([], window).empty, 'No recall quizzes in this window.');

const memory = memorySection([{ title: null, stability: null, due_on: '2026-02-02', last_reviewed_on: '2026-01-02' }], window);
assert.equal(memory.rows[0][0], '\u2014');
assert.equal(memory.rows[0][2], '\u2014');
assert.equal(memorySection([], window).empty, 'No memory-model rows in this window.');

const manyLinks = Array.from({ length: 121 }, (_, index) => ({ source: `A${index}`, relationship: 'part_of', target: `B${index}`, verification: 'verified' }));
const atlas = atlasSection({ concepts: [{ status: 'verified' }], edges: manyLinks, claims: [{}], mastery: [{ name: 'C', recall: null }], discoveries: [] });
assert.equal(atlas.rows.length, 120);
assert.match(atlas.note, /and 1 more/);
assert.equal(atlas.extra.rows[0][1], '\u2014');
assert.equal(atlasSection({}).empty, 'No Atlas data yet.');

const emptyResults = resultsSection({ asOf: '2026-11-08', keystone: null, parallax: { n: 3 } });
assert.match(emptyResults.paragraphs.join('\n'), /insufficient evidence yet/);
const dumped = JSON.stringify(emptyResults);
assert.doesNotMatch(dumped, /lambda/i);
assert.doesNotMatch(dumped, /formula/i);
assert.doesNotMatch(dumped, /sensitivity/i);
assert.equal(dumped.includes('undefined'), false);
assert.equal(dumped.includes('NaN'), false);

const filled = resultsSection({
  asOf: '2026-11-08',
  keystone: { coupling: { status: 'not supported', gain: 0, heldOut: 30 }, events: 40, coverage: 0.1, planK: 1, baselineK: 1, topics: [], concepts: [], sparse: true },
  parallax: { n: 22, status: 'no detectable gap', auc: null, assumption: 'Quiz grading is done by a small AI model or a keyword matcher, so some results are wrong; Orbit assumes at most 20 percent are.' },
});
const text = filled.paragraphs.join('\n');
assert.match(text, /Not supported by your history yet/);
assert.match(text, /not distinguishable|null|—/);
assert.doesNotMatch(text, /lambda/i);
assert.doesNotMatch(text, /formula/i);
assert.equal(dash(undefined), '\u2014');
assert.equal(dash(0), '0');

function walk(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  if (value === undefined) assert.fail('undefined cell');
  if (Array.isArray(value)) value.forEach(walk);
  else if (value && typeof value === 'object') Object.values(value).forEach(walk);
}
walk(recall);
walk(memory);
walk(atlas);
walk(filled);
console.log('record sections ok');
