'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getProfile } from '../../lib/profile';
import {
  loadStats,
  syncBadges,
  unlockedMap,
} from '../../lib/stats';
import AwardsGallery from '../../components/AwardsGallery';

export default function AwardsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (authError) throw authError;
        if (!auth.user) throw new Error('Please sign in to view your awards.');

        const uid = auth.user.id;

        const profile = await getProfile(uid);
        const stats = await loadStats(uid, profile);

        // Award any newly reached achievements.
        await syncBadges(uid, stats);

        // Load after synchronisation so new awards appear immediately.
        const unlocked = await unlockedMap(uid);

        if (alive) {
          setData({ stats, unlocked });
        }
      } catch (e) {
        if (alive) setError(e.message || 'Could not load your awards.');
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div className="fade-in">
        <h1>Awards</h1>
        <p className="err">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fade-in">
        <h1>Awards</h1>
        <p className="muted">Loading your collection…</p>
      </div>
    );
  }

  const earned = data.unlocked.size;

  return (
    <div className="fade-in">
      <h1>Your awards</h1>
      <p className="muted">
        A collection of milestones earned through your learning.
      </p>

      <div className="card">
        <div className="kicker">Your collection</div>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
        }}>
          <strong style={{ fontSize: 32, fontWeight: 700 }}>
            {earned}
          </strong>
          <span className="muted">
            of {16} awards earned
          </span>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Every medal represents progress recorded in ORBIT.
        </p>
      </div>

      <AwardsGallery
        stats={data.stats}
        unlocked={data.unlocked}
      />
    </div>
  );
}