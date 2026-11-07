'use client';

import { useEffect, useState } from 'react';
import { currentUser } from '../lib/session';
import { loadRecallView } from '../lib/memoryStore';

// The personal recall model. This is not the Recall quiz.
export default function RecallConstellation() {
  const [model, setModel] = useState(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    currentUser().then(async (user) => {
      if (!user) {
        if (alive) setModel(null);
        return;
      }
      try {
        const next = await loadRecallView(user.id);
        if (alive) setModel(next);
      } catch (e) {
        if (alive) setError(e.message || 'The recall model could not load.');
      }
    });
    return () => { alive = false; };
  }, []);

  return (
    <section id="recall-model" className="card recall-constellation" aria-label="Recall model" style={{ maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
      <div className="kicker">Recall model</div>
      <h2 style={{ marginTop: 4, fontSize: '1.15rem', overflowWrap: 'anywhere' }}>How likely the next review is to stick</h2>
      {error && <p className="err">{error}</p>}
      {model === undefined && !error && <p className="muted">Loading your review history</p>}
      {model === null && !error && <p className="muted">Sign in to see your recall model.</p>}
      {model && <RecallBody model={model} />}
    </section>
  );
}

function nextLine(points) {
  const queued = (points || []).filter(point => point && point.due && point.name);
  if (!queued.length) return '';
  const today = new Date().toISOString().slice(0, 10);
  const ordered = [...queued].sort((a, b) => String(a.due).localeCompare(String(b.due)));
  const dueNow = ordered.filter(point => String(point.due).slice(0, 10) <= today);
  const pick = dueNow.length ? [...dueNow].sort((a, b) => a.mean - b.mean)[0] : ordered[0];
  const dueDay = String(pick.due).slice(0, 10);
  const when = dueDay <= today ? 'now' : `on ${dueDay}`;
  const detail = pick.phrase ? ` ${pick.phrase}.` : '';
  return `Next: review ${pick.name} ${when}.${detail}`;
}

function chartLabel(point) {
  const pct = `${Math.round(point.mean * 100)}%`;
  const max = point.mean > 0.58 ? 12 : 16;
  const name = point.name.length > max ? `${point.name.slice(0, max - 1)}…` : point.name;
  return `${name} ${pct}`;
}

function RecallBody({ model }) {
  const { fit, validation, bands, points } = model;
  const claim = validation.claim
    ? `The model predicted your recall better than the generic curve on the last ${validation.nTest} reviews.`
    : `Validation is not yet conclusive (${validation.nTest} test reviews).`;
  const summary = nextLine(points);
  const rowH = 34;
  const height = points.length ? 16 + points.length * rowH : 0;
  return (
    <>
      {summary ? <p style={{ fontSize: 16, lineHeight: 1.45, margin: '8px 0', overflowWrap: 'anywhere' }}>{summary}</p> : null}
      {points.length === 0 ? <p className="muted" style={{ fontSize: 15, overflowWrap: 'anywhere' }}>No stability stored yet. Save a journal entry and it appears here.</p> : null}
      <p className="muted" style={{ fontSize: 15, overflowWrap: 'anywhere' }}>
        These numbers are a starting model, not a measured fact about memory. Parameter uncertainty only: the band does not include the variability of real recall.
      </p>
      {fit.learning ? (
        <p style={{ fontSize: 16, lineHeight: 1.45, overflowWrap: 'anywhere' }}>The model is still learning ({fit.n} of 8 reviews). The starting value is k = 1. That is not a fitted estimate.</p>
      ) : (
        <p style={{ fontSize: 16, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
          Personal multiplier <strong style={{ fontSize: '1.6rem' }}>{fit.k.toFixed(2)}</strong>, interval {fit.lo.toFixed(2)} to {fit.hi.toFixed(2)}.
          {fit.early ? ' Early estimate.' : ''}
        </p>
      )}
      <p style={{ fontSize: 16, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{claim}</p>
      {points.length > 0 && (
      <svg className="constellation" viewBox={`0 0 320 ${height}`} role="img" aria-label="Topics by estimated recall" style={{ width: '100%', maxWidth: '100%', height: 'auto', overflow: 'hidden', display: 'block' }}>
        {points.map((point, index) => {
          const cx = 28 + point.mean * 200;
          const cy = 22 + index * rowH;
          const rightSide = point.mean > 0.58;
          return (
            <g key={point.id}>
              <circle
                cx={cx}
                cy={cy}
                r={4 + Math.min(8, Math.log2(point.stability + 1))}
                fill="var(--accent)"
                opacity="0.85"
              />
              <text
                x={rightSide ? cx - 12 : cx + 12}
                y={cy + 4}
                fontSize="13"
                fill="var(--ink)"
                textAnchor={rightSide ? 'end' : 'start'}
              >
                {chartLabel(point)}
              </text>
            </g>
          );
        })}
      </svg>
      )}
      {points.slice(0, 6).map(point => (
        <p key={point.id} className="muted" style={{ fontSize: 15, overflowWrap: 'anywhere' }}>{point.name}. {point.phrase}.</p>
      ))}
      {bands.map(band => (
        <p key={band.lo} className="muted" style={{ fontSize: 15, overflowWrap: 'anywhere' }}>
          Predicted {Math.round(band.lo * 100)}–{Math.round(band.hi * 100)}%: {band.label || `${Math.round(band.rate * 100)}% remembered, ${band.count} reviews`}
        </p>
      ))}
    </>
  );
}
