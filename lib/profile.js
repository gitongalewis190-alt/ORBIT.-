import { supabase } from './supabase';

export const DEFAULT_PROFILE = {
  display_name: '',
  age: null,
  daily_minutes: 90,
  word_goal: 150,
  weekly_entry_goal: 5,
  theme: 'light',
  sound_on: true,
  sound_volume: 70,
  timezone: 'Africa/Nairobi',
  onboarded: false,
};

// Returns the signed-in user's profile, creating it with defaults if missing.
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({ user_id: userId, ...DEFAULT_PROFILE })
    .select('*')
    .single();
  if (insertError) throw insertError;
  return created;
}

export async function saveProfile(userId, patch) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
