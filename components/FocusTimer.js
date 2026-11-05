'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { play } from '../lib/sound';
import { toast } from '../lib/toast';
import { today } from '../lib/dates';
import { getProfile } from '../lib/profile';
import { loadStats, syncBadges } from '../lib/stats';

const PRESETS = [25, 45, 60];
const keyFor = uid => `orbit.focus.${uid}`;

function clock(ms) {
  const total = Math.ceil(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// A session is stored as: { mode: 'running' | 'paused', endAt, remainingMs, plannedMin }.
// Storing the end time means a session keeps going if the app is closed.
export default function FocusTimer() {
  const [uid, setUid] = useState(null);
  const [planned, setPlanned] = useState(25);
  const [sess, setSess] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const finishing = useRef(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUid(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (!uid) return;
    try {
      const raw = localStorage.getItem(keyFor(uid));
      if (raw) setSess(JSON.parse(raw));
    } catch {
      localStorage.removeItem(keyFor(uid));
    }
  }, [uid]);

  // Tick while running.
  useEffect(() => {
    if (sess?.mode !== 'running') return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [sess?.mode]);

  const remainingMs = !sess
    ? planned * 60000
    : sess.mode === 'running' ? Math.max(0, sess.endAt - now) : sess.remainingMs;
  const totalMs = (sess?.plannedMin ?? planned) * 60000;

  function persist(next) {
    setSess(next);
    if (!uid) return;
    if (next) localStorage.setItem(keyFor(uid), JSON.stringify(next));
    else localStorage.removeItem(keyFor(uid));
  }

  // Runs out on its own: log the full planned minutes.
  useEffect(() => {
    if (sess?.mode === 'running' && now >= sess.endAt) finish(sess.plannedMin, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, sess]);

  function begin() {
    if (!uid) return;
    const t = Date.now();
    play('focusstart');
    if (sess?.mode === 'paused') {
      persist({ ...sess, mode: 'running', endAt: t + sess.remainingMs });
    } else {
      const total = planned * 60000;
      persist({ mode: 'running', endAt: t + total, remainingMs: total, plannedMin: planned });
    }
    setNow(t);
  }

  function pause() {
    const t = Date.now();
    persist({ ...sess, mode: 'paused', remainingMs: Math.max(0, sess.endAt - t) });
    play('toggle');
  }

  function cancel() {
    persist(null);
    play('close');
    toast('Focus cancelled. Nothing was logged.', 'info');
  }

  // Logs minutes to the study ring and checks for new medals.
  async function finish(minutes, completed) {
    if (finishing.current || !uid) return;
    finishing.current = true;
    setBusy(true);
    try {
      const { error } = await supabase.from('focus_sessions').insert({ user_id: uid, day: today(), minutes });
      if (error) throw error;
      persist(null);
      const profile = await getProfile(uid);
      const stats = await loadStats(uid, profile);
      await syncBadges(uid, stats);
      if (completed) {
        play('focusdone');
        toast(`Focus complete. ${minutes} min added to your study ring.`, 'ok', 4200);
      } else {
        play('save');
        toast(`Logged ${minutes} min of focus.`, 'ok');
      }
    } catch (e) {
      play('error');
      toast(`Could not log focus: ${e.message}`, 'err', 5000);
    } finally {
      finishing.current = false;
      setBusy(false);
    }
  }

  function finishNow() {
    if (!sess) return;
    const elapsedMs = sess.plannedMin * 60000 - remainingMs;
    const minutes = Math.round(elapsedMs / 60000);
    if (minutes < 1) {
      play('error');
      toast('Focus for at least a minute before you log it.', 'warn');
      return;
    }
    finish(minutes, false);
  }

  const progress = totalMs > 0 ? Math.min(100, Math.round((1 - remainingMs / totalMs) * 100)) : 0;
  const idle = !sess;

  return (
    <div className="card focus-card">
      <div className="kicker">Focus</div>
      <div className="focus-clock" aria-live="off">{clock(remainingMs)}</div>
      <div className="bar"><span style={{ width: `${progress}%` }} /></div>
      <div className="muted" style={{ textAlign: 'center', marginTop: 6 }}>
        {idle ? `Ready for ${planned} minutes` : sess.mode === 'running' ? 'Focusing' : 'Paused'}
      </div>

      {idle && (
        <div className="seg" style={{ marginTop: 12 }}>
          {PRESETS.map(p => (
            <button key={p} className={planned === p ? 'on' : ''} onClick={() => setPlanned(p)}>{p} min</button>
          ))}
        </div>
      )}

      <div className="row" style={{ justifyContent: 'center' }}>
        {idle && <button className="btn accent" onClick={begin} disabled={busy || !uid}>Start focus</button>}
        {sess?.mode === 'running' && <button className="btn" onClick={pause} disabled={busy}>Pause</button>}
        {sess?.mode === 'paused' && <button className="btn accent" onClick={begin} disabled={busy}>Resume</button>}
        {sess && <button className="btn" onClick={finishNow} disabled={busy}>Log time so far</button>}
        {sess && <button className="btn danger" onClick={cancel} disabled={busy}>Cancel</button>}
      </div>
    </div>
  );
}
