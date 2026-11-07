'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { activeTabIndex, tabCentre, barPath, NAV } from '../lib/tabs';

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

// The navigation bar stays put. The marker sits on the current tab and does not
// glide, spring, or follow a drag. The bar only leaves when a screen outside
// the tabs is open.
export default function TabBar({ tabs, path, visible = true }) {
  const n = tabs.length;
  const activeIndex = activeTabIndex(tabs, path);
  const centre = tabs.findIndex(([href]) => href === '/journal');

  const [width, setWidth] = useState(0);
  const barRef = useRef(null);
  const pathRef = useRef(null);
  const selectorRef = useRef(null);

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return undefined;
    const place = () => {
      const w = el.getBoundingClientRect().width;
      setWidth(w);
      if (!w || activeIndex < 0) return;
      const x = tabCentre(activeIndex, n, w);
      pathRef.current?.setAttribute('d', barPath({ width: w, cx: x }));
      if (selectorRef.current) {
        selectorRef.current.style.transform = `translate3d(${x - NAV.r}px, ${NAV.cy - NAV.r}px, 0)`;
      }
    };
    place();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    ro?.observe(el);
    window.addEventListener('resize', place);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [activeIndex, n]);

  return (
    <nav
      className={`obar${visible ? '' : ' is-hidden'}`}
      aria-label="Main"
      aria-hidden={visible ? undefined : true}
    >
      <div className="obar-body" ref={barRef} style={{ '--n': n }}>
        <svg
          className="obar-svg"
          viewBox={`0 0 ${width || 1} ${NAV.height}`}
          aria-hidden="true"
          focusable="false"
        >
          <rect className="obar-bg" x="0" y="0" width={width || 1} height={NAV.height} rx={NAV.radius} />
          <path ref={pathRef} className="obar-shape" />
        </svg>

        <div className="obar-row">
          {tabs.map(([href, label], i) => {
            const on = i === activeIndex;
            const isCentre = i === centre;
            return (
              <Link
                key={href}
                href={href}
                className={`obar-item${on ? ' on' : ''}${isCentre ? ' is-centre' : ''}`}
                aria-current={on ? 'page' : undefined}
                aria-label={label}
                title={label}
                data-sound="nav"
                draggable={false}
                tabIndex={visible ? undefined : -1}
              >
                <span className="obar-ico">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {ICON[href]}
                  </svg>
                </span>
                <span className="obar-name">{label}</span>
              </Link>
            );
          })}
        </div>

        <div ref={selectorRef} className="obar-selector" aria-hidden="true">
          {activeIndex >= 0 && (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              {ICON[tabs[activeIndex][0]]}
            </svg>
          )}
        </div>
      </div>
    </nav>
  );
}
