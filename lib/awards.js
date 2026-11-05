// The award catalogue. Each award has a category, a tier, an emblem and a progress rule.
// Keys and thresholds are the ones already in use for badges, so every badge a user
// has earned stays earned. One threshold is new: the 100-day streak (obsidian tier),
// added as the top of the existing streak ladder (3, 7, 30 days).

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

// progress(stats) returns [current, target]. "done" is current >= target.
export const AWARDS = [
  { key: 'first_step', category: 'study', tier: 'bronze', emblem: 'star', name: 'First step',
    description: 'Complete your first topic.', progress: s => [s.completed, 1] },
  { key: 'focus_first', category: 'study', tier: 'bronze', emblem: 'clock', name: 'First focus',
    description: 'Finish your first focus session.', progress: s => [s.focusTotal > 0 ? 1 : 0, 1] },
  { key: 'focus_10h', category: 'study', tier: 'gold', emblem: 'clock', name: 'Ten hours',
    description: 'Focus for 600 minutes in total.', progress: s => [s.focusTotal, 600] },

  { key: 'entries_10', category: 'journal', tier: 'bronze', emblem: 'nib', name: 'Steady hand',
    description: 'Save 10 journal entries.', progress: s => [s.entries, 10] },
  { key: 'entries_50', category: 'journal', tier: 'silver', emblem: 'nib', name: 'Keeper',
    description: 'Save 50 journal entries.', progress: s => [s.entries, 50] },
  { key: 'words_1000', category: 'journal', tier: 'bronze', emblem: 'book', name: 'Thousand words',
    description: 'Write 1,000 words in total.', progress: s => [s.wordsTotal, 1000] },
  { key: 'words_10000', category: 'journal', tier: 'gold', emblem: 'book', name: 'Ten thousand',
    description: 'Write 10,000 words in total.', progress: s => [s.wordsTotal, 10000] },
  { key: 'full_week', category: 'journal', tier: 'silver', emblem: 'book', name: 'Full week',
    description: 'Reach your weekly entry goal.', progress: s => [s.entriesWeek, s.weeklyGoal] },

  { key: 'returner', category: 'revision', tier: 'silver', emblem: 'loop', name: 'Returner',
    description: 'Return to 10 topics you have studied before.', progress: s => [s.reviewSessions, 10] },
  { key: 'mastery', category: 'revision', tier: 'gold', emblem: 'star', name: 'Mastery',
    description: 'Rate a topic 5 out of 5.', progress: s => [s.bestConfidence === 5 ? 5 : (s.bestConfidence ?? 0), 5] },

  { key: 'streak_3', category: 'streak', tier: 'bronze', emblem: 'flame', name: 'Three in a row',
    description: 'Journal three days in a row.', progress: s => [s.streak, 3] },
  { key: 'streak_7', category: 'streak', tier: 'silver', emblem: 'flame', name: 'Week of orbit',
    description: 'Journal seven days in a row.', progress: s => [s.streak, 7] },
  { key: 'streak_30', category: 'streak', tier: 'gold', emblem: 'flame', name: 'Thirty days',
    description: 'Journal thirty days in a row.', progress: s => [s.streak, 30] },
  { key: 'streak_100', category: 'streak', tier: 'obsidian', emblem: 'flame', name: 'Hundred days',
    description: 'Journal a hundred days in a row.', progress: s => [s.streak, 100] },
  { key: 'freeze_used', category: 'streak', tier: 'bronze', emblem: 'loop', name: 'Second chance',
    description: 'Save a streak with a freeze.', progress: s => [s.freezesUsed, 1] },

  { key: 'explorer_5', category: 'explorer', tier: 'silver', emblem: 'compass', name: 'Explorer',
    description: 'Study topics from five different fields.', progress: s => [s.fields, 5] },
  { key: 'explorer_10', category: 'explorer', tier: 'platinum', emblem: 'compass', name: 'Cartographer',
    description: 'Study topics from ten different fields.', progress: s => [s.fields, 10] },
];

// Current value, target, and whether the award is reached. Never negative, never above target.
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

// The badge engine reads this list. "test" uses the same rule as the progress bar.
export const BADGES = AWARDS.map(a => ({ ...a, test: s => awardProgress(a, s).done }));

export const awardByKey = Object.fromEntries(AWARDS.map(a => [a.key, a]));
