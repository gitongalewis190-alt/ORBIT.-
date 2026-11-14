'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { currentUser } from '../../lib/session';
import { pickRecall, BANDS, bandFor } from '../../lib/recall';
import { buildQuestions, pickQuestion, gradeQuestion } from '../../lib/recallQuestions';
import { prettyDate, today } from '../../lib/dates';
import { logDecision } from '../../lib/log';
import { play } from '../../lib/sound';
import { toast } from '../../lib/toast';
import { renderRich } from '../../lib/richtext';
import { verifyAnswer } from '../../lib/recallClient';
import Dictate from '../../components/Dictate';

// Recall: questions built from what you logged, harder for older entries. A weak answer sends you back to
// the concept: the entry is shown again, and the topic goes into today's reviews.
export default function RecallPage() {
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [history, setHistory] = useState([]);
  const [current, setCurrent] = useState(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [chosen, setChosen] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const user = await currentUser();
      if (!user) { setError('Sign in to use recall.'); return; }
      setUser(user);
      const [{ data: rows, error: e1 }, { data: asks, error: e2 }] = await Promise.all([
        supabase.from('journal_entries')
          .select('id, topic_id, body, key_points, created_at, topics(title)')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(500),
        supabase.from('recall_questions')
          .select('id, entry_id, topic_title, entry_logged_on, band, question, answer, score, comment, verifier, asked_at')
          .eq('user_id', user.id).order('asked_at', { ascending: false }).limit(200),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setEntries(rows ?? []);
      setHistory(asks ?? []);
    } catch (err) {
      setError(err.message || 'Could not load recall.');
    }
  }

  function pool() {
    const recentAsks = {};
    for (const h of history) {
      const t = new Date(h.asked_at).getTime();
      if (!recentAsks[h.entry_id] || t > recentAsks[h.entry_id]) recentAsks[h.entry_id] = t;
    }
    const lastScore = {};
    for (const h of [...history].reverse()) lastScore[h.entry_id] = h.score;
    const candidates = entries.map(e => ({
      id: e.id,
      topic_id: e.topic_id,
      topic_title: e.topics?.title ?? 'Untitled topic',
      created_at: e.created_at,
      lastScore: lastScore[e.id] ?? null,
      body: e.body,
      key_points: e.key_points ?? [],
    }));
    return { candidates, recentAsks };
  }

  function pose(entry, days) {
    const { candidates } = pool();
    const others = candidates.filter(c => c.id !== entry.id).slice(0, 30);
    const question = pickQuestion(buildQuestions(entry, days, others));
    if (!question) {
      setError('This entry is too short to build a question from. Add a few more sentences to it.');
      setCurrent(null);
      return;
    }
    setError('');
    setResult(null);
    setAnswer('');
    setCurrent({ entry, days, band: bandFor(Math.max(1, days)) ?? BANDS[0], question, logged: entry.created_at.slice(0, 10) });
  }

  function askMe() {
    const { candidates, recentAsks } = pool();
    const pick = pickRecall(candidates, { recentAsks });
    if (!pick) {
      setCurrent(null);
      setError('Nothing old enough yet. Recall starts the day after you log an entry.');
      return;
    }
    const days = Math.floor((Date.now() - new Date(pick.entry.created_at).getTime()) / 86400000);
    pose(pick.entry, days);
  }

  function askChosen(id) {
    const { candidates } = pool();
    const entry = candidates.find(c => c.id === id);
    if (!entry) return;
    const days = Math.max(1, Math.floor((Date.now() - new Date(entry.created_at).getTime()) / 86400000));
    pose(entry, days);
  }

  useEffect(() => {
    if (!entries.length) return;
    const id = new URLSearchParams(window.location.search).get('entry');
    if (id) askChosen(id);
    // The address is read once, when the entries arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  async function submit() {
    if (!current || !answer.trim() || busy) return;
    setBusy(true);
    setError('');
    // Rules always grade the answer. If the optional AI verifier answers, its score and comment are used.
    const rules = gradeQuestion(current.question, answer);
    const ai = await verifyAnswer(answer, { body: current.entry.body, key_points: current.entry.key_points ?? [] });
    const aiUsed = ai && ai.verifier && ai.verifier !== 'local';
    const graded = aiUsed
      ? { ...rules, score: ai.score, comment: ai.comment, weak: ai.score < 60, verifier: ai.verifier }
      : { ...rules, verifier: 'rules' };
    const row = {
      user_id: user.id,
      entry_id: current.entry.id,
      topic_id: current.entry.topic_id,
      topic_title: current.entry.topic_title,
      entry_logged_on: current.logged,
      band: current.band.key,
      question: current.question.prompt,
      answer,
      score: graded.score,
      comment: graded.comment,
      verifier: graded.verifier,
    };
    const { data, error: saveError } = await supabase.from('recall_questions').insert(row).select().single();
    setBusy(false);
    if (saveError) setError('Scored, but could not save: ' + saveError.message);
    setResult(graded);
    if (data) setHistory(h => [data, ...h]);
    play(graded.weak ? 'warn' : 'success');
  }

  // A weak answer sends you back to the concept: the topic goes into today's reviews and the entry is shown.
  async function relearn() {
    if (!current) return;
    const { error: rErr } = await supabase.from('reviews').upsert(
      { user_id: user.id, topic_id: current.entry.topic_id, due_on: today() },
      { onConflict: 'user_id,topic_id' }
    );
    if (rErr) { play('error'); return toast(rErr.message, 'err'); }
    await logDecision(user.id, 'recall_relearn', current.entry.topic_id, { score: result?.score ?? null });
    toast('Added to today’s reviews. Reread the concept first.', 'info', 4500);
  }

  return (
    <div className="fade-in">
      <Link href="/study" className="muted" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 15, textDecoration: 'none' }}>Study</Link>
      <h1 style={{ fontSize: '1.4rem' }}>Recall</h1>
      <p className="muted">Questions built from what you logged. Older entries ask harder questions.</p>

      {error && <p className="err" role="alert">{error}</p>}

      {!current && (
        <>
          <button type="button" className="btn accent" onClick={askMe} disabled={!user || entries.length === 0 || busy} style={{ minHeight: 44 }}>Ask me something</button>
          <select value={chosen} onChange={e => setChosen(e.target.value)} aria-label="Choose an entry">
            <option value="">Choose an entry</option>
            {entries.map(e => (
              <option key={e.id} value={e.id}>{e.topics?.title ?? 'Entry'} · {String(e.created_at).slice(0, 10)}</option>
            ))}
          </select>
          <div className="seg" role="group" aria-label="Ask about a chosen entry">
            <button type="button" onClick={() => askChosen(chosen)} disabled={!chosen || busy} style={{ minHeight: 44, fontSize: 15 }}>Ask about this entry</button>
          </div>
        </>
      )}

      {current && (
        <section className="card">
          <p className="muted">
            {current.band.label} · Topic: <strong>{current.entry.topic_title}</strong> · Logged {prettyDate(current.logged)}
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.5 }}>{current.question.prompt}</p>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            rows={6}
            placeholder="Write what you remember"
            disabled={busy || !!result}
          />
          {!result && <Dictate onText={text => setAnswer(a => (a ? `${a.trimEnd()} ${text}` : text))} />}
          {!result && (
            <button type="button" className="btn accent" onClick={submit} disabled={busy || !answer.trim()} style={{ minHeight: 44 }}>
              {busy ? 'Checking' : 'Check my answer'}
            </button>
          )}
          {result && (
            <div className="card">
              <p className="kicker">{result.weak || result.score < 60 ? 'Not yet' : result.score >= 80 ? 'Correct' : 'Partly correct'}</p>
              <p style={{ fontSize: '2.2rem', lineHeight: 1, margin: '0 0 8px', fontWeight: 650 }}>{result.score}<span className="muted">/100</span></p>
              <p style={{ fontSize: 16, lineHeight: 1.5 }}>{result.comment}</p>
              <p className="muted">Graded by {result.verifier === 'rules' || result.verifier === 'local' ? 'keyword check' : result.verifier}.</p>
              {result.weak && (
                <>
                  <p>Go back to the concept first. Reread what you logged:</p>
                  <div className="rich-view card" dangerouslySetInnerHTML={{ __html: renderRich(current.entry.body) }} />
                  <div className="row">
                    <button type="button" className="btn" onClick={relearn} disabled={busy} style={{ minHeight: 44 }}>Put this topic in today’s reviews</button>
                  </div>
                </>
              )}
              <div className="row">
                <button type="button" className="btn accent" onClick={askMe} disabled={busy} style={{ minHeight: 44 }}>Next question</button>
              </div>
            </div>
          )}
        </section>
      )}

      <h2>Catalogue</h2>
      {history.length === 0 && <p className="muted">No questions answered yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {history.map(h => (
          <li key={h.id} className="entry" style={{ cursor: 'default' }}>
            <div><strong>{h.topic_title}</strong></div>
            <div>Score {h.score}/100 · {BANDS.find(b => b.key === h.band)?.label}</div>
            <div className="muted">logged {prettyDate(h.entry_logged_on)} · asked {prettyDate(h.asked_at.slice(0, 10))}</div>
            <div className="muted">{h.question}</div>
            <div className="muted">{h.comment}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
