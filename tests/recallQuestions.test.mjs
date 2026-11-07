// Run: esbuild tests/recallQuestions.test.mjs --bundle --platform=node --format=cjs --outfile=/tmp/rq.cjs && node /tmp/rq.cjs
import assert from 'node:assert/strict';
import { buildQuestions, kindsFor, pickQuestion, gradeQuestion, sentencesOf } from '../lib/recallQuestions';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };
const entry = {
  topic_title: 'Photosynthesis',
  body: 'Plants capture sunlight using chlorophyll inside their leaves. Chloroplasts convert light energy into chemical energy because the pigments absorb photons. Oxygen is released as a byproduct of the reaction.',
  key_points: ['chlorophyll absorbs light'],
};

console.log('Recall questions');
check('sentences are split and short fragments dropped', () => {
  assert.equal(sentencesOf('Too short. Plants capture sunlight using chlorophyll inside their leaves.').length, 1);
});
check('younger entries get easier kinds, older ones harder kinds', () => {
  assert.deepEqual(kindsFor(3), ['cloze', 'keypoint', 'explain']);
  assert.ok(kindsFor(200).includes('cloze2') && kindsFor(200).includes('connect'));
});
check('a cloze question blanks the target word and names the topic', () => {
  const qs = buildQuestions(entry, 5);
  const cloze = qs.find(q => q.kind === 'cloze');
  assert.ok(cloze.prompt.includes('_____'));
  assert.ok(cloze.prompt.includes('Photosynthesis'));
  assert.ok(!cloze.prompt.includes(cloze.targets[0] + ' '), 'the blanked word must not appear in the prompt');
});
check('a reason question is built from a causal sentence', () => {
  assert.ok(buildQuestions(entry, 60).some(q => q.kind === 'why'));
});
check('connection questions use other topics only when old enough', () => {
  const others = [{ topic_title: 'Cellular respiration' }];
  assert.ok(buildQuestions(entry, 400, others).some(q => q.kind === 'connect'));
  assert.ok(!buildQuestions(entry, 5, others).some(q => q.kind === 'connect'));
});
check('grading counts target terms, and a weak score is flagged', () => {
  const q = { targets: ['chlorophyll', 'sunlight'] };
  assert.equal(gradeQuestion(q, 'Leaves use chlorophyll and sunlight to make food.').score, 100);
  assert.equal(gradeQuestion(q, 'Leaves use chlorophylls and the sunlight to make food.').score, 100);
  const weak = gradeQuestion(q, 'Plants are green and grow in soil.');
  assert.equal(weak.score, 0);
  assert.equal(weak.weak, true);
  assert.match(weak.comment, /You missed/);
});
check('picking spreads across kinds with a fixed random source', () => {
  const qs = buildQuestions(entry, 60);
  const seq = [0.1, 0.9, 0.5];
  let i = 0;
  const rng = () => seq[i++ % seq.length];
  assert.ok(pickQuestion(qs, rng));
  assert.equal(pickQuestion([], rng), null);
});
console.log(`\n${passed} passed`);
