'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HUBS, recordById } from '../../lib/navMap';
import { currentUser } from '../../lib/session';
import { getProfile } from '../../lib/profile';
import { loadStats } from '../../lib/stats';

export default function ProgressPage() {
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    currentUser().then(async (user) => {
      if (!user) return;
      try {
        const profile = await getProfile(user.id);
        const stats = await loadStats(user.id, profile);
        setSummary(stats);
      } catch {
        setSummary(null);
      }
    });
  }, []);
  return (
    <div className="fade-in">
      <h1>Progress</h1>
      <div className="card">
        <p>Streak {summary?.streak ?? '—'}</p>
        <p className="muted">Awards earned {summary?.awards ?? summary?.earned ?? '—'}</p>
        <Link href="/#rings">Today's rings</Link>
      </div>
      <div className="hub-grid">
        {HUBS.progress.map(id => {
          const row = recordById(id);
          if (!row) return null;
          if (row.action) {
            return <button key={id} type="button" className="nav-row" data-sound="open" onClick={() => window.dispatchEvent(new Event(row.action))}><strong>{row.title}</strong><span>{row.description}</span></button>;
          }
          return <Link key={id} href={row.route} className="nav-row" data-sound="nav"><strong>{row.title}</strong><span>{row.description}</span></Link>;
        })}
      </div>
    </div>
  );
}
