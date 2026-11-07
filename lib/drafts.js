const PREFIX = 'orbit.draft.';

function store() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readDraft(key) {
  try {
    const raw = store()?.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeDraft(key, value) {
  try {
    store()?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage can throw in private mode or when the quota is full.
  }
}

export function clearDraft(key) {
  try {
    store()?.removeItem(PREFIX + key);
  } catch {
    // Ignore. A leftover draft is better than a crash.
  }
}
