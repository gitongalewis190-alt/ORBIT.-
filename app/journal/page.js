'use client';
import FullEditor from '../../components/FullEditor';
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

const CONFIDENCE_WORD = ['Blank', 'Barely', 'Shaky', 'Partial', 'Solid', 'Mastered'];
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
  const [pendingDelete, setPendingDelete] = useState(null);
  useEffect(() => { setBenefitIds(readBenefits()); }, []);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [savedKind, setSavedKind] = useState('');
  const [err, setErr] = useState('');
  const [streak, setStreak] = useState(0);
  const [wordsToday, setWordsToday] = useState(0);
  const [draftNote, setDraftNote] = useState('');

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
      if (params.get('synthesis') === '1') {
        const prompt = params.get('prompt');
        if (prompt) {
          setBody(prompt + '\n\n');
          setMode('reflect');
          toast('Bridge loaded. Reflect on the connection.', 'info');
        }
      }

      await load(id, p);
      const { data: tp, error } = await fetchAllTopics();
      if (!error) {
        setTopics(tp.map(t => ({
          id: t.id,
          title: t.title,
          field: t.subfields?.fields?.name ?? '',
          fieldId: t.subfields?.field_id ?? '',
          section: t.subfields?.name ?? '',
        })));
      }
    });
  }, []);

  // Autosave the draft on this phone as you type.
  useEffect(() => {
    if (!uid) return;
    if (!body && !points && !tagText && conf === null && !mins) return;
    saveDraft(uid, { body, points, tagText, conf, mins, font });
  }, [uid, body, points, tagText, conf, mins, font]);

  async function load(id, p = profile) {
    const { data, error } = await supabase.from('journal_entries')
      .select('id,topic_id,body,key_points,confidence,minutes_spent,word_count,tags,created_at,entry_kind,research_entry_id,editor_font,topics(title,subfields(field_id))')
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

  // The entry before or after this one in the memory list, for the editor's Previous and Next buttons.
  function neighbour(step, e) {
    const list = filtered;
    const i = list.findIndex(x => x.id === e.id);
    if (i < 0) return null;
    const n = list[i + step];
    return n || null;
  }

  async function saveEdit(entry, text) {
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

      <TopicPicker topics={topics} value={topic} onChange={setTopic} />

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

      <input type="number" value={mins} onChange={e => setMins(e.target.value)} placeholder="Minutes spent" />

      <div className="row">
        <button className="btn accent" onClick={save} disabled={busy}>
          {busy ? 'Saving' : 'Save'}
        </button>
        <span className="muted">{words} words · {pct}%</span>
      </div>

      <h2>Memory</h2>
      <input value={memorySearch} onChange={e => setMemorySearch(e.target.value)} placeholder="Search entries" />

      {filtered.map(e => (
        <div key={e.id} className="card">
          <div className="muted">{e.topics?.title || 'No topic'} · {prettyDate(e.created_at?.slice(0, 10))}</div>
          <div dangerouslySetInnerHTML={{ __html: renderRich(e.body) }} />
          <div className="row">
            <button className="btn sm" onClick={() => setEditing(e)}>Edit</button>
            <button className="btn sm" onClick={() => relearn(e)}>Review again</button>
            <button className="btn sm danger" onClick={() => setPendingDelete(e)}>Delete</button>
          </div>
        </div>
      ))}

      {editing && (
        <FullEditor
          entry={editing}
          onSave={saveEdit}
          onClose={() => setEditing(null)}
          neighbour={neighbour}
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
