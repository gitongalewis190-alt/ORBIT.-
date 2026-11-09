'use client';
import FullEditor from '../../components/FullEditor';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { currentUser } from '../../lib/session';
import { today, prettyDate } from '../../lib/dates';
import { play } from '../../lib/sound';
import { toast } from '../../lib/toast';
import { fetchAllTopics } from '../../lib/context';
import { getProfile } from '../../lib/profile';
import { wordCount, loadStats, pageOf } from '../../lib/stats';
import { commitEntry } from '../../lib/journal';
import { enqueue, isNetworkError, loadDraft, saveDraft, clearDraft } from '../../lib/offline';
import { logDecision } from '../../lib/log';
import { fieldColor, REFLECT_PROMPTS, EXTRA_PROMPTS } from '../../lib/palette';
import { readBenefits } from '../../lib/benefits';
import { renderRich, plainText } from '../../lib/richtext';
import TopicPicker from '../../components/TopicPicker';
import RichEditor from '../../components/RichEditor';
import AssistAsk from '../../components/AssistAsk';
import ConfirmDialog from '../../components/ConfirmDialog';
import { averageWords, assistPrefs, nextAdvice } from '../../lib/assist';
import { queueAutoBackup } from '../../lib/backupSync';
import { scheduleAtlas } from '../../lib/atlas/repository';
import { RelatedStrip } from '../../components/MenuDrawer';
import { ruleFor, blockFor, noteFor, kindChangeBlock } from '../../lib/topicRules';

const CONFIDENCE_WORD = ['Blank', 'Barely', 'Shaky', 'Partial', 'Solid', 'Mastered'];
const PREVIEW_CHARS = 220;
const FONT_CLASS = { serif: 'f-serif', mono: 'f-mono' };

const parseTags = text =>
  [...new Set(text.split(',').map(t => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean))].slice(0, 8);

