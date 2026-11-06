// The award catalogue.
//
// Awards come in chains. Each step in a chain has a higher target and must be earned
// after the step before it (its "requires"). Keys from earlier versions are kept, so
// everything you already earned stays earned.
//
// A step may grant a benefit (see lib/benefits.js).

export const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'obsidian'];

export const TIER_LABEL = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  obsidian: 'Obsidian',
};

export const CATEGORIES = [
  { key: 'study', label: 'Study' },
  { key: 'journal', label: 'Journal' },
  { key: 'revision', label: 'Revision' },
  { key: 'streak', label: 'Streak' },
  { key: 'explorer', label: 'Explorer' },
];

// progress(stats) returns [current, target]. A step is done when current >= target.
export const AWARDS = [
  // Study: focus time
  { key: 'focus_first', chain: 'focus', step: 1, category: 'study', tier: 'bronze', emblem: 'clock',
    name: 'First focus', description: 'Finish a focus session.', requirement: '1 focus session',
    progress: s => [s.focusTotal > 0 ? 1 : 0, 1] },
  { key: 'focus_10h', chain: 'focus', step: 2, requires: 'focus_first', category: 'study', tier: 'gold', emblem: 'clock',
    name: 'Ten hours', description: 'Focus for 600 minutes in total.', requirement: '600 focus minutes',
    progress: s => [s.focusTotal, 600], benefit: 'deep_focus' },
  { key: 'focus_50h', chain: 'focus', step: 3, requires: 'focus_10h', category: 'study', tier: 'obsidian', emblem: 'clock',
    name: 'Fifty hours', description: 'Focus for 3,000 minutes in total.', requirement: '3,000 focus minutes',
    progress: s => [s.focusTotal, 3000], benefit: 'marathon' },

  // Study: topics completed
  { key: 'first_step', chain: 'topics', step: 1, category: 'study', tier: 'bronze', emblem: 'star',
    name: 'First step', description: 'Complete your first topic.', requirement: '1 completed topic',
    progress: s => [s.completed, 1] },
  { key: 'study_25', chain: 'topics', step: 2, requires: 'first_step', category: 'study', tier: 'silver', emblem: 'star',
    name: 'Twenty-five', description: 'Complete 25 topics.', requirement: '25 completed topics',
    progress: s => [s.completed, 25] },
  { key: 'study_100', chain: 'topics', step: 3, requires: 'study_25', category: 'study', tier: 'obsidian', emblem: 'star',
    name: 'Centurion', description: 'Complete 100 topics.', requirement: '100 completed topics',
    progress: s => [s.completed, 100] },

  // Journal: entries and words
  { key: 'entries_10', chain: 'entries', step: 1, category: 'journal', tier: 'bronze', emblem: 'nib',
    name: 'Steady hand', description: 'Save 10 journal entries.', requirement: '10 entries',
    progress: s => [s.entries, 10] },
  { key: 'entries_50', chain: 'entries', step: 2, requires: 'entries_10', category: 'journal', tier: 'silver', emblem: 'nib',
    name: 'Keeper', description: 'Save 50 journal entries.', requirement: '50 entries',
    progress: s => [s.entries, 50] },
  { key: 'entries_200', chain: 'entries', step: 3, requires: 'entries_50', category: 'journal', tier: 'gold', emblem: 'nib',
    name: 'Scribe', description: 'Save 200 journal entries.', requirement: '200 entries',
    progress: s => [s.entries, 200] },
  { key: 'words_1000', chain: 'words', step: 1, category: 'journal', tier: 'bronze', emblem: 'book',
    name: 'Thousand words', description: 'Write 1,000 words in total.', requirement: '1,000 words',
    progress: s => [s.wordsTotal, 1000] },
  { key: 'words_10000', chain: 'words', step: 2, requires: 'words_1000', category: 'journal', tier: 'silver', emblem: 'book',
    name: 'Ten thousand', description: 'Write 10,000 words in total.', requirement: '10,000 words',
    progress: s => [s.wordsTotal, 10000] },
  { key: 'words_50000', chain: 'words', step: 3, requires: 'words_10000', category: 'journal', tier: 'gold', emblem: 'book',
    name: 'Fifty thousand', description: 'Write 50,000 words in total.', requirement: '50,000 words',
    progress: s => [s.wordsTotal, 50000] },
  { key: 'full_week', category: 'journal', tier: 'silver', emblem: 'book',
    name: 'Full week', description: 'Reach your weekly entry goal.', requirement: 'Your weekly entry goal in seven days',
    progress: s => [s.entriesWeek, s.weeklyGoal] },

  // Journal: reflections
  { key: 'reflect_5', chain: 'reflect', step: 1, category: 'journal', tier: 'bronze', emblem: 'nib',
    name: 'Reflective', description: 'Write five reflections in Reflect mode.', requirement: '5 reflections',
    progress: s => [s.reflections, 5], benefit: 'reflection_prompts' },
  { key: 'reflect_25', chain: 'reflect', step: 2, requires: 'reflect_5', category: 'journal', tier: 'silver', emblem: 'nib',
    name: 'Deep reflection', description: 'Write 25 reflections.', requirement: '25 reflections',
    progress: s => [s.reflections, 25] },
  { key: 'reflect_100', chain: 'reflect', step: 3, requires: 'reflect_25', category: 'journal', tier: 'gold', emblem: 'nib',
    name: 'Thoughtful', description: 'Write 100 reflections.', requirement: '100 reflections',
    progress: s => [s.reflections, 100] },

  // Revision: returning to topics
  { key: 'returner', chain: 'returner', step: 1, category: 'revision', tier: 'silver', emblem: 'loop',
    name: 'Returner', description: 'Return to 10 topics you studied before.', requirement: '10 returns to earlier topics',
    progress: s => [s.reviewSessions, 10] },
  { key: 'returner_50', chain: 'returner', step: 2, requires: 'returner', category: 'revision', tier: 'gold', emblem: 'loop',
    name: 'Habitual', description: 'Return to 50 earlier topics.', requirement: '50 returns to earlier topics',
    progress: s => [s.reviewSessions, 50] },
  { key: 'returner_150', chain: 'returner', step: 3, requires: 'returner_50', category: 'revision', tier: 'obsidian', emblem: 'loop',
    name: 'Unbroken', description: 'Return to 150 earlier topics.', requirement: '150 returns to earlier topics',
    progress: s => [s.reviewSessions, 150] },

  // Revision: perfect ratings
  { key: 'mastery', chain: 'mastery', step: 1, category: 'revision', tier: 'gold', emblem: 'star',
    name: 'Mastery', description: 'Rate a topic 5 out of 5.', requirement: 'One entry rated 5',
    progress: s => [s.fiveStars > 0 ? 1 : 0, 1] },
  { key: 'mastery_5', chain: 'mastery', step: 2, requires: 'mastery', category: 'revision', tier: 'platinum', emblem: 'star',
    name: 'Five perfect', description: 'Rate five entries 5 out of 5.', requirement: 'Five entries rated 5',
    progress: s => [s.fiveStars, 5] },
  { key: 'mastery_20', chain: 'mastery', step: 3, requires: 'mastery_5', category: 'revision', tier: 'obsidian', emblem: 'star',
    name: 'Exacting', description: 'Rate twenty entries 5 out of 5.', requirement: 'Twenty entries rated 5',
    progress: s => [s.fiveStars, 20] },

  // Streak
  { key: 'streak_3', chain: 'streak', step: 1, category: 'streak', tier: 'bronze', emblem: 'flame',
    name: 'Three in a row', description: 'Journal three days in a row.', requirement: 'A 3-day streak',
    progress: s => [s.streak, 3] },
  { key: 'streak_7', chain: 'streak', step: 2, requires: 'streak_3', category: 'streak', tier: 'silver', emblem: 'flame',
    name: 'Week of orbit', description: 'Journal seven days in a row.', requirement: 'A 7-day streak',
    progress: s => [s.streak, 7], benefit: 'freeze_plus' },
  { key: 'streak_30', chain: 'streak', step: 3, requires: 'streak_7', category: 'streak', tier: 'gold', emblem: 'flame',
    name: 'Thirty days', description: 'Journal thirty days in a row.', requirement: 'A 30-day streak',
    progress: s => [s.streak, 30] },
  { key: 'streak_100', chain: 'streak', step: 4, requires: 'streak_30', category: 'streak', tier: 'obsidian', emblem: 'flame',
    name: 'Hundred days', description: 'Journal a hundred days in a row.', requirement: 'A 100-day streak',
    progress: s => [s.streak, 100] },
  { key: 'freeze_used', category: 'streak', tier: 'bronze', emblem: 'loop',
    name: 'Second chance', description: 'Save a streak with a freeze.', requirement: 'One streak freeze used',
    progress: s => [s.freezesUsed, 1] },

  // Explorer
  { key: 'explorer_5', chain: 'explorer', step: 1, category: 'explorer', tier: 'silver', emblem: 'compass',
    name: 'Explorer', description: 'Study topics from five different fields.', requirement: 'Five fields',
    progress: s => [s.fields, 5] },
  { key: 'explorer_10', chain: 'explorer', step: 2, requires: 'explorer_5', category: 'explorer', tier: 'platinum', emblem: 'compass',
    name: 'Cartographer', description: 'Study topics from ten different fields.', requirement: 'Ten fields',
    progress: s => [s.fields, 10] },
];

// Current value, target, and whether the step is reached. Never negative, never above target.
export function awardProgress(award, stats) {
  const [value, target] = award.progress(stats);
  const t = Math.max(1, target);
  return {
    value: Math.min(Math.max(0, value), t),
    target: t,
    done: value >= t,
    fraction: Math.min(1, Math.max(0, value) / t),
  };
}

// The badge engine reads this list, in chain order. "test" is the same rule as the progress bar.
export const BADGES = AWARDS.map(a => ({ ...a, test: s => awardProgress(a, s).done }));

export const awardByKey = Object.fromEntries(AWARDS.map(a => [a.key, a]));

// All steps in the same chain, in order.
export function chainOf(award) {
  if (!award.chain) return [award];
  return AWARDS.filter(a => a.chain === award.chain).sort((x, y) => x.step - y.step);
}
