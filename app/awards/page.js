'use client';

import { useEffect, useState } from 'react';
import { currentUser } from '../../lib/session';
import { getProfile } from '../../lib/profile';
import {
  loadStats,
  syncBadges,
  unlockedMap,
} from '../../lib/stats';
import { AWARDS } from '../../lib/awards';
import AwardsGallery from '../../components/AwardsGallery';
import BenefitsPanel from '../../components/BenefitsPanel';
import Skeleton from '../../components/Skeleton';
import BackLink from '../../components/BackLink';

function resolveDisplayName(profile, user) {
  const candidates = [
    profile?.display_name,
    user?.user_metadata?.full_name,
    user?.user_metadata?.name,
    user?.email?.split('@')[0],
  ];

  return candidates.find(value => typeof value === 'string' && value.trim())?.trim()
    || 'Learner';
}

export default function AwardsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const user = await currentUser();
        if (!user) throw new Error('Please sign in to view your awards.');

        const uid = user.id;
        const profile = await getProfile(uid);
        const stats = await loadStats(uid, profile);

        // Award any newly reached achievements.
        await syncBadges(uid, stats);

        // Load after synchronisation so new awards appear immediately.
        const unlocked = await unlockedMap(uid);
        const displayName = resolveDisplayName(profile, user);

        if (alive) {
          setData({ stats, unlocked, displayName });
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
        <BackLink />
        <h1>Awards</h1>
        <p className="err">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fade-in">
        <BackLink />
        <h1>Awards</h1>
        <Skeleton lines={4} label="Loading your collection" />
      </div>
    );
  }

  const earned = AWARDS.filter(award => data.unlocked.has(award.key)).length;

  return (
    <div className="fade-in">
      <BackLink />
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
            of {AWARDS.length} awards earned
          </span>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Every medal represents progress recorded in ORBIT.
        </p>
      </div>

      <BenefitsPanel />

      <AwardsGallery
        stats={data.stats}
        unlocked={data.unlocked}
        displayName={data.displayName}
      />
    </div>
  );
}
