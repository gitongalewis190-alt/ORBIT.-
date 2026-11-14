'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import './study.css';
import { HUBS, recordById } from '../../lib/navMap';

const ROWS = [
  { href: '/attention', title: 'Attention', line: 'Ask your journal, or shorten a draft.' },
];

export default function StudyPage() {
  const [attentionDraft, setAttentionDraft] = useState(false);

  useEffect(() => {
    try {
      setAttentionDraft(Boolean(window.localStorage.getItem('orbit.draft.attention')));
    } catch {
      setAttentionDraft(false);
    }
  }, []);

  return (
    <div className="fade-in study-page">
      <Link href="/" className="study-back">Back</Link>
      <h1>Study</h1>
      <p className="muted">Practice, connect, understand, or ask for help.</p>
      {Object.entries(HUBS.study).map(([cluster, ids]) => (
        <section key={cluster}>
          <h2>{cluster}</h2>
          <div className="hub-grid">
            {ids.map(id => {
              const row = recordById(id);
              if (!row?.route) return null;
              const known = ROWS.find(item => item.href === row.route);
              return (
                <Link key={id} href={row.route} className="nav-row">
                  <strong>{known?.title || row.title}</strong>
                  <span>{known?.line || row.description}</span>
                  {row.route === '/attention' && attentionDraft ? (
                    <span className="study-status">Unsent draft on this phone</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
