'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { activeTabIndex, tabIndexAt } from '../lib/tabs';

// Icons for each tab, keyed by route. Monoline, to match the app's icon style.
const ICON = {
  '/': (
    <path d="M4 11.2 12 4.5l8 6.7V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />
  ),
  '/topics': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  '/journal': (
    <path d="M12 20s-7.5-4.4-7.5-9.6A4.1 4.1 0 0 1 12 7.9a4.1 4.1 0 0 1 7.5 2.5C19.5 15.6 12 20 12 20z" />
  ),
  '/awards': (
    <path d="M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6L12 16.6l-5 2.6.9-5.6-4-3.9 5.6-.8z" />
  ),
  '/log': (
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5zM10 20.5a2 2 0 0 0 4 0" />
  ),
};

// Floating glass bar. Fixed to the bottom of the screen, it sits above the page and never scrolls.
// The centre tab is the journal, raised in the accent colour. Drag along the bar to switch tabs.
export default function TabBar({ tabs, path }) {
  const router = useRouter();
  const trackRef = useRef(null);
  const gesture = useRef({ down: false, moved: false, x: 0 });
  const suppressClick = useRef(false);
  const n = tabs.length;
  const activeIndex = activeTabIndex(tabs, path);
  const [dragIndex, setDragIndex] = useState(null);
  const shown = dragIndex ?? activeIndex;
  const centre = tabs.findIndex(([href]) => href === '/journal');

  function indexAt(clientX) {
    const rect = trackRef.current.getBoundingClientRect();
    return tabIndexAt(clientX, rect.left, rect.width, n);
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

  // A drag ends with a click on the tab under the finger. Swallow that click.
  function onClickCapture(e) {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }

  return (
    <nav className="obar" aria-label="Main">
      <div
        className={`obar-track ${dragIndex !== null ? 'is-dragging' : ''}`}
        ref={trackRef}
        style={{ '--n': n }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={onClickCapture}
      >
        {tabs.map(([href, label], i) => {
          const isCentre = i === centre;
          const on = i === shown;
          return (
            <Link
              key={href}
              href={href}
              className={`obar-item ${on ? 'on' : ''} ${isCentre ? 'is-centre' : ''}`}
              aria-current={i === activeIndex ? 'page' : undefined}
              aria-label={label}
              data-sound="nav"
            >
              <span className="obar-ico">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {ICON[href]}
                </svg>
              </span>
              <span className="obar-sr">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
