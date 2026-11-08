// Browser side of recall: asks the verify route, and falls back to the local scorer.
import { supabase } from './supabase';
import { heuristicReview } from './recall';

const LOG_KEY = 'orbit.ai.log.v1';

function logAttempt(entry) {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const next = [...(Array.isArray(list) ? list : []), entry].slice(-50);
    localStorage.setItem(LOG_KEY, JSON.stringify(next));
  } catch {
    // a private window may refuse storage
  }
}

export function readAiLog() {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function aiGradingEnabled() {
  try { return localStorage.getItem('orbit.ai.enabled') !== '0'; } catch { return true; }
}

export function setAiGradingEnabled(on) {
  localStorage.setItem('orbit.ai.enabled', on ? '1' : '0');
}

export async function verifyAnswer(answer, source, options = {}) {
  const started = Date.now();
  const charsSent = String(answer || '').length + String(source?.body || '').length;
  const local = (reason) => {
    const graded = heuristicReview(answer, source);
    logAttempt({ t: started, provider: null, outcome: 'local', ms: Date.now() - started, charsSent: 0, fallbackReason: reason, test: Boolean(options.test) });
    return { ...graded, meta: { fallbackReason: reason } };
  };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return local('offline');
  if (!aiGradingEnabled()) return local('ai_disabled');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return local('unauthenticated');
    const res = await fetch('/api/recall/verify', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ answer, source, test: Boolean(options.test) }),
    });
    if (!res.ok) return local(`http_${res.status}`);
    const graded = await res.json();
    logAttempt({ t: started, provider: graded.verifier || null, outcome: graded.verifier || 'ok', ms: Date.now() - started, charsSent, fallbackReason: null, test: Boolean(options.test) });
    return graded;
  } catch (error) {
    const reason = error?.name === 'AbortError' ? 'timeout' : 'timeout';
    return local(reason);
  } finally {
    clearTimeout(timer);
  }
}
