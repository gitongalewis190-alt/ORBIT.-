'use client';
import { useMemo, useState } from 'react';
import { MANUAL } from '../../lib/manual';
import { APP_VERSION, CHANGELOG } from '../../lib/version';
import BackLink from '../../components/BackLink';

// The searchable manual and the version history, both in one place.
export default function Guide() {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const shown = useMemo(() => {
    if (!query) return MANUAL;
    return MANUAL.filter(section => {
      const haystack = [section.title, ...section.body, ...(section.keywords ?? [])].join(' ').toLowerCase();
      return query.split(/\s+/).every(word => haystack.includes(word));
    });
  }, [query]);

  return (
    <div className="fade-in">
      <BackLink />
      <h1>Guide</h1>
      <p className="muted">Search the manual, or open any topic below. Version {APP_VERSION}.</p>

      <input
        type="search"
        placeholder="Search: focus, rings, export, reset…"
        value={q}
        onChange={e => setQ(e.target.value)}
        aria-label="Search the guide"
      />

      {shown.length === 0 && (
        <p className="muted">Nothing matches &ldquo;{q.trim()}&rdquo;. Try a shorter word.</p>
      )}

      {shown.map(section => (
        <details key={section.id} className="guide-section" open={query.length > 0}>
          <summary><span>{section.title}</span></summary>
          {section.body.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
        </details>
      ))}

      <h2>Version history</h2>
      {CHANGELOG.map(release => (
        <details key={release.version} className="guide-section">
          <summary>
            <span>Version {release.version}</span>
            {release.date && <span className="muted">{release.date}</span>}
          </summary>
          <ul>
            {release.notes.map(note => <li key={note}>{note}</li>)}
          </ul>
        </details>
      ))}
    </div>
  );
}
