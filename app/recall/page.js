'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
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
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) { setError('Sign in to use recall.'); return; }
      setUser(auth.user);
      const [{ data: rows, error: e1 }, { data: asks, error: e2 }] = await Promise.all([
        supabase.from('journal_entries')
          .select('id, topic_id, body, key_points, created_at, topics(title)')
          .eq('user_id', auth.user.id).order('created_at', { ascending: false }).limit(500),
        supabase.from('recall_questions')
          .select('id, entry_id, topic_title, entry_logged_on, band, question, answer, score, comment, verifier, asked_at')
          .eq('user_id', auth.user.id).order('asked_at', { ascending: false }).limit(200),
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

  const tip = { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 };

  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '24px 18px 120px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, margin: '0 0 6px' }}>Recall</h1>
      <p style={{ opacity: 0.7, margin: '0 0 20px', fontSize: 14 }}>
        Questions built from what you logged. Older entries ask harder questions.
      </p>

      {error && <p role="alert" style={{ color: '#b4532a', fontSize: 14 }}>{error}</p>}

      {!current && (
        <>
          <button onClick={askMe} disabled={!user || entries.length === 0} style={btn}>Ask me something</button>
          <div style={{ marginTop: 16 }}>
            <select value={chosen} onChange={e => setChosen(e.target.value)} style={{ width: '100%' }}>
              <option value="">Choose an entry</option>
              {entries.map(e => (
                <option key={e.id} value={e.id}>{e.topics?.title ?? 'Entry'} · {String(e.created_at).slice(0, 10)}</option>
              ))}
            </select>
            <button onClick={() => askChosen(chosen)} disabled={!chosen} style={btn}>Ask about this entry</button>
          </div>
        </>
      )}

      {current && (
        <section style={{ marginTop: 8 }}>
          <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
            {current.band.label} · Topic: <strong>{current.entry.topic_title}</strong> · Logged {prettyDate(current.logged)}
          </p>
          <p style={{ fontSize: 17, lineHeight: 1.5, margin: '12px 0' }}>{current.question.prompt}</p>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            rows={6}
            placeholder="Write what you remember"
            style={{ width: '100%', boxSizing: 'border-box', padding: 12, fontSize: 15 }}
            disabled={busy || !!result}
          />
          {!result && <Dictate onText={text => setAnswer(a => (a ? `${a.trimEnd()} ${text}` : text))} />}
          {!result && (
            <button onClick={submit} disabled={busy || !answer.trim()} style={btn}>
              {busy ? 'Checking…' : 'Check my answer'}
            </button>
          )}
          {result && (
            <div style={{ marginTop: 14, padding: 14, border: '1px solid #d8cfc0', borderRadius: 10 }}>
              <p style={{ margin: 0, fontSize: 15 }}>Score <strong>{result.score}/100</strong></p>
              <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5 }}>{result.comment}</p>
              {result.weak && (
                <>
                  <p style={{ margin: '12px 0 6px', fontSize: 14 }}>Go back to the concept first. Reread what you logged:</p>
                  <div className="rich-view" style={{ fontSize: 15, lineHeight: 1.6, padding: 12, border: '0.5px solid #d8cfc0', borderRadius: 8 }}
                    dangerouslySetInnerHTML={{ __html: renderRich(current.entry.body) }} />
                  <div style={tip}>
                    <button onClick={relearn} style={btn}>Put this topic in today’s reviews</button>
                  </div>
                </>
              )}
              <div style={tip}>
                <button onClick={askMe} style={btn}>Next question</button>
              </div>
            </div>
          )}
        </section>
      )}

      <h2 style={{ fontSize: 16, fontWeight: 500, margin: '32px 0 10px' }}>Catalogue</h2>
      {history.length === 0 && <p style={{ fontSize: 14, opacity: 0.6 }}>No questions answered yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {history.map(h => (
          <li key={h.id} style={{ borderTop: '1px solid #e6dfd2', padding: '10px 0', fontSize: 14 }}>
            <div><strong>{h.topic_title}</strong> · logged {prettyDate(h.entry_logged_on)} · asked {prettyDate(h.asked_at.slice(0, 10))}</div>
            <div style={{ opacity: 0.75 }}>Score {h.score}/100 · {BANDS.find(b => b.key === h.band)?.label}</div>
            <div style={{ opacity: 0.6, fontSize: 13 }}>{h.question}</div>
            <div style={{ opacity: 0.6, fontSize: 13 }}>{h.comment}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}

const btn = {
  padding: '10px 18px', borderRadius: 999, border: '1px solid #b4532a',
  background: 'transparent', color: '#b4532a', fontSize: 15, cursor: 'pointer',
};
