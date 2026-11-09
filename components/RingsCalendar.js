'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { today, prettyDate, TZ } from '../lib/dates';

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const monthOf = iso => iso.slice(0, 7);
const firstOf = ym => `${ym}-01`;
const lastOf = ym => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
const shift = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};
const dayOf = ts => new Date(ts).toLocaleDateString('en-CA', { timeZone: TZ });
const monthLabel = ym => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

// Totals per day from focus sessions, journal entries and reflection minutes.
export function summarise(focus, entries, reflect) {
  const map = {};
  const get = d => (map[d] ??= { minutes: 0, words: 0, reflectMinutes: 0, reflectWords: 0, topics: new Set() });
  for (const r of focus) get(r.day).minutes += Number(r.minutes) || 0;
  for (const e of entries) {
    const d = get(dayOf(e.created_at));
    if (e.entry_kind === 'reflection') {
      d.reflectWords += Number(e.word_count) || 0;
    } else {
      d.words += Number(e.word_count) || 0;
      if (e.topics?.title) d.topics.add(e.topics.title);
    }
  }
  for (const r of reflect) get(dayOf(r.created_at)).reflectMinutes += Number(r.payload?.minutes) || 0;
  return map;
}

// A day is completed when learning minutes and words both meet the daily goals.
export function isCompleted(s, profile) {
  return !!s && s.words > 0 && s.minutes >= (profile.daily_minutes || 0) && s.words >= (profile.word_goal || 0);
}

const EMPTY = { minutes: 0, words: 0, reflectMinutes: 0, reflectWords: 0, topics: new Set() };

export default function RingsCalendar({ uid, profile, onClose }) {
  const [ym, setYm] = useState(() => monthOf(today()));
  const [summary, setSummary] = useState({});
  const [sel, setSel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const todayIso = today();

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr('');
      const from = firstOf(ym);
      const to = lastOf(ym);
      const [f, e, r] = await Promise.all([
        supabase.from('focus_sessions').select('day,minutes').eq('user_id', uid).gte('day', from).lte('day', to),
        supabase.from('journal_entries').select('created_at,word_count,entry_kind,topics(title)').eq('user_id', uid)
          .gte('created_at', `${from}T00:00:00+03:00`).lte('created_at', `${to}T23:59:59+03:00`),
        supabase.from('decision_log').select('created_at,payload').eq('user_id', uid).eq('event', 'reflect_focus')
          .gte('created_at', `${from}T00:00:00+03:00`).lte('created_at', `${to}T23:59:59+03:00`),
      ]);
      if (!alive) return;
      const failed = f.error || e.error || r.error;
      if (failed) setErr(failed.message);
      else setSummary(summarise(f.data ?? [], e.data ?? [], r.data ?? []));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [uid, ym]);

  const cells = useMemo(() => {
    const first = new Date(`${firstOf(ym)}T00:00:00Z`).getUTCDay();
    const lead = (first + 6) % 7; // weeks start on Monday
    const count = Number(lastOf(ym).slice(8));
    const days = Array.from({ length: count }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`);
    return [...Array(lead).fill(null), ...days];
  }, [ym]);

  const s = sel ? (summary[sel] ?? EMPTY) : null;

  return (
    <div className="card rings-calendar">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" className="btn sm" onClick={() => { setYm(shift(ym, -1)); setSel(null); }} aria-label="Previous month">‹</button>
        <strong>{monthLabel(ym)}</strong>
        <button type="button" className="btn sm" onClick={() => { setYm(shift(ym, 1)); setSel(null); }}
          disabled={ym >= monthOf(todayIso)} aria-label="Next month">›</button>
      </div>

      <div className="cal-grid cal-head">
        {WEEK.map(w => <span key={w}>{w}</span>)}
      </div>

      {loading ? (
        <p className="muted" style={{ marginTop: 10 }}>Loading the month…</p>
      ) : err ? (
        <p className="err" style={{ marginTop: 10 }}>{err}</p>
      ) : (
        <div className="cal-grid">
          {cells.map((d, i) => d == null ? <span key={`pad-${i}`} /> : (
            <button
              key={d}
              type="button"
              className={`cal-day${isCompleted(summary[d], profile) ? ' done' : ''}${sel === d ? ' sel' : ''}${d === todayIso ? ' today' : ''}`}
              disabled={d > todayIso}
              onClick={() => setSel(d)}
              aria-label={`${prettyDate(d)}${isCompleted(summary[d], profile) ? ', completed' : ''}`}
              aria-pressed={sel === d}
            >
              {Number(d.slice(8))}
            </button>
          ))}
        </div>
      )}

      {sel && s && (
        <div className="cal-detail">
          <div className="kicker">{prettyDate(sel)} · {isCompleted(s, profile) ? 'Completed' : 'Not completed'}</div>
          <p style={{ margin: '6px 0' }}>Topics: {s.topics.size ? [...s.topics].join(', ') : 'none logged'}</p>
          <p style={{ margin: '6px 0' }}>{s.minutes} min focused · {s.words} words logged</p>
          <p className="muted" style={{ margin: '6px 0' }}>Reflection: {s.reflectMinutes} min · {s.reflectWords} words</p>
        </div>
      )}

      <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
        <button type="button" className="btn sm" onClick={onClose}>Close calendar</button>
      </div>
    </div>
  );
}
