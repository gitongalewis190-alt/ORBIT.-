'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const LABELS = {
  generated: 'Topic generated',
  accepted: 'Topic accepted',
  rejected: 'Topic rejected',
  journal_saved: 'Entry saved',
  relearn: 'Re-learn queued',
  auto_show_less: 'Auto: show less',
  topic_show_more: 'Marked more',
  topic_show_less: 'Marked less',
  topic_archived: 'Archived',
  topic_removed: 'Removed',
  topic_normal: 'Reset',
  topic_added: 'Custom topic added',
  topic_deleted: 'Custom topic deleted',
};

function describe(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const parts = [];
  if (payload.mode) parts.push(`mode ${payload.mode}`);
  if (payload.level) parts.push(`level ${payload.level}`);
  if (payload.minutes) parts.push(`${payload.minutes} min`);
  if (payload.confidence !== undefined && payload.confidence !== null) parts.push(`confidence ${payload.confidence}`);
  if (payload.next_review) parts.push(`next review ${payload.next_review}`);
  if (payload.reps) parts.push(`${payload.reps} reviews`);
  return parts.join(' · ');
}

export default function Log() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase.from('decision_log')
      .select('id,event,topic_id,payload,created_at,topics(title)')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) return setErr(error.message);
        setRows(data ?? []);
      });
  }, []);

  return (
    <div className="fade-in">
      <h1>Decision log</h1>
      <p className="muted">Every choice you make in Orbit. The system learns from this history.</p>
      {err && <p className="err">{err}</p>}
      {!err && rows.length === 0 && <p className="muted">No decisions yet.</p>}
      {rows.map(r => {
        const detail = describe(r.payload);
        return (
          <div key={r.id} className="entry">
            <div>
              {LABELS[r.event] ?? r.event.replace(/_/g, ' ')}
              {r.topics?.title ? <span className="muted"> · {r.topics.title}</span> : null}
            </div>
            <div className="muted">
              {r.created_at.slice(0, 16).replace('T', ' ')}
              {detail ? ` · ${detail}` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}
