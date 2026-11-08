'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { currentUser } from '../../lib/session';
import { logDecision } from '../../lib/log';
import { play } from '../../lib/sound';
import { toast } from '../../lib/toast';
import { fetchAllTopics } from '../../lib/context';
import { fieldColor } from '../../lib/palette';
import { searchTopics, highlightSegments } from '../../lib/search';
import Skeleton from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import BackLink from '../../components/BackLink';
import { RelatedStrip } from '../../components/MenuDrawer';

const MARKS = [
  ['all', 'All'],
  ['show_more', 'More'],
  ['show_less', 'Less'],
  ['archived', 'Archived'],
  ['removed', 'Removed'],
];
const MARK_LABEL = { normal: 'Normal', show_more: 'More', show_less: 'Less', archived: 'Archived', removed: 'Removed' };
const SORTS = [['relevance', 'Best match'], ['az', 'A to Z'], ['field', 'By field'], ['level', 'By level']];
const LEVEL_RANK = { beginner: 0, intermediate: 1, advanced: 2 };
const PAGE = 60;
const NEW_SECTION = '__new__';

// Renders text with matched words highlighted.
function Highlighted({ text, query }) {
  return highlightSegments(text, query).map((seg, i) =>
    seg.hit ? <mark key={i} className="hit">{seg.text}</mark> : <span key={i}>{seg.text}</span>
  );
}

