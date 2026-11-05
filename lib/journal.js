import { supabase } from './supabase';
import { nextReview } from './review';
import { logDecision } from './log';
import { getProfile } from './profile';
import { loadStats, syncBadges } from './stats';

// Spaced review scheduling from a confidence rating (SM-2).
export async function scheduleReview(uid, topicId, quality) {
  const { data: cur, error: readError } = await supabase.from('reviews').select('*')
    .eq('user_id', uid).eq('topic_id', topicId).maybeSingle();
  if (readError) throw readError;
  const next = nextReview(cur ?? {}, quality);
  const { error } = await supabase.from('reviews').upsert({
    user_id: uid, topic_id: topicId, ...next,
  });
  if (error) throw error;
  return next;
}

// Everything that happens when an entry is saved. Used by live saves and by
// the offline queue, so it must be safe to run once per entry id.
// payload: { id, topic_id, assignment_id, body, key_points, confidence,
//            minutes_spent, word_count, tags, created_at }
export async function commitEntry(uid, payload) {
  const { error } = await supabase.from('journal_entries').upsert(
    { ...payload, user_id: uid },
    { onConflict: 'id', ignoreDuplicates: true }
  );
  if (error) throw error;

  if (payload.assignment_id) {
    await supabase.from('assignments').update({ status: 'completed' })
      .eq('id', payload.assignment_id).eq('user_id', uid);
  }

  const next = await scheduleReview(uid, payload.topic_id, payload.confidence);

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
  });

  const profile = await getProfile(uid);
  const stats = await loadStats(uid, profile);
  const fresh = await syncBadges(uid, stats);
  return { next, fresh, stats, profile };
}
