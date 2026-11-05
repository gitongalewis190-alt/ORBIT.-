import { supabase } from './supabase';

// Every choice you make is written here. The selector learns from this history.
export async function logDecision(userId, event, topicId = null, payload = {}) {
  const { error } = await supabase.from('decision_log').insert({
    user_id: userId,
    event,
    topic_id: topicId,
    payload,
  });
  if (error) console.error('decision_log write failed', error.message);
}
