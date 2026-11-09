'use client';
import { useEffect, useState } from 'react';
import { currentUser } from '../lib/session';
import { getProfile } from '../lib/profile';
import { loadStats, syncBadges } from '../lib/stats';
import { play } from '../lib/sound';
import { toast } from '../lib/toast';
import { prettyDate } from '../lib/dates';
import { progressCardBlob } from '../lib/card';
import { downloadBlob } from '../lib/download';
import Rings from './Rings';
import { REFLECT_TARGET } from '../lib/rings';

const RING_NAMES = { study: 'Study', journal: 'Journal', review: 'Review' };
const VIEW_KEY = 'orbit.rings.view';

// Today's rings. A switch chooses which set shows: Learn (the default, the required work) or Reflect
// (optional, the reflection for today). Learn is the default view on Today.
export default function DayRings() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('learn');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === 'learn' || saved === 'reflect') setView(saved);
    } catch {}
  }, []);

  function choose(next) {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch {}
  }

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

  // Celebrate each Learn ring once per day, the first time it closes.
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

  // Shares today's Learn rings as a PNG card. Falls back to a download where the phone cannot share files.
  async function shareRings() {
    if (busy || !data) return;
    setBusy(true);
    try {
      const { stats, profile } = data;
      const blob = await progressCardBlob({
        name: profile.full_name || profile.display_name || 'Orbit learner',
        date: prettyDate(stats.today),
        streak: stats.streak,
        words: stats.wordsTotal,
        entries: stats.entries,
        rings: stats.rings,
      });
      const file = new File([blob], 'orbit-today.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Orbit rings today' });
      } else {
        downloadBlob(blob, 'orbit-today.png');
        toast('Today’s rings saved to your downloads.', 'ok');
      }
      play('export');
    } catch (e) {
      if (e?.name !== 'AbortError') {
        play('error');
        toast(e.message || 'Could not share today’s rings.', 'err', 5000);
      }
    } finally {
      setBusy(false);
    }
  }

  if (err) return <p className="err">{err}</p>;
  if (!data) return null;
  const { stats, profile } = data;
  const reflect = stats.reflectToday;

  return (
    <div className="rings-switch">
      <div className="seg" role="radiogroup" aria-label="Which rings to show">
        <button type="button" role="radio" aria-checked={view === 'learn'} className={view === 'learn' ? 'on' : ''} onClick={() => choose('learn')}>Learn</button>
        <button type="button" role="radio" aria-checked={view === 'reflect'} className={view === 'reflect' ? 'on' : ''} onClick={() => choose('reflect')}>Reflect</button>
      </div>

      {view === 'learn' ? (
        <div className="card day-rings">
          <div className="kicker">Learn today</div>
          <Rings study={stats.rings.study} journal={stats.rings.journal} review={stats.rings.review} />
          <div className="muted" style={{ marginTop: 10 }}>
            {stats.minutesToday} of {profile.daily_minutes} min · {stats.learnWordsToday} of {profile.word_goal} words ·
            {' '}{stats.reviewsDoneToday} review{stats.reviewsDoneToday === 1 ? '' : 's'} done
          </div>
          <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
            <button className="btn sm" onClick={shareRings} disabled={busy}>{busy ? 'Preparing' : 'Share today’s rings'}</button>
            <span className="tag">streak {stats.streak} day{stats.streak === 1 ? '' : 's'}</span>
            <span className="tag">{stats.entriesWeek}/{profile.weekly_entry_goal} this week</span>
          </div>
        </div>
      ) : (
        <div className="card day-rings">
          <div className="kicker">Reflect today · optional</div>
          {reflect.any ? (
            <>
              <Rings
                study={stats.reflectRings.minutes}
                journal={stats.reflectRings.words}
                review={stats.reflectRings.revisit}
                labels={['Time', 'Words', 'Revisit']}
              />
              <div className="muted" style={{ marginTop: 10 }}>
                {reflect.minutes} of {REFLECT_TARGET.minutes} min · {reflect.words} of {REFLECT_TARGET.words} words ·
                {' '}{reflect.revisits} earlier topic{reflect.revisits === 1 ? '' : 's'} revisited
              </div>
            </>
          ) : (
            <p className="muted" style={{ marginTop: 6 }}>
              Not reflected today. Reflecting is optional and never replaces learning. Open Journal, switch to Reflect, and pick a topic to fill these rings.
            </p>
          )}
          <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
            <span className="tag">{stats.reflectDays} reflect day{stats.reflectDays === 1 ? '' : 's'} closed</span>
          </div>
        </div>
      )}
    </div>
  );
}
