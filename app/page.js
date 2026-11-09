'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { currentUser } from '../lib/session';
import { buildContext } from '../lib/context';
import { selectTopic, pickMode, adaptLevel, shuffle } from '../lib/selector';
import { today, prettyDate } from '../lib/dates';
import { logDecision } from '../lib/log';
import { play } from '../lib/sound';
import { toast } from '../lib/toast';
import Reveal from '../components/Reveal';
import DayRings from '../components/DayRings';
import SmartNotes from '../components/SmartNotes';
import BenefitsPanel from '../components/BenefitsPanel';
import FocusTimer from '../components/FocusTimer';
import Onboarding from '../components/Onboarding';
import { canChangeTopic, changesToday } from '../lib/dayRules';

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
  const [busyAction, setBusyAction] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [reveal, setReveal] = useState(null);
  const [err, setErr] = useState('');
  const [changes, setChanges] = useState(0);
  const [swaps, setSwaps] = useState(0);
  const [reviewOrder, setReviewOrder] = useState('due');
  const busyRef = useRef(false);
  const busy = busyAction !== '';

  function beginBusy(action) {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusyAction(action);
    return true;
  }

  function endBusy() {
    busyRef.current = false;
    setBusyAction('');
  }

  useEffect(() => {
    currentUser().then((user) => {
      if (!user) return;
      setUser(user);
      load(user.id);
    });
  }, []);

  async function load(uid) {
    const t = today();
    const [a, r, f, c] = await Promise.all([
      supabase.from('assignments')
        .select('id,topic_id,assigned_on,due_on,est_minutes,mode,status,topics(title,difficulty,subfields(name,fields(name)))')
        .eq('user_id', uid).eq('assigned_on', t).neq('status', 'rejected')
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('reviews').select('topic_id,due_on,topics(title)')
        .eq('user_id', uid).lte('due_on', t).order('due_on'),
      supabase.from('fields').select('id,name').order('id'),
      supabase.from('assignments').select('id', { count: 'exact', head: true })
        .eq('user_id', uid).eq('assigned_on', t).neq('status', 'rejected'),
    ]);
    if (a.error || r.error || f.error || c.error) {
      const message = (a.error || r.error || f.error || c.error).message;
      setErr(message);
      play('error');
    }
    // Swaps made today, from the decision log: one swap per day is allowed on an accepted topic.
    const sw = await supabase.from('decision_log').select('id', { count: 'exact', head: true })
      .eq('user_id', uid).eq('event', 'swapped')
      .gte('created_at', new Date(`${today()}T00:00:00+03:00`).toISOString());
    setSwaps(sw.count ?? 0);
    setAssignment(a.data ?? null);
    setReviews(r.data ?? []);
    setFields(f.data ?? []);
    setChanges(changesToday(c.count));
  }

  // Selection runs first. The reveal plays, then the assignment is saved.
  async function runGenerate(manualFieldId) {
    const ctx = await buildContext(user.id);
    const level = adaptLevel(ctx.recentConfidences);
    const mode = manualFieldId ? 'manual' : pickMode();
    let atlasTopicIds = null;
    const atlas = await supabase.from('atlas_concepts').select('metadata').eq('user_id', user.id).limit(100);
    if (!atlas.error) {
      const ids = (atlas.data || []).filter(row => row.metadata?.reinforce && row.metadata?.topic_id).map(row => row.metadata.topic_id);
      if (ids.length) atlasTopicIds = new Set(ids);
    }
    const pick = selectTopic({ ...ctx, level, mode, manualFieldId: manualFieldId || null, ...(atlasTopicIds ? { atlasTopicIds } : {}) });
    const pool = shuffle(ctx.topics).slice(0, 40);

    setReveal({
      pool,
      target: pick.topic.title,
      onDone: async () => {
        try {
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
          await load(user.id);
        } catch (e) {
          play('error');
          setErr(e.message);
          toast(e.message, 'err');
        } finally {
          setReveal(null);
          endBusy();
        }
      },
    });
  }

  async function generate(manualFieldId, action) {
    if (!user || busyRef.current || reveal) return;
    if (!beginBusy(action)) return;
    setErr('');
    let revealed = false;
    try {
      await runGenerate(manualFieldId);
      revealed = true;
    } catch (e) {
      play('error');
      setErr(e.message);
      toast(e.message, 'err');
    } finally {
      if (!revealed) endBusy();
    }
  }

  // Swap an accepted topic for another, before it is logged. One swap per day.
  // The accepted topic is rejected, which keeps it out of today's list, and a new topic is drawn.
  async function swap() {
    if (!user || !assignment || busyRef.current || reveal) return;
    if (assignment.status !== 'accepted') return;
    if (swaps >= 1) return toast('You have already swapped today’s topic.', 'warn');
    if (!beginBusy('swap')) return;
    try {
      const { error } = await supabase.from('assignments')
        .update({ status: 'rejected' }).eq('id', assignment.id);
      if (error) throw error;
      await logDecision(user.id, 'swapped', assignment.topic_id);
    } catch (e) {
      play('error');
      toast(e.message, 'err');
      endBusy();
      return;
    }
    endBusy();
    await generate(null, 'swap');
  }

  async function accept() {
    if (!user || !assignment || busyRef.current || reveal) return;
    if (!beginBusy('accept')) return;
    try {
      const { error } = await supabase.from('assignments')
        .update({ status: 'accepted' }).eq('id', assignment.id);
      if (error) {
        play('error');
        setErr(error.message);
        return;
      }
      await logDecision(user.id, 'accepted', assignment.topic_id);
      play('success');
      toast('Topic accepted. Good luck.', 'ok');
      await load(user.id);
    } catch (e) {
      play('error');
      setErr(e.message);
      toast(e.message, 'err');
    } finally {
      endBusy();
    }
  }

  async function reject() {
    if (!user || !assignment || busyRef.current || reveal) return;
    if (!beginBusy('reject')) return;
    let revealed = false;
    try {
      const { error } = await supabase.from('assignments')
        .update({ status: 'rejected' }).eq('id', assignment.id);
      if (error) {
        play('error');
        setErr(error.message);
        return;
      }
      await logDecision(user.id, 'rejected', assignment.topic_id);
      setAssignment(null);
      toast('Topic rejected. Choosing another.', 'warn');
      await runGenerate(null);
      revealed = true;
    } catch (e) {
      play('error');
      setErr(e.message);
      toast(e.message, 'err');
    } finally {
      if (!revealed) endBusy();
    }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem('orbit.review.order');
      if (saved === 'keystone' || saved === 'due') setReviewOrder(saved);
    } catch { /* storage is optional */ }
  }, []);
  const change = canChangeTopic({ assignment, overridesToday: changes });
  const topic = assignment?.topics;
  let orderedReviews = reviews;
  if (reviewOrder === 'keystone') {
    try {
      const plan = JSON.parse(localStorage.getItem('orbit.keystone.plan') || '[]');
      if (Array.isArray(plan) && plan.length) {
        orderedReviews = [...reviews].sort((a, b) => {
          const ia = plan.indexOf(a.topic_id);
          const ib = plan.indexOf(b.topic_id);
          return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || String(a.due_on).localeCompare(String(b.due_on));
        });
      }
    } catch {
      orderedReviews = reviews;
    }
  }

  return (
    <div className="fade-in">
      <h1>Today</h1>
      <p className="muted">{prettyDate(today())}</p>
      <div className="row" style={{ marginTop: 8 }}>
        <Link className="btn" href="/study">Study</Link>
        <Link className="btn" href="/resonance">Resonance</Link>
      </div>
      {err && <p className="err">{err}</p>}
      <div id="rings"><DayRings /></div>

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
              <button className="btn accent" onClick={accept} disabled={busy}>
                {busyAction === 'accept' ? 'Working' : 'Accept'}
              </button>
              <button className="btn" onClick={reject} disabled={busy}>
                {busyAction === 'reject' ? 'Working' : 'Reject'}
              </button>
            </div>
          ) : (
            <div className="row">
              <span className="muted">Status: {assignment.status}</span>
              {assignment.status === 'accepted' && (
                <button className="btn" onClick={swap} disabled={busy || swaps >= 1}>
                  {busyAction === 'swap' ? 'Working' : swaps >= 1 ? 'Swapped today' : 'Swap topic'}
                </button>
              )}
              {assignment.status !== 'completed' && (
                <a className="btn accent" href={`/journal?assignment=${assignment.id}`}>
                  Log what I learned
                </a>
              )}
              {assignment.status === 'completed' && (
                <>
                  <button className="btn" onClick={() => generate(null, 'another')} disabled={busy || !change.ok}>
                    {busyAction === 'another' ? 'Working' : 'Choose another topic'}
                  </button>
                  {!change.ok && <p className="muted">{change.reason}</p>}
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="card fade-in">
          <p className="muted" style={{ marginTop: 0 }}>No topic yet for today.</p>
          <div className="row" style={{ marginTop: 0 }}>
            <button className="btn accent" onClick={() => generate(null, 'generate')} disabled={busy || !user || !!reveal}>
              {busyAction === 'generate' ? 'Working' : "Generate today's topic"}
            </button>
          </div>

          <h2>Manual field override</h2>
          <select value={manualField} onChange={e => setManualField(e.target.value)}>
            <option value="">Choose a field</option>
            {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <div className="row" style={{ marginTop: 0 }}>
            <button className="btn" onClick={() => generate(manualField, 'field')} disabled={busy || !manualField || !!reveal}>
              {busyAction === 'field' ? 'Working' : 'Generate in this field'}
            </button>
          </div>
        </div>
      )}

      <h2 id="reviews-due">Reviews due</h2>
      <div className="seg" role="group" aria-label="Review order">
        <button type="button" data-sound="select" className={reviewOrder === 'due' ? 'on' : ''} onClick={() => { setReviewOrder('due'); localStorage.setItem('orbit.review.order', 'due'); }}>Due date</button>
        <button type="button" data-sound="select" className={reviewOrder === 'keystone' ? 'on' : ''} onClick={() => { setReviewOrder('keystone'); localStorage.setItem('orbit.review.order', 'keystone'); }}>Keystone</button>
      </div>
      <div className="row" style={{ marginTop: 0 }}>
        <Link className="btn" href="/recall">Recall quiz</Link>
        <Link className="btn accent" href="/log#recall-model">Recall model</Link>
      </div>
      {orderedReviews.length ? orderedReviews.map(r => (
        <div key={r.topic_id} className="card">
          <div>{r.topics.title}</div>
          <div className="muted">due {prettyDate(r.due_on)}</div>
          <div className="row">
            <a className="btn sm" href={`/journal?review=${r.topic_id}`}>Review now</a>
          </div>
        </div>
      )) : <p className="muted">Nothing due.</p>}

      <button
        type="button"
        id="more-for"
        className="btn more-today-toggle"
        aria-expanded={moreOpen}
        aria-controls="more-today"
        onClick={() => setMoreOpen(open => !open)}
      >
        More for today
      </button>
      {moreOpen && (
        <div id="more-today" className="more-today">
          <div id="smart-notes"><SmartNotes /></div>
          <BenefitsPanel />
          <div id="focus"><FocusTimer /></div>
        </div>
      )}
      <Onboarding />
    </div>
  );
}
