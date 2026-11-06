'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { play } from '../lib/sound';
import { TIER_LABEL } from '../lib/awards';
import { BENEFITS } from '../lib/benefits';

const Medal3D = dynamic(() => import('./Medal3D'), {
  ssr: false,
  loading: () => <div className="medal-placeholder" aria-hidden="true" />,
});

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

  useEffect(() => {
    if (current) play('badge');
  }, [current?.key]);

  if (!current) return null;

  const next = () => setQueue(q => q.slice(1));

  return (
    <div className="unlock" role="dialog" aria-modal="true" aria-label="Award unlocked">
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
            size={240}
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
