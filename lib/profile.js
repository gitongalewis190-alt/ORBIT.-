
import { supabase } from './supabase.js';

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

// Returns the signed-in user's profile.
// Creates a new profile with default settings if one does not exist.
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  // Existing profiles: preserve saved values and fill in missing defaults.
  if (data) {
    return {
      ...DEFAULT_PROFILE,
      ...data,
      sound_on: data.sound_on ?? true,
      sound_volume: data.sound_volume ?? 70,
    };
  }

  // New profiles: create using the default settings.
  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      user_id: userId,
      ...DEFAULT_PROFILE,
    })
    .select('*')
    .single();

  if (insertError) throw insertError;

  return created;
}

// Saves changes to the signed-in user's profile.
export async function saveProfile(userId, patch) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;

  return data;
}
