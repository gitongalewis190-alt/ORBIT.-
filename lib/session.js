import { supabase } from './supabase';

// The signed-in user from the session already on this phone.
// getUser() calls the auth server. A save followed by Logs fires several of
// those at once, and on iOS that burst is what drops the session.
export async function currentUser() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.user ?? null;
}
