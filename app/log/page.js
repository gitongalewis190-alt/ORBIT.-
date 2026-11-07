'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { currentUser } from '../../lib/session';
import { prettyDate } from '../../lib/dates';
import Skeleton from '../../components/Skeleton';
import LogStats from '../../components/LogStats';
import BackLink from '../../components/BackLink';
import { highlightSegments, normalise, queryTokens } from '../../lib/search';

const LABELS = {
  generated: 'Topic generated',
  accepted: 'Topic accepted',
  rejected: 'Topic rejected',
  journal_saved: 'Entry saved',
  entry_edited: 'Entry edited',
  relearn: 'Re-learn queued',
  entry_deleted: 'Entry deleted',
  auto_show_less: 'Auto: show less',
  topic_show_more: 'Marked more',
  topic_show_less: 'Marked less',
  topic_archived: 'Archived',
  topic_removed: 'Removed',
  topic_normal: 'Reset',
  topic_added: 'Custom topic added',
  topic_deleted: 'Custom topic deleted',
  section_added: 'Section created',
  topics_added: 'Topics added',
};

const GROUPS = [
  { key: 'all', label: 'All' },
  { key: 'topics', label: 'Topics', colour: '#c4623d', events: ['generated', 'accepted', 'rejected', 'topic_show_more', 'topic_show_less', 'topic_archived', 'topic_removed', 'topic_normal', 'topic_added', 'topic_deleted', 'topics_added'] },
  { key: 'entries', label: 'Entries', colour: '#3b7a6a', events: ['journal_saved', 'entry_edited', 'entry_deleted', 'relearn'] },
  { key: 'system', label: 'System', colour: '#5a6bb5', events: ['auto_show_less', 'section_added'] },
];

const groupOf = event => GROUPS.find(g => g.events?.includes(event))?.key ?? 'system';
const colourOf = key => GROUPS.find(g => g.key === key)?.colour ?? '#8a867f';

function detailOf(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const parts = [];
  if (payload.mode) parts.push(`mode ${payload.mode}`);
  if (payload.level) parts.push(`level ${payload.level}`);
  if (payload.minutes) parts.push(`${payload.minutes} min`);
  if (payload.words) parts.push(`${payload.words} words`);
  if (payload.confidence !== undefined && payload.confidence !== null) parts.push(`confidence ${payload.confidence}`);
  if (payload.next_review) parts.push(`next review ${payload.next_review}`);
  if (payload.reps) parts.push(`${payload.reps} reviews`);
  return parts.join(' · ');
}

// Statistics first, then the record of decisions, searchable and grouped by day.
export default function Logs() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');

  useEffect(() => {
    let alive = true;
    currentUser().then((user) => {
      if (!alive || !user) return;
      supabase.from('decision_log')
        .select('id,event,topic_id,payload,created_at,topics(title)')
        .order('created_at', { ascending: false })
        .limit(500)
        .then(({ data, error }) => {
          if (!alive) return;
          if (error) setErr(error.message);
          else setRows(data ?? []);
        });
    });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const tokens = queryTokens(q);
    return rows.filter(r => {
      if (group !== 'all' && groupOf(r.event) !== group) return false;
      if (tokens.length === 0) return true;
      const haystack = normalise([LABELS[r.event] ?? r.event, r.event, r.topics?.title ?? '', JSON.stringify(r.payload ?? {})].join(' '));
      return tokens.every(t => haystack.includes(t));
    });
  }, [rows, q, group]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const day = r.created_at.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(r);
    }
    return [...map];
  }, [filtered]);

  return (
    <div className="fade-in">
      <BackLink />
      <h1>Logs</h1>
      <p className="muted">Statistics first, then every decision Orbit made and every change you made.</p>

      <LogStats />

      <h2>Records</h2>
      <input
        type="search"
        placeholder="Search records: topic, event, or detail"
        value={q}
        onChange={e => setQ(e.target.value)}
        aria-label="Search records"
      />

      <div className="chip-row" role="group" aria-label="Filter records">
        {GROUPS.map(g => (
          <button key={g.key} className={`chip ${group === g.key ? 'on' : ''}`} onClick={() => setGroup(g.key)}>
            {g.label}
          </button>
        ))}
      </div>

      {err && <p className="err">{err}</p>}
      {!err && rows === null && <Skeleton lines={5} label="Loading your records" />}
      {!err && rows !== null && filtered.length === 0 && (
        <p className="muted">{rows.length === 0 ? 'No records yet. They appear as you use Orbit.' : 'No records match. Try fewer words, or choose All.'}</p>
      )}

      {byDay.map(([day, items]) => (
        <section key={day}>
          <div className="log-day">{prettyDate(day)} · {items.length}</div>
          {items.map(r => {
            const key = groupOf(r.event);
            const label = LABELS[r.event] ?? r.event.replace(/_/g, ' ');
            const detail = detailOf(r.payload);
            const segments = highlightSegments(label, q);
            return (
              <div key={r.id} className="log-row" style={{ borderLeftColor: colourOf(key) }}>
                <div className="log-title">
                  {segments.map((seg, i) => (seg.hit ? <mark key={i} className="hit">{seg.text}</mark> : <span key={i}>{seg.text}</span>))}
                  {r.topics?.title && <span className="muted"> · {r.topics.title}</span>}
                </div>
                <div className="muted log-meta">
                  {r.created_at.slice(11, 16)}{detail ? ` · ${detail}` : ''}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
