'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { play } from '../lib/sound';
import { TIER_LABEL } from '../lib/awards';
import { BENEFITS } from '../lib/benefits';

const Medal3D = dynamic(() => import('./Medal3D'), {
  ssr: false,
  loading: () => <div className="medal-placeholder" aria-hidden="true" />,
});

const CONFETTI_COLOURS = ['#c4623d', '#e8a87c', '#1c1b19', '#f2d7b6', '#8a4a2c', '#ffffff'];

// A burst of paper confetti. Each piece gets its own colour, speed, drift and start delay.
function Confetti({ seed }) {
  const pieces = useMemo(() => Array.from({ length: 90 }, (_, i) => ({
    left: Math.random() * 100,
    dx: (Math.random() - 0.5) * 220,
    rot: 360 + Math.random() * 900,
    delay: Math.random() * 0.6,
    d: 2.2 + Math.random() * 1.6,
    w: 6 + Math.random() * 6,
    h: 10 + Math.random() * 10,
    c: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
  })), [seed]);

  return (
    <div className="confetti-layer" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            '--dx': `${p.dx}px`,
            '--rot': `${p.rot}deg`,
            '--delay': `${p.delay}s`,
            '--d': `${p.d}s`,
            '--w': `${p.w}px`,
            '--h': `${p.h}px`,
            '--c': p.c,
          }}
        />
      ))}
    </div>
  );
}

const todayLabel = () => new Date().toLocaleDateString('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi',
});

// Listens for 'orbit:award' events, which syncBadges() sends when new awards are saved.
// Several awards earned together appear one after another.
export default function AwardUnlock() {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    const onAward = e => setQueue(q => [...q, ...e.detail]);
    window.addEventListener('orbit:award', onAward);
    return () => window.removeEventListener('orbit:award', onAward);
  }, []);

  const current = queue[0];
  // Fit the medal to the visible screen: width and height both limit it, so the card never needs scrolling.
  const medalSize = typeof window === 'undefined'
    ? 280
    : Math.max(140, Math.min(window.innerWidth - 40, window.innerHeight * 0.34, 400));

  useEffect(() => {
    if (current) play('badge');
  }, [current?.key]);

  if (!current) return null;

  const next = () => setQueue(q => q.slice(1));

  return (
    <div className="unlock" role="dialog" aria-modal="true" aria-label="Award unlocked">
      <Confetti seed={current.key} />
      <div className="unlock-card fade-in">
        <div className="kicker">Award unlocked</div>
        <div className="unlock-glow" aria-hidden="true" />
        <div className="unlock-medal">
          <Medal3D
            key={current.key}
            tier={current.tier}
            emblem={current.emblem}
            name={current.name}
            dateLabel={todayLabel()}
            size={medalSize}
            interactive
            autoSpin
            intro
          />
        </div>
        <h2 className="unlock-title">{current.name}</h2>
        <div className="muted">{TIER_LABEL[current.tier]} · {current.description}</div>
        {current.benefit && BENEFITS[current.benefit] && (
          <div className="unlock-benefit">
            <strong>{BENEFITS[current.benefit].title}.</strong> {BENEFITS[current.benefit].text}
          </div>
        )}
        {queue.length > 1 && <div className="muted" style={{ marginTop: 6 }}>{queue.length - 1} more to see</div>}
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn accent" onClick={next}>
            {queue.length > 1 ? 'Next' : 'Continue'}
          </button>
          <Link className="btn" href="/stats#awards" onClick={next}>View collection</Link>
        </div>
      </div>
    </div>
  );
}
