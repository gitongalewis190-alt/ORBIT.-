'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getProfile } from '../lib/profile';
import { loadStats, syncBadges, unlockedMap, weeklyRecap, insights } from '../lib/stats';
import { addDays, today, prettyDate } from '../lib/dates';
import { play } from '../lib/sound';
import { toast } from '../lib/toast';
import { progressCardBlob } from '../lib/card';
import { downloadBlob } from '../lib/download';
import Rings from './Rings';
import AwardsGallery from './AwardsGallery';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function StatsView() {
  const [uid, setUid] = useState(null);
  const [s, setS] = useState(null);
  const [profile, setProfile] = useState(null);
  const [unlocked, setUnlocked] = useState(new Map());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function load(id) {
    const p = await getProfile(id);
    const stats = await loadStats(id, p);
    await syncBadges(id, stats);
    setProfile(p);
    setS(stats);
    setUnlocked(await unlockedMap(id));
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUid(data.user.id);
      try {
        await load(data.user.id);
      } catch (e) {
        setErr(e.message);
      }
    });
  }, []);

  // Opening the collection from an unlock card jumps straight to the awards.
  useEffect(() => {
    if (s && window.location.hash === '#awards') {
      document.getElementById('awards')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [s]);

  // A freeze saves yesterday's streak once every seven days.
  async function useFreeze() {
    if (busy || !uid) return;
    setBusy(true);
    try {
      const yesterday = addDays(s.today, -1);
      const { error } = await supabase.from('streak_freezes').insert({ user_id: uid, day: yesterday });
      if (error) throw error;
      play('freeze');
      toast('Streak saved with a freeze for yesterday.', 'ok', 4000);
      await load(uid);
    } catch (e) {
      play('error');
      toast(e.message, 'err', 5000);
    } finally {
      setBusy(false);
    }
  }

  async function shareCard() {
    if (busy || !s || !profile) return;
    setBusy(true);
    try {
      const blob = await progressCardBlob({
        name: profile.full_name || profile.display_name || 'Orbit learner',
        date: prettyDate(s.today),
        streak: s.streak,
        words: s.wordsTotal,
        entries: s.entries,
        rings: s.rings,
      });
      const file = new File([blob], 'orbit-progress.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Orbit progress' });
      } else {
        downloadBlob(blob, 'orbit-progress.png');
        toast('Progress card saved to your downloads.', 'ok');
      }
      play('export');
    } catch (e) {
      if (e?.name !== 'AbortError') {
        play('error');
        toast(e.message, 'err', 5000);
      }
    } finally {
      setBusy(false);
    }
  }

  if (err) return <div className="fade-in"><h1>Stats</h1><p className="err">{err}</p></div>;
  if (!s || !profile) return <div className="fade-in"><h1>Stats</h1><p className="muted">Loading</p></div>;

  const maxWords = Math.max(1, ...s.week.map(d => d.words));
  const todayIdx = new Date(s.week[6].day + 'T12:00:00Z').getUTCDay();
  const recap = weeklyRecap(s);
  const yesterday = addDays(s.today, -1);
  const yesterdayCovered = s.rows.some(r => r.day === yesterday) || s.freezeDays.includes(yesterday);
  const showFreeze = !yesterdayCovered && s.freeze.available && s.rows.length > 0;

  const tiles = [
    ['Streak', `${s.streak} day${s.streak === 1 ? '' : 's'}`],
    ['Entries this week', `${s.entriesWeek} / ${profile.weekly_entry_goal}`],
    ['Words this week', s.wordsWeek.toLocaleString()],
    ['Minutes this week', s.minutesWeek.toLocaleString()],
    ['Topics completed', s.completed.toLocaleString()],
    ['Reviews done', s.reviewSessions.toLocaleString()],
    ['Fields explored', `${s.fields}`],
    ['Average confidence', s.avgConfidence === null ? '–' : `${s.avgConfidence} / 5`],
  ];

  return (
    <div className="fade-in">
      <h1>Stats</h1>
      <p className="muted">Your last seven days, and everything since you started.</p>

      <div className="card" style={{ textAlign: 'center' }}>
        <div className="kicker">Today</div>
        <Rings study={s.rings.study} journal={s.rings.journal} review={s.rings.review} size={150} />
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn accent" onClick={shareCard} disabled={busy}>Share progress card</button>
        </div>
      </div>

      <h2>This week</h2>
      <div className="card">
        <div className="weekbars">
          {s.week.map((d, i) => (
            <div key={d.day} title={`${d.words} words`}>
              <div className="col" style={{ height: `${Math.max(3, (d.words / maxWords) * 100)}%` }} />
              <div className="lbl">{WEEKDAYS[(todayIdx - 6 + i + 7) % 7]}</div>
            </div>
          ))}
        </div>
        <div className="muted" style={{ marginTop: 10 }}>
          {s.wordsWeek.toLocaleString()} words across {s.entriesWeek} entr{s.entriesWeek === 1 ? 'y' : 'ies'}
        </div>
      </div>

      <h2>Week in review</h2>
      <div className="card">
        <div className="switchrow" style={{ padding: '6px 0' }}>
          <span className="muted">Best day</span>
          <span style={{ fontWeight: 600 }}>{recap.bestDay ? `${prettyDate(recap.bestDay.day)} · ${recap.bestDay.words} words` : 'None yet'}</span>
        </div>
        <div className="switchrow" style={{ padding: '6px 0' }}>
          <span className="muted">Change from last week</span>
          <span style={{ fontWeight: 600 }}>{recap.change === null ? 'No earlier week' : `${recap.change >= 0 ? '+' : ''}${recap.change}%`}</span>
        </div>
        <div className="switchrow" style={{ padding: '6px 0' }}>
          <span className="muted">Most-worked topic</span>
          <span style={{ fontWeight: 600, textAlign: 'right' }}>{recap.topTopic ? recap.topTopic.title : 'None yet'}</span>
        </div>
        <div className="switchrow" style={{ padding: '6px 0' }}>
          <span className="muted">Focus this week</span>
          <span style={{ fontWeight: 600 }}>{recap.focusWeek} min</span>
        </div>
      </div>

      <h2>Observations</h2>
      <div className="card">
        {insights(s).map((line, i) => (
          <p key={i} style={{ margin: i === 0 ? '0 0 10px' : '10px 0', lineHeight: 1.5, fontSize: 14 }}>{line}</p>
        ))}
      </div>

      {showFreeze && (
        <>
          <h2>Streak protection</h2>
          <div className="card">
            <p className="muted" style={{ marginTop: 0 }}>
              You didn't journal yesterday. A freeze keeps your streak alive. You get one every seven days.
            </p>
            <div className="row" style={{ marginTop: 0 }}>
              <button className="btn accent" onClick={useFreeze} disabled={busy}>Use a freeze for yesterday</button>
            </div>
          </div>
        </>
      )}
      {!s.freeze.available && s.freeze.nextAvailable && (
        <p className="muted" style={{ marginTop: 10 }}>
          Your next streak freeze is available on {prettyDate(s.freeze.nextAvailable)}.
        </p>
      )}

      <h2>Totals</h2>
      <div className="card">
        {tiles.map(([label, value]) => (
          <div key={label} className="switchrow" style={{ padding: '7px 0' }}>
            <span className="muted">{label}</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
          </div>
        ))}
      </div>

      <h2>Awards</h2>
      <AwardsGallery stats={s} unlocked={unlocked} />
    </div>
  );
}
