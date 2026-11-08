'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { paletteGroups, recordById } from '../lib/navMap';
import { MANUAL } from '../lib/manual';
import { SETTINGS_SECTIONS } from '../lib/navMap';

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
  const inputRef = useRef(null);
  const items = useMemo(() => {
    if (!query.trim()) {
      return recent().map(recordById).filter(Boolean).map(row => ({ id: row.id, title: row.title, route: row.route, action: row.action, group: 'Recent' }));
    }
    const groups = paletteGroups(query);
    const help = MANUAL.filter(chapter => `${chapter.title} ${(chapter.keywords || []).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
      .map(chapter => ({ id: `guide-${chapter.id}`, title: chapter.title, route: '/guide', action: null, group: 'Help' }));
    const settings = SETTINGS_SECTIONS.filter(([, label]) => label.toLowerCase().includes(query.trim().toLowerCase()))
      .map(([key, label]) => ({ id: `setting-${key}`, title: label, route: `/settings#${key}`, action: null, group: 'Settings' }));
    const rows = [];
    for (const [group, list] of Object.entries(groups)) {
      for (const row of list) rows.push({ id: row.id, title: row.title, route: row.route, action: row.action, group });
    }
    return [...rows, ...settings, ...help];
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setActive(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;
  const current = items[active] || null;
  function go(item) {
    if (!item) return;
    if (item.action) window.dispatchEvent(new Event(item.action));
    else if (item.route) router.push(item.route);
    onClose();
  }
  return (
    <div className="orbit-palette">
      <button type="button" className="evidence-backdrop" aria-label="Close search" onClick={onClose} />
      <div className="palette-panel" role="dialog" aria-modal="true" aria-label="Search Orbit">
        <input
          ref={inputRef}
          className="palette-input"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={current ? `palette-${current.id}` : undefined}
          aria-label="Search Orbit"
          placeholder="Search Orbit"
          value={query}
          onChange={event => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => Math.min(items.length - 1, index + 1)); }
            if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
            if (event.key === 'Enter') { event.preventDefault(); go(current); }
          }}
        />
        <ul id="palette-list" role="listbox">
          {items.length ? items.map((item, index) => (
            <li key={`${item.group}-${item.id}`} id={`palette-${item.id}`} role="option" aria-selected={index === active}>
              <button type="button" className={index === active ? 'on' : ''} data-sound="select" onClick={() => go(item)}>
                <span className="muted">{item.group}</span> {item.title}
              </button>
            </li>
          )) : <li className="muted">Nothing matches. Recent is shown when the field is empty.</li>}
        </ul>
      </div>
    </div>
  );
}
