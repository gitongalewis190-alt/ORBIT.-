'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { activeTabIndex, tabCentre, barPath, barPathVertical, NAV } from '../lib/tabs';
import { settled, stepSpring } from '../lib/spring';

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
  '/study': (
    <path d="M5 5.5h14v13H5zM8 9h8M8 12.5h5" />
  ),
  '/progress': (
    <path d="M5 16.5 9 11l3 3 3-5 4 7.5" />
  ),
  '/settings': (
    <>
      <path d="M14.8 3.3 14.3 6a6 6 0 0 1 2.1 1.2l2.3-1 1.4 2.3-2 1.4a6 6 0 0 1 0 2.2l2 1.4-1.4 2.3-2.3-1a6 6 0 0 1-2.1 1.2l.5 2.7h-2.6l-.5-2.7a6 6 0 0 1-2.1-1.2l-2.3 1-1.4-2.3 2-1.4a6 6 0 0 1 0-2.2l-2-1.4 1.4-2.3 2.3 1A6 6 0 0 1 11.7 6L12.2 3.3z" />
      <circle cx="12" cy="12" r="2.4" />
    </>
  ),
  '/guide': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.3a2.4 2.4 0 1 1 3.3 2.2c-.6.3-.9.8-.9 1.5V14" />
      <path d="M12 17h.01" />
    </>
  ),
  '/inspect': (
    <>
      <path d="M2.8 12S6.2 6.4 12 6.4 21.2 12 21.2 12 17.8 17.6 12 17.6 2.8 12 2.8 12z" />
      <circle cx="12" cy="12" r="2.2" />
    </>
  ),
};

const FOOT = [
  ['/settings', 'Settings'],
  ['/guide', 'Guide'],
  ['/inspect', 'Under the hood'],
];

function Glyph({ href }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON[href] || null}
    </svg>
  );
}

// One sculpted bar. Horizontal on a phone, vertical on a laptop. The marker
// springs to the current tab. Screens outside the five tabs keep the bar.
export default function TabBar({ tabs, path, visible = true, orientation = 'horizontal' }) {
  const vertical = orientation === 'vertical';
  const n = tabs.length;
  const activeIndex = activeTabIndex(tabs, path);
  const centre = tabs.findIndex(([href]) => href === '/journal');

  const [width, setWidth] = useState(0);
  const [length, setLength] = useState(0);
  const barRef = useRef(null);
  const pathRef = useRef(null);
  const selectorRef = useRef(null);
  const springRef = useRef({ x: 0, v: 0, ready: false });

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return undefined;
    let raf = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const box = () => {
      const rect = el.getBoundingClientRect();
      return vertical
        ? { length: rect.height, thickness: rect.width }
        : { length: rect.width, thickness: NAV.height };
    };

    const apply = (along) => {
      const { length: axis, thickness } = box();
      if (!axis) return;
      setLength(axis);
      setWidth(vertical ? thickness : axis);
      if (selectorRef.current) {
        selectorRef.current.style.opacity = activeIndex < 0 ? '0' : '1';
      }
      if (activeIndex < 0) {
        pathRef.current?.setAttribute('d', '');
        return;
      }
      if (vertical) {
        pathRef.current?.setAttribute('d', barPathVertical({ length: axis, thickness, cy: along }));
        if (selectorRef.current) {
          const x = Math.max(0, thickness - NAV.cy - NAV.r);
          selectorRef.current.style.transform = `translate3d(${x}px, ${along - NAV.r}px, 0)`;
        }
      } else {
        pathRef.current?.setAttribute('d', barPath({ width: axis, cx: along }));
        if (selectorRef.current) {
          selectorRef.current.style.transform = `translate3d(${along - NAV.r}px, ${NAV.cy - NAV.r}px, 0)`;
        }
      }
    };

    const goal = () => {
      const { length: axis } = box();
      if (activeIndex < 0 || !axis) return null;
      return tabCentre(activeIndex, n, axis);
    };

    const snap = () => {
      const t = goal();
      if (t == null) {
        apply(0);
        return;
      }
      springRef.current = { x: t, v: 0, ready: true };
      apply(t);
    };

    const glide = () => {
      const t = goal();
      if (t == null) {
        apply(0);
        return;
      }
      if (!springRef.current.ready || reduced) {
        snap();
        return;
      }
      const frame = () => {
        const next = goal();
        if (next == null) return;
        springRef.current = stepSpring(springRef.current, next, 1 / 60);
        apply(springRef.current.x);
        if (!settled(springRef.current, next)) raf = requestAnimationFrame(frame);
      };
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    };

    glide();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(snap) : null;
    ro?.observe(el);
    window.addEventListener('resize', snap);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', snap);
    };
  }, [activeIndex, n, vertical]);

  const svgW = vertical ? (width || NAV.height) : (width || 1);
  const svgH = vertical ? (length || 1) : NAV.height;

  return (
    <nav
      className={`obar${vertical ? ' is-vertical' : ''}${visible ? '' : ' is-hidden'}`}
      aria-label="Main"
      aria-hidden={visible ? undefined : true}
    >
      <div className="obar-body" ref={barRef} style={{ '--n': n }}>
        <svg
          className="obar-svg"
          viewBox={`0 0 ${svgW} ${svgH}`}
          aria-hidden="true"
          focusable="false"
        >
          <rect className="obar-bg" x="0" y="0" width={svgW} height={svgH} rx={NAV.radius} />
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
                  <Glyph href={href} />
                </span>
                <span className="obar-name">{label}</span>
              </Link>
            );
          })}
        </div>

        <div ref={selectorRef} className="obar-selector" aria-hidden="true">
          {activeIndex >= 0 && <Glyph href={tabs[activeIndex][0]} />}
        </div>
      </div>

      {vertical && (
        <div className="obar-foot">
          {FOOT.map(([href, label]) => (
            <Link key={href} href={href} className={path === href || path.startsWith(href + '/') ? 'on' : ''} data-sound="nav" aria-label={label} title={label}>
              <Glyph href={href} />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
