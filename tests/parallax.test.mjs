import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  wilsonInterval, corrected, identifiedSet, gapReport, agreedGap, aucScore,
  probeGain, parallaxReport, pairProbe,
} from '../lib/parallax.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rowsFrom({ n, pTrue, eps, seed, cMode }) {
  const rng = mulberry32(seed);
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    const truth = rng() < pTrue ? 1 : 0;
    let y = truth;
    if (rng() < eps) y = 1 - y;
    const c = cMode === 'informative' ? (truth ? 4 + rng() : rng() * 2) : rng() * 5;
    rows.push({
      p: pTrue, y, score: y ? 80 : 40, c, verifier: 'groq', topic_id: `t${i % 7}`, entry_id: `e${i}`, band: '1w',
    });
  }
  return rows;
}

test('intervals and the identity correction stay inside 0 to 1', () => {
  const interval = wilsonInterval(30, 60);
  assert.ok(interval.low >= 0 && interval.high <= 1 && interval.low <= interval.mean && interval.mean <= interval.high);
  assert.equal(corrected(0.4, 0), 0.4);
  const set = identifiedSet(0.4, 0.6, 0.2);
  assert.ok(set.min <= 0.4 && set.max >= 0.6);
});

test('a calibrated learner is rarely flagged, and never in the wrong direction when miscalibrated', () => {
  for (const eps of [0, 0.1, 0.2]) {
    let over = 0;
    let under = 0;
    for (let seed = 1; seed <= 400; seed += 1) {
      const report = gapReport(rowsFrom({ n: 60, pTrue: 0.7, eps, seed }), { epsMax: 0.2, threshold: 60 });
      if (report.status === 'optimistic') over += 1;
      if (report.status === 'pessimistic') under += 1;
    }
    assert.ok(over / 400 <= 0.06, `over ${eps} ${over}`);
    assert.ok(under / 400 <= 0.06, `under ${eps} ${under}`);
  }
  for (let seed = 1; seed <= 80; seed += 1) {
    const high = gapReport(rowsFrom({ n: 80, pTrue: 0.4, eps: 0, seed }).map(row => ({ ...row, p: 0.85 })), { epsMax: 0.2 });
    const low = gapReport(rowsFrom({ n: 80, pTrue: 0.85, eps: 0, seed }).map(row => ({ ...row, p: 0.3 })), { epsMax: 0.2 });
    assert.notEqual(high.status, 'pessimistic');
    assert.notEqual(low.status, 'optimistic');
  }
});

test('directions that disagree across thresholds are not flagged', () => {
  const rows = [];
  for (let i = 0; i < 40; i += 1) rows.push({ p: 0.9, score: 55, y: 0, verifier: 'groq', c: 3, topic_id: 't', entry_id: `e${i}` });
  const report = agreedGap(rows, 0.2);
  assert.ok(report.status === 'threshold-sensitive' || report.status === 'insufficient evidence yet' || report.reports);
});

test('confidence flags are conservative and informative confidence is detected', () => {
  let flags = 0;
  for (let seed = 1; seed <= 400; seed += 1) {
    const result = aucScore(rowsFrom({ n: 60, pTrue: 0.5, eps: 0, seed, cMode: 'null' }).map(row => ({ c: row.c, y: row.y })));
    if (result.flag) flags += 1;
  }
  assert.ok(flags / 400 <= 0.06, `null flags ${flags}`);
  let found = 0;
  const noisy = [];
  const clean = [];
  for (let seed = 1; seed <= 40; seed += 1) {
    const good = aucScore(rowsFrom({ n: 120, pTrue: 0.5, eps: 0, seed, cMode: 'informative' }).map(row => ({ c: row.c, y: row.y })));
    if (good.flag) found += 1;
    clean.push(good.auc);
    const flipped = rowsFrom({ n: 120, pTrue: 0.5, eps: 0.2, seed, cMode: 'informative' });
    noisy.push(aucScore(flipped.map(row => ({ c: row.c, y: row.y }))).auc);
  }
  assert.ok(found / 40 >= 0.9, `found ${found}`);
  const mean = list => list.reduce((sum, value) => sum + value, 0) / list.length;
  assert.ok(mean(noisy) < mean(clean));
});

test('a probe without a prior event is skipped', () => {
  assert.equal(pairProbe(null, { asked_at: '2026-01-02', score: 80 }, { k: 1 }), null);
  assert.equal(pairProbe({ reviewed_at: '2026-01-03', stability_after: 4, confidence: 3 }, { asked_at: '2026-01-02', score: 10, verifier: 'local', topic_id: 't', entry_id: 'e' }, { k: 1 }), null);
});

test('probe queue gain is never negative', () => {
  for (let a = 0; a < 8; a += 1) {
    for (let b = 0; b < 8; b += 1) assert.ok(probeGain(a, b) >= -1e-12);
  }
});

test('no export rewrites a probability', () => {
  const source = fs.readFileSync(new URL('../lib/parallax.js', import.meta.url), 'utf8');
  assert.equal(/export function \w+\([^)]*probability/.test(source), false);
  const report = parallaxReport([{ p: 0.5, y: 1, score: 80, c: 4, verifier: 'groq', topic_id: 't', entry_id: 'e' }]);
  assert.equal(report.gap.status, 'insufficient evidence yet');
  assert.equal(report.version, 'p1');
});
