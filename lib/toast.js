// Call toast('Saved.') from anywhere. The Toaster component in the shell shows it.
// tone: 'info' | 'ok' | 'err' | 'warn' | 'badge'
export function toast(text, tone = 'info', ms = 3400) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('orbit:toast', {
    detail: { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, tone, ms },
  }));
}
