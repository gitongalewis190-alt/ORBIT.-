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
    <section id="recall-model" className="card recall-constellation" aria-label="Recall model">
      <div className="kicker">Recall model</div>
      <h2 style={{ marginTop: 4 }}>How likely the next review is to stick</h2>
      {error && <p className="err">{error}</p>}
      {model === undefined && !error && <p className="muted">Loading your review history</p>}
      {model === null && !error && <p className="muted">Sign in to see your recall model.</p>}
      {model && <RecallBody model={model} />}
    </section>
  );
}

function RecallBody({ model }) {
  const { fit, validation, bands, points } = model;
  const claim = validation.claim
    ? `The model predicted your recall better than the generic curve on the last ${validation.nTest} reviews.`
    : `Validation is not yet conclusive (${validation.nTest} test reviews).`;
  return (
    <>
      <p className="muted">
        These numbers are a starting model, not a measured fact about memory. Parameter uncertainty only: the band does not include the variability of real recall.
      </p>
      {fit.learning ? (
        <p>The model is still learning ({fit.n} of 8 reviews). The starting value is k = 1. That is not a fitted estimate.</p>
      ) : (
        <p>
          Personal multiplier {fit.k.toFixed(2)}, interval {fit.lo.toFixed(2)} to {fit.hi.toFixed(2)}.
          {fit.early ? ' Early estimate.' : ''}
        </p>
      )}
      <p>{claim}</p>
      <svg className="constellation" viewBox="0 0 320 140" role="img" aria-label="Topics by estimated recall">
        {points.length === 0 && <text x="16" y="72" fill="var(--muted)" fontSize="13">No stability stored yet. Save a journal entry and it appears here.</text>}
        {points.map((point, index) => (
          <g key={point.id}>
            <circle
              cx={24 + point.mean * 270}
              cy={28 + (index % 4) * 26}
              r={4 + Math.min(8, Math.log2(point.stability + 1))}
              fill="var(--accent)"
              opacity="0.85"
            />
            <text x={24 + point.mean * 270 + 10} y={32 + (index % 4) * 26} fontSize="11" fill="var(--ink)">
              {point.name.slice(0, 22)}
            </text>
          </g>
        ))}
      </svg>
      {points.slice(0, 6).map(point => (
        <p key={point.id} className="muted">{point.name}. {point.phrase}.</p>
      ))}
      {bands.map(band => (
        <p key={band.lo} className="muted">
          Predicted {Math.round(band.lo * 100)}–{Math.round(band.hi * 100)}%: {band.label || `${Math.round(band.rate * 100)}% remembered, ${band.count} reviews`}
        </p>
      ))}
    </>
  );
}
