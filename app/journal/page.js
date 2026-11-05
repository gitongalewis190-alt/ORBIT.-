'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { nextReview } from '../../lib/review';
import { logDecision } from '../../lib/log';
import { today, prettyDate } from '../../lib/dates';
import { play } from '../../lib/sound';
import { fetchAllTopics } from '../../lib/context';

const SCALE = [0, 1, 2, 3, 4, 5];
const CONFIDENCE_WORD = ['Blank', 'Barely', 'Shaky', 'Partial', 'Solid', 'Mastered'];

export default function Journal() {
  const [uid, setUid] = useState(null);
  const [entries, setEntries] = useState([]);
  const [topics, setTopics] = useState([]);
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState(null);
  const [assignmentId, setAssignmentId] = useState(null);
  const [body, setBody] = useState('');
  const [points, setPoints] = useState('');
  const [conf, setConf] = useState(null);
  const [mins, setMins] = useState('');
  const [open, setOpen] = useState(null);
  const [msg, setMsg] = useState({ text: '', tone: 'muted' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const id = data.user.id;
      setUid(id);

      const params = new URLSearchParams(window.location.search);
      const aid = params.get('assignment');
      const rid = params.get('review');

      if (aid) {
        const { data: a } = await supabase.from('assignments')
          .select('id,topic_id,topics(title)').eq('id', aid).maybeSingle();
        if (a?.topics) {
          setAssignmentId(a.id);
          setTopic({ id: a.topic_id, title: a.topics.title });
        }
      }
      if (rid) {
        const { data: t } = await supabase.from('topics')
          .select('id,title').eq('id', rid).maybeSingle();
        if (t) setTopic(t);
      }

      load(id);
      const { data: tp, error } = await fetchAllTopics();
      if (!error) setTopics(tp.map(t => ({ id: t.id, title: t.title })));
    });
  }, []);

  async function load(id) {
    const { data, error } = await supabase.from('journal_entries')
      .select('id,topic_id,body,key_points,confidence,minutes_spent,created_at,topics(title)')
      .eq('user_id', id).order('created_at', { ascending: false }).limit(100);
    if (error) { play('error'); return setMsg({ text: error.message, tone: 'err' }); }
    setEntries(data ?? []);
  }

  // SM-2 scheduling from the confidence rating.
  async function scheduleReview(id, topicId, quality) {
    const { data: cur } = await supabase.from('reviews').select('*')
      .eq('user_id', id).eq('topic_id', topicId).maybeSingle();
    const next = nextReview(cur ?? {}, quality);
    const { error } = await supabase.from('reviews').upsert({
      user_id: id, topic_id: topicId, ...next,
    });
    if (error) throw error;
    return next;
  }

  async function save() {
    if (busy) return;
    if (!topic) return fail('Pick a topic first.');
    if (!body.trim()) return fail('Write what you learned, in your own words.');
    if (conf === null) return fail('Rate your confidence from 0 to 5.');

    setBusy(true);
    try {
      const { error } = await supabase.from('journal_entries').insert({
        user_id: uid,
        topic_id: topic.id,
        assignment_id: assignmentId,
        body: body.trim(),
        key_points: points.split('\n').map(s => s.trim()).filter(Boolean),
        confidence: conf,
        minutes_spent: mins ? Number(mins) : null,
      });
      if (error) throw error;

      if (assignmentId) {
        await supabase.from('assignments').update({ status: 'completed' }).eq('id', assignmentId);
      }

      const next = await scheduleReview(uid, topic.id, conf);

      // Mastery signal: well-learned topics surface less, and the change is logged.
      if (conf >= 4 && next.reps >= 3) {
        await supabase.from('topic_controls').upsert({
          user_id: uid, topic_id: topic.id, state: 'show_less',
        });
        await logDecision(uid, 'auto_show_less', topic.id, { reps: next.reps });
      }
      await logDecision(uid, 'journal_saved', topic.id, {
        confidence: conf, minutes: mins ? Number(mins) : null, next_review: next.due_on,
      });

      play('success');
      setBody(''); setPoints(''); setConf(null); setMins('');
      setTopic(null); setAssignmentId(null);
      setMsg({ text: `Saved. Next review ${prettyDate(next.due_on)}.`, tone: 'muted' });
      load(uid);
    } catch (e) {
      fail(e.message);
    } finally {
      setBusy(false);
    }
  }

  function fail(text) {
    play('error');
    setMsg({ text, tone: 'err' });
  }

  async function relearn(entry) {
    const { error } = await supabase.from('reviews').upsert(
      { user_id: uid, topic_id: entry.topic_id, due_on: today() },
      { onConflict: 'user_id,topic_id' }
    );
    if (error) return fail(error.message);
    await logDecision(uid, 'relearn', entry.topic_id);
    play('chime');
    setMsg({ text: 'Added to today\u2019s reviews.', tone: 'muted' });
  }

  const matches = search.trim()
    ? topics.filter(t => t.title.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 12)
    : [];

  return (
    <div className="fade-in">
      <h1>Journal</h1>

      <div className="card">
        {topic ? (
          <div className="row" style={{ marginTop: 0, justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{topic.title}</span>
            <button className="btn sm" onClick={() => { setTopic(null); setAssignmentId(null); }}>Change</button>
          </div>
        ) : (
          <>
            <input
              placeholder="Search a topic"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {matches.map(t => (
              <div key={t.id} className="entry" onClick={() => { setTopic(t); setSearch(''); }}>
                {t.title}
              </div>
            ))}
          </>
        )}

        <h2>What I learned</h2>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Explain it in your own words."
        />

        <h2>Key points</h2>
        <textarea
          value={points}
          onChange={e => setPoints(e.target.value)}
          placeholder="One per line."
          style={{ minHeight: 72 }}
        />

        <h2>Confidence</h2>
        <div className="choices">
          {SCALE.map(n => (
            <button key={n} className={`btn ${conf === n ? 'on' : ''}`} onClick={() => setConf(n)}>{n}</button>
          ))}
        </div>
        {conf !== null && <div className="muted" style={{ marginTop: -6 }}>{CONFIDENCE_WORD[conf]}</div>}

        <h2>Minutes spent</h2>
        <input
          type="number"
          inputMode="numeric"
          placeholder="e.g. 45"
          value={mins}
          onChange={e => setMins(e.target.value)}
        />

        <div className="row">
          <button className="btn accent" onClick={save} disabled={busy}>
            {busy ? 'Saving' : 'Save entry'}
          </button>
        </div>
        {msg.text && <p className={msg.tone} style={{ marginBottom: 0 }}>{msg.text}</p>}
      </div>

      <h2>Memory</h2>
      {entries.length === 0 && <p className="muted">Nothing saved yet.</p>}
      {entries.map(e => (
        <div key={e.id} className="entry" onClick={() => setOpen(open?.id === e.id ? null : e)}>
          <div>{e.topics?.title ?? 'Removed topic'}</div>
          <div className="muted">
            {prettyDate(e.created_at.slice(0, 10))} · confidence {e.confidence ?? '-'}
          </div>
          {open?.id === e.id && (
            <div className="fade-in" style={{ marginTop: 10 }} onClick={ev => ev.stopPropagation()}>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.5 }}>{e.body}</p>
              {e.key_points?.length > 0 && (
                <ul style={{ paddingLeft: 18, fontSize: 14, lineHeight: 1.5 }}>
                  {e.key_points.map((k, i) => <li key={i}>{k}</li>)}
                </ul>
              )}
              <div className="row">
                <button className="btn sm accent" onClick={() => relearn(e)}>Re-learn now</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
