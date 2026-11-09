'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { currentUser } from '../lib/session';
import { logDecision } from '../lib/log';
import { play } from '../lib/sound';
import { toast } from '../lib/toast';
import { today } from '../lib/dates';
import ConfirmDialog from './ConfirmDialog';

const clock = ms => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// Counts reflection time. Logged as reflect_focus: it feeds the swap trade-offs, not the Learn ring.
export default function ReflectTimer() {
  const [uid, setUid] = useState(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [confirmStart, setConfirmStart] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [todays, setTodays] = useState([]);
  const [pendingRevoke, setPendingRevoke] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { currentUser().then(u => { if (u) setUid(u.id); }); }, []);

  async function load(id) {
    if (!id) return;
    const { data } = await supabase.from('decision_log').select('id,payload,created_at')
      .eq('user_id', id).eq('event', 'reflect_focus')
      .gte('created_at', `${today()}T00:00:00+03:00`).order('created_at');
    setTodays(data ?? []);
  }
  useEffect(() => { load(uid); }, [uid]);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [running]);

  const shown = elapsed + (running && startedAt ? now - startedAt : 0);

  function start() {
    const t = Date.now();
    setStartedAt(t);
    setNow(t);
    setRunning(true);
    play('focusstart');
  }

  function pause() {
    setElapsed(e => e + (Date.now() - startedAt));
    setStartedAt(null);
    setRunning(false);
    play('toggle');
  }

  function discard() {
    setRunning(false);
    setElapsed(0);
    setStartedAt(null);
    setConfirmDiscard(false);
    play('close');
    toast('Timer discarded. Nothing was logged.', 'info');
  }

  async function log() {
    if (!uid || busy) return;
    const minutes = Math.round(shown / 60000);
    if (minutes < 1) {
      play('error');
      toast('Reflect for at least a minute before you log it.', 'warn');
      return;
    }
    setBusy(true);
    try {
      await logDecision(uid, 'reflect_focus', null, { minutes });
      setRunning(false);
      setElapsed(0);
      setStartedAt(null);
      play('save');
      toast(`${minutes} reflection min logged.`, 'ok');
      await load(uid);
    } catch (e) {
      play('error');
      toast(`Could not log: ${e.message}`, 'err', 5000);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(row) {
    if (!uid || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('decision_log').delete().eq('id', row.id).eq('user_id', uid);
      if (error) throw error;
      play('close');
      toast(`Revoked ${row.payload?.minutes ?? 0} reflection min.`, 'info', 4200);
      await load(uid);
    } catch (e) {
      play('error');
      toast(`Could not revoke: ${e.message}`, 'err', 5000);
    } finally {
      setPendingRevoke(null);
      setBusy(false);
    }
  }

  return (
    <div className="card timer-block" style={{ marginTop: 12 }}>
      <div className="kicker">Reflection timer</div>
      <p className="muted" style={{ margin: '4px 0 8px', lineHeight: 1.5 }}>
        Counts reflection minutes toward your swap trade-offs. It does not change the Learn ring.
      </p>
      <div className="focus-clock" aria-live="off">{clock(shown)}</div>
      <div className="row" style={{ justifyContent: 'center' }}>
        {!running && shown === 0 && (
          <button type="button" className="btn accent" onClick={() => setConfirmStart(true)} disabled={!uid}>Start reflection timer</button>
        )}
        {!running && shown > 0 && (
          <button type="button" className="btn accent" onClick={() => setConfirmStart(true)}>Resume</button>
        )}
        {running && <button type="button" className="btn" onClick={pause}>Pause</button>}
        {shown > 0 && <button type="button" className="btn" onClick={log} disabled={busy}>Log reflection time</button>}
        {shown > 0 && <button type="button" className="btn danger" onClick={() => setConfirmDiscard(true)}>Discard timer</button>}
      </div>

      {todays.length > 0 && (
        <div className="timer-log" style={{ marginTop: 14, textAlign: 'left' }}>
          <div className="kicker">Reflection minutes logged today</div>
          {todays.map(row => (
            <div key={row.id} className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <span>{row.payload?.minutes ?? 0} min</span>
              <button type="button" className="btn sm danger" onClick={() => setPendingRevoke(row)} disabled={busy}>Revoke</button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmStart}
        title={shown > 0 ? 'Resume the reflection timer?' : 'Start the reflection timer?'}
        confirmLabel="Agree and continue"
        onCancel={() => setConfirmStart(false)}
        onConfirm={() => { setConfirmStart(false); start(); }}
      >
        <p style={{ margin: 0 }}>When you log this time, it is recorded as reflection minutes for your swap trade-offs.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard this timer?"
        confirmLabel="Discard"
        danger
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={discard}
      >
        <p style={{ margin: 0 }}>The time on the clock will not be logged. This cannot be undone.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!pendingRevoke}
        title="Revoke these reflection minutes?"
        confirmLabel="Revoke"
        danger
        busy={busy}
        onCancel={() => setPendingRevoke(null)}
        onConfirm={() => revoke(pendingRevoke)}
      >
        <p style={{ margin: 0 }}>
          {pendingRevoke ? `${pendingRevoke.payload?.minutes ?? 0} minutes` : ''} will be removed from your swap trade-offs for today.
        </p>
      </ConfirmDialog>
    </div>
  );
}
