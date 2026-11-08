import { createClient } from '@supabase/supabase-js';
import { memoryLock } from './authGate.js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Do not use navigator.locks. On iOS it lets a save's auth burst overlap,
    // the second refresh fails, and the client wipes a still-valid session.
    lock: memoryLock,
  },
});
