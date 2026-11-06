'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AWARDS, CATEGORIES, TIER_LABEL, awardProgress } from '../lib/awards';

// Three.js loads only when the collection is opened, keeping other screens light.
const Medal3D = dynamic(() => import('./Medal3D'), {
  ssr: false,
  loading: () => <div className="medal-placeholder" aria-hidden="true" />,
});

const longDate = iso => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Nairobi',
  });
};

// unlocked is a Map of award key -> unlocked_on timestamp.
export default function AwardsGallery({ stats, unlocked, displayName = 'Learner' }) {
  const [open, setOpen] = useState(null);
  const earnedCount = AWARDS.filter(a => unlocked.has(a.key)).length;
  const safeName = (displayName || '').trim() || 'Learner';

  return (
    <div id="awards">
      <div className="kicker">{earnedCount} of {AWARDS.length} awards earned</div>
      <div
        className="bar"
        role="progressbar"
        aria-label="Award collection progress"
        aria-valuemin={0}
        aria-valuemax={AWARDS.length}
        aria-valuenow={earnedCount}
      >
        <span style={{ width: `${Math.round((earnedCount / AWARDS.length) * 100)}%` }} />
      </div>

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
                    type="button"
                    className={`award-cell ${earned ? 'earned' : 'locked'}`}
                    onClick={() => setOpen(a)}
                    data-sound="open"
                    aria-label={`${a.name}, ${earned ? TIER_LABEL[a.tier] : 'locked'}`}
                    aria-haspopup="dialog"
                  >
                    <Medal3D
                      tier={a.tier}
                      emblem={a.emblem}
                      name={a.name}
                      locked={!earned}
                      size={104}
                      interactive={false}
                      autoSpin={false}
                    />
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
        <AwardDetail
          key={open.key}
          award={open}
          stats={stats}
          unlocked={unlocked}
          displayName={safeName}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function AwardDetail({ award, stats, unlocked, displayName, onClose }) {
  const earnedOn = unlocked.get(award.key);
  const earned = Boolean(earnedOn);
  const p = awardProgress(award, stats);
  const dateLabel = earned ? longDate(earnedOn) : '';
  const category = CATEGORIES.find(c => c.key === award.category)?.label ?? '';

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="award-detail-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="award-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="award-detail-title"
        aria-describedby="award-detail-description"
      >
        <header className="award-detail-header">
          <div className="award-detail-brand">
            <span className="award-detail-orbit">ORBIT</span>
            <span className="award-detail-divider">/</span>
            <span>YOUR COLLECTION</span>
          </div>
          <button
            type="button"
            className="award-detail-close"
            onClick={onClose}
            aria-label="Close award details"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <main className="award-detail-content">
          <p className="award-detail-eyebrow">
            {earned ? 'MILESTONE UNLOCKED' : 'NEXT MILESTONE'}
          </p>

          <div className="award-detail-owner">
            <span className="award-detail-avatar" aria-hidden="true">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <span>
              <span className="award-detail-owner-label">COLLECTOR</span>
              <strong>{displayName}</strong>
            </span>
          </div>

          <div className="award-detail-medal-stage">
            <div className="award-detail-medal-glow" aria-hidden="true" />
            <div className="award-detail-medal">
              <Medal3D
                tier={award.tier}
                emblem={award.emblem}
                name={award.name}
                dateLabel={dateLabel}
                locked={!earned}
                size={280}
                interactive
                autoSpin={false}
                intro
              />
            </div>
            <p className="award-detail-turn-hint">DRAG TO TURN THE MEDAL</p>
          </div>

          <div className="award-detail-heading">
            <div className="award-detail-tier">
              <span>{TIER_LABEL[award.tier]}</span>
              <span className="award-detail-dot">•</span>
              <span>{category}</span>
            </div>
            <h2 id="award-detail-title">{award.name}</h2>
            <p id="award-detail-description">{award.description}</p>
          </div>

          {earned ? (
            <div className="award-detail-earned">
              <span className="award-detail-earned-icon" aria-hidden="true">✓</span>
              <div>
                <strong>Added to your collection</strong>
                <span>{dateLabel ? `Earned by ${displayName} on ${dateLabel}` : `Earned by ${displayName}`}</span>
              </div>
            </div>
          ) : (
            <div className="award-detail-progress">
              <div className="award-detail-progress-top">
                <span>YOUR PROGRESS</span>
                <strong>{p.value} <span>/ {p.target}</span></strong>
              </div>
              <div
                className="award-detail-progress-track"
                role="progressbar"
                aria-label={`${award.name} progress`}
                aria-valuemin={0}
                aria-valuemax={p.target}
                aria-valuenow={p.value}
              >
                <span style={{ width: `${Math.round(p.fraction * 100)}%` }} />
              </div>
              <p>Keep building your progress. This milestone is waiting for you.</p>
            </div>
          )}

          <button type="button" className="award-detail-done" onClick={onClose}>
            Back to collection
          </button>
        </main>

        <footer className="award-detail-footer">
          <span>ORBIT · PROGRESS, MADE VISIBLE</span>
          <span>{earned ? 'AWARD VERIFIED' : 'IN PROGRESS'}</span>
        </footer>
      </section>
    </div>
  );
}