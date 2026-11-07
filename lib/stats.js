import { supabase } from './supabase';
import { addDays } from './dates';
import { BADGES } from './awards';
import { benefitsFor, cacheBenefits } from './benefits';

export const wordCount = text => (text.trim().match(/\S+/g) || []).length;

export const dayOf = (iso, tz) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: tz });

export const todayIn = tz =>
  new Date().toLocaleDateString('en-CA', { timeZone: tz });

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekdayOf = day => WEEKDAY_NAMES[new Date(day + 'T12:00:00Z').getUTCDay()];

// Streak = consecutive days with an entry or a used freeze, counting back from today.
// If today has nothing yet, the count starts from yesterday instead.
export function computeStreak(daySet, tz, freezeSet = new Set()) {
  const covered = d => daySet.has(d) || freezeSet.has(d);
  let day = todayIn(tz);
  if (!covered(day)) day = addDays(day, -1);
  let n = 0;
  while (covered(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

// A freeze covers one missed day. You get one every rolling seven days.
export function freezeStatus(freezeDays, tz, allowance = 1) {
  const today = todayIn(tz);
  const windowStart = addDays(today, -6);
  const recent = [...freezeDays].filter(d => d >= windowStart && d <= today).sort();
  const available = recent.length < allowance;
  const nextAvailable = available ? today : addDays(recent[0], 7);
  return { available, nextAvailable, allowance, used: recent.length };
}

export { BADGES };

const sum = (rows, f) => rows.reduce((t, r) => t + (f(r) || 0), 0);

// Three circles: a day counts when study minutes, journal words and a return to an earlier topic
// all happened that day. Study is measured against the daily minutes goal, journal against the word goal.
function circleDays(rows, focusRows, profile) {
  const days = new Set([...rows.map(e => e.day), ...focusRows.map(x => x.day)]);
  let closed = 0;
  for (const day of days) {
    const dayRows = rows.filter(e => e.day === day);
    const minutes = sum(dayRows, e => e.minutes_spent) + sum(focusRows.filter(x => x.day === day), x => x.minutes);
    const words = sum(dayRows, e => e.word_count);
    const reviewed = dayRows.some(e => e.isReview);
    if (minutes >= profile.daily_minutes && words >= profile.word_goal && reviewed) closed++;
  }
  return closed;
}

// Loads everything the screens need in one pass.
export async function loadStats(uid, profile) {
  const tz = profile.timezone;
  const [j, a, r, f, z, bq] = await Promise.all([
    supabase.from('journal_entries')
      .select('id,topic_id,word_count,minutes_spent,confidence,tags,created_at,topics(title,subfields(field_id,name,fields(name)))')
      .eq('user_id', uid).order('created_at', { ascending: true }),
    supabase.from('assignments').select('id,status,assigned_on,est_minutes').eq('user_id', uid),
    supabase.from('reviews').select('topic_id,due_on').eq('user_id', uid),
    supabase.from('focus_sessions').select('day,minutes').eq('user_id', uid),
    supabase.from('streak_freezes').select('day').eq('user_id', uid),
    supabase.from('user_badges').select('badge_key').eq('user_id', uid),
  ]);
  for (const x of [j, a, r, f, z, bq]) if (x.error) throw x.error;

  const today = todayIn(tz);
  const weekStart = addDays(today, -6);
  const prevStart = addDays(today, -13);
  const prevEnd = addDays(today, -7);

  // A journal entry on a topic already seen earlier is a review session.
  const seen = new Set();
  const rows = j.data.map(e => {
    const isReview = seen.has(e.topic_id);
    seen.add(e.topic_id);
    return { ...e, day: dayOf(e.created_at, tz), isReview };
  });

  const freezeDays = new Set(z.data.map(x => x.day));
  const daySet = new Set(rows.map(e => e.day));
  const todayRows = rows.filter(e => e.day === today);
  const weekRows = rows.filter(e => e.day >= weekStart && e.day <= today);
  const prevRows = rows.filter(e => e.day >= prevStart && e.day <= prevEnd);

  const focusRows = f.data;
  const focusToday = sum(focusRows.filter(x => x.day === today), x => x.minutes);
  const focusWeek = sum(focusRows.filter(x => x.day >= weekStart && x.day <= today), x => x.minutes);
  const focusTotal = sum(focusRows, x => x.minutes);

  const fields = new Set(rows.map(e => e.topics?.subfields?.field_id).filter(Boolean));
  const confidences = rows.map(e => e.confidence).filter(c => c !== null);
  const dueToday = r.data.filter(x => x.due_on <= today).length;
  const reviewsDoneToday = todayRows.filter(e => e.isReview).length;

  const week = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    const dayRows = rows.filter(e => e.day === day);
    return {
      day,
      words: sum(dayRows, e => e.word_count),
      minutes: sum(dayRows, e => e.minutes_spent) + sum(focusRows.filter(x => x.day === day), x => x.minutes),
      entries: dayRows.length,
    };
  });

  const earned = new Set((bq.data ?? []).map(b => b.badge_key));
  const benefits = benefitsFor(earned);
  cacheBenefits(benefits);
  const allowance = benefits.includes('freeze_plus') ? 2 : 1;

  const s = {
    today,
    entries: rows.length,
    entriesWeek: weekRows.length,
    weeklyGoal: profile.weekly_entry_goal,
    wordsTotal: sum(rows, e => e.word_count),
    wordsToday: sum(todayRows, e => e.word_count),
    wordsWeek: sum(weekRows, e => e.word_count),
    wordsPrevWeek: sum(prevRows, e => e.word_count),
    minutesToday: sum(todayRows, e => e.minutes_spent) + focusToday,
    minutesWeek: sum(weekRows, e => e.minutes_spent) + focusWeek,
    focusToday,
    focusWeek,
    focusTotal,
    completed: a.data.filter(x => x.status === 'completed').length,
    completedWeek: a.data.filter(x => x.status === 'completed' && x.assigned_on >= weekStart).length,
    streak: computeStreak(daySet, tz, freezeDays),
    freezesUsed: freezeDays.size,
    freeze: freezeStatus(freezeDays, tz, allowance),
    reviewSessions: rows.filter(e => e.isReview).length,
    reviewsDoneToday,
    dueToday,
    fields: fields.size,
    bestConfidence: confidences.length ? Math.max(...confidences) : null,
    avgConfidence: confidences.length
      ? Number((confidences.reduce((x, y) => x + y, 0) / confidences.length).toFixed(1))
      : null,
    week,
    weekRows,
    rows,
    freezeDays: [...freezeDays],
    reflections: rows.filter(e => (e.tags || []).includes('reflection')).length,
    fiveStars: rows.filter(e => e.confidence === 5).length,
    earned,
    benefits,
  };

  s.rings = {
    study: Math.min(1, s.minutesToday / profile.daily_minutes),
    journal: Math.min(1, s.wordsToday / profile.word_goal),
    review: dueToday + reviewsDoneToday === 0 ? 0 : Math.min(1, reviewsDoneToday / (dueToday + reviewsDoneToday)),
  };
  s.circleDays = circleDays(rows, focusRows, profile);
  return s;
}

// The week in one summary: the numbers you'd quote to a friend.
export function weeklyRecap(s) {
  const rows = s.weekRows;
  const bestDay = s.week.reduce((best, d) => (d.words > best.words ? d : best), s.week[0]);

  const topicCounts = new Map();
  for (const e of rows) {
    const title = e.topics?.title ?? 'Removed topic';
    topicCounts.set(title, (topicCounts.get(title) ?? 0) + 1);
  }
  const topTopic = [...topicCounts].sort((a, b) => b[1] - a[1])[0] ?? null;

  const fieldWords = new Map();
  for (const e of rows) {
    const name = e.topics?.subfields?.fields?.name;
    if (!name) continue;
    fieldWords.set(name, (fieldWords.get(name) ?? 0) + (e.word_count || 0));
  }
  const topField = [...fieldWords].sort((a, b) => b[1] - a[1])[0] ?? null;

  const change = s.wordsPrevWeek > 0
    ? Math.round(((s.wordsWeek - s.wordsPrevWeek) / s.wordsPrevWeek) * 100)
    : null;

  return {
    wordsWeek: s.wordsWeek,
    entriesWeek: s.entriesWeek,
    bestDay: bestDay.words > 0 ? bestDay : null,
    topTopic: topTopic ? { title: topTopic[0], count: topTopic[1] } : null,
    topField: topField ? { name: topField[0], words: topField[1] } : null,
    change,
    focusWeek: s.focusWeek,
  };
}

// Plain-language observations built from the real numbers.
export function insights(s) {
  const out = [];
  if (s.streak > 0) out.push(`You're on a ${s.streak}-day streak.`);
  else out.push('Write today to start a streak.');

  if (s.wordsPrevWeek > 0) {
    const pct = Math.round(((s.wordsWeek - s.wordsPrevWeek) / s.wordsPrevWeek) * 100);
    out.push(`This week's writing is ${Math.abs(pct)}% ${pct >= 0 ? 'up' : 'down'} on last week.`);
  } else if (s.wordsWeek > 0) {
    out.push('This is your first full week of writing to compare. Keep going.');
  }

  const long = s.rows.filter(e => (e.word_count || 0) >= 300 && e.confidence !== null);
  const short = s.rows.filter(e => (e.word_count || 0) < 300 && e.confidence !== null);
  if (long.length >= 3 && short.length >= 3) {
    const avg = arr => (arr.reduce((t, e) => t + e.confidence, 0) / arr.length).toFixed(1);
    out.push(`Entries over 300 words average confidence ${avg(long)}. Shorter ones average ${avg(short)}.`);
  }

  const byWeekday = new Map();
  for (const e of s.rows) {
    const name = weekdayOf(e.day);
    byWeekday.set(name, (byWeekday.get(name) ?? 0) + (e.word_count || 0));
  }
  const peak = [...byWeekday].sort((a, b) => b[1] - a[1])[0];
  if (peak && peak[1] > 0) out.push(`You write most on ${peak[0]}s.`);

  if (s.focusWeek > 0) out.push(`You focused for ${s.focusWeek} minutes this week.`);
  if (s.reviewSessions > 0) {
    out.push(`You have returned to ${s.reviewSessions} topic${s.reviewSessions === 1 ? '' : 's'}. Returning is how memory sticks.`);
  }
  return out;
}

// Compares computed stats with stored badges. Saves new unlocks and returns them.
export async function syncBadges(uid, stats) {
  const { data: existing, error } = await supabase
    .from('user_badges').select('badge_key').eq('user_id', uid);
  if (error) throw error;
  const have = new Set((existing ?? []).map(b => b.badge_key));

  // Steps are checked in chain order. A step only counts once the step before it is earned.
  const earnedNow = new Set(have);
  const fresh = [];
  for (const b of BADGES) {
    if (earnedNow.has(b.key)) continue;
    if (b.requires && !earnedNow.has(b.requires)) continue;
    if (!b.test(stats)) continue;
    earnedNow.add(b.key);
    fresh.push(b);
  }
  if (fresh.length) {
    const { error: insertError } = await supabase.from('user_badges').insert(
      fresh.map(b => ({ user_id: uid, badge_key: b.key }))
    );
    if (insertError) throw insertError;
  }
  if (fresh.length && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('orbit:award', { detail: fresh }));
  }
  return fresh;
}

// key -> unlocked_on timestamp, so screens can show earning dates.
export async function unlockedMap(uid) {
  const { data, error } = await supabase.from('user_badges')
    .select('badge_key,unlocked_on').eq('user_id', uid);
  if (error) throw error;
  return new Map((data ?? []).map(b => [b.badge_key, b.unlocked_on]));
}

export async function unlockedKeys(uid) {
  return new Set((await unlockedMap(uid)).keys());
}
