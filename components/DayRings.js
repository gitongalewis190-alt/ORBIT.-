'use client';
import { useEffect, useState } from 'react';
import { currentUser } from '../lib/session';
import { getProfile } from '../lib/profile';
import { loadStats, syncBadges } from '../lib/stats';
import { play } from '../lib/sound';
import { toast } from '../lib/toast';
import { prettyDate, today } from '../lib/dates';
import { supabase } from '../lib/supabase';
import FocusTimer from './FocusTimer';
import ReflectTimer from './ReflectTimer';
import RingsCalendar from './RingsCalendar';
import { progressCardBlob } from '../lib/card';
import { downloadBlob } from '../lib/download';
import Rings from './Rings';
import { REFLECT_TARGET } from '../lib/rings';

const RING_NAMES = { study: 'Study', journal: 'Journal', review: 'Review' };
const VIEW_KEY = 'orbit.rings.view';

// Today's rings. Learn and Reflect have the same card: the rings, a summary, how many rings closed,
// and Share. A switch chooses which set shows. Learn is the default.
export default function DayRings() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('learn');
  const [showCalendar, setShowCalendar] = useState(false);
  const [learnTarget, setLearnTarget] = useState(null);

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
        setData({ stats, profile, uid: user.id });
      } catch (e) {
        if (alive) setErr(e.message);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Today's accepted topic sets the learning timer's length.
  useEffect(() => {
    if (!data?.uid) return;
    (async () => {
      const { data: a } = await supabase.from('assignments').select('est_minutes,topics(title)')
        .eq('user_id', data.uid).eq('assigned_on', today()).eq('status', 'accepted').maybeSingle();
      setLearnTarget(a ? { minutes: a.est_minutes, title: a.topics?.title ?? '' } : null);
    })();
  }, [data?.uid]);

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

  // Shares today's rings for the set shown (learn or reflect) as a PNG card.
  async function shareRings(kind) {
    if (busy || !data) return;
    setBusy(true);
    try {
      const { stats, profile } = data;
      const name = profile.full_name || profile.display_name || 'Orbit learner';
      const date = prettyDate(stats.today);
      const blob = kind === 'learn'
        ? await progressCardBlob({
            name, date,
            streak: stats.streak, caption: 'day streak',
            words: stats.learnWordsToday, entries: stats.entries,
            rings: stats.rings, title: 'Learn',
            labels: ['Study', 'Journal', 'Review'],
          })
        : await progressCardBlob({
            name, date,
            streak: stats.reflectDays, caption: 'reflect days closed',
            words: stats.reflectToday.words, entries: stats.reflectToday.entries,
            rings: { study: stats.reflectRings.minutes, journal: stats.reflectRings.words, review: stats.reflectRings.revisit },
            title: 'Reflect', labels: ['Time', 'Words', 'Revisit'],
          });
      const fileName = kind === 'learn' ? 'orbit-learn-today.png' : 'orbit-reflect-today.png';
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: kind === 'learn' ? 'My Orbit rings today' : 'My Orbit reflection today' });
      } else {
        downloadBlob(blob, fileName);
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
  const r = stats.reflectToday;
  const learnClosed = ['study', 'journal', 'review'].filter(k => stats.rings[k] >= 1).length;
  const reflectClosed = ['minutes', 'words', 'revisit'].filter(k => stats.reflectRings[k] >= 1).length;

  const learnCard = (
    <div className="card day-rings">
      <div className="kicker">Learn today</div>
      <Rings study={stats.rings.study} journal={stats.rings.journal} review={stats.rings.review} />
      <div className="muted" style={{ marginTop: 10 }}>
        {stats.minutesToday} of {profile.daily_minutes} min · {stats.learnWordsToday} of {profile.word_goal} words ·
        {' '}{stats.reviewsDoneToday} review{stats.reviewsDoneToday === 1 ? '' : 's'} done
      </div>
      <div className="closed-line">{learnClosed} of 3 rings closed</div>
      <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
        <button className="btn sm" onClick={() => shareRings('learn')} disabled={busy}>{busy ? 'Preparing' : 'Share Learn rings'}</button>
        <span className="tag">streak {stats.streak} day{stats.streak === 1 ? '' : 's'}</span>
        <span className="tag">{stats.entriesWeek}/{profile.weekly_entry_goal} this week</span>
      </div>
    </div>
  );

  const reflectCard = (
    <div className="card day-rings">
      <div className="kicker">Reflect today · optional</div>
      {r.any ? (
        <>
          <Rings
            study={stats.reflectRings.minutes}
            journal={stats.reflectRings.words}
            review={stats.reflectRings.revisit}
            labels={['Time', 'Words', 'Revisit']}
          />
          <div className="muted" style={{ marginTop: 10 }}>
            {r.minutes} of {REFLECT_TARGET.minutes} min · {r.words} of {REFLECT_TARGET.words} words ·
            {' '}{r.revisits} earlier topic{r.revisits === 1 ? '' : 's'} revisited
          </div>
          <div className="closed-line">{reflectClosed} of 3 rings closed</div>
        </>
      ) : (
        <p className="muted" style={{ marginTop: 6 }}>
          Not reflected today. Reflecting is optional and never replaces learning. Open Journal, and pick a topic you have learned to fill these rings.
        </p>
      )}
      <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
        <button className="btn sm" onClick={() => shareRings('reflect')} disabled={busy || !r.any}>{busy ? 'Preparing' : 'Share Reflect rings'}</button>
        <span className="tag">{stats.reflectDays} reflect day{stats.reflectDays === 1 ? '' : 's'} closed</span>
      </div>
    </div>
  );

  return (
    <div className="rings-switch">
      <div className="timer-pair">
        <div>
          {learnTarget && (
            <p className="muted" style={{ textAlign: 'center', margin: '0 0 8px' }}>
              Today’s topic target: {learnTarget.minutes} minutes.
            </p>
          )}
          <FocusTimer label="Learning timer" fixedMinutes={learnTarget?.minutes ?? null} />
        </div>
        <ReflectTimer />
      </div>
      <details className="rings-fold">
        <summary>Daily rings and calendar</summary>
        <div className="seg" role="radiogroup" aria-label="Which rings to show">
          <button type="button" role="radio" aria-checked={view === 'learn'} className={view === 'learn' ? 'on' : ''} onClick={() => choose('learn')}>Learn</button>
          <button type="button" role="radio" aria-checked={view === 'reflect'} className={view === 'reflect' ? 'on' : ''} onClick={() => choose('reflect')}>Reflect</button>
        </div>
        <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <button type="button" className="btn sm" onClick={() => setShowCalendar(s => !s)} aria-expanded={showCalendar}>
            {showCalendar ? 'Hide calendar' : 'Open calendar'}
          </button>
        </div>
        {showCalendar && <RingsCalendar uid={data.uid} profile={profile} onClose={() => setShowCalendar(false)} />}
        {view === 'learn' ? learnCard : reflectCard}
      </details>
    </div>
  );
}
