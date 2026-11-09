// Learn and Reflect, decided by what you have learned on a topic.
//
//   A topic you have never learned: Learn it. Reflecting on it is not possible yet.
//   A topic you have learned: Reflect on it. A review is a reflection, so a topic is never learned twice.
//     When its review is due, reflecting on it is the review.
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
    canLearn: !isLearned,
    canReflect: isLearned,
  };
}

// Why a save in this mode is blocked, or '' when it may go ahead.
export function blockFor(mode, rule) {
  if (!rule) return '';
  if (mode === 'learn' && !rule.canLearn) {
    return 'You already learned this topic. Reflect on it instead. A review is a reflection.';
  }
  if (mode === 'reflect' && !rule.canReflect) {
    return 'Learn this topic first. Reflect only on topics you have studied.';
  }
  return '';
}

// A short line that explains the mode for the chosen topic.
export function noteFor(mode, rule) {
  if (!rule) return '';
  if (rule.due && rule.canReflect) return 'This topic is due for review. Reflecting on it now is the review, and it counts toward Reflect.';
  if (mode === 'reflect' && rule.canReflect) return 'Reflecting on something you learned. It counts toward Reflect today.';
  if (mode === 'learn' && rule.canLearn) return 'New topic. Learning it counts toward Learn today.';
  return '';
}

// Changing an existing entry between Learn and Reflect has the same rules.
// otherResearch: number of other Learn entries on the same topic. due: the topic is due for review.
export function kindChangeBlock(nextKind, { otherResearch = 0 } = {}) {
  if (nextKind === 'reflection' && otherResearch === 0) {
    return 'Learn this topic first. A reflection needs a learned topic.';
  }
  if (nextKind === 'research' && otherResearch > 0) {
    return 'You already learned this topic. Keep this as a reflection, because a review is a reflection.';
  }
  return '';
}
