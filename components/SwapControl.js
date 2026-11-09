'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { logDecision } from '../lib/log';
import { today } from '../lib/dates';
import { pageOf } from '../lib/stats';
import { toast } from '../lib/toast';
import { play } from '../lib/sound';
import { drawChallenge, verifyChallenge, swapsLeft, MAX_EARNED_PER_DAY } from '../lib/challenges';
import { confetti } from '../lib/confetti';
import ConfirmDialog from './ConfirmDialog';

// A padlock, shown when no more swaps can be made today.
const Padlock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 6 }}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const DAY_EVENTS = ['swapped', 'swap_earned', 'challenge_started', 'challenge_passed', 'challenge_cancelled'];

// Swaps for an accepted topic. One free swap a day. After that, a swap is earned by passing a trade-off.
// Everything is logged in the decision log, so the state holds through a refresh and resets at midnight (Nairobi).
export default function SwapControl({ uid, assignment, onFreeSwap, busy }) {
  const [state, setState] = useState({ swapped: 0, earned: 0, active: null, focusTotal: 0, ready: false });
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [confirmEarn, setConfirmEarn] = useState(false);
  const [confirmFree, setConfirmFree] = useState(false);
  const [lastLabel, setLastLabel] = useState('');
  const dayStart = () => new Date(`${today()}T00:00:00+03:00`).toISOString();

  const refresh = useCallback(async () => {
    if (!uid) return;
    const ev = await supabase.from('decision_log').select('event,payload,created_at')
      .eq('user_id', uid).in('event', DAY_EVENTS).gte('created_at', dayStart()).order('created_at');
    const events = ev.data ?? [];
    const closed = new Set(events.filter(e => e.event === 'challenge_passed' || e.event === 'challenge_cancelled').map(e => e.payload?.id));
    const started = events.filter(e => e.event === 'challenge_started');
    const last = started[started.length - 1]?.payload ?? null;
    const focus = await supabase.from('focus_sessions').select('minutes').eq('user_id', uid).eq('day', today());
    setState({
      swapped: events.filter(e => e.event === 'swapped').length,
      earned: events.filter(e => e.event === 'swap_earned').length,
      active: last && !closed.has(last.id) ? last : null,
      focusTotal: (focus.data ?? []).reduce((t, r) => t + (Number(r.minutes) || 0), 0),
      ready: true,
    });
  }, [uid]);

  useEffect(() => { refresh(); }, [refresh, assignment?.id, assignment?.status]);

  // Learned topics: any topic with a Learn entry.
  async function learnedTopics() {
    const res = await pageOf(() => supabase.from('journal_entries').select('topic_id,topics(title)')
      .eq('user_id', uid).eq('entry_kind', 'research'));
    const map = new Map();
    for (const r of res.data ?? []) {
      if (r.topic_id && !map.has(r.topic_id)) map.set(r.topic_id, { id: r.topic_id, title: r.topics?.title ?? 'a topic' });
    }
    return [...map.values()];
  }

  async function startChallenge() {
    if (working) return;
    setWorking(true);
    try {
      const c = drawChallenge(await learnedTopics());
      if (!c) { toast('Learn a topic first. Then you can earn swaps.', 'warn'); return; }
      const payload = { ...c, startedAt: new Date().toISOString(), focusBaseline: state.focusTotal };
      await logDecision(uid, 'challenge_started', c.params.topicId ?? c.params.a ?? null, payload);
      play('select');
      setOpen(true);
      await refresh();
    } catch (e) {
      play('error'); toast(e.message, 'err');
    } finally {
      setWorking(false);
    }
  }

  async function check() {
    const c = state.active;
    if (!c || working) return;
    setWorking(true);
    try {
      const entries = await pageOf(() => supabase.from('journal_entries')
        .select('topic_id,entry_kind,word_count,body,tags,created_at')
        .eq('user_id', uid).gte('created_at', c.startedAt));
      // Trade-off 2 counts minutes on the reflection timer since the challenge started.
      const rf = await supabase.from('decision_log').select('payload')
        .eq('user_id', uid).eq('event', 'reflect_focus').gte('created_at', c.startedAt);
      const focusSince = (rf.data ?? []).reduce((t, r) => t + (Number(r.payload?.minutes) || 0), 0);
      const res = verifyChallenge(c, { entries: entries.data ?? [], focusSince });
      setLastLabel(res.label);
      if (res.passed) {
        await logDecision(uid, 'challenge_passed', null, { id: c.id });
        await logDecision(uid, 'swap_earned', null, { challengeId: c.id });
        play('success');
        toast('Passed. One swap earned.', 'ok', 4200);
        confetti();
        setOpen(false);
      } else {
        toast(`Not yet: ${res.label}.`, 'warn', 4200);
      }
      await refresh();
    } catch (e) {
      play('error'); toast(e.message, 'err');
    } finally {
      setWorking(false);
    }
  }

  async function cancel() {
    const c = state.active;
    if (!c || working) return;
    setWorking(true);
    try {
      await logDecision(uid, 'challenge_cancelled', null, { id: c.id });
      toast('Challenge cancelled. Your topic stays as it is.', 'warn');
      setOpen(false);
      await refresh();
    } catch (e) {
      play('error'); toast(e.message, 'err');
    } finally {
      setWorking(false);
    }
  }

  if (!state.ready || assignment?.status !== 'accepted') return null;

  const left = swapsLeft({ earned: state.earned, swapped: state.swapped });
  const c = state.active;
  const link = c && c.params.topicId ? `/journal?review=${c.params.topicId}&mode=reflect&challenge=${c.id}`
    : c && c.params.a ? `/journal?review=${c.params.a}&mode=reflect&challenge=${c.id}`
    : c ? `/journal?mode=reflect&challenge=${c.id}`
    : null;

  let button;
  if (left > 0) {
    button = <button type="button" className="btn" onClick={() => setConfirmFree(true)} disabled={busy || working}>Swap topic</button>;
  } else if (c) {
    button = <button type="button" className="btn" onClick={() => setOpen(o => !o)}>{open ? 'Hide challenge' : 'Continue challenge'}</button>;
  } else if (state.earned >= MAX_EARNED_PER_DAY) {
    button = <button type="button" className="btn" disabled aria-label="Swap limit reached today"><Padlock />Swap limit reached</button>;
  } else {
    button = <button type="button" className="btn" onClick={() => setConfirmEarn(true)} disabled={working || busy}>{working ? 'Working' : 'Earn a swap'}</button>;
  }

  return (
    <>
      {button}
      <ConfirmDialog
        open={confirmFree}
        title="Swap this topic?"
        confirmLabel="Agree and continue"
        busy={busy}
        onCancel={() => setConfirmFree(false)}
        onConfirm={() => { setConfirmFree(false); onFreeSwap(); }}
      >
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          Your accepted topic will be replaced with a new one. You get one free swap a day. Once it is used, a swap is earned by passing a trade-off.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmEarn}
        title="Earn a swap?"
        confirmLabel="Agree and continue"
        busy={working}
        onCancel={() => setConfirmEarn(false)}
        onConfirm={async () => { setConfirmEarn(false); await startChallenge(); }}
      >
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          You will get one trade-off, chosen at random from the ones you can do today. Pass it to earn one swap. You can cancel it at any time.
        </p>
      </ConfirmDialog>
      {c && open && (
        <div className="card swap-challenge" style={{ flexBasis: '100%', marginTop: 10 }}>
          <div className="kicker">Earn a swap · trade-off</div>
          <p style={{ margin: '8px 0', lineHeight: 1.5 }}>{c.text}</p>
          <p className="muted" style={{ margin: '4px 0 10px' }}>{lastLabel || verifyChallenge(c, { entries: [], focusSince: 0 }).label}</p>
          <div className="row">
            <Link className="btn accent" href={link}>Open Journal</Link>
            <button type="button" className="btn" onClick={check} disabled={working}>Check progress</button>
            <button type="button" className="btn" onClick={() => setOpen(false)}>Not now</button>
            <button type="button" className="btn danger" onClick={cancel} disabled={working}>Cancel challenge</button>
          </div>
        </div>
      )}
    </>
  );
}
