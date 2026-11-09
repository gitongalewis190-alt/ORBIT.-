'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { paletteGroups, recordById, SETTINGS_SECTIONS } from '../lib/navMap';
import { MANUAL } from '../lib/manual';
import { fetchAllTopics } from '../lib/context';
import { searchTopics } from '../lib/search';

function recent() {
  try {
    const raw = localStorage.getItem('orbit.nav.recent.v1');
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export default function CommandPalette({ open, onClose }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [topics, setTopics] = useState(null);
  const [topicErr, setTopicErr] = useState('');
  const inputRef = useRef(null);

  // Keep the latest onClose in a ref. Depending on it directly made the effect re-run
  // (and clear the query) every time the parent re-rendered.
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  // Load the topic list once, the first time the palette opens.
  useEffect(() => {
    if (!open || topics !== null) return;
    let alive = true;
    fetchAllTopics().then(({ data, error }) => {
      if (!alive) return;
      if (error) { setTopicErr('Topics could not load. Navigation search still works.'); setTopics([]); return; }
      setTopics((data ?? []).map(t => ({
        id: t.id,
        title: t.title,
        field: t.subfields?.fields?.name ?? '',
        section: t.subfields?.name ?? '',
      })));
    });
    return () => { alive = false; };
  }, [open, topics]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setActive(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    const onKey = (event) => { if (event.key === 'Escape') closeRef.current?.(); };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const items = useMemo(() => {
    const term = query.trim();
    if (!term) {
      return recent().map(recordById).filter(Boolean)
        .map(row => ({ id: row.id, title: row.title, route: row.route, action: row.action, group: 'Recent' }));
    }
    const low = term.toLowerCase();
    const groups = paletteGroups(term);
    const found = [];
    // Topics first: searching for a subject should land on the subject.
    for (const t of searchTopics(topics ?? [], term).slice(0, 8)) {
      found.push({ id: `topic-${t.id}`, title: t.title, route: `/journal?review=${t.id}`, action: null, group: 'Topic', sub: [t.field, t.section].filter(Boolean).join(' · ') });
    }
    for (const [group, list] of Object.entries(groups)) {
      for (const row of list) found.push({ id: row.id, title: row.title, route: row.route, action: row.action, group });
    }
    for (const [key, label] of SETTINGS_SECTIONS) {
      if (label.toLowerCase().includes(low)) found.push({ id: `setting-${key}`, title: label, route: `/settings#${key}`, action: null, group: 'Settings' });
    }
    for (const chapter of MANUAL) {
      if (`${chapter.title} ${(chapter.keywords || []).join(' ')}`.toLowerCase().includes(low)) {
        found.push({ id: `guide-${chapter.id}`, title: chapter.title, route: '/guide', action: null, group: 'Help' });
      }
    }
    return found;
  }, [query, topics]);

  if (!open) return null;
  const current = items[active] || null;

  function go(item) {
    if (!item) return;
    if (item.action) window.dispatchEvent(new Event(item.action));
    else if (item.route) router.push(item.route);
    closeRef.current?.();
  }

  return (
    <div className="orbit-palette">
      <button type="button" className="evidence-backdrop" aria-label="Close search" onClick={() => closeRef.current?.()} />
      <div className="palette-panel" role="dialog" aria-modal="true" aria-label="Search Orbit">
        <input
          ref={inputRef}
          className="palette-input"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={current ? `palette-${current.id}` : undefined}
          aria-label="Search Orbit"
          placeholder="Search topics, pages and settings"
          value={query}
          autoComplete="off"
          onChange={event => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => Math.min(items.length - 1, index + 1)); }
            if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
            if (event.key === 'Enter') { event.preventDefault(); go(current); }
          }}
        />
        {topicErr && <p className="muted" role="status">{topicErr}</p>}
        <ul id="palette-list" role="listbox">
          {items.length ? items.map((item, index) => (
            <li key={`${item.group}-${item.id}`} id={`palette-${item.id}`} role="option" aria-selected={index === active}>
              <button type="button" className={index === active ? 'on' : ''} data-sound="select" onClick={() => go(item)}>
                <span className="muted">{item.group}</span> {item.title}
                {item.sub ? <span className="muted"> · {item.sub}</span> : null}
              </button>
            </li>
          )) : <li className="muted">Nothing matches. Try a shorter word.</li>}
        </ul>
      </div>
    </div>
  );
}
