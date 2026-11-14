// Position maths for the navigation bar, kept apart from the component so it can be tested.

// Index of the tab for this path, or -1 when the page is not one of the tabs.
// Settings, Guide and other separate screens are -1, so the bar hides on them.
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

// Sculpted bar geometry, in CSS pixels.
//   height: the bar. cy: the line the icons and the selector sit on, measured from the top.
//   r: radius of the selector. gap: space between the selector and the carved edge.
// The carved notch has radius r + gap. It must be larger than cy, so the notch
// opens through the top edge and the selector sits in it like a ball in a cradle.
export const NAV = { height: 60, cy: 26, r: 22, gap: 5, radius: 24, maxWidth: 480 };

// Horizontal centre of tab i, out of n, across a bar of this width.
export function tabCentre(i, n, width) {
  return (width / n) * (i + 0.5);
}

// SVG path for the bar. The top edge runs flat, dips around a circular notch centred
// at x = cx, and runs flat again. The corners are rounded.
export function barPath({ width, height = NAV.height, radius = NAV.radius, cx, cy = NAV.cy, r = NAV.r, gap = NAV.gap }) {
  const R = r + gap;
  const dx = Math.sqrt(R * R - cy * cy);
  const A = cx - dx;
  const B = cx + dx;
  const rr = Math.min(radius, height / 2, width / 2);
  const W = width;
  const H = height;
  return [
    `M ${rr} 0`,
    `L ${A.toFixed(2)} 0`,
    // Down round the notch and back up: the long way round, anticlockwise on screen.
    `A ${R} ${R} 0 1 0 ${B.toFixed(2)} 0`,
    `L ${W - rr} 0`,
    `Q ${W} 0 ${W} ${rr}`,
    `L ${W} ${H - rr}`,
    `Q ${W} ${H} ${W - rr} ${H}`,
    `L ${rr} ${H}`,
    `Q 0 ${H} 0 ${H - rr}`,
    `L 0 ${rr}`,
    `Q 0 0 ${rr} 0 Z`,
  ].join(' ');
}

// Same bar, turned so the notch opens through the right edge.
// length is the long axis. thickness is the bar's width. cy is the selector's
// position along the length. The selector sits `inset` pixels in from the right.
export function barPathVertical({ length, thickness = NAV.height, radius = NAV.radius, cy, inset = NAV.cy, r = NAV.r, gap = NAV.gap }) {
  const R = r + gap;
  const dy = Math.sqrt(Math.max(0, R * R - inset * inset));
  const A = cy - dy;
  const B = cy + dy;
  const rr = Math.min(radius, thickness / 2, length / 2);
  const W = thickness;
  const H = length;
  return [
    `M ${rr} 0`,
    `L ${W - rr} 0`,
    `Q ${W} 0 ${W} ${rr}`,
    `L ${W} ${A.toFixed(2)}`,
    `A ${R} ${R} 0 1 0 ${W} ${B.toFixed(2)}`,
    `L ${W} ${H - rr}`,
    `Q ${W} ${H} ${W - rr} ${H}`,
    `L ${rr} ${H}`,
    `Q 0 ${H} 0 ${H - rr}`,
    `L 0 ${rr}`,
    `Q 0 0 ${rr} 0 Z`,
  ].join(' ');
}
