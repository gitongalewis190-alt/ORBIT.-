// Learn and Reflect, decided by what you have learned on a topic.
//
//   A topic you have never learned: Learn it. Reflecting on it is not possible yet.
//   A topic you have learned: Reflect on it. Learning it again is only possible as a review,
//     when its review date has come (the reviews table says it is due today or earlier).
//
// learned: Set of topic ids with at least one research (Learn) entry.
// due:     Set of topic ids whose review is due today or earlier.

export function ruleFor(topicId, { learned = new Set(), due = new Set() } = {}) {
  const isLearned = learned.has(topicId);
  const isDue = due.has(topicId);
  return {
    learned: isLearned,
    due: isDue,
    // The mode a topic belongs in. Choosing a topic sets the mode to this.
    mode: isLearned ? 'reflect' : 'learn',
    canLearn: !isLearned || isDue,
    canReflect: isLearned,
  };
}

// Why a save in this mode is blocked, or '' when it may go ahead.
export function blockFor(mode, rule) {
  if (!rule) return '';
  if (mode === 'learn' && !rule.canLearn) {
    return 'You already learned this topic, and its review is not due. Switch to Reflect to write about it, or wait for its review date.';
  }
  if (mode === 'reflect' && !rule.canReflect) {
    return 'Learn this topic first. Reflect only on topics you have studied.';
  }
  return '';
}

// A short line that explains the mode for the chosen topic.
export function noteFor(mode, rule) {
  if (!rule) return '';
  if (mode === 'reflect' && rule.canReflect) return 'Reflecting on something you learned. It counts toward Reflect today.';
  if (mode === 'learn' && rule.due) return 'This topic is due for review. Learning it now is a review, and it counts toward Learn.';
  if (mode === 'learn' && rule.canLearn) return 'New topic. Learning it counts toward Learn today.';
  return '';
}

// Changing an existing entry between Learn and Reflect has the same rules.
// otherResearch: number of other Learn entries on the same topic. due: the topic is due for review.
export function kindChangeBlock(nextKind, { otherResearch = 0, due = false } = {}) {
  if (nextKind === 'reflection' && otherResearch === 0) {
    return 'Learn this topic first. A reflection needs a learned topic.';
  }
  if (nextKind === 'research' && otherResearch > 0 && !due) {
    return 'You already learned this topic, and its review is not due. Keep this as a reflection.';
  }
  return '';
}
