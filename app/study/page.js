'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import './study.css';

const ROWS = [
  { href: '/attention', title: 'Attention', line: 'Ask your journal, or shorten a draft.' },
  { href: '/recall', title: 'Recall', line: 'Answer a question from something you logged.' },
  { href: '/log#recall-model', title: 'Recall model', line: 'See how likely the next review is to stick.' },
  { href: '/atlas', title: 'Atlas', line: 'Map concepts, links, and what to practise.' },
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
      <div className="study-list">
        {ROWS.map(row => (
          <Link key={row.href} href={row.href} className="study-row">
            <strong>{row.title}</strong>
            <span>{row.line}</span>
            {row.href === '/attention' && attentionDraft ? (
              <span className="study-status">Unsent draft on this phone</span>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
