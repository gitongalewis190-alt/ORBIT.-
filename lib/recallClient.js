// Browser side of recall: asks the verify route, and falls back to the local scorer.
import { supabase } from './supabase';
import { heuristicReview } from './recall';

export async function verifyAnswer(answer, source) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error('no session');
    const res = await fetch('/api/recall/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ answer, source }),
    });
    if (!res.ok) throw new Error(`verify ${res.status}`);
    return await res.json();
  } catch {
    return heuristicReview(answer, source);
  }
}
