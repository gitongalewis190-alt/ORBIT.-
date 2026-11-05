'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { AWARDS, CATEGORIES, TIER_LABEL, awardProgress } from '../lib/awards';

// three.js loads only when the collection is opened, keeping other screens light.
const Medal3D = dynamic(() => import('./Medal3D'), {
  ssr: false,
  loading: () => <div className="medal-placeholder" aria-hidden="true" />,
});

const longDate = iso => new Date(iso).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Nairobi',
});

// unlocked is a Map of award key -> unlocked_on timestamp.
export default function AwardsGallery({ stats, unlocked }) {
  const [open, setOpen] = useState(null);
  const earnedCount = AWARDS.filter(a => unlocked.has(a.key)).length;

  return (
    <div id="awards">
      <div className="kicker">{earnedCount} of {AWARDS.length} awards earned</div>
      <div className="bar"><span style={{ width: `${Math.round((earnedCount / AWARDS.length) * 100)}%` }} /></div>

      {CATEGORIES.map(cat => {
        const items = AWARDS.filter(a => a.category === cat.key);
        return (
          <section key={cat.key} className="award-group">
            <h3 className="award-cat">{cat.label}</h3>
            <div className="award-grid">
              {items.map(a => {
                const earned = unlocked.has(a.key);
                const p = awardProgress(a, stats);
                return (
                  <button
                    key={a.key}
                    className={`award-cell ${earned ? 'earned' : 'locked'}`}
                    onClick={() => setOpen(a)}
                    data-sound="open"
                    aria-label={`${a.name}, ${earned ? TIER_LABEL[a.tier] : 'locked'}`}
                  >
                    <Medal3D tier={a.tier} emblem={a.emblem} name={a.name} locked={!earned} size={104} interactive={false} autoSpin={false} />
                    <div className="award-name">{a.name}</div>
                    <div className="award-meta">
                      {earned ? TIER_LABEL[a.tier] : `${p.value} of ${p.target}`}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {open && (
        <AwardSheet
          award={open}
          stats={stats}
          earnedOn={unlocked.get(open.key)}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function AwardSheet({ award, stats, earnedOn, onClose }) {
  const earned = Boolean(earnedOn);
  const p = awardProgress(award, stats);
  const dateLabel = earned ? longDate(earnedOn) : '';
  const category = CATEGORIES.find(c => c.key === award.category)?.label ?? '';

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={award.name} onClick={e => e.stopPropagation()}>
        <div className="sheet-medal">
          <Medal3D
            tier={award.tier}
            emblem={award.emblem}
            name={award.name}
            dateLabel={dateLabel}
            locked={!earned}
            size={240}
            interactive
            autoSpin={false}
          />
        </div>
        <div className="sheet-tier">{TIER_LABEL[award.tier]} · {category}</div>
        <h2 className="sheet-title">{award.name}</h2>
        <p className="muted">{award.description}</p>
        {earned ? (
          <p className="ok">Earned on {dateLabel}. Drag the medal to turn it.</p>
        ) : (
          <>
            <div className="bar"><span style={{ width: `${Math.round(p.fraction * 100)}%` }} /></div>
            <p className="muted">{p.value} of {p.target} so far. Drag the medal to turn it.</p>
          </>
        )}
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
