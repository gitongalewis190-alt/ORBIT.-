'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { buildContext } from '../lib/context';
import { selectTopic, pickMode, adaptLevel, shuffle } from '../lib/selector';
import { today, prettyDate } from '../lib/dates';
import { logDecision } from '../lib/log';
import { play } from '../lib/sound';
import { toast } from '../lib/toast';
import Reveal from '../components/Reveal';
import DayRings from '../components/DayRings';
import FocusTimer from '../components/FocusTimer';
import Onboarding from '../components/Onboarding';

const WHY = {
  auto: 'Drawn from your library, weighted toward topics you marked More and away from those marked Less.',
  cross: 'Chosen from a field linked to the one you studied last, to build a bridge between subjects.',
  serendipity: 'A fully random draw, to surface something you would not have picked.',
  reinforce: 'Chosen from a field where your recent confidence is low, to strengthen it.',
  manual: 'You picked this field yourself.',
};

export default function Today() {
  const [user, setUser] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [fields, setFields] = useState([]);
  const [manualField, setManualField] = useState('');
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUser(data.user);
      load(data.user.id);
    });
  }, []);

  async function load(uid) {
    const t = today();
    const [a, r, f] = await Promise.all([
      supabase.from('assignments')
        .select('id,topic_id,assigned_on,due_on,est_minutes,mode,status,topics(title,difficulty,subfields(name,fields(name)))')
        .eq('user_id', uid).eq('assigned_on', t).neq('status', 'rejected')
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('reviews').select('topic_id,due_on,topics(title)')
        .eq('user_id', uid).lte('due_on', t).order('due_on'),
      supabase.from('fields').select('id,name').order('id'),
    ]);
    if (a.error || r.error || f.error) {
      const message = (a.error || r.error || f.error).message;
      setErr(message);
      play('error');
    }
    setAssignment(a.data ?? null);
    setReviews(r.data ?? []);
    setFields(f.data ?? []);
  }

  // Selection runs first. The reveal plays, then the assignment is saved.
  async function generate(manualFieldId) {
    if (!user || busy) return;
    setBusy(true);
    setErr('');
    try {
      const ctx = await buildContext(user.id);
      const level = adaptLevel(ctx.recentConfidences);
      const mode = manualFieldId ? 'manual' : pickMode();
      const pick = selectTopic({ ...ctx, level, mode, manualFieldId: manualFieldId || null });
      const pool = shuffle(ctx.topics).slice(0, 40);

      setReveal({
        pool,
        target: pick.topic.title,
        onDone: async () => {
          const { error } = await supabase.from('assignments').insert({
            user_id: user.id,
            topic_id: pick.topic.id,
            assigned_on: today(),
            due_on: pick.dueOn,
            est_minutes: pick.minutes,
            mode: pick.mode,
          });
          if (error) {
            play('error');
            setErr(error.message);
            toast(error.message, 'err');
          } else {
            await logDecision(user.id, 'generated', pick.topic.id, {
              mode: pick.mode, level, due_on: pick.dueOn, minutes: pick.minutes,
            });
            toast(`Today's topic: ${pick.topic.title}`, 'info');
          }
          setReveal(null);
          setBusy(false);
          await load(user.id);
        },
      });
    } catch (e) {
      play('error');
      setErr(e.message);
      toast(e.message, 'err');
      setBusy(false);
    }
  }

  async function accept() {
    const { error } = await supabase.from('assignments')
      .update({ status: 'accepted' }).eq('id', assignment.id);
    if (error) { play('error'); return setErr(error.message); }
    await logDecision(user.id, 'accepted', assignment.topic_id);
    play('success');
    toast('Topic accepted. Good luck.', 'ok');
    load(user.id);
  }

  async function reject() {
    const { error } = await supabase.from('assignments')
      .update({ status: 'rejected' }).eq('id', assignment.id);
    if (error) { play('error'); return setErr(error.message); }
    await logDecision(user.id, 'rejected', assignment.topic_id);
    setAssignment(null);
    toast('Topic rejected. Choosing another.', 'warn');
    generate(null);
  }

  const topic = assignment?.topics;

  return (
    <div className="fade-in">
      <h1>Today</h1>
      <p className="muted">{prettyDate(today())}</p>
      {err && <p className="err">{err}</p>}
      <DayRings />
      <FocusTimer />
      <Onboarding />

      {reveal ? (
        <div className="card" style={{ marginTop: 16 }}>
          <Reveal pool={reveal.pool} target={reveal.target} onDone={reveal.onDone} />
        </div>
      ) : assignment ? (
        <div className="card fade-in">
          <div className="muted">{topic.subfields.fields.name} · {topic.subfields.name}</div>
          <h2 style={{ marginTop: 6, fontSize: 18 }}>{topic.title}</h2>
          <span className="tag">{topic.difficulty}</span>
          <span className="tag">{assignment.est_minutes} min</span>
          <span className="tag">done by {prettyDate(assignment.due_on)}</span>
          <span className="tag">{assignment.mode}</span>
          <p className="muted" style={{ marginTop: 10, lineHeight: 1.5 }}>
            {WHY[assignment.mode] ?? WHY.auto}
          </p>

          {assignment.status === 'generated' ? (
            <div className="row">
              <button className="btn accent" onClick={accept} disabled={busy}>Accept</button>
              <button className="btn" onClick={reject} disabled={busy}>Reject</button>
            </div>
          ) : (
            <div className="row">
              <span className="muted">Status: {assignment.status}</span>
              {assignment.status !== 'completed' && (
                <a className="btn accent" href={`/journal?assignment=${assignment.id}`}>
                  Log what I learned
                </a>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="card fade-in">
          <p className="muted" style={{ marginTop: 0 }}>No topic yet for today.</p>
          <div className="row" style={{ marginTop: 0 }}>
            <button className="btn accent" onClick={() => generate(null)} disabled={busy || !user}>
              Generate today's topic
            </button>
          </div>

          <h2>Manual field override</h2>
          <select value={manualField} onChange={e => setManualField(e.target.value)}>
            <option value="">Choose a field</option>
            {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <div className="row" style={{ marginTop: 0 }}>
            <button className="btn" onClick={() => generate(manualField)} disabled={busy || !manualField}>
              Generate in this field
            </button>
          </div>
        </div>
      )}

      <h2>Reviews due</h2>
      {reviews.length ? reviews.map(r => (
        <div key={r.topic_id} className="card">
          <div>{r.topics.title}</div>
          <div className="muted">due {prettyDate(r.due_on)}</div>
          <div className="row">
            <a className="btn sm" href={`/journal?review=${r.topic_id}`}>Review now</a>
          </div>
        </div>
      )) : <p className="muted">Nothing due.</p>}
    </div>
  );
}
