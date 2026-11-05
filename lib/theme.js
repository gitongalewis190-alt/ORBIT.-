// Light, dark, or system. The choice is cached in localStorage so the layout
// script can apply it before the first paint, which prevents a white flash.
export const THEME_KEY = 'orbit.theme';

export function getStoredTheme() {
  if (typeof window === 'undefined') return 'light';
  return localStorage.getItem(THEME_KEY) || 'light';
}

export function resolveTheme(choice) {
  if (choice === 'dark') return 'dark';
  if (choice === 'light') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function applyTheme(choice) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_KEY, choice);
  document.documentElement.dataset.theme = resolveTheme(choice);
}

// Inline script for <head>. Runs before React so the page never flashes.
export const THEME_BOOT_SCRIPT = `
(function () {
  try {
    var c = localStorage.getItem('${THEME_KEY}') || 'light';
    var dark = c === 'dark' || (c === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
`;
