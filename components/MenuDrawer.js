'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { HUBS, PRIMARY, RECORDS, recordById } from '../lib/navMap';

export function NavRow({ href, title, line, current }) {
  return (
    <Link href={href} className="nav-row" aria-current={current ? 'page' : undefined} data-sound="nav">
      <strong>{title}</strong>
      {line ? <span>{line}</span> : null}
    </Link>
  );
}

export function RelatedStrip({ ids }) {
  const rows = (ids || []).map(recordById).filter(row => row && (row.route || row.action));
  if (!rows.length) return null;
  return (
    <nav className="related-strip" aria-label="Related">
      {rows.map(row => row.action ? (
        <button key={row.id} type="button" className="chip" data-sound="tap" onClick={() => window.dispatchEvent(new Event(row.action))}>{row.title}</button>
      ) : (
        <Link key={row.id} href={row.route} className="chip" data-sound="nav">{row.title}</Link>
      ))}
    </nav>
  );
}

function recentIds() {
  try {
    const raw = localStorage.getItem('orbit.nav.recent.v1');
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.slice(0, 5) : [];
  } catch {
    return [];
  }
}

export default function MenuDrawer({ open, onClose, onSearch }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const node = ref.current;
    node?.querySelector('button, a')?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const groups = [
    ['Study', Object.values(HUBS.study).flat()],
    ['Progress', HUBS.progress],
    ['Data and backup', RECORDS.filter(row => row.cluster === 'Data and backup' && row.risk !== 'destructive').map(row => row.id)],
    ['Settings and help', ['settings', 'guide', 'inspect']],
  ];
  return (
    <div className="orbit-menu">
      <button type="button" className="evidence-backdrop" aria-label="Close menu" onClick={onClose} />
      <aside id="orbit-menu" ref={ref} role="dialog" aria-modal="true" aria-label="Menu" className="menu-panel">
        <button type="button" className="btn" data-sound="open" onClick={onSearch}>Search Orbit</button>
        <button type="button" className="btn print-menu" data-sound="open" onClick={() => { window.dispatchEvent(new Event('orbit:open-print')); onClose(); }}>Download PDF record</button>
        {PRIMARY.map(item => <NavRow key={item.id} href={item.route} title={item.title} />)}
        {groups.map(([title, ids]) => (
          <div key={title}>
            <h2>{title}</h2>
            {[...new Set(ids)].map(id => {
              const row = recordById(id);
              if (!row || row.risk === 'destructive' || !row.route) return null;
              return <NavRow key={id} href={row.route} title={row.title} line={row.description} />;
            })}
          </div>
        ))}
        <h2>Recent</h2>
        {recentIds().map(id => {
          const row = recordById(id);
          if (!row?.route) return null;
          return <NavRow key={id} href={row.route} title={row.title} />;
        })}
        <button type="button" className="btn sm" data-sound="tap" onClick={onClose}>Close</button>
      </aside>
    </div>
  );
}
