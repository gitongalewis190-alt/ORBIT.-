'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { activeTabIndex, tabIndexAt, tabCentre, barPath, NAV } from '../lib/tabs';
import { stepSpring, settled, SPRING } from '../lib/spring';

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

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function reducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// Light tactile tap where the device can vibrate (Android). iPhone Safari has no
// vibration API for web pages, so the tab sound is the feedback there.
function tick() {
  try { navigator.vibrate?.(8); } catch {}
}

// The sculpted navigation bar.
// A flat-topped bar carved by a circular notch. The selector is a solid circle that
// sits in the notch and glides between the tabs on a damped spring. The notch is
// redrawn on every frame, so the carved edge follows the selector exactly.
// Drag along the bar to choose a tab, or tap one. The bar hides on screens outside the tabs.
export default function TabBar({ tabs, path, visible = true }) {
  const router = useRouter();
  const n = tabs.length;
  const activeIndex = activeTabIndex(tabs, path);
  const centre = tabs.findIndex(([href]) => href === '/journal');

  const [width, setWidth] = useState(0);
  const [dragIndex, setDragIndex] = useState(null);

  const barRef = useRef(null);
  const pathRef = useRef(null);
  const selectorRef = useRef(null);
  const widthRef = useRef(0);
  const prevIndex = useRef(activeIndex);
  // Animation and pointer state. Kept in a ref so frames never trigger React renders.
  const anim = useRef({
    x: null, v: 0, target: 0, raf: 0, last: 0,
    pointer: null, startX: 0, moved: false, suppress: false,
  });

  // Puts the selector and the carved edge at horizontal position x.
  function draw(x) {
    const w = widthRef.current;
    if (!w) return;
    pathRef.current?.setAttribute('d', barPath({ width: w, cx: x }));
    if (selectorRef.current) {
      selectorRef.current.style.transform = `translate3d(${x - NAV.r}px, ${NAV.cy - NAV.r}px, 0)`;
    }
  }

  function frame(now) {
    const a = anim.current;
    const dt = a.last ? (now - a.last) / 1000 : 1 / 60;
    a.last = now;
    const s = stepSpring({ x: a.x, v: a.v }, a.target, dt, SPRING);
    a.x = s.x;
    a.v = s.v;
    if (settled(s, a.target)) {
      a.x = a.target;
      a.v = 0;
      a.raf = 0;
      a.last = 0;
      draw(a.x);
      return;
    }
    draw(a.x);
    a.raf = requestAnimationFrame(frame);
  }

  // Glides the selector to x. Reduced-motion users get an instant move.
  function glideTo(x) {
    const a = anim.current;
    if (a.x === null || reducedMotion()) {
      if (a.raf) cancelAnimationFrame(a.raf);
      a.raf = 0;
      a.x = x;
      a.v = 0;
      a.target = x;
      draw(x);
      return;
    }
    a.target = x;
    if (!a.raf) {
      a.last = 0;
      a.raf = requestAnimationFrame(frame);
    }
  }

  // Measure the bar so the notch and selector use real pixels.
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      widthRef.current = w;
      setWidth(w);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Glide to the active tab. Hidden screens keep the selector where it was.
  useEffect(() => {
    const a = anim.current;
    if (!width || a.pointer !== null) return;
    if (activeIndex < 0) return;
    if (prevIndex.current !== activeIndex && prevIndex.current >= 0) tick();
    prevIndex.current = activeIndex;
    glideTo(tabCentre(activeIndex, n, width));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, width, n]);

  // Stop any running animation when the bar leaves the page.
  useEffect(() => () => {
    const a = anim.current;
    if (a.raf) cancelAnimationFrame(a.raf);
  }, []);

  function localX(clientX) {
    const rect = barRef.current.getBoundingClientRect();
    return clientX - rect.left;
  }

  function onPointerDown(e) {
    const a = anim.current;
    a.pointer = e.pointerId;
    a.startX = e.clientX;
    a.moved = false;
    a.suppress = false;
  }

  function onPointerMove(e) {
    const a = anim.current;
    if (a.pointer === null || e.pointerId !== a.pointer) return;
    if (!a.moved) {
      if (Math.abs(e.clientX - a.startX) < 6) return;
      a.moved = true;
      barRef.current.setPointerCapture?.(e.pointerId);
      if (a.raf) {
        cancelAnimationFrame(a.raf);
        a.raf = 0;
      }
    }
    const w = widthRef.current;
    const x = clamp(localX(e.clientX), NAV.r, w - NAV.r);
    a.x = x;
    a.v = 0;
    draw(x);
    setDragIndex(tabIndexAt(e.clientX, barRef.current.getBoundingClientRect().left, w, n));
  }

  function onPointerEnd(e, cancelled) {
    const a = anim.current;
    if (a.pointer === null || e.pointerId !== a.pointer) return;
    a.pointer = null;
    if (!a.moved) return; // A plain tap: the link itself handles it.
    a.moved = false;
    a.suppress = true; // The click that follows a drag must not navigate twice.
    setDragIndex(null);
    const w = widthRef.current;
    const target = cancelled
      ? activeIndex
      : tabIndexAt(e.clientX, barRef.current.getBoundingClientRect().left, w, n);
    if (!cancelled && target >= 0 && target !== activeIndex) {
      router.push(tabs[target][0]);
    } else if (activeIndex >= 0) {
      glideTo(tabCentre(activeIndex, n, w));
    }
  }

  function onClickCapture(e) {
    const a = anim.current;
    if (a.suppress) {
      a.suppress = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }

  const shown = dragIndex ?? activeIndex;

  return (
    <nav
      className={`obar${visible ? '' : ' is-hidden'}`}
      aria-label="Main"
      aria-hidden={visible ? undefined : true}
    >
      <div
        className="obar-body"
        ref={barRef}
        style={{ '--n': n }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={e => onPointerEnd(e, false)}
        onPointerCancel={e => onPointerEnd(e, true)}
        onClickCapture={onClickCapture}
        onDragStart={e => e.preventDefault()}
      >
        <svg
          className="obar-svg"
          viewBox={`0 0 ${width || 1} ${NAV.height}`}
          aria-hidden="true"
          focusable="false"
        >
          {/* Solid body first, so nothing from the page shows through the carved notch. */}
          <rect className="obar-bg" x="0" y="0" width={width || 1} height={NAV.height} rx={NAV.radius} />
          {/* The carved outline, drawn as a stroke along the edge only. */}
          <path ref={pathRef} className="obar-shape" />
        </svg>

        <div className="obar-row">
          {tabs.map(([href, label], i) => {
            const on = i === shown;
            const isCentre = i === centre;
            return (
              <Link
                key={href}
                href={href}
                className={`obar-item${on ? ' on' : ''}${isCentre ? ' is-centre' : ''}`}
                aria-current={i === activeIndex ? 'page' : undefined}
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
          {shown >= 0 && (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              {ICON[tabs[shown][0]]}
            </svg>
          )}
        </div>
      </div>
    </nav>
  );
}
