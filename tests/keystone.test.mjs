import test from 'node:test';
import assert from 'node:assert/strict';
import {
  orientRelationship, indexSupport, stronglyConnected, effectOf, retained, rhoMap,
  analyseKeystone, marginalPlan, fitCoupling, dependentCounts, knowledgeAt,
} from '../lib/keystone.js';
import { asFitRows, fitPersonal, predictRecall } from '../lib/memory.js';

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

const ALL = ['prerequisite_of','part_of','contains','causes','influences','analogous_to','contrasts_with','applies_to','derived_from','depends_on','example_of','related_to'];

test('orientation covers twelve relationships and ignores the non-structural ones', () => {
  assert.deepEqual(orientRelationship('prerequisite_of'), { direction: 'forward', klass: 'hard' });
  assert.deepEqual(orientRelationship('depends_on'), { direction: 'reverse', klass: 'hard' });
  assert.deepEqual(orientRelationship('derived_from'), { direction: 'reverse', klass: 'hard' });
  assert.deepEqual(orientRelationship('part_of'), { direction: 'forward', klass: 'soft' });
  assert.deepEqual(orientRelationship('contains'), { direction: 'reverse', klass: 'soft' });
  for (const name of ALL) {
    const orient = orientRelationship(name);
    if (['causes','influences','analogous_to','contrasts_with','applies_to','example_of','related_to'].includes(name)) {
      assert.equal(orient, null);
    } else assert.ok(orient);
  }
});

test('rejected edges and candidate edges with null confidence are excluded', () => {
  const concepts = [{ id: 'a', status: 'verified' }, { id: 'b', status: 'verified' }];
  const edges = [
    { source_id: 'a', target_id: 'b', relationship: 'prerequisite_of', verification: 'rejected', confidence: 1 },
    { source_id: 'a', target_id: 'b', relationship: 'part_of', verification: 'candidate', confidence: null },
  ];
  assert.equal(indexSupport(concepts, edges).links.length, 0);
});

test('bounds, lambda identity and monotonicity', () => {
  const lambda = { hard: 0.6, soft: 0.25 };
  const supporters = [{ klass: 'hard', w: 1, rho: 0.4 }, { klass: 'soft', w: 0.5, rho: 0.7 }];
  const value = effectOf(0.8, supporters, lambda);
  assert.ok(value >= 0 && value <= 0.8);
  assert.equal(effectOf(0.8, supporters, { hard: 0, soft: 0 }), 0.8);
  assert.equal(effectOf(null, supporters, lambda), null);
  const higher = effectOf(0.8, supporters.map(link => ({ ...link, rho: Math.min(1, link.rho + 0.2) })), lambda);
  assert.ok(higher >= value);
  const rho = new Map([['a', 0.8], ['b', null]]);
  const support = { incoming: new Map([['a', supporters], ['b', []]]) };
  const sum = retained(rho, support, lambda);
  assert.equal(sum.known, 1);
  assert.ok(sum.total <= 0.8);
});

test('cycles terminate and are reported', () => {
  const concepts = [{ id: 'a', status: 'verified' }, { id: 'b', status: 'verified' }, { id: 'c', status: 'verified' }];
  const edges = [
    { source_id: 'a', target_id: 'b', relationship: 'prerequisite_of', verification: 'verified', confidence: 1 },
    { source_id: 'b', target_id: 'a', relationship: 'prerequisite_of', verification: 'verified', confidence: 1 },
  ];
  const facts = dependentCounts(concepts, edges);
  assert.ok(facts.cycles.length >= 1);
  assert.ok(facts.cycles[0].includes('a') && facts.cycles[0].includes('b'));
});

test('K does not rise with the horizon when nothing is reviewed', () => {
  const fit = { k: 1, weights: null };
  const input = {
    concepts: [{ id: 'c', status: 'verified' }],
    edges: [],
    evidence: [{ concept_id: 'c', topic_id: 't' }],
    reviews: [{ topic_id: 't', title: 'T', due_on: '2026-01-01', stability: 4, last_reviewed_on: '2026-01-01' }],
    today: '2026-01-10',
  };
  const a = rhoMap({ ...input, fit, horizon: 1, freshTopics: new Set() });
  const b = rhoMap({ ...input, fit, horizon: 8, freshTopics: new Set() });
  assert.ok(a.get('c') >= b.get('c'));
});

