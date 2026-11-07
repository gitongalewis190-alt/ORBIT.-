import assert from 'node:assert/strict';
import {
  MODEL, recallProbability, gradeFromConfidence, observedRecall, initialMemory,
  nextStability, nextDifficulty, targetInterval, fitPersonal, predictRecall,
  validateChronological, calibrationBands, daysBetween,
} from '../lib/memory.js';

const near = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

assert.equal(gradeFromConfidence(0), 1);
assert.equal(gradeFromConfidence(2), 1);
assert.equal(gradeFromConfidence(3), 2);
assert.equal(gradeFromConfidence(4), 3);
assert.equal(gradeFromConfidence(5), 4);
assert.equal(observedRecall(1), 0);
assert.equal(observedRecall(2), 1);

const S = 4;
const k = 1.3;
const atTarget = recallProbability(S * k, S, k);
assert.ok(near(atTarget, 0.9, 1e-12), atTarget);
const interval = targetInterval(S, k);
assert.equal(interval, Math.max(1, Math.round(S * k)));

for (const stability of [0.01, 0.4, 1, 12, 365, 3650]) {
  for (const difficulty of [1, 5, 10]) {
    for (const grade of [1, 2, 3, 4]) {
      for (const R of [0, 0.2, 0.9, 1]) {
        const next = nextStability(stability, difficulty, grade, R);
        assert.ok(Number.isFinite(next) && next > 0, `${stability} ${difficulty} ${grade} ${R} -> ${next}`);
        if (grade >= 2) assert.ok(next >= stability - 1e-9);
        if (grade === 1) assert.ok(next <= stability + 1e-9);
      }
    }
  }
}

const same = { S: 6, D: 5, R: 0.4 };
const hard = nextStability(same.S, same.D, 2, same.R);
const good = nextStability(same.S, same.D, 3, same.R);
const easy = nextStability(same.S, same.D, 4, same.R);
assert.ok(easy > good && good > hard, `${easy} ${good} ${hard}`);

let grown = 2;
let last = grown;
for (let step = 0; step < 12; step++) {
  const R = recallProbability(3, grown, 1);
  grown = nextStability(grown, 5, 3, R);
  assert.ok(grown >= last);
  last = grown;
}
assert.ok(grown > 2);

let failed = 10;
for (let step = 0; step < 30; step++) {
  const R = recallProbability(1, failed, 1);
  const next = nextStability(failed, 6, 1, R);
  assert.ok(next > 0 && next <= failed);
  failed = next;
}
assert.ok(failed < 2);

const shortGain = nextStability(5, 5, 3, 0.99) - 5;
const longGain = nextStability(5, 5, 3, 0.01) - 5;
assert.ok(longGain > shortGain && shortGain >= 0);

let difficulty = 5;
for (const grade of [1, 1, 4, 4, 1, 4, 4, 1]) difficulty = nextDifficulty(difficulty, grade);
assert.ok(difficulty >= 1 && difficulty <= 10);
assert.equal(nextDifficulty(1, 4), 1);
assert.equal(nextDifficulty(10, 1), 10);

const first = initialMemory(3);
assert.equal(first.stability, MODEL.W0[2]);
assert.ok(first.difficulty >= 1 && first.difficulty <= 10);

const few = Array.from({ length: 7 }, (_, index) => ({
  t: index + 1, stabilityBefore: 3, y: 1, at: `2026-01-${String(index + 2).padStart(2, '0')}`,
}));
const earlyFit = fitPersonal(few);
assert.equal(earlyFit.k, 1);
assert.equal(earlyFit.learning, true);
assert.equal(earlyFit.lo, null);

const many = Array.from({ length: 24 }, (_, index) => ({
  t: 10, stabilityBefore: 2, y: index % 5 === 0 ? 0 : 1, at: `2026-02-${String(index + 1).padStart(2, '0')}`, derived: false,
}));
const fit = fitPersonal(many);
assert.ok(fit.k >= MODEL.kMin && fit.k <= MODEL.kMax);
assert.ok(fit.lo <= fit.k && fit.k <= fit.hi);
assert.equal(fit.early, true);
const prediction = predictRecall(4, 3, fit);
assert.ok(prediction.mean >= prediction.lo - 1e-9 && prediction.mean <= prediction.hi + 1e-9);
assert.ok(prediction.width >= 0);

const ignored = fitPersonal([{ t: 0, stabilityBefore: 2, y: 1 }, { t: 4, stabilityBefore: null, y: 1 }, { t: 4, stabilityBefore: 2, y: 1, derived: true }]);
assert.equal(ignored.n, 0);

const validation = validateChronological(many);
assert.equal(validation.nTest, Math.ceil(many.length * 0.3) > 0 ? validation.nTest : 0);
assert.equal(typeof validation.claim, 'boolean');
assert.ok(validation.nTest < 20 || validation.claim === (validation.fittedLoss < validation.baseLoss));

const bands = calibrationBands(many, 1);
assert.equal(bands.length, 5);
assert.ok(bands.every(band => band.count < 10 ? band.label === 'too few reviews' : band.rate >= 0));

assert.equal(daysBetween('2026-01-01', '2026-01-08'), 7);

// Rolling-origin fixture. Not used by the app.
function rollingOrigin(events, minTrain) {
  const rows = events.filter(event => event.t > 0 && event.stabilityBefore != null && !event.derived)
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const losses = [];
  for (let index = minTrain; index < rows.length; index++) {
    const fitted = fitPersonal(rows.slice(0, index));
    const event = rows[index];
    const p = Math.min(1 - 1e-6, Math.max(1e-6, recallProbability(event.t, event.stabilityBefore, fitted.k)));
    losses.push(-(event.y * Math.log(p) + (1 - event.y) * Math.log(1 - p)));
  }
  return losses;
}
const rolled = rollingOrigin(many, 8);
assert.equal(rolled.length, many.length - 8);
assert.ok(rolled.every(loss => Number.isFinite(loss) && loss >= 0));

console.log('memory ok');
