import { addDays } from './dates';

// Four smart systems. Each reads your real statistics and returns one plain note.
// The fifth system is the Guide (lib/manual.js).

// 1. Streak guardian: says what today needs to keep your streak alive.
export function streakGuardian(s) {
  const base = { id: 'guardian', title: 'Streak guardian' };
  if (s.entries === 0) {
    return { ...base, tone: 'info', text: 'Write your first entry today to start a streak.' };
  }
  if (s.rows.some(r => r.day === s.today)) {
    return { ...base, tone: 'ok', text: `Today is covered. Your ${s.streak}-day streak is safe.` };
  }
  if (s.streak >= 2 && s.freeze.available) {
    return { ...base, tone: 'warn', text: `Your ${s.streak}-day streak needs one entry today. A freeze is ready if the day gets away from you.` };
  }
  return {
    ...base,
    tone: 'warn',
    text: s.streak > 0
      ? `Your ${s.streak}-day streak needs one entry today.`
      : 'Write a short entry today to build momentum.',
  };
}

// 2. Pace coach: how far you are from your weekly entry goal.
export function paceCoach(s, profile) {
  const base = { id: 'pace', title: 'Pace coach' };
  const goal = profile.weekly_entry_goal;
  const left = Math.max(0, goal - s.entriesWeek);
  if (left === 0) {
    return { ...base, tone: 'ok', text: `You have reached this week's goal of ${goal} entries. Anything more is a bonus.` };
  }
  const every = Math.max(1, Math.floor(7 / left));
  return {
    ...base,
    tone: 'info',
    text: `${left} more entr${left === 1 ? 'y' : 'ies'} to reach your goal in the next seven days. Roughly one every ${every} day${every === 1 ? '' : 's'}.`,
  };
}

// 3. Confidence tutor: names the field where your confidence is lowest.
export function confidenceTutor(s) {
  const base = { id: 'tutor', title: 'Confidence tutor' };
  const byField = new Map();
  for (const r of s.rows) {
    const field = r.topics?.subfields?.fields?.name;
    if (!field || r.confidence === null || r.confidence === undefined) continue;
    const a = byField.get(field) ?? { sum: 0, n: 0 };
    a.sum += r.confidence;
    a.n += 1;
    byField.set(field, a);
  }
  const ranked = [...byField]
    .filter(([, a]) => a.n >= 2)
    .map(([name, a]) => ({ name, avg: a.sum / a.n }))
    .sort((x, y) => x.avg - y.avg);
  if (ranked.length === 0) {
    return { ...base, tone: 'info', text: 'Rate a few entries and Orbit will show which field needs revisiting.' };
  }
  const low = ranked[0];
  if (low.avg >= 4) {
    return { ...base, tone: 'ok', text: 'Every field rates 4 or higher. Keep stretching into harder topics.' };
  }
  return {
    ...base,
    tone: 'warn',
    text: `Your confidence in ${low.name} averages ${low.avg.toFixed(1)} of 5. Revisit one topic there today.`,
  };
}

// 4. Review rhythm: what is due, and what to do about it.
export function reviewRhythm(s) {
  const base = { id: 'rhythm', title: 'Review rhythm' };
  if (s.dueToday > 0) {
    return {
      ...base,
      tone: 'warn',
      text: `${s.dueToday} topic${s.dueToday === 1 ? ' is' : 's are'} due for review. Start with the oldest so nothing fades.`,
    };
  }
  if (s.reviewSessions === 0) {
    return { ...base, tone: 'info', text: 'No reviews yet. Topics you return to will appear here when they are due.' };
  }
  return { ...base, tone: 'ok', text: 'Nothing is due today. A good moment to explore a new topic.' };
}

export function smartNotes(s, profile) {
  return [streakGuardian(s), paceCoach(s, profile), confidenceTutor(s), reviewRhythm(s)];
}

export const yesterdayOf = today => addDays(today, -1);
