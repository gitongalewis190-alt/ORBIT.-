'use client';
import { useEffect, useState } from 'react';
import { currentUser } from '../lib/session';
import { getProfile } from '../lib/profile';
import { loadStats } from '../lib/stats';
import { smartNotes } from '../lib/smart';
import Skeleton from './Skeleton';

// Four smart notes on Today, built from your real statistics.
export default function SmartNotes() {
  const [notes, setNotes] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    currentUser().then(async (user) => {
      if (!user) return;
      try {
        const profile = await getProfile(user.id);
        const stats = await loadStats(user.id, profile);
        if (alive) setNotes(smartNotes(stats, profile));
      } catch (e) {
        if (alive) setErr(e.message);
      }
    });
    return () => { alive = false; };
  }, []);

  if (err) return <p className="err">{err}</p>;
  if (!notes) return <Skeleton lines={2} label="Preparing smart notes" />;

  return (
    <section className="smart-grid" aria-label="Smart notes">
      {notes.map(note => (
        <article key={note.id} className={`smart-card tone-${note.tone}`}>
          <div className="kicker">{note.title}</div>
          <p>{note.text}</p>
        </article>
      ))}
    </section>
  );
}
