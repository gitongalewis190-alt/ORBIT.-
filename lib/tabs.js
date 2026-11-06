// Position maths for the tab bar, kept apart from the component so it can be tested.

// Index of the tab for this path, or -1 when the page is not one of the tabs
// (Guide, Settings and Stats are reached from elsewhere, so no tab is lit).
export function activeTabIndex(tabs, path) {
  if (!path) return -1;
  const exact = tabs.findIndex(([href]) => href === path);
  if (exact !== -1) return exact;
  // Nested pages under a tab keep that tab lit, for example /journal/new.
  return tabs.findIndex(([href]) => href !== '/' && path.startsWith(href + '/'));
}

// Which tab a horizontal position falls in, clamped to the bar.
export function tabIndexAt(clientX, left, width, count) {
  if (count <= 0 || width <= 0) return 0;
  const frac = (clientX - left) / width;
  return Math.min(count - 1, Math.max(0, Math.floor(frac * count)));
}
