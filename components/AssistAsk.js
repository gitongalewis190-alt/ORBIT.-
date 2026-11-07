'use client';

import { useMemo, useState } from 'react';
import { askJournal } from '../lib/assist';
import Dictate from './Dictate';

// A question over entries already on the page. Nothing is sent away.
export default function AssistAsk({ entries, onOpen, onReview }) {
  const [query, setQuery] = useState('');
  const [asked, setAsked] = useState(null);
  const result = useMemo(() => (asked ? askJournal(entries, asked) : null), [entries, asked]);

  function go(text) {
    const q = (text ?? query).trim();
    if (!q) return;
    setQuery(q);
    setAsked(q);
  }

  return (
    <div className="card">
      <div className="kicker">Ask</div>
      <div className="row" style={{ marginTop: 0, alignItems: 'center' }}>
        <input value={query} placeholder="When did I write about this?" onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') go(); }} style={{ flex: 1, margin: 0 }} />
        <Dictate onText={text => go(`${query} ${text}`.trim())} />
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn sm" type="button" onClick={() => go()}>Ask</button>
      </div>
      {result?.answer && <p style={{ marginTop: 10, lineHeight: 1.5 }}>{result.answer}</p>}
      {result && result.hits.length === 0 && <p className="muted">Nothing in your journal matches that.</p>}
      {result?.hits.map(hit => (
        <button key={hit.id} type="button" className="entry" style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 0 }}
          onClick={() => onOpen?.(hit)}>
          <div>{hit.title}</div>
          <div className="muted">{String(hit.created_at).slice(0, 10)}</div>
          <div style={{ fontSize: 14, marginTop: 4 }}>{hit.excerpt}</div>
        </button>
      ))}
      {result?.recommendations.map(item => (
        <div key={item.label} className="row">
          {item.kind === 'relearn' ? (
            <button className="btn sm" type="button" onClick={() => onReview?.(item.topic_id)}>{item.label}</button>
          ) : item.kind === 'recall' ? (
            <a className="btn sm" href={`/recall?entry=${item.entry_id}`}>{item.label}</a>
          ) : (
            <span className="muted">{item.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}
