import { contentWords } from './normalizer.js';
import { challengePriority } from './scoring.js';
import { weakestDimension } from './mastery.js';

export const CHALLENGE_KINDS = ['reconstruction', 'explanation', 'application', 'transfer', 'critique'];

const PROMPTS = {
  reconstruction: concept => `Without looking back, state what ${concept.name} is, in your own words.`,
  explanation: concept => `Explain why ${concept.name} works, and how its parts relate. Use the claims you actually recorded.`,
  application: concept => `Apply ${concept.name} to a situation you have not written about yet. Say what changes and what would not.`,
  transfer: concept => `Name one other idea you know that shares something with ${concept.name}. Say what is shared, then say what is different. Do not treat them as the same mechanism.`,
  critique: concept => `What assumption sits inside ${concept.name}, and what would make that assumption fail?`,
};

export function chooseKind(mastery) {
  const weak = weakestDimension(mastery);
  if (!weak) return 'reconstruction';
  if (weak === 'recall') return 'reconstruction';
  if (weak === 'application') return 'application';
  if (weak === 'transfer') return 'transfer';
  if (weak === 'retention') return 'reconstruction';
  return 'explanation';
}

export function makeChallenge(concept, mastery) {
  const kind = chooseKind(mastery);
  const priority = challengePriority({
    weakness: weakestDimension(mastery) ? 1 : 0.4,
    urgency: mastery ? 0.6 : 0.8,
    difficultyFit: 0.7,
    value: 0.8,
  });
  return {
    kind,
    title: `${concept.name}`,
    prompt: PROMPTS[kind](concept),
    difficulty: priority.score > 0.7 ? 'stretch' : 'steady',
    rubric: {
      version: 'c1',
      kind,
      passAt: 0.6,
      note: 'The score is the share of your recorded wording that the answer covers. It is not a judgement of intelligence.',
    },
  };
}

export function scoreAnswer(concept, claims, answer) {
  const source = contentWords([concept.description, concept.name, ...(claims || []).map(claim => claim.claim_text)].join(' '));
  const unique = [...new Set(source)];
  if (!unique.length) return { score: null, matched: [], missing: [], note: 'There is not enough recorded wording to score this.' };
  const reply = new Set(contentWords(answer));
  const matched = unique.filter(word => reply.has(word));
  const missing = unique.filter(word => !reply.has(word)).slice(0, 6);
  const score = matched.length / unique.length;
  return {
    score,
    matched,
    missing,
    note: score >= 0.6 ? 'The answer covers most of the recorded wording.' : 'Some recorded wording is missing. That is a gap in this attempt, not a final limit.',
  };
}

export { weakestDimension };
