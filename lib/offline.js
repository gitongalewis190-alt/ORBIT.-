// Everything here lives on the phone, in localStorage, so it survives a closed
// app or a dropped connection. Drafts are per user, so accounts never mix.

const draftKey = uid => `orbit.draft.${uid}`;
const queueKey = uid => `orbit.queue.${uid}`;

function read(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked. The draft is lost, but the app keeps working.
  }
}

// Drafts: what you're writing right now, saved as you type.
export const loadDraft = uid => read(draftKey(uid), null);
export const saveDraft = (uid, draft) => write(draftKey(uid), { ...draft, savedAt: Date.now() });
export const clearDraft = uid => {
  if (typeof window !== 'undefined') localStorage.removeItem(draftKey(uid));
};

// Queue: finished entries that could not reach the server yet.
export const loadQueue = uid => read(queueKey(uid), []);
export const enqueue = (uid, item) => write(queueKey(uid), [...loadQueue(uid), item]);
export const replaceQueue = (uid, items) => write(queueKey(uid), items);

// True when the failure is a connection problem rather than a rejected request.
export function isNetworkError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = (err?.message || '').toLowerCase();
  return err instanceof TypeError || msg.includes('failed to fetch') || msg.includes('network');
}
