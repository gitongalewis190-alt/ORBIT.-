'use client';
import { useEffect, useState } from 'react';
import { currentUser } from '../lib/session';
import { getProfile } from '../lib/profile';
import { loadStats, syncBadges } from '../lib/stats';
import { play } from '../lib/sound';
import { toast } from '../lib/toast';
import Rings from './Rings';

const RING_NAMES = { study: 'Study', journal: 'Journal', review: 'Review' };

// Shows today's three rings. The rings are the daily progress indicators:
// Study (minutes against the daily target), Journal (words against the word goal),
// Review (reviews done against reviews due). syncBadges() awards any new medals.
export default function DayRings() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const user = await currentUser();
        if (!user) return;
        const profile = await getProfile(user.id);
        const stats = await loadStats(user.id, profile);
        await syncBadges(user.id, stats);
        if (!alive) return;
        setData({ stats, profile });
      } catch (e) {
        if (alive) setErr(e.message);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Celebrate each ring once per day, the first time it closes.
  useEffect(() => {
    if (!data) return;
    const day = data.stats.today;
    for (const key of Object.keys(RING_NAMES)) {
      const flag = `orbit.closed.${day}.${key}`;
      if (data.stats.rings[key] >= 1 && !localStorage.getItem(flag)) {
        localStorage.setItem(flag, '1');
        play('ringclose');
        toast(`${RING_NAMES[key]} ring closed. Well done.`, 'ok', 4200);
      }
    }
  }, [data]);

  if (err) return <p className="err">{err}</p>;
  if (!data) return null;
  const { stats, profile } = data;

  return (
    <div className="card day-rings">
      <div className="kicker">Today</div>
      <Rings study={stats.rings.study} journal={stats.rings.journal} review={stats.rings.review} />
      <div className="muted" style={{ marginTop: 10 }}>
        {stats.minutesToday} of {profile.daily_minutes} min · {stats.wordsToday} of {profile.word_goal} words ·
        {' '}{stats.reviewsDoneToday} review{stats.reviewsDoneToday === 1 ? '' : 's'} done
      </div>
      <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
        <span className="tag">streak {stats.streak} day{stats.streak === 1 ? '' : 's'}</span>
        <span className="tag">{stats.entriesWeek}/{profile.weekly_entry_goal} this week</span>
      </div>
    </div>
  );
}