test('the plan is deterministic and never below due-date order', () => {
  const fit = fitPersonal([]);
  const reviews = [1, 2, 3, 4].map(n => ({
    topic_id: `t${n}`, title: `T${n}`, due_on: `2026-01-0${n}`, stability: 5, last_reviewed_on: '2025-12-01',
  }));
  const input = {
    concepts: reviews.map(review => ({ id: review.topic_id, status: 'verified' })),
    edges: [],
    evidence: reviews.map(review => ({ concept_id: review.topic_id, topic_id: review.topic_id })),
    reviews,
    fit,
    today: '2026-01-04',
    horizon: 1,
    slots: 2,
    lambda: { hard: 0, soft: 0 },
  };
  const first = marginalPlan(input);
  const second = marginalPlan(input);
  assert.deepEqual(first.ids, second.ids);
  assert.ok(first.K + 1e-9 >= first.baselineK);
});

test('greedy stays within 5 percent of brute force on small graphs', () => {
  let worst = 1;
  for (let seed = 1; seed <= 100; seed += 1) {
    const rng = mulberry32(seed);
    const reviews = [0, 1, 2, 3].map(n => ({
      topic_id: `t${n}`,
      title: `T${n}`,
      due_on: `2026-01-0${n + 1}`,
      stability: 2 + rng() * 8,
      last_reviewed_on: '2026-01-01',
    }));
    const concepts = reviews.map(review => ({ id: `c${review.topic_id}`, status: 'verified' }));
    const edges = [];
    for (let i = 0; i < concepts.length; i += 1) {
      for (let j = 0; j < concepts.length; j += 1) {
        if (i !== j && rng() < 0.4) {
          edges.push({
            source_id: concepts[i].id,
            target_id: concepts[j].id,
            relationship: 'prerequisite_of',
            verification: 'verified',
            confidence: 1,
          });
        }
      }
    }
    const fit = { k: 1, weights: null };
    const base = {
      concepts, edges,
      evidence: reviews.map(review => ({ concept_id: `c${review.topic_id}`, topic_id: review.topic_id })),
      reviews, fit, today: '2026-01-08', horizon: 3, slots: 2, lambda: { hard: 0.5, soft: 0.25 },
    };
    const greedy = marginalPlan(base);
    const ids = reviews.map(review => review.topic_id);
    const subsets = [[]];
    for (const id of ids) subsets.push(...subsets.map(set => [...set, id]));
    let best = 0;
    for (const set of subsets.filter(set => set.length <= 2)) best = Math.max(best, knowledgeAt(base, set));
    const ratio = best <= 1e-9 ? 1 : greedy.K / best;
    worst = Math.min(worst, ratio);
    assert.ok(greedy.K + 1e-8 >= greedy.baselineK);
  }
  assert.ok(worst >= 0.95, `worst ratio ${worst}`);
});

function plant(seed, lambda) {
  const rng = mulberry32(seed);
  const events = [];
  const day = i => {
    const date = new Date(Date.UTC(2024, 0, 1));
    date.setUTCDate(date.getUTCDate() + i);
    return date.toISOString();
  };
  for (let i = 0; i < 150; i += 1) {
    events.push({
      id: `s${i}`, topic_id: 'sig', reviewed_at: day(i * 2), elapsed_days: 1,
      stability_before: 0.078, stability_after: 0.078, observed_recall: rng() < 0.5 ? 1 : 0, derived: false,
    });
    const base = 0.9961133124895509;
    const rho = 0.4995455712020274;
    const p = Math.min(1 - 1e-6, Math.max(1e-6, base * (1 - lambda * (1 - rho))));
    events.push({
      id: `t${i}`, topic_id: 'tau', reviewed_at: day(i * 2 + 1), elapsed_days: 1,
      stability_before: 30, stability_after: 30, observed_recall: rng() < p ? 1 : 0, derived: false,
    });
  }
  return fitCoupling({
    concepts: [{ id: 'J', status: 'verified' }, { id: 'C', status: 'verified' }],
    edges: [{ source_id: 'J', target_id: 'C', relationship: 'prerequisite_of', verification: 'verified', confidence: 1 }],
    evidence: [{ concept_id: 'J', topic_id: 'sig' }, { concept_id: 'C', topic_id: 'tau' }],
    events,
  });
}

