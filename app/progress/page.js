'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HUBS, recordById } from '../../lib/navMap';
import { currentUser } from '../../lib/session';
import { getProfile } from '../../lib/profile';
import { loadStats } from '../../lib/stats';

export default function ProgressPage() {
  const [summary, setSummary] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    currentUser()
      .then(async (user) => {
        if (!user) return;
        const profile = await getProfile(user.id);
        const stats = await loadStats(user.id, profile);
        if (alive) setSummary(stats);
      })
      .catch((e) => {
        if (alive) setErr(e?.message || 'Progress could not load. Check your connection and try again.');
      });
    return () => { alive = false; };
  }, []);

  // `earned` is a Set of badge keys, so its size is the count. Rendering the Set itself throws.
  const awards = summary?.earned?.size ?? 0;

  return (
    <div className="fade-in">
      <h1>Progress</h1>
      {err && <div className="card err" role="alert">{err}</div>}
      <div className="card">
        <p className="stat-num">{summary ? summary.streak : '—'}</p>
        <p className="muted">day streak</p>
        <p className="stat-num">{summary ? awards : '—'}</p>
        <p className="muted">awards earned</p>
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
