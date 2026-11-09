'use client';
import { useState } from 'react';
import Link from 'next/link';
import { RECORDS, familyForPath } from '../lib/navMap';

// The section links shown under the header on pages outside the tab bar (for example Settings).
// One layout only: a full-width box per link, stacked. The chosen link is marked only after a tap.
export default function FamilyStrip({ path }) {
  const family = familyForPath(path);
  const [picked, setPicked] = useState(null);

  const items = RECORDS.filter(item => item.family === family && item.route && item.risk !== 'destructive').slice(0, 8);

  return (
    <nav className="family-strip" aria-label={family || 'Section'}>
      {family ? (
        <div className="family-head">
          <span>{family}</span>
        </div>
      ) : null}
      {items.map(item => (
        <Link
          key={item.id}
          href={item.route}
          aria-current={item.route.split('#')[0] === path ? 'page' : undefined}
          className={picked === item.route ? 'picked' : undefined}
          onClick={e => {
            setPicked(item.route);
            // Same-page section links: Next does not fire hashchange, so set the hash and announce it.
            const [target, hash] = item.route.split('#');
            if (hash !== undefined && target === path) {
              e.preventDefault();
              if (window.location.hash === `#${hash}`) window.dispatchEvent(new HashChangeEvent('hashchange'));
              else window.location.hash = hash;
            }
          }}
          data-sound="nav"
        >
          {item.title}
        </Link>
      ))}
    </nav>
  );
}
