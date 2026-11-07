'use client';
import FullEditor from '../../components/FullEditor';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
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
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const id = data.user.id;
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
    try {
      const { next, fresh } = await commitEntry(uid, payload);
      play(fresh.length ? 'badge' : 'save');
      toast(`Saved. Next review ${prettyDate(next.due_on)}.`, 'ok');
      finishSave();
      queueAutoBackup(uid);
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
    toast('Added to today’s reviews.', 'info');
  }

  // The entry before or after this one in the memory list, for the editor's Previous and Next buttons.
  function neighbour(step, e) {
    const i = memory.findIndex(x => x.id === e.id);
    const target = i < 0 ? null : memory[i + step];
    if (!target) return null;
    return () => { setOpen(target); setEditing(target.id); };
  }

  // Saves an edit to a published entry. The change is recorded in the log.
  async function saveEdit(entry, text) {
    const body = text.trim();
    const words = body.split(/\s+/).filter(Boolean).length;
    if (words < 1) { play('error'); return toast('An entry cannot be empty.', 'err'); }
    const { error } = await supabase.from('journal_entries')
      .update({ body, word_count: words }).eq('id', entry.id).eq('user_id', uid);
    if (error) { play('error'); return toast(error.message, 'err'); }
    await logDecision(uid, 'entry_edited', entry.topic_id, { words });
    play('save');
    toast('Entry updated.', 'ok');
    setEditing(null);
    load(uid, profile);
  }

  function removeEntry(entry) {
    setPendingDelete(entry);
  }

  async function confirmRemove() {
    const entry = pendingDelete;
    if (!entry) return;
    const { error } = await supabase.from('journal_entries').delete().eq('id', entry.id);
    if (error) { play('error'); return toast(error.message, 'err'); }
    await logDecision(uid, 'entry_deleted', entry.topic_id, { words: entry.word_count });
    play('trash');
    toast('Entry deleted.', 'info');
    setPendingDelete(null);
    setOpen(null);
    load(uid, profile);
  }

  const matches = e => {
    const q = memorySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (e.topics?.title || '').toLowerCase().includes(q) ||
      (e.body || '').toLowerCase().includes(q) ||
      (e.tags || []).some(t => t.includes(q.replace(/\s+/g, '-')))
    );
  };

  // Memory: research entries as cards, each with its reflections nested beneath it.
  // A reflection with no research to group under is shown on its own.
  const memory = entries.filter(matches);
  const researchCards = memory.filter(e => e.entry_kind !== 'reflection');
  const reflections = memory.filter(e => e.entry_kind === 'reflection');
  const grouped = id => reflections.filter(r => r.research_entry_id === id);
  const researchIds = new Set(researchCards.map(e => e.id));
  const orphans = reflections.filter(r => !r.research_entry_id || !researchIds.has(r.research_entry_id));

  function EntryBody({ e }) {
    return (
      <div
        className={`rich-view ${FONT_CLASS[e.editor_font] ?? ''}`}
        dangerouslySetInnerHTML={{ __html: renderRich(e.body) }}
      />
    );
  }

  function Expanded({ e }) {
    const actions = e.entry_kind === 'reflection' ? (
      <div className="entry-actions">
        <button className="btn" onClick={() => setEditing(e.id)}>Edit</button>
        <button className="btn danger" onClick={() => removeEntry(e)}>Delete reflection</button>
      </div>
    ) : (
      <div className="entry-actions">
        <button className="btn" onClick={() => setEditing(e.id)}>Edit</button>
        <button className="btn accent" onClick={() => relearn(e)}>Re-learn now</button>
        <button className="btn danger" onClick={() => removeEntry(e)}>Delete</button>
      </div>
    );
    return (
      <div className="fade-in" style={{ marginTop: 10 }} onClick={ev => ev.stopPropagation()}>
        {actions}
        <EntryBody e={e} />
        {editing === e.id && (
          <FullEditor
            title={e.topics?.title ?? 'Entry'}
            value={e.body}
            onSave={text => saveEdit(e, text)}
            onClose={() => setEditing(null)}
            onPrev={neighbour(-1, e)}
            onNext={neighbour(1, e)}
          />
        )}
        {e.key_points?.length > 0 && (
          <ul style={{ paddingLeft: 18, fontSize: 14, lineHeight: 1.5 }}>
            {e.key_points.map((k, i) => <li key={i}>{k}</li>)}
          </ul>
        )}
      </div>
    );
  }

  const dayOf = iso => prettyDate(String(iso).slice(0, 10));

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
          <TopicPicker topics={topics} onPick={t => { setTopic(t); }} />
        )}

        <div className="seg" style={{ marginBottom: 10 }} role="tablist" aria-label="Journal mode">
          <button role="tab" aria-selected={!isReflect} className={!isReflect ? 'on' : ''} onClick={() => setMode('learn')}>Learn</button>
          <button role="tab" aria-selected={isReflect} className={isReflect ? 'on' : ''} onClick={() => setMode('reflect')}>Reflect</button>
        </div>

        {isReflect && topic && (
          linkedResearch ? (
            <p className="notice" role="status">
              Grouped with your research on this topic from {dayOf(linkedResearch.created_at)}.
            </p>
          ) : (
            <p className="muted" style={{ marginTop: 0 }}>
              No research on this topic yet. This reflection will stand on its own.
            </p>
          )
        )}

        {isReflect && (
          <div className="prompt-list">
            {[...REFLECT_PROMPTS, ...(benefitIds.includes('reflection_prompts') ? EXTRA_PROMPTS : [])].map(prompt => (
              <button key={prompt} className="prompt" onClick={() => setBody(b => (b ? `${b}\n\n` : '') + prompt + '\n')}>
                {prompt}
              </button>
            ))}
          </div>
        )}
        <h2>{isReflect ? 'Reflection' : 'What I learned'}</h2>
        <RichEditor
          value={body}
          onChange={setBody}
          font={font}
          onFont={setFont}
          label="Formatting"
          placeholder="Explain it in your own words."
          minHeight={260}
        />
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 0 }}>
          <span className="muted">{words} word{words === 1 ? '' : 's'}</span>
          <span className="muted">goal {goal}{assistPrefs().pace && averageWords(entries) ? ` · usual ${averageWords(entries)}` : ''}</span>
        </div>
        <div className="bar"><span style={{ width: `${pct}%` }} /></div>
        {assistPrefs().suggestions && assistPrefs().pace && words > 0 && averageWords(entries) && words < averageWords(entries) * 0.6 && (
          <p className="muted" style={{ marginTop: 6 }}>Shorter than your usual length.</p>
        )}
        {assistPrefs().suggestions && nextAdvice(entries) && (
          <p className="muted" style={{ marginTop: 6 }}>{nextAdvice(entries)}</p>
        )}
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
            {busy ? 'Saving' : isReflect ? 'Save reflection' : 'Save entry'}
          </button>
        </div>
      </div>

      <h2>Memory</h2>
      {assistPrefs().ask && (
        <AssistAsk
          entries={entries}
          onOpen={hit => {
            const found = entries.find(e => e.id === hit.id);
            if (found) setOpen(found);
          }}
          text={body}
          onUse={(next, kind) => {
            if (kind === 'points') setPoints(next);
            else setBody(next);
          }}
          onReview={topicId => {
            const found = entries.find(e => e.topic_id === topicId);
            if (found) relearn(found);
          }}
        />
      )}
      <input placeholder="Search your memory: topic, words or tag" value={memorySearch}
        onChange={e => setMemorySearch(e.target.value)} />
      {memory.length === 0 && (
        <p className="muted">{entries.length === 0 ? 'Nothing saved yet.' : 'No entries match that search.'}</p>
      )}

      {researchCards.map(e => {
        const children = grouped(e.id);
        return (
          <div key={e.id} className="entry entry-card" style={{ borderLeft: `4px solid ${fieldColor(e.topics?.subfields?.field_id)}` }} onClick={() => setOpen(open?.id === e.id ? null : e)}>
            <div>{e.topics?.title ?? 'Removed topic'}</div>
            <div className="muted">
              Research · {dayOf(e.created_at)} · confidence {e.confidence ?? '-'} · {e.word_count ?? 0} words
            </div>
            {e.tags?.length > 0 && (
              <div style={{ marginTop: 4 }}>
                {e.tags.map(t => <span key={t} className="tag">{t}</span>)}
              </div>
            )}
            {children.length > 0 && (
              <div className="reflection-group" aria-label="Reflections on this research">
                <div className="kicker" style={{ marginTop: 8 }}>Reflections · {children.length}</div>
                {children.map(r => (
                  <div key={r.id} className="reflection-item" onClick={ev => { ev.stopPropagation(); setOpen(open?.id === r.id ? null : r); }}>
                    <span>{dayOf(r.created_at)} · confidence {r.confidence ?? '-'}</span>
                    {open?.id === r.id && <Expanded e={r} />}
                  </div>
                ))}
              </div>
            )}
            {open?.id === e.id && <Expanded e={e} />}
          </div>
        );
      })}

      {orphans.map(e => (
        <div key={e.id} className="entry entry-card" style={{ borderLeft: `4px solid ${fieldColor(e.topics?.subfields?.field_id)}` }} onClick={() => setOpen(open?.id === e.id ? null : e)}>
          <div>{e.topics?.title ?? 'Removed topic'}</div>
          <div className="muted">
            Reflection · {dayOf(e.created_at)} · confidence {e.confidence ?? '-'} · {e.word_count ?? 0} words
          </div>
          {open?.id === e.id && <Expanded e={e} />}
        </div>
      ))}
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