test('planted hard coupling of 0.6 validates and stays near the plant', () => {
  let hard = 0;
  let validated = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    const result = plant(seed, 0.6);
    hard += result.lambda.hard;
    if (result.status === 'validated') validated += 1;
  }
  assert.ok(Math.abs(hard / 40 - 0.6) <= 0.15);
  assert.ok(validated >= 32);
});

test('null coupling is rarely validated', () => {
  let validated = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    if (plant(1000 + seed, 0).status === 'validated') validated += 1;
  }
  assert.ok(validated <= 4);
});

test('fewer than 20 held-out feature events is assumed', () => {
  const result = plant(3, 0.6);
  const short = fitCoupling({
    concepts: result ? [{ id: 'J', status: 'verified' }, { id: 'C', status: 'verified' }] : [],
    edges: [{ source_id: 'J', target_id: 'C', relationship: 'prerequisite_of', verification: 'verified', confidence: 1 }],
    evidence: [{ concept_id: 'J', topic_id: 'sig' }, { concept_id: 'C', topic_id: 'tau' }],
    events: [],
  });
  const events = [];
  for (let i = 0; i < 30; i += 1) {
    const date = new Date(Date.UTC(2024, 0, 1 + i)).toISOString();
    events.push({ id: `e${i}`, topic_id: 'tau', reviewed_at: date, elapsed_days: 1, stability_before: 4, stability_after: 4, observed_recall: 1, derived: false });
  }
  const assumed = fitCoupling({
    concepts: [{ id: 'C', status: 'verified' }],
    edges: [],
    evidence: [{ concept_id: 'C', topic_id: 'tau' }],
    events,
  });
  assert.equal(assumed.status, 'assumed');
  assert.equal(short.status, 'assumed');
});

test('features for an event ignore later events', () => {
  const built = plant(4, 0.6);
  const again = plant(4, 0.6);
  assert.equal(built.lambda.hard, again.lambda.hard);
  const events = [];
  const day = i => new Date(Date.UTC(2024, 0, 1 + i)).toISOString();
  for (let i = 0; i < 40; i += 1) {
    events.push({ id: `s${i}`, topic_id: 'sig', reviewed_at: day(i * 2), elapsed_days: 1, stability_before: 0.078, stability_after: 0.078, observed_recall: 1, derived: false });
    events.push({ id: `t${i}`, topic_id: 'tau', reviewed_at: day(i * 2 + 1), elapsed_days: 1, stability_before: 30, stability_after: 30, observed_recall: i < 20 ? 1 : 0, derived: false });
  }
  const before = fitCoupling({
    concepts: [{ id: 'J', status: 'verified' }, { id: 'C', status: 'verified' }],
    edges: [{ source_id: 'J', target_id: 'C', relationship: 'prerequisite_of', verification: 'verified', confidence: 1 }],
    evidence: [{ concept_id: 'J', topic_id: 'sig' }, { concept_id: 'C', topic_id: 'tau' }],
    events: events.map(event => ({ ...event })),
  });
  events[events.length - 1].stability_after = 0.01;
  const after = fitCoupling({
    concepts: [{ id: 'J', status: 'verified' }, { id: 'C', status: 'verified' }],
    edges: [{ source_id: 'J', target_id: 'C', relationship: 'prerequisite_of', verification: 'verified', confidence: 1 }],
    evidence: [{ concept_id: 'J', topic_id: 'sig' }, { concept_id: 'C', topic_id: 'tau' }],
    events,
  });
  assert.equal(before.status, after.status);
});

test('analyseKeystone returns a plan, facts and a curve', () => {
  const result = analyseKeystone({
    today: '2026-02-01',
    concepts: [{ id: 'c', status: 'verified' }],
    edges: [],
    evidence: [{ concept_id: 'c', topic_id: 't' }],
    reviews: [{ topic_id: 't', title: 'Topic', due_on: '2026-02-01', stability: 6, last_reviewed_on: '2026-01-20' }],
    events: [],
  }, { horizon: 1, slots: 1 });
  assert.equal(result.version, 'k1');
  assert.ok(result.plan.K >= result.plan.baselineK - 1e-9);
  assert.equal(result.curve.length, 15);
  assert.ok(result.facts.coverage >= 0);
});