// Learn writes research. Reflect writes a reflection, which belongs to the research on the same topic.
export default function Journal() {
  const [uid, setUid] = useState(null);
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [topics, setTopics] = useState([]);
  const [memorySearch, setMemorySearch] = useState('');
  const [topic, setTopic] = useState(null);
  const [assignmentId, setAssignmentId] = useState(null);
  const [body, setBody] = useState('');
  const [font, setFont] = useState('sans');
  const [points, setPoints] = useState('');
  const [tagText, setTagText] = useState('');
  const [conf, setConf] = useState(null);
  const [mins, setMins] = useState('');
  const [open, setOpen] = useState(null);
  const [mode, setMode] = useState('learn');
  const [benefitIds, setBenefitIds] = useState([]);
  const [editing, setEditing] = useState(null);
  const [openIds, setOpenIds] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);
  useEffect(() => { setBenefitIds(readBenefits()); }, []);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [savedKind, setSavedKind] = useState('');
  const [err, setErr] = useState('');
  const [streak, setStreak] = useState(0);
  const [wordsToday, setWordsToday] = useState(0);
  const [draftNote, setDraftNote] = useState('');
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicsErr, setTopicsErr] = useState('');
  const [learned, setLearned] = useState(new Set());
  const [timerSec, setTimerSec] = useState(0);
  const [timerRun, setTimerRun] = useState(false);
  const tickRef = useRef(null);
  useEffect(() => {
    if (!timerRun) return undefined;
    tickRef.current = setInterval(() => setTimerSec(s => s + 1), 1000);
    return () => clearInterval(tickRef.current);
  }, [timerRun]);
  const clock = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  async function useTimer() {
    const m = Math.max(1, Math.round(timerSec / 60));
    setMins(String(m));
    setTimerRun(false);
    setTimerSec(0);
    // Reflection minutes are recorded for the swap trade-offs. They do not change the Learn ring.
    if (isReflect && uid) {
      await logDecision(uid, 'reflect_focus', topic?.id ?? null, { minutes: m });
      await loadReflectToday(uid);
    }
    toast(`${m} min added to Minutes spent.`, 'ok');
  }
  const [due, setDue] = useState(new Set());
  const [confirmTimer, setConfirmTimer] = useState(false); // false | 'start' | 'resume'
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [reflectToday, setReflectToday] = useState([]);
  const [pendingReflectRevoke, setPendingReflectRevoke] = useState(null);

  // Today's reflection minutes, so a mistaken one can be revoked.
  async function loadReflectToday(id) {
    if (!id) return;
    const { data } = await supabase.from('decision_log').select('id,payload,created_at')
      .eq('user_id', id).eq('event', 'reflect_focus')
      .gte('created_at', `${today()}T00:00:00+03:00`).order('created_at');
    setReflectToday(data ?? []);
  }

  function discardTimer() {
    setTimerRun(false);
    setTimerSec(0);
    setConfirmDiscard(false);
    play('close');
    toast('Timer discarded. Nothing was logged.', 'info');
  }

  async function revokeReflect(row) {
    if (!uid) return;
    try {
      const { error } = await supabase.from('decision_log').delete().eq('id', row.id).eq('user_id', uid);
      if (error) throw error;
      play('close');
      toast(`Revoked ${row.payload?.minutes ?? 0} reflection min.`, 'info', 4200);
      await loadReflectToday(uid);
    } catch (e) {
      play('error');
      toast(`Could not revoke: ${e.message}`, 'err', 5000);
    } finally {
      setPendingReflectRevoke(null);
    }
  }

  const words = useMemo(() => wordCount(plainText(body)), [body]);
  const goal = profile?.word_goal ?? 150;
  const pct = Math.min(100, Math.round((words / goal) * 100));
  const isReflect = mode === 'reflect';

  // The research written on the chosen topic, which a reflection is grouped under.
  const researchFor = topicId => entries.find(e => e.topic_id === topicId && e.entry_kind !== 'reflection') ?? null;
  const linkedResearch = isReflect && topic ? researchFor(topic.id) : null;

  useEffect(() => {
    currentUser().then(async (user) => {
      if (!user) return;
      const id = user.id;
      setUid(id);
      loadReflectToday(id);
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
        setFont(draft.font || 'sans');
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
      // A trade-off opens the reflection with its topic and mode already set.
      const wantMode = params.get('mode');
      if (wantMode === 'reflect' || wantMode === 'learn') setMode(wantMode);
      if (params.get('synthesis') === '1') {
        const prompt = params.get('prompt');
        if (prompt) {
          setBody(prompt + '\n\n');
          setMode('reflect');
          toast('Bridge loaded. Reflect on the connection.', 'info');
        }
      }

      await load(id, p);
    }).catch(e => setErr(e?.message || 'Could not load your journal.'));
  }, []);

  // The topic library loads on its own, so a failure elsewhere can never leave the picker empty.
  async function loadTopics() {
    setTopicsLoading(true);
    setTopicsErr('');
    try {
      const { data: tp, error } = await fetchAllTopics();
      if (error) throw error;
      setTopics((tp ?? []).map(t => ({
        id: t.id,
        title: t.title,
        field: t.subfields?.fields?.name ?? '',
        fieldId: t.subfields?.field_id ?? '',
        section: t.subfields?.name ?? '',
      })));
    } catch (e) {
      setTopicsErr(e?.message || 'check your connection, then try again.');
    } finally {
      setTopicsLoading(false);
    }
  }

  useEffect(() => { loadTopics(); }, []);

  // Autosave the draft on this phone as you type.
  useEffect(() => {
    if (!uid) return;
    if (!body && !points && !tagText && conf === null && !mins) return;
    saveDraft(uid, { body, points, tagText, conf, mins, font });
  }, [uid, body, points, tagText, conf, mins, font]);

  // Every topic you have learned (Learn entries), and every topic whose review is due.
  async function fetchLearnedAndDue(id) {
    const learnedIds = new Set();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('journal_entries').select('topic_id')
        .eq('user_id', id).eq('entry_kind', 'research').order('id').range(from, from + 999);
      if (error) throw error;
      for (const r of data) if (r.topic_id) learnedIds.add(r.topic_id);
      if (data.length < 1000) break;
    }
    const { data: dueRows, error: dErr } = await supabase.from('reviews').select('topic_id')
      .eq('user_id', id).lte('due_on', today());
    if (dErr) throw dErr;
    return { learned: learnedIds, due: new Set((dueRows ?? []).map(r => r.topic_id)) };
  }

  async function load(id, p = profile) {
    const { data, error } = await pageOf(() => supabase.from('journal_entries')
      .select('id,topic_id,body,key_points,confidence,minutes_spent,word_count,tags,created_at,entry_kind,research_entry_id,editor_font,topics(title,subfields(field_id))')
      .eq('user_id', id).order('created_at', { ascending: false }).order('id'));
    if (error) return setErr(error.message);
    setErr('');
    setEntries(data ?? []);
    try {
      const st = await fetchLearnedAndDue(id);
      setLearned(st.learned);
      setDue(st.due);
    } catch (e) {
      setErr(e.message || 'Could not load what you have learned.');
    }
    if (p) {
      try {
        const s = await loadStats(id, p);
        setStreak(s.streak);
        setWordsToday(s.wordsToday);
      } catch {
        // The streak is a summary. A failure here should not hide the entries.
      }
    }
  }

  // Choosing a topic sets the mode to match it: a learned topic goes to Reflect, a new one to Learn.
  function pickTopic(t) {
    setTopic(t);
    if (t) setMode(ruleFor(t.id, { learned, due }).mode);
  }

  function statusOf(t) {
    const r = ruleFor(t.id, { learned, due });
    return r.due ? 'Due for review' : r.learned ? 'Learned' : 'New';
  }

  function validate() {
    if (!topic) return 'Choose a topic first: search its name and tap it in the list.';
    const block = blockFor(isReflect ? 'reflect' : 'learn', ruleFor(topic.id, { learned, due }));
    if (block) return block;
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
      entry_kind: isReflect ? 'reflection' : 'research',
      research_entry_id: linkedResearch?.id ?? null,
      editor_font: font,
      created_at: new Date().toISOString(),
    };

    setBusy(true);
    setPhase('saving');
    const kind = isReflect ? 'reflection' : 'entry';
    try {
      const { next, fresh } = await commitEntry(uid, payload);
      play(fresh.length ? 'badge' : 'save');
      toast(`Saved. Next review ${prettyDate(next.due_on)}.`, 'ok');
      scheduleAtlas(uid, payload.id);
      finishSave();
      setSavedKind(kind);
      setPhase('saved');
      queueAutoBackup(uid);
      await load(uid, profile);
    } catch (e) {
      if (isNetworkError(e)) {
        // No connection: keep the finished entry on the phone and sync it later.
        enqueue(uid, { payload, queuedAt: Date.now() });
        play('save');
        toast('Saved on this phone. It will sync when you are back online.', 'warn', 4500);
        finishSave();
        setSavedKind(kind);
        setPhase('saved');
      } else {
        play('error');
        setPhase('idle');
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
    toast('Added to today’s reviews.', 'info');
  }

  // Previous and Next inside the editor move through the entries currently listed.
  function neighbourJump(step) {
    if (!editing) return null;
    const i = filtered.findIndex(x => x.id === editing.id);
    if (i < 0) return null;
    const n = filtered[i + step];
    return n ? () => setEditing(n) : null;
  }

  async function saveEdit(entry, text) {
    if (!entry?.id || !uid) { play('error'); return toast('Could not find this entry. Close and try again.', 'err'); }
    const { error } = await supabase.from('journal_entries').update({
      body: text,
      word_count: wordCount(plainText(text)),
    }).eq('id', entry.id).eq('user_id', uid);
    if (error) { play('error'); return toast(error.message, 'err'); }
    play('save');
    toast('Updated.', 'ok');
    setEditing(null);
    await load(uid);
  }

  async function confirmRemove() {
    const entry = pendingDelete;
    setPendingDelete(null);
    if (!entry) return;
    const { error } = await supabase.from('journal_entries').delete().eq('id', entry.id).eq('user_id', uid);
    if (error) { play('error'); return toast(error.message, 'err'); }
    play('warn');
    toast('Entry deleted.', 'info');
    if (editing?.id === entry.id) setEditing(null);
    await load(uid);
  }

  // Moves an entry between Learn and Reflect, so a reflection saved as Learn can be put right.
  async function flipKind(entry) {
    const next = entry.entry_kind === 'reflection' ? 'research' : 'reflection';
    try {
      const { data: others, error: oErr } = await supabase.from('journal_entries').select('id')
        .eq('user_id', uid).eq('topic_id', entry.topic_id).eq('entry_kind', 'research')
        .neq('id', entry.id).limit(1);
      if (oErr) throw oErr;
      const block = kindChangeBlock(next, { otherResearch: others.length, due: due.has(entry.topic_id) });
      if (block) { play('error'); return toast(block, 'err', 5000); }
      const patch = next === 'reflection'
        ? { entry_kind: 'reflection', research_entry_id: others[0].id }
        : { entry_kind: 'research', research_entry_id: null };
      const { error } = await supabase.from('journal_entries').update(patch).eq('id', entry.id).eq('user_id', uid);
      if (error) throw error;
      play('save');
      toast(next === 'reflection' ? 'Moved to Reflect. Today’s rings are updated.' : 'Moved to Learn. Today’s rings are updated.', 'ok');
      await load(uid);
    } catch (e) {
      play('error');
      toast(e.message, 'err', 5000);
    }
  }

  const filtered = entries.filter(e => {
    if (!memorySearch.trim()) return true;
    const q = memorySearch.toLowerCase();
    return (e.body || '').toLowerCase().includes(q)
      || (e.key_points || []).some(p => p.toLowerCase().includes(q))
      || (e.topics?.title || '').toLowerCase().includes(q)
      || (e.tags || []).some(t => t.includes(q));
  });

  return (
    <div className="fade-in">
      <h1>Journal</h1>
      <RelatedStrip ids={['review-now', 'recall-quiz', 'attention', 'assist-settings', 'topics']} />
      {err && <p className="err">{err}</p>}
      {draftNote && <p className="muted">{draftNote}</p>}

      <div className="seg">
        <button type="button" className={mode === 'learn' ? 'on' : ''} onClick={() => setMode('learn')}>Learn</button>
        <button type="button" className={mode === 'reflect' ? 'on' : ''} onClick={() => setMode('reflect')}>Reflect</button>
      </div>

      <TopicPicker
        topics={topics}
        value={topic}
        onPick={pickTopic}
        statusOf={statusOf}
        loading={topicsLoading}
        error={topicsErr}
        onRetry={loadTopics}
      />
      {topic && blockFor(mode, ruleFor(topic.id, { learned, due })) && (
        <p role="alert" className="err" style={{ marginTop: 6 }}>{blockFor(mode, ruleFor(topic.id, { learned, due }))}</p>
      )}
      {topic && noteFor(mode, ruleFor(topic.id, { learned, due })) && (
        <p className="muted" style={{ marginTop: 6 }}>{noteFor(mode, ruleFor(topic.id, { learned, due }))}</p>
      )}

      <RichEditor
        value={body}
        onChange={setBody}
        font={font}
        onFont={setFont}
        placeholder={isReflect ? 'What did this make you think?' : 'Explain it in your own words.'}
      />

      <input value={points} onChange={e => setPoints(e.target.value)} placeholder="Key points, one per line" />
      <input value={tagText} onChange={e => setTagText(e.target.value)} placeholder="Tags, comma separated" />

      <div className="row">
        {CONFIDENCE_WORD.map((w, i) => (
          <button key={i} type="button" className={conf === i ? 'chip on' : 'chip'} onClick={() => setConf(i)}>{w}</button>
        ))}
      </div>

      <div className="timer-block" style={{ marginTop: 8 }}>
        <div className="kicker">{isReflect ? 'Reflection timer' : 'Learning timer'}</div>
        <p className="muted" style={{ margin: '4px 0 8px', lineHeight: 1.5 }}>
          {isReflect
            ? 'Counts reflection minutes toward your swap trade-offs. It does not change the Learn ring.'
            : 'Fills Minutes spent when you save this entry.'}
        </p>
        <div className="row">
          {!timerRun && timerSec === 0 && (
            <button type="button" className="btn sm accent" onClick={() => setConfirmTimer('start')}>
              {isReflect ? 'Start reflection timer' : 'Start learning timer'}
            </button>
          )}
          {timerRun && <button type="button" className="btn sm" onClick={() => setTimerRun(false)}>Pause timer</button>}
          {!timerRun && timerSec > 0 && <button type="button" className="btn sm accent" onClick={() => setConfirmTimer('resume')}>Resume timer</button>}
          <span className="muted" aria-live="off">{clock(timerSec)}</span>
          {timerSec > 0 && !timerRun && <button type="button" className="btn sm" onClick={useTimer}>Use this time</button>}
          {timerSec > 0 && <button type="button" className="btn sm danger" onClick={() => setConfirmDiscard(true)}>Discard timer</button>}
        </div>
        {isReflect && reflectToday.length > 0 && (
          <div className="timer-log" style={{ marginTop: 10 }}>
            <div className="kicker">Reflection minutes logged today</div>
            {reflectToday.map(row => (
              <div key={row.id} className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <span>{row.payload?.minutes ?? 0} min</span>
                <button type="button" className="btn sm danger" onClick={() => setPendingReflectRevoke(row)}>Revoke</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmTimer}
        title={confirmTimer === 'resume' ? 'Resume the timer?' : `Start the ${isReflect ? 'reflection' : 'learning'} timer?`}
        confirmLabel="Agree and continue"
        onCancel={() => setConfirmTimer(false)}
        onConfirm={() => { setConfirmTimer(false); setTimerRun(true); }}
      >
        <p style={{ margin: 0 }}>
          {isReflect
            ? 'When you use this time, it is logged as reflection minutes for your swap trade-offs.'
            : 'When you save, these minutes are added to Minutes spent on this entry.'}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard this timer?"
        confirmLabel="Discard"
        danger
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={discardTimer}
      >
        <p style={{ margin: 0 }}>The time on the clock will not be logged. This cannot be undone.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!pendingReflectRevoke}
        title="Revoke these reflection minutes?"
        confirmLabel="Revoke"
        danger
        onCancel={() => setPendingReflectRevoke(null)}
        onConfirm={() => revokeReflect(pendingReflectRevoke)}
      >
        <p style={{ margin: 0 }}>
          {pendingReflectRevoke ? `${pendingReflectRevoke.payload?.minutes ?? 0} minutes` : ''} will be removed from your swap trade-offs for today.
        </p>
      </ConfirmDialog>

      <input type="number" value={mins} onChange={e => setMins(e.target.value)} placeholder="Minutes spent" />

      <div className="row">
        <button className="btn accent" onClick={save} disabled={busy}>
          {busy ? 'Saving' : 'Save'}
        </button>
        <span className="muted">{words} words · {pct}%</span>
      </div>

      <h2>Memory</h2>
      <input value={memorySearch} onChange={e => setMemorySearch(e.target.value)} placeholder="Search entries" />

      {filtered.map(e => {
        const full = plainText(e.body || '');
        const long = full.length > PREVIEW_CHARS;
        const expanded = !!openIds[e.id];
        const shown = long && !expanded ? full.slice(0, PREVIEW_CHARS).trimEnd() + '…' : null;
        return (
          <div key={e.id} className="card">
            <div className="muted">{e.topics?.title || 'No topic'} · {prettyDate(e.created_at?.slice(0, 10))}</div>
            {shown !== null
              ? <p className="entry-preview">{shown}</p>
              : <div dangerouslySetInnerHTML={{ __html: renderRich(e.body) }} />}
            <div className="row">
              {long && (
                <button className="btn sm" aria-expanded={expanded}
                  onClick={() => setOpenIds(s => ({ ...s, [e.id]: !s[e.id] }))}>
                  {expanded ? 'Show less' : 'Read full entry'}
                </button>
              )}
              <button className="btn sm" onClick={() => setEditing(e)}>Edit</button>
              <button className="btn sm" onClick={() => flipKind(e)}>{e.entry_kind === 'reflection' ? 'Make it Learn' : 'Make it Reflect'}</button>
              <button className="btn sm" onClick={() => relearn(e)}>Review again</button>
              <button className="btn sm danger" onClick={() => setPendingDelete(e)}>Delete</button>
            </div>
          </div>
        );
      })}

      {editing && (
        <FullEditor
          key={editing.id}
          title={`${editing.topics?.title || 'No topic'} · ${prettyDate(editing.created_at?.slice(0, 10))}`}
          value={editing.body || ''}
          onSave={text => saveEdit(editing, text)}
          onClose={() => setEditing(null)}
          onPrev={neighbourJump(-1)}
          onNext={neighbourJump(1)}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this entry?"
        danger
        confirmLabel="Delete entry"
        onConfirm={confirmRemove}
        onCancel={() => setPendingDelete(null)}
      >
        <p style={{ marginTop: 0 }}>This cannot be undone. The rest of your journal stays.</p>
      </ConfirmDialog>
    </div>
  );
}
