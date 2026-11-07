import { supabase } from './supabase';
import { nextReview } from './review';
import { advanceReview } from './memoryStore';
import { logDecision } from './log';
import { getProfile } from './profile';
import { loadStats, syncBadges } from './stats';
import { today } from './dates';
import { completesAssignment } from './dayRules';

// ease, reps and interval_days stay on the SM-2 rule. due_on is the memory
// interval, because Today and the journal read that date as the next review.
export async function scheduleReview(uid, topicId, quality, entry = null) {
  const { data: cur, error: readError } = await supabase.from('reviews').select('*')
    .eq('user_id', uid).eq('topic_id', topicId).maybeSingle();
  if (readError) throw readError;
  const sm2 = nextReview(cur ?? {}, quality);
  const memory = await advanceReview({ uid, topicId, quality, entry, current: cur });
  const next = {
    ...sm2,
    due_on: memory.due_on,
    stability: memory.stability,
    difficulty: memory.difficulty,
    last_reviewed_on: memory.reviewed_on,
  };
  const { error } = await supabase.from('reviews').upsert({
    user_id: uid, topic_id: topicId, ...next,
  });
  if (error) throw error;
  return next;
}

// The assignment a research entry completes: the one it was started from, or today's
// topic when you log that same topic by hand. Reflections never complete a day.
async function assignmentToComplete(uid, payload) {
  if (!completesAssignment(payload.entry_kind)) return null;
  if (payload.assignment_id) return payload.assignment_id;
  const { data, error } = await supabase.from('assignments').select('id')
    .eq('user_id', uid).eq('assigned_on', today()).eq('topic_id', payload.topic_id)
    .in('status', ['generated', 'accepted']).limit(1).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

// Everything that happens when an entry is saved. Used by live saves and by
// the offline queue, so it must be safe to run once per entry id.
// payload: { id, topic_id, assignment_id, entry_kind, body, key_points, confidence,
//            minutes_spent, word_count, tags, created_at }
export async function commitEntry(uid, payload) {
  const { error } = await supabase.from('journal_entries').upsert(
    { ...payload, user_id: uid },
    { onConflict: 'id', ignoreDuplicates: true }
  );
  if (error) throw error;

  const doneId = await assignmentToComplete(uid, payload);
  if (doneId) {
    await supabase.from('assignments').update({ status: 'completed' })
      .eq('id', doneId).eq('user_id', uid);
    if (!payload.assignment_id) {
      await logDecision(uid, 'completed_by_log', payload.topic_id, { assignment_id: doneId });
    }
  }

  const next = await scheduleReview(uid, payload.topic_id, payload.confidence, {
    id: payload.id,
    reviewedAt: payload.created_at,
  });

  // Mastery: well-learned topics surface less. The change is logged.
  if (payload.confidence >= 4 && next.reps >= 3) {
    await supabase.from('topic_controls').upsert({
      user_id: uid, topic_id: payload.topic_id, state: 'show_less',
    });
    await logDecision(uid, 'auto_show_less', payload.topic_id, { reps: next.reps });
  }
  await logDecision(uid, 'journal_saved', payload.topic_id, {
    confidence: payload.confidence,
    minutes: payload.minutes_spent,
    words: payload.word_count,
    next_review: next.due_on,
    kind: payload.entry_kind ?? 'research',
  });

  const profile = await getProfile(uid);
  const stats = await loadStats(uid, profile);
  const fresh = await syncBadges(uid, stats);
  return { next, fresh, stats, profile };
}
