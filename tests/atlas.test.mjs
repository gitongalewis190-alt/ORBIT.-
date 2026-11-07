import assert from 'node:assert/strict';
import { sameConcept, canonicalKey } from '../lib/atlas/normalizer.js';
import { validEdge } from '../lib/atlas/relationships.js';
import { compileRecord } from '../lib/atlas/compiler.js';
import { applyAssessment, composite, brierScore, emptyMastery } from '../lib/atlas/mastery.js';
import { bridgeScore, opportunityScore, challengePriority } from '../lib/atlas/scoring.js';
import { findPath, clusters } from '../lib/atlas/graph.js';
import { scoreAnswer } from '../lib/atlas/challenges.js';

assert.equal(sameConcept('Neural plasticity', 'neuroplasticity'), true);
assert.equal(sameConcept('Neural plasticity', 'plasticity of the nervous system'), true);
assert.equal(sameConcept('Gradient descent', 'Natural selection'), false);
assert.equal(canonicalKey('The neural plasticity'), canonicalKey('neuroplasticity'));

assert.equal(validEdge({ sourceKey: 'a', targetKey: 'a', relationship: 'related_to' }), false);
assert.equal(validEdge({ sourceKey: 'a', targetKey: 'b', relationship: 'nope' }), false);
assert.equal(validEdge({ sourceKey: 'a', targetKey: 'b', relationship: 'depends_on' }), true);

const entry = {
  topic_title: 'Neural plasticity',
  discipline: 'Neuroscience',
  topic_id: 'bio',
  prerequisite_title: 'Synapse',
  body: 'Neural plasticity depends on synapse change. It is similar to gradient descent only as adaptation.',
  key_points: ['Synapses change with use'],
};
const first = compileRecord(entry, [{
  name: 'Gradient descent',
  normalized_name: canonicalKey('Gradient descent'),
  discipline: 'Computer science',
  description: 'Weight adaptation by gradient descent',
}]);
const second = compileRecord(entry, [{
  name: 'Gradient descent',
  normalized_name: canonicalKey('Gradient descent'),
  discipline: 'Computer science',
  description: 'Weight adaptation by gradient descent',
}]);
assert.deepEqual(first.concepts.map(concept => concept.key), second.concepts.map(concept => concept.key));
assert.ok(first.edges.some(edge => edge.relationship === 'prerequisite_of'));
assert.ok(first.edges.every(edge => edge.sourceKey !== edge.targetKey));
assert.equal(first.edges.every(edge => edge.verification === 'candidate'), true);

const blank = composite(emptyMastery());
assert.equal(blank.score, null);
const learned = applyAssessment(emptyMastery(), 'recall', 0.8);
assert.equal(learned.recall, 0.8);
assert.equal(learned.explanation, null);
assert.throws(() => applyAssessment(emptyMastery(), 'recall', 2));
assert.equal(brierScore([{ p: 0.5, y: 1 }, { p: 0.5, y: 0 }]), 0.25);

const bridge = bridgeScore(
  { name: 'Neural plasticity', description: 'adaptation of synapses', category: 'concept', discipline: 'Neuroscience' },
  { name: 'Gradient descent', description: 'adaptation of weights', category: 'concept', discipline: 'Computer science' },
);
assert.ok(bridge.score > 0 && bridge.score <= 1);
assert.ok(bridge.shared.includes('adaptation'));
const chance = opportunityScore({ gap: 1, relevance: 1, interdisciplinary: 0, novelty: 1, feasibility: 1 });
assert.ok(chance.score > 0.5);
assert.ok(challengePriority({ weakness: 1, urgency: 1, difficultyFit: 1, value: 1 }).score === 1);

const edges = [
  { source_id: 'a', target_id: 'b', verification: 'candidate' },
  { source_id: 'b', target_id: 'c', verification: 'verified' },
];
assert.deepEqual(findPath(edges, 'a', 'c'), ['a', 'b', 'c']);
assert.equal(clusters([{ id: 'a' }, { id: 'b' }, { id: 'z' }], edges).length, 2);

const judged = scoreAnswer(
  { name: 'Synapse', description: 'A synapse passes a signal' },
  [{ claim_text: 'Signals cross the synapse' }],
  'A synapse passes a signal',
);
assert.ok(judged.score > 0.4);

console.log('atlas ok');
