'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { logDecision } from '../../lib/log';
import { play } from '../../lib/sound';
import { fetchAllTopics } from '../../lib/context';

const CONTROLS = [
  ['show_more', 'More'],
  ['show_less', 'Less'],
  ['archived', 'Archive'],
  ['removed', 'Remove'],
  ['normal', 'Reset'],
];
const FILTERS = [
  ['all', 'All'],
  ['show_more', 'More'],
  ['show_less', 'Less'],
  ['archived', 'Archived'],
  ['removed', 'Removed'],
];
const EMPTY_DRAFT = { title: '', subfield_id: '', difficulty: 'intermediate', description: '' };

export default function Topics() {
  const [uid, setUid] = useState(null);
  const [topics, setTopics] = useState([]);
  const [controls, setControls] = useState({});
  const [subs, setSubs] = useState([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [msg, setMsg] = useState({ text: '', tone: 'muted' });
  const [limit, setLimit] = useState(40);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUid(data.user.id);
      loadAll(data.user.id);
    });
  }, []);

  async function loadAll(id) {
    const [t, c, s] = await Promise.all([
      fetchAllTopics(),
      supabase.from('topic_controls').select('topic_id,state').eq('user_id', id),
      supabase.from('subfields').select('id,name,fields(name)').order('id'),
    ]);
    if (t.error || c.error || s.error) {
      play('error');
      return setMsg({ text: (t.error || c.error || s.error).message, tone: 'err' });
    }
    setTopics(t.data);
    setControls(Object.fromEntries((c.data ?? []).map(r => [r.topic_id, r.state])));
    setSubs(s.data ?? []);
  }

  const state = id => controls[id] ?? 'normal';

  const counts = FILTERS.reduce((acc, [v]) => {
    acc[v] = v === 'all' ? topics.length : topics.filter(t => state(t.id) === v).length;
    return acc;
  }, {});

  const matching = topics
    .filter(t => filter === 'all' || state(t.id) === filter)
    .filter(t => !q.trim() || t.title.toLowerCase().includes(q.trim().toLowerCase()));
  const shown = matching.slice(0, limit);

  async function setState(topicId, s) {
    const { error } = await supabase.from('topic_controls').upsert({
      user_id: uid, topic_id: topicId, state: s, updated_at: new Date().toISOString(),
    });
    if (error) { play('error'); return setMsg({ text: error.message, tone: 'err' }); }
    await logDecision(uid, `topic_${s}`, topicId);
    play('chime');
    loadAll(uid);
  }

  async function deleteCustom(t) {
    const { error } = await supabase.from('topics').delete().eq('id', t.id);
    if (error) { play('error'); return setMsg({ text: error.message, tone: 'err' }); }
    await logDecision(uid, 'topic_deleted', null, { title: t.title });
    play('success');
    loadAll(uid);
  }

  async function addTopic() {
    if (!draft.title.trim() || !draft.subfield_id) {
      play('error');
      return setMsg({ text: 'A title and a subfield are needed.', tone: 'err' });
    }
    const { data, error } = await supabase.from('topics').insert({
      user_id: uid,
      title: draft.title.trim(),
      subfield_id: draft.subfield_id,
      difficulty: draft.difficulty,
      description: draft.description.trim() || null,
    }).select('id').single();
    if (error) { play('error'); return setMsg({ text: error.message, tone: 'err' }); }
    await logDecision(uid, 'topic_added', data.id, { title: draft.title.trim() });
    play('success');
    setDraft(EMPTY_DRAFT);
    setMsg({ text: 'Topic added to the library.', tone: 'muted' });
    loadAll(uid);
  }

  return (
    <div className="fade-in">
      <h1>Topics</h1>
      <p className="muted">{topics.length} in the library</p>

      <input placeholder="Search" value={q} onChange={e => { setQ(e.target.value); setLimit(40); }} />
      <div className="choices">
        {FILTERS.map(([v, l]) => (
          <button key={v} className={`btn sm ${filter === v ? 'on' : ''}`}
            onClick={() => { setFilter(v); setLimit(40); }}>
            {l} {counts[v] ? `(${counts[v]})` : ''}
          </button>
        ))}
      </div>

      {shown.map(t => (
        <div key={t.id} className="card">
          <div>{t.title}</div>
          <div className="muted">{t.subfields.fields.name} · {t.subfields.name} · {t.difficulty}</div>
          <span className="tag">{state(t.id) === 'normal' ? 'normal' : state(t.id).replace('_', ' ')}</span>
          <div className="row">
            {CONTROLS.map(([s, l]) => (
              <button key={s} className="btn sm" onClick={() => setState(t.id, s)}>{l}</button>
            ))}
            {t.user_id === uid && (
              <button className="btn sm" onClick={() => deleteCustom(t)}>Delete</button>
            )}
          </div>
        </div>
      ))}

      {matching.length > limit && (
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn sm" onClick={() => setLimit(l => l + 40)}>Show more rows</button>
        </div>
      )}

      <h2>Add a custom topic</h2>
      <div className="card">
        <input
          placeholder="Topic title"
          value={draft.title}
          onChange={e => setDraft({ ...draft, title: e.target.value })}
        />
        <select value={draft.subfield_id} onChange={e => setDraft({ ...draft, subfield_id: e.target.value })}>
          <option value="">Choose a subfield</option>
          {subs.map(s => <option key={s.id} value={s.id}>{s.fields.name} · {s.name}</option>)}
        </select>
        <select value={draft.difficulty} onChange={e => setDraft({ ...draft, difficulty: e.target.value })}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <textarea
          style={{ minHeight: 64 }}
          placeholder="Short description (optional)"
          value={draft.description}
          onChange={e => setDraft({ ...draft, description: e.target.value })}
        />
        <div className="row">
          <button className="btn accent" onClick={addTopic}>Add topic</button>
        </div>
        {msg.text && <p className={msg.tone} style={{ marginBottom: 0 }}>{msg.text}</p>}
      </div>
    </div>
  );
}
