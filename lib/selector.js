import { addDays, today } from './dates';

// Time budget and deadline are tied to difficulty. A hard topic gets more
// minutes and more days, so you are never handed an advanced topic with
// a beginner's window.
export const MINUTES = { beginner: 30, intermediate: 45, advanced: 75 };
export const DAYS = { beginner: 1, intermediate: 2, advanced: 3 };

const CONTROL_WEIGHT = { normal: 1, show_more: 3, show_less: 0.3 };
const HIDDEN = new Set(['removed', 'archived']);

// Share of days each selection mode is used.
const MODES = [['auto', 70], ['cross', 15], ['serendipity', 10], ['reinforce', 5]];

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function weightedPick(items, weightFn) {
  const weights = items.map(weightFn);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[Math.floor(Math.random() * items.length)];
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function pickMode() {
  const total = MODES.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [m, w] of MODES) {
    r -= w;
    if (r <= 0) return m;
  }
  return 'auto';
}

// Difficulty adaptation from the last five confidence ratings.
export function adaptLevel(recentConfidences) {
  if (recentConfidences.length < 3) return 'intermediate';
  const window = recentConfidences.slice(0, 5);
  const avg = window.reduce((a, b) => a + b, 0) / window.length;
  if (avg >= 4) return 'advanced';
  if (avg <= 2) return 'beginner';
  return 'intermediate';
}

export function selectTopic(ctx) {
  const {
    topics, controls, recentTopicIds, recentFieldIds, lastFieldId,
    fieldConfidence, completedIds, links, level, mode, manualFieldId,
  } = ctx;

  const state = id => controls.get(id) ?? 'normal';

  let pool = topics.filter(t => !HIDDEN.has(state(t.id)) && !recentTopicIds.has(t.id));
  if (manualFieldId) pool = pool.filter(t => t.fieldId === manualFieldId);

  // Relationship matching: on cross days, pull from fields linked to the last one.
  if (mode === 'cross' && lastFieldId) {
    const linked = links.get(lastFieldId) ?? new Set();
    const crossPool = pool.filter(t => linked.has(t.fieldId));
    if (crossPool.length) pool = crossPool;
  }
  if (!pool.length) {
    throw new Error('No eligible topics. Restore some in Topics, or add one.');
  }

  let chosen;
  if (mode === 'serendipity') {
    chosen = pool[Math.floor(Math.random() * pool.length)];
  } else {
    chosen = weightedPick(pool, t => {
      let w = CONTROL_WEIGHT[state(t.id)] ?? 1;
      // Recency: avoid stacking the same field two days in a row.
      if (recentFieldIds.has(t.fieldId)) w *= 0.4;
      // Reinforcement: weak fields get pulled up, strong fields get eased off.
      const conf = fieldConfidence.get(t.fieldId);
      if (mode === 'reinforce' && conf !== undefined) w *= conf < 3 ? 3 : 0.5;
      // Difficulty adaptation.
      if (t.difficulty === level) w *= 2;
      return w;
    });
  }

  // Prerequisite awareness: if the chosen topic depends on an unfinished
  // prerequisite, study the prerequisite instead.
  if (chosen.prerequisiteId && !completedIds.has(chosen.prerequisiteId)) {
    const pre = topics.find(t => t.id === chosen.prerequisiteId);
    if (pre && !HIDDEN.has(state(pre.id))) chosen = pre;
  }

  return {
    topic: chosen,
    mode,
    minutes: MINUTES[chosen.difficulty],
    dueOn: addDays(today(), DAYS[chosen.difficulty]),
  };
}
