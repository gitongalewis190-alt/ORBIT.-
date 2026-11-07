'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { currentUser } from '../../lib/session';
import { today, prettyDate } from '../../lib/dates';
import { play } from '../../lib/sound';
import { toast } from '../../lib/toast';
import { fetchAllTopics } from '../../lib/context';
import { getProfile } from '../../lib/profile';
import { wordCount, loadStats } from '../../lib/stats';
import { commitEntry } from '../../lib/journal';
import { enqueue, isNetworkError, loadDraft, saveDraft, clearDraft } from '../../lib/offline';
import { logDecision } from '../../lib/log';

const CONFIDENCE_WORD = ['Blank', 'Barely', 'Shaky', 'Partial', 'Solid', 'Mastered'];

const parseTags = text =>
  [...new Set(text.split(',').map(t => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean))].slice(0, 8);

export default function Journal() {
  const [uid, setUid] = useState(null);
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [topics, setTopics] = useState([]);
  const [search, setSearch] = useState('');
  const [memorySearch, setMemorySearch] = useState('');
  const [topic, setTopic] = useState(null);
  const [assignmentId, setAssignmentId] = useState(null);
  const [body, setBody] = useState('');
  const [points, setPoints] = useState('');
  const [tagText, setTagText] = useState('');
  const [conf, setConf] = useState(null);
  const [mins, setMins] = useState('');
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [streak, setStreak] = useState(0);
  const [wordsToday, setWordsToday] = useState(0);
  const [draftNote, setDraftNote] = useState('');

  const words = useMemo(() => wordCount(body), [body]);
  const goal = profile?.word_goal ?? 150;
  const pct = Math.min(100, Math.round((words / goal) * 100));

  useEffect(() => {
    currentUser().then(async (user) => {
      if (!user) return;
      const id = user.id;
      setUid(id);
      const p = await getProfile(id);
      setProfile(p);

      // Restore an unfinished draft from this phone.
      const draft = loadDraft(id);
      if (draft && (draft.body || draft.points || draft.tagText)) {
        setBody(draft.body || '');
        setPoints(draft.points || '');
        setTagText(draft.tagText || '');
        setConf(draft.conf ?? null);
        setMins(draft.mins || '');
        setDraftNote('Draft restored from this phone.');
      }

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
        const { data: t } = await supabase.from('topics').select('id,title').eq('id', rid).maybeSingle();
        if (t) setTopic(t);
      }

      await load(id, p);
      const { data: tp, error } = await fetchAllTopics();
      if (!error) setTopics(tp.map(t => ({ id: t.id, title: t.title })));
    });
  }, []);

  // Autosave the draft on this phone as you type.
  useEffect(() => {
    if (!uid) return;
    if (!body && !points && !tagText && conf === null && !mins) return;
    saveDraft(uid, { body, points, tagText, conf, mins });
  }, [uid, body, points, tagText, conf, mins]);

  async function load(id, p = profile) {
    const { data, error } = await supabase.from('journal_entries')
      .select('id,topic_id,body,key_points,confidence,minutes_spent,word_count,tags,created_at,topics(title)')
      .eq('user_id', id).order('created_at', { ascending: false }).limit(200);
    if (error) return setErr(error.message);
    setErr('');
    setEntries(data ?? []);
    if (p) {
      const s = await loadStats(id, p);
      setStreak(s.streak);
      setWordsToday(s.wordsToday);
    }
  }

  function validate() {
    if (!topic) return 'Pick a topic first.';
    if (words < 5) return 'Write at least a few words, in your own explanation.';
    if (conf === null) return 'Rate your confidence from 0 to 5.';
    return '';
  }

  async function save() {
    if (busy) return;
    const problem = validate();
    if (problem) {
      play('error');
      toast(problem, 'err');
      return;
    }

    const payload = {
      id: crypto.randomUUID(),
      topic_id: topic.id,
      assignment_id: assignmentId,
      body: body.trim(),
      key_points: points.split('\n').map(s => s.trim()).filter(Boolean),
      confidence: conf,
      minutes_spent: mins ? Number(mins) : null,
      word_count: words,
      tags: parseTags(tagText),
      created_at: new Date().toISOString(),
    };

    setBusy(true);
    try {
      const { next, fresh } = await commitEntry(uid, payload);
      play(fresh.length ? 'badge' : 'save');
      toast(`Saved. Next review ${prettyDate(next.due_on)}.`, 'ok');
      finishSave();
      await load(uid, profile);
    } catch (e) {
      if (isNetworkError(e)) {
        // No connection: keep the finished entry on the phone and sync it later.
        enqueue(uid, { payload, queuedAt: Date.now() });
        play('save');
        toast('Saved on this phone. It will sync when you are back online.', 'warn', 4500);
        finishSave();
      } else {
        play('error');
        toast(`Could not save: ${e.message}`, 'err', 6000);
      }
    } finally {
      setBusy(false);
    }
  }

  function finishSave() {
    setBody(''); setPoints(''); setTagText(''); setConf(null); setMins('');
    setTopic(null); setAssignmentId(null); setDraftNote('');
    clearDraft(uid);
  }

  async function relearn(entry) {
    const { error } = await supabase.from('reviews').upsert(
      { user_id: uid, topic_id: entry.topic_id, due_on: today() },
      { onConflict: 'user_id,topic_id' }
    );
    if (error) { play('error'); return toast(error.message, 'err'); }
    await logDecision(uid, 'relearn', entry.topic_id);
    play('chime');
    toast('Added to today\u2019s reviews.', 'info');
  }

  async function removeEntry(entry) {
    if (!window.confirm('Delete this entry? This cannot be undone.')) return;
    const { error } = await supabase.from('journal_entries').delete().eq('id', entry.id);
    if (error) { play('error'); return toast(error.message, 'err'); }
    await logDecision(uid, 'entry_deleted', entry.topic_id, { words: entry.word_count });
    play('trash');
    toast('Entry deleted.', 'info');
    setOpen(null);
    load(uid, profile);
  }

  const matches = search.trim()
    ? topics.filter(t => t.title.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 12)
    : [];

  const memoryList = entries.filter(e => {
    const q = memorySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (e.topics?.title || '').toLowerCase().includes(q) ||
      (e.body || '').toLowerCase().includes(q) ||
      (e.tags || []).some(t => t.includes(q.replace(/\s+/g, '-')))
    );
  });

  return (
    <div className="fade-in">
      <h1>Journal</h1>
      <p className="muted">
        {streak > 0 ? `${streak}-day streak` : 'Start a streak today'} · {wordsToday} words today
      </p>
      {err && <p className="err">{err}</p>}

      <div className="card">
        {topic ? (
          <div className="row" style={{ marginTop: 0, justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{topic.title}</span>
            <button className="btn sm" onClick={() => { setTopic(null); setAssignmentId(null); }}>Change</button>
          </div>
        ) : (
          <>
            <input placeholder="Search a topic" value={search} onChange={e => setSearch(e.target.value)} />
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
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 0 }}>
          <span className="muted">{words} word{words === 1 ? '' : 's'}</span>
          <span className="muted">goal {goal}</span>
        </div>
        <div className="bar"><span style={{ width: `${pct}%` }} /></div>
        {draftNote && <p className="muted" style={{ marginTop: 6 }}>{draftNote}</p>}

        <h2>Key points</h2>
        <textarea
          value={points}
          onChange={e => setPoints(e.target.value)}
          placeholder="One per line."
          style={{ minHeight: 72 }}
        />

        <h2>Tags</h2>
        <input
          value={tagText}
          onChange={e => setTagText(e.target.value)}
          placeholder="e.g. memory, exam prep, bias"
        />
        <p className="muted" style={{ marginTop: -6 }}>Separate tags with commas. Up to eight.</p>

        <h2>Confidence</h2>
        <div className="seg">
          {[0, 1, 2, 3, 4, 5].map(n => (
            <button key={n} className={conf === n ? 'on' : ''} onClick={() => setConf(n)}>{n}</button>
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
      </div>

      <h2>Memory</h2>
      <input placeholder="Search your memory: topic, words or tag" value={memorySearch}
        onChange={e => setMemorySearch(e.target.value)} />
      {memoryList.length === 0 && (
        <p className="muted">{entries.length === 0 ? 'Nothing saved yet.' : 'No entries match that search.'}</p>
      )}
      {memoryList.map(e => (
        <div key={e.id} className="entry" onClick={() => setOpen(open?.id === e.id ? null : e)}>
          <div>{e.topics?.title ?? 'Removed topic'}</div>
          <div className="muted">
            {prettyDate(e.created_at.slice(0, 10))} · confidence {e.confidence ?? '-'} · {e.word_count ?? 0} words
          </div>
          {e.tags?.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {e.tags.map(t => <span key={t} className="tag">{t}</span>)}
            </div>
          )}
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
                <button className="btn sm danger" onClick={() => removeEntry(e)}>Delete</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
