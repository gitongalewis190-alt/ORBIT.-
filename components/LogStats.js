'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getProfile } from '../lib/profile';
import { loadStats, weeklyRecap, insights } from '../lib/stats';
import { fieldColor } from '../lib/palette';
import { prettyDate } from '../lib/dates';
import Skeleton from './Skeleton';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Statistics shown at the top of Logs: totals, the week, fields studied, and what the numbers say.
export default function LogStats() {
  const [s, setS] = useState(null);
  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      try {
        const p = await getProfile(data.user.id);
        const stats = await loadStats(data.user.id, p);
        if (!alive) return;
        setProfile(p);
        setS(stats);
      } catch (e) {
        if (alive) setErr(e.message);
      }
    });
    return () => { alive = false; };
  }, []);

  const fields = useMemo(() => {
    if (!s) return [];
    const map = new Map();
    for (const r of s.rows) {
      const name = r.topics?.subfields?.fields?.name;
      if (!name) continue;
      const cur = map.get(name) ?? { name, id: r.topics?.subfields?.field_id, entries: 0, words: 0, conf: 0, rated: 0 };
      cur.entries += 1;
      cur.words += r.word_count || 0;
      if (r.confidence !== null && r.confidence !== undefined) {
        cur.conf += r.confidence;
        cur.rated += 1;
      }
      map.set(name, cur);
    }
    return [...map.values()].sort((a, b) => b.entries - a.entries);
  }, [s]);

  if (err) return <p className="err">{err}</p>;
  if (!s || !profile) return <Skeleton lines={4} label="Loading your statistics" />;

  const recap = weeklyRecap(s);
  const maxWords = Math.max(1, ...s.week.map(d => d.words));
  const maxEntries = Math.max(1, ...fields.map(f => f.entries));
  const todayIdx = new Date(s.week[6].day + 'T12:00:00Z').getUTCDay();

  const totals = [
    ['Entries', s.entries],
    ['Words', s.wordsTotal.toLocaleString()],
    ['Streak', `${s.streak}d`],
    ['Focus', `${s.focusTotal}m`],
    ['Topics done', s.completed],
    ['Reviews', s.reviewSessions],
    ['Fields', s.fields],
    ['Avg confidence', s.avgConfidence === null ? '–' : s.avgConfidence],
  ];

  return (
    <section className="log-stats" aria-label="Statistics">
      <div className="stat-grid">
        {totals.map(([label, value]) => (
          <div key={label} className="stat-tile">
            <span className="stat-value">{value}</span>
            <span className="stat-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="kicker">The last seven days</div>
        <div className="weekbars">
          {s.week.map((d, i) => (
            <div key={d.day} title={`${d.words} words, ${d.entries} entries`}>
              <div className="col" style={{ height: `${Math.max(4, (d.words / maxWords) * 100)}%` }} />
              <div className="lbl">{WEEKDAYS[(todayIdx - 6 + i + 7) % 7]}</div>
            </div>
          ))}
        </div>
        <div className="muted" style={{ marginTop: 10 }}>
          {recap.wordsWeek.toLocaleString()} words in {recap.entriesWeek} entries
          {recap.change === null ? '' : ` · ${recap.change >= 0 ? '+' : ''}${recap.change}% on last week`}
        </div>
      </div>

      <div className="card">
        <div className="kicker">Where your entries went</div>
        {fields.length === 0 && <p className="muted">Save a few entries and your fields appear here.</p>}
        {fields.map(f => (
          <div key={f.name} className="field-bar">
            <div className="field-bar-head">
              <span><span className="chip-dot" style={{ '--chip': fieldColor(f.id), background: fieldColor(f.id) }} /> {f.name.charAt(0) + f.name.slice(1).toLowerCase()}</span>
              <span className="muted">{f.entries} · {f.words.toLocaleString()} words{f.rated ? ` · avg ${(f.conf / f.rated).toFixed(1)}` : ''}</span>
            </div>
            <div className="bar"><span style={{ width: `${(f.entries / maxEntries) * 100}%`, background: fieldColor(f.id) }} /></div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="kicker">What the numbers say</div>
        {insights(s).map((line, i) => (
          <p key={i} className="insight">{line}</p>
        ))}
        {recap.bestDay && (
          <p className="insight muted">Best day: {prettyDate(recap.bestDay.day)} with {recap.bestDay.words} words.</p>
        )}
      </div>
    </section>
  );
}
