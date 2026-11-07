// Auth gating for Orbit. Kept free of the Supabase client so it can be tested
// on its own, and so the shell can decide sign-in without a network call.

const chains = new Map();

// One auth operation at a time inside this tab.
// iOS Safari's Navigator LockManager overlaps those operations when a save
// fires a burst of session reads. The overlapping refresh is rejected, the
// client deletes the session, and the app treats that as a sign-out.
export function memoryLock(name, _acquireTimeout, fn) {
  const previous = chains.get(name) || Promise.resolve();
  const run = previous.then(() => fn(), () => fn());
  chains.set(name, run.then(() => undefined, () => undefined));
  return run;
}

// The persisted session, if the browser still has one. Storage is passed in
// so this stays a pure read (localStorage in the app, a fake in tests).
export function readPersistedUserId(storage) {
  if (!storage || typeof storage.key !== 'function' || typeof storage.getItem !== 'function') {
    return null;
  }
  try {
    const length = storage.length ?? 0;
    for (let i = 0; i < length; i += 1) {
      const key = storage.key(i);
      if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
      const raw = storage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const session = parsed?.currentSession ?? parsed?.session ?? parsed;
      if (session?.access_token && session?.user?.id) return session.user.id;
    }
  } catch {
    return null;
  }
  return null;
}

// What the shell should do with one auth event.
// A null session is a sign-out only when the event says so AND nothing is
// left on disk. INITIAL_SESSION and a refresh race must not open the landing
// animation. `settle` means confirm against storage before leaving the app.
export function nextAuth({ event, session, persistedUserId, knownUserId }) {
  const liveId = session?.user?.id || null;
  if (liveId) return { authed: true, userId: liveId, settle: false };
  if (event !== 'SIGNED_OUT') {
    if (knownUserId) return { authed: true, userId: knownUserId, settle: false };
    if (persistedUserId) return { authed: true, userId: persistedUserId, settle: false };
    return { authed: null, userId: null, settle: false };
  }
  if (persistedUserId) return { authed: true, userId: persistedUserId, settle: true };
  return { authed: false, userId: null, settle: true };
}
