// Day rules: when a topic counts as done, and when you may change it.
//
// A day's topic can be changed only after what you learned from it is logged,
// and only once per day. The first draw is not a change.
export const OVERRIDES_PER_DAY = 1;

export function changesToday(rowCount) {
  return Math.max(0, (rowCount ?? 0) - 1);
}

export function canChangeTopic({ assignment, overridesToday = 0 }) {
  if (!assignment) return { ok: true, reason: '' };
  if (assignment.status !== 'completed') {
    return { ok: false, reason: 'Log what you learned on today’s topic first.' };
  }
  if (overridesToday >= OVERRIDES_PER_DAY) {
    return { ok: false, reason: 'You have already changed today’s topic.' };
  }
  return { ok: true, reason: '' };
}

// Reflections add to the record but never complete a day's topic.
export function completesAssignment(entryKind) {
  return entryKind !== 'reflection';
}
