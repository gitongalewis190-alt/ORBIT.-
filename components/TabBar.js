'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Five-tab bar. A warm orange pebble sits in a recessed hole under the active tab.
// Tap a tab to open it, or press and drag along the bar: the pebble follows your
// finger and settles into the tab you release on.
export default function TabBar({ tabs, path }) {
  const router = useRouter();
  const trackRef = useRef(null);
  const gesture = useRef({ down: false, moved: false, x: 0 });
  const suppressClick = useRef(false);
  const n = tabs.length;
  const activeIndex = Math.max(0, tabs.findIndex(([href]) => href === path));
  const [dragIndex, setDragIndex] = useState(null);
  const shown = dragIndex ?? activeIndex;

  function indexAt(clientX) {
    const rect = trackRef.current.getBoundingClientRect();
    const frac = (clientX - rect.left) / rect.width;
    return Math.min(n - 1, Math.max(0, Math.floor(frac * n)));
  }

  function onPointerDown(e) {
    gesture.current = { down: true, moved: false, x: e.clientX };
  }

  function onPointerMove(e) {
    const g = gesture.current;
    if (!g.down) return;
    if (!g.moved && Math.abs(e.clientX - g.x) > 6) {
      g.moved = true;
      trackRef.current?.setPointerCapture?.(e.pointerId);
    }
    if (g.moved) setDragIndex(indexAt(e.clientX));
  }

  function onPointerUp(e) {
    const g = gesture.current;
    gesture.current = { down: false, moved: false, x: 0 };
    if (!g.moved) return;
    const target = indexAt(e.clientX);
    suppressClick.current = true;
    setDragIndex(null);
    if (target !== activeIndex) router.push(tabs[target][0]);
  }

  function onPointerCancel() {
    gesture.current = { down: false, moved: false, x: 0 };
    setDragIndex(null);
  }

  // A drag ends with a click on the tab underneath the finger. Swallow that click.
  function onClickCapture(e) {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }

  return (
    <div className="tabbar" role="navigation" aria-label="Main">
      <div
        className="tabbar-track"
        ref={trackRef}
        style={{ '--n': n }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={onClickCapture}
      >
        <div
          className={`tabbar-hole ${dragIndex !== null ? 'is-dragging' : ''}`}
          style={{ width: `${100 / n}%`, transform: `translateX(${shown * 100}%)` }}
          aria-hidden="true"
        >
          <span className="tabbar-pebble" />
        </div>
        {tabs.map(([href, label], i) => (
          <Link
            key={href}
            href={href}
            className={`tabbar-link ${i === shown ? 'on' : ''}`}
            aria-current={i === activeIndex ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
