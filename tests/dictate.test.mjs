import assert from 'node:assert/strict';
import { shapePhrase, splitUtterance } from '../lib/dictate.js';

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log('  ok  ' + name); };

console.log('Dictate');

check('drops fillers and capitalises', () => {
  assert.equal(shapePhrase('um the memory trace is stable'), 'The memory trace is stable');
});

check('spoken punctuation becomes marks', () => {
  assert.equal(shapePhrase('attention drifts comma then returns period'), 'Attention drifts, then returns.');
});

check('splits a run of sentences', () => {
  assert.deepEqual(
    splitUtterance('first idea. second idea? third idea'),
    ['First idea.', 'Second idea?', 'Third idea'],
  );
});

check('empty filler is not a phrase', () => {
  assert.equal(shapePhrase('um uh you know'), '');
  assert.deepEqual(splitUtterance('er'), []);
});

check('new line splits phrases', () => {
  assert.deepEqual(splitUtterance('keep this new line start the next'), ['Keep this', 'Start the next']);
});

console.log(passed + ' passed');
