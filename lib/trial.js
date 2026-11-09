// Trial mode: a private window. While it is on, writes are not sent to your account.
const KEY = 'orbit.trial';

export function isTrial() {
  try { return typeof window !== 'undefined' && localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function setTrial(on) {
  try {
    if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event('orbit:trial'));
}