export default function Topics() {
  const [uid, setUid] = useState(null);
  const [topics, setTopics] = useState(null);
  const [controls, setControls] = useState({});
  const [subs, setSubs] = useState([]);
  const [fields, setFields] = useState([]);
  const [err, setErr] = useState('');

  const [q, setQ] = useState('');
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('q');
    if (initial) setQ(initial);
  }, []);
  const [mark, setMark] = useState('all');
  const [fieldFilter, setFieldFilter] = useState('all');
  const [level, setLevel] = useState('all');
  const [sort, setSort] = useState('relevance');
  const [page, setPage] = useState(PAGE);
  const [openTopic, setOpenTopic] = useState(null);
  const [pendingTopic, setPendingTopic] = useState(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkSub, setBulkSub] = useState('');
  const [bulkDiff, setBulkDiff] = useState('intermediate');
  const [newSecName, setNewSecName] = useState('');
  const [newSecField, setNewSecField] = useState('');

  useEffect(() => {
    currentUser().then((user) => {
      if (!user) return;
      setUid(user.id);
      loadAll(user.id);
    });
  }, []);

  async function loadAll(id) {
    const [t, c, s, f] = await Promise.all([
      fetchAllTopics(),
      supabase.from('topic_controls').select('topic_id,state').eq('user_id', id),
      supabase.from('subfields').select('id,name,user_id,fields(name)').order('id'),
      supabase.from('fields').select('id,name').order('id'),
    ]);
    const failed = t.error || c.error || s.error || f.error;
    if (failed) {
      setErr(failed.message);
      play('error');
      return;
    }
    setTopics(t.data.map(r => ({
      id: r.id,
      title: r.title,
      difficulty: r.difficulty,
      userId: r.user_id,
      fieldId: r.subfields?.field_id ?? '',
      field: r.subfields?.fields?.name ?? '',
      section: r.subfields?.name ?? '',
    })));
    setControls(Object.fromEntries((c.data ?? []).map(r => [r.topic_id, r.state])));
    setSubs(s.data ?? []);
    setFields(f.data ?? []);
    setErr('');
  }

  const markOf = id => controls[id] ?? 'normal';

  const counts = useMemo(() => {
    const all = topics ?? [];
    const byMark = Object.fromEntries(MARKS.map(([v]) => [v, 0]));
    byMark.all = all.filter(t => markOf(t.id) !== 'removed').length;
    for (const t of all) {
      const m = markOf(t.id);
      if (m in byMark) byMark[m] += 1;
    }
    const byField = new Map();
    for (const t of all) {
      if (markOf(t.id) === 'removed') continue;
      byField.set(t.fieldId, (byField.get(t.fieldId) ?? 0) + 1);
    }
    return { byMark, byField };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, controls]);

  // Filter by mark, field and level first, then search, then sort.
  const filtered = useMemo(() => {
    if (!topics) return [];
    const pool = topics.filter(t => {
      const m = markOf(t.id);
      if (mark === 'all' ? m === 'removed' : m !== mark) return false;
      if (fieldFilter !== 'all' && t.fieldId !== fieldFilter) return false;
      if (level !== 'all' && t.difficulty !== level) return false;
      return true;
    });
    const found = q.trim() ? searchTopics(pool, q) : pool.slice();
    if (sort === 'relevance' && q.trim()) return found;
    if (sort === 'az' || sort === 'relevance') return found.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'field') return found.sort((a, b) => a.field.localeCompare(b.field) || a.title.localeCompare(b.title));
    return found.sort((a, b) => (LEVEL_RANK[a.difficulty] ?? 1) - (LEVEL_RANK[b.difficulty] ?? 1) || a.title.localeCompare(b.title));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, controls, q, mark, fieldFilter, level, sort]);

  const visible = filtered.slice(0, page);

  const groups = useMemo(() => {
    if (sort !== 'field') return [{ key: 'all', label: null, items: visible }];
    const map = new Map();
    for (const t of visible) {
      if (!map.has(t.field)) map.set(t.field, { key: t.field, label: t.field, colour: fieldColor(t.fieldId), items: [] });
      map.get(t.field).items.push(t);
    }
    return [...map.values()];
  }, [visible, sort]);

  async function setState(topicId, next, sound = 'chime') {
    const { error } = await supabase.from('topic_controls').upsert({
      user_id: uid, topic_id: topicId, state: next, updated_at: new Date().toISOString(),
    });
    if (error) { play('error'); return toast(error.message, 'err'); }
    await logDecision(uid, `topic_${next}`, topicId);
    play(sound);
    toast(`Marked ${MARK_LABEL[next].toLowerCase()}.`, 'ok');
    loadAll(uid);
  }

  async function deleteCustom(topic) {
    setPendingTopic(topic);
  }

  async function confirmDeleteTopic() {
    const topic = pendingTopic;
    if (!topic) return;
    const { error } = await supabase.from('topics').delete().eq('id', topic.id);
    if (error) { play('error'); return toast(error.message, 'err'); }
    await logDecision(uid, 'topic_deleted', null, { title: topic.title });
    play('delete');
    toast('Topic deleted.', 'info');
    setPendingTopic(null);
    setOpenTopic(null);
    loadAll(uid);
  }

  async function createSection() {
    const name = newSecName.trim();
    if (!name || !newSecField) {
      play('error');
      toast('Give the section a name and choose its field.', 'warn');
      return null;
    }
    const id = `c-${crypto.randomUUID()}`;
    const { error } = await supabase.from('subfields').insert({ id, field_id: newSecField, name, user_id: uid });
    if (error) { play('error'); toast(error.message, 'err'); return null; }
    await logDecision(uid, 'section_added', null, { name });
    play('save');
    setNewSecName('');
    loadAll(uid);
    return id;
  }

  async function addBulk() {
    const lines = bulkText.split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) {
      play('error');
      return toast('Paste at least one topic, one per line.', 'warn');
    }
    let sub = bulkSub;
    if (sub === NEW_SECTION) {
      sub = await createSection();
      if (!sub) return;
    }
    if (!sub) {
      play('error');
      return toast('Choose a section for these topics.', 'warn');
    }
    const rows = lines.map(title => ({ user_id: uid, subfield_id: sub, title, difficulty: bulkDiff }));
    const { data, error } = await supabase.from('topics').insert(rows).select('id');
    if (error) { play('error'); return toast(error.message, 'err'); }
    await logDecision(uid, 'topics_added', null, { count: data.length, subfield: sub });
    play('success');
    toast(`${data.length} topic${data.length === 1 ? '' : 's'} added.`, 'ok');
    setBulkText('');
    loadAll(uid);
  }

  const ownSections = subs.filter(s => s.user_id === uid);

  if (err) return <div className="fade-in"><BackLink /><h1>Topics</h1><p className="err">{err}</p></div>;
  if (!topics) return <div className="fade-in"><BackLink /><h1>Topics</h1><Skeleton lines={5} label="Loading your topics" /></div>;

  return (
    <div className="fade-in">
      <BackLink />
      <h1>Topics</h1>
      <RelatedStrip ids={['topic-generation', 'journal-capture']} />
      <p className="muted">{filtered.length} of {topics.length} topics shown</p>

      <div className="search-box">
        <input
          type="search"
          placeholder="Search: a word, part of a word, or a typo"
          value={q}
          onChange={e => { setQ(e.target.value); setPage(PAGE); }}
          aria-label="Search topics"
        />
        {q && <button className="search-clear" onClick={() => setQ('')} aria-label="Clear search">×</button>}
      </div>
      <p className="muted search-hint">Several words all have to match. Field, section and level count too.</p>

      <div className="chip-row" role="group" aria-label="Filter by mark">
        {MARKS.map(([v, l]) => (
          <button key={v} className={`chip ${mark === v ? 'on' : ''}`} onClick={() => { setMark(v); setPage(PAGE); }}>
            {l} · {counts.byMark[v] ?? 0}
          </button>
        ))}
      </div>

      <div className="chip-row" role="group" aria-label="Filter by field">
        <button className={`chip ${fieldFilter === 'all' ? 'on' : ''}`} onClick={() => { setFieldFilter('all'); setPage(PAGE); }}>All fields</button>
        {fields.map(f => (
          <button
            key={f.id}
            className={`chip chip-field ${fieldFilter === f.id ? 'on' : ''}`}
            style={{ '--chip': fieldColor(f.id) }}
            onClick={() => { setFieldFilter(f.id); setPage(PAGE); }}
          >
            <span className="chip-dot" aria-hidden="true" />
            {f.name.charAt(0) + f.name.slice(1).toLowerCase()} · {counts.byField.get(f.id) ?? 0}
          </button>
        ))}
      </div>

      <div className="chip-row" role="group" aria-label="Filter by level">
        {[['all', 'Any level'], ['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']].map(([v, l]) => (
          <button key={v} className={`chip ${level === v ? 'on' : ''}`} onClick={() => { setLevel(v); setPage(PAGE); }}>{l}</button>
        ))}
      </div>

      <div className="seg" role="tablist" aria-label="Sort topics">
        {SORTS.map(([v, l]) => (
          <button key={v} role="tab" aria-selected={sort === v} className={sort === v ? 'on' : ''} onClick={() => setSort(v)}>{l}</button>
        ))}
      </div>

      {filtered.length === 0 && <p className="muted">No topics match. Clear the search, or widen the filters.</p>}

      {groups.map(group => (
        <section key={group.key}>
          {group.label && (
            <div className="catalogue-head" style={{ '--chip': group.colour }}>
              <span className="chip-dot" aria-hidden="true" />
              {group.label} · {group.items.length}
            </div>
          )}
          {group.items.map(t => {
            const m = markOf(t.id);
            return (
              <button key={t.id} className="topic-row" style={{ borderLeftColor: fieldColor(t.fieldId) }} onClick={() => setOpenTopic(t)}>
                <span className="topic-title"><Highlighted text={t.title} query={q} /></span>
                <span className="muted topic-meta">
                  {t.field && !group.label ? `${t.field} · ` : ''}<Highlighted text={t.section} query={q} /> · {t.difficulty}
                </span>
                {m !== 'normal' && <span className={`mark-tag mark-${m}`}>{MARK_LABEL[m]}</span>}
              </button>
            );
          })}
        </section>
      ))}

      {filtered.length > page && (
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={() => setPage(p => p + PAGE)}>
            Show {Math.min(PAGE, filtered.length - page)} more · {filtered.length - page} left
          </button>
        </div>
      )}

      {openTopic && (
        <div className="sheet-backdrop" onClick={() => setOpenTopic(null)}>
          <div className="sheet sheet-left" role="dialog" aria-modal="true" aria-label={openTopic.title} onClick={e => e.stopPropagation()}>
            <div className="sheet-tier" style={{ color: fieldColor(openTopic.fieldId) }}>{openTopic.field} · {openTopic.section}</div>
            <h2 className="sheet-title">{openTopic.title}</h2>
            <p className="muted">Level: {openTopic.difficulty}. Currently marked: {MARK_LABEL[markOf(openTopic.id)]}.</p>
            <div className="row">
              <button className="btn" onClick={() => setState(openTopic.id, 'show_more', 'select')}>More</button>
              <button className="btn" onClick={() => setState(openTopic.id, 'show_less', 'select')}>Less</button>
              <button className="btn" onClick={() => setState(openTopic.id, 'archived', 'tap')}>Archive</button>
              <button className="btn danger" onClick={() => setState(openTopic.id, 'removed', 'warn')}>Remove</button>
              <button className="btn" onClick={() => setState(openTopic.id, 'normal', 'tap')}>Reset</button>
            </div>
            {openTopic.userId === uid && (
              <div className="row"><button className="btn danger" onClick={() => deleteCustom(openTopic)}>Delete this topic</button></div>
            )}
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn" onClick={() => setOpenTopic(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <h2>Add topics</h2>
      <div className="card add-panel">
        {!panelOpen ? (
          <div className="add-start">
            <p className="muted" style={{ margin: 0 }}>Paste as many topics as you like, one per line, into any section.</p>
            <button className="btn accent big" onClick={() => setPanelOpen(true)}>Add topics</button>
          </div>
        ) : (
          <>
            <div className="kicker">Topics, one per line</div>
            <textarea
              className="add-textarea"
              placeholder={'Stoic virtue ethics\nSpaced repetition\nBasic photosynthesis'}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
            />
            <div className="add-count">{bulkText.split('\n').filter(l => l.trim()).length} topics ready</div>

            <div className="kicker">Section</div>
            <select className="big-select" value={bulkSub} onChange={e => setBulkSub(e.target.value)}>
              <option value="">Choose a section</option>
              <option value={NEW_SECTION}>+ Create a new section</option>
              {subs.map(s => (
                <option key={s.id} value={s.id}>{s.fields.name} · {s.name}{s.user_id === uid ? ' (yours)' : ''}</option>
              ))}
            </select>

            {bulkSub === NEW_SECTION && (
              <div className="new-section">
                <input placeholder="New section name" value={newSecName} onChange={e => setNewSecName(e.target.value)} />
                <select className="big-select" value={newSecField} onChange={e => setNewSecField(e.target.value)}>
                  <option value="">Under which field?</option>
                  {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            )}

            <div className="kicker">Level</div>
            <div className="seg">
              {['beginner', 'intermediate', 'advanced'].map(d => (
                <button key={d} className={bulkDiff === d ? 'on' : ''} onClick={() => setBulkDiff(d)}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>

            <div className="row add-actions">
              <button className="btn accent big" onClick={addBulk}>Add topics</button>
              <button className="btn big" onClick={() => setPanelOpen(false)}>Close</button>
            </div>
          </>
        )}
      </div>

      {ownSections.length > 0 && (
        <>
          <h2>Your sections</h2>
          <div className="muted">{ownSections.map(s => s.name).join(' · ')}</div>
        </>
      )}
      <ConfirmDialog
        open={!!pendingTopic}
        title="Delete this topic?"
        danger
        confirmLabel="Delete topic"
        onConfirm={confirmDeleteTopic}
        onCancel={() => setPendingTopic(null)}
      >
        <p style={{ marginTop: 0 }}>
          {pendingTopic ? `"${pendingTopic.title}" leaves your library. Journal entries that used it stay, without that topic.` : ''}
        </p>
      </ConfirmDialog>
    </div>
  );
}
