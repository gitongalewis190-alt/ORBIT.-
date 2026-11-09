'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RECORDS, familyForPath } from '../lib/navMap';

const KEY = 'orbit.strip.layout';

// The section links shown under the header on pages outside the tab bar (for example Settings).
// Boxes is the default: one full-width rounded box per link, stacked. Chips is the override.
export default function FamilyStrip({ path }) {
  const family = familyForPath(path);
  const [layout, setLayout] = useState('boxes');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'boxes' || saved === 'chips') setLayout(saved);
    } catch {}
  }, []);

  function choose(next) {
    setLayout(next);
    try { localStorage.setItem(KEY, next); } catch {}
  }

  const items = RECORDS.filter(item => item.family === family && item.route && item.risk !== 'destructive').slice(0, 8);

  return (
    <nav className={`family-strip ${layout}`} aria-label={family || 'Section'}>
      <div className="family-head">
        <span>{family}</span>
        <div className="seg" role="radiogroup" aria-label="Section layout">
          <button type="button" role="radio" aria-checked={layout === 'boxes'} className={layout === 'boxes' ? 'on' : ''} onClick={() => choose('boxes')}>Boxes</button>
          <button type="button" role="radio" aria-checked={layout === 'chips'} className={layout === 'chips' ? 'on' : ''} onClick={() => choose('chips')}>Chips</button>
        </div>
      </div>
      {items.map(item => (
        <Link key={item.id} href={item.route} aria-current={item.route.split('#')[0] === path ? 'page' : undefined} data-sound="nav">{item.title}</Link>
      ))}
    </nav>
  );
}
