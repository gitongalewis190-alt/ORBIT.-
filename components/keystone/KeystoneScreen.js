'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { currentUser } from '../../lib/session';
import { loadKeystoneInputs } from '../../lib/memoryStore';
import { analyseKeystone } from '../../lib/keystone';
import Skeleton from '../Skeleton';

const EvidenceDrawer = dynamic(() => import('../inspect/EvidenceDrawer'), { ssr: false });

const HORIZONS = [[1, 'Tomorrow'], [3, '3 days'], [7, '7 days']];

function statusText(coupling) {
  if (!coupling) return 'Not assessed';
  if (coupling.status === 'validated') return `Validated on your history (${coupling.heldOut} events, held-out gain ${Number(coupling.gain).toFixed(3)})`;
  if (coupling.status === 'not supported') return 'Not supported by your history yet';
  return 'Assumed structure effect';
}

export default function KeystoneScreen() {
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [input, setInput] = useState(null);
  const [horizon, setHorizon] = useState(1);
  const [slots, setSlots] = useState(null);
  const [result, setResult] = useState(null);
  const [open, setOpen] = useState(false);
  const [asOf, setAsOf] = useState('');

  useEffect(() => {
    let alive = true;
    currentUser().then(async (user) => {
      if (!alive) return;
      if (!user) { setState('empty'); return; }
      try {
        const loaded = await loadKeystoneInputs(user.id);
        if (!alive) return;
        setInput(loaded);
        const cachedSlots = Number(localStorage.getItem('orbit.keystone.slots'));
        setSlots(Number.isFinite(cachedSlots) && cachedSlots > 0 ? cachedSlots : null);
        setAsOf(loaded.today);
        setState('ready');
      } catch (e) {
        const cached = localStorage.getItem('orbit.keystone.cache.v1');
        if (cached) {
          setResult(JSON.parse(cached));
          setAsOf('cached');
          setState('cached');
        } else {
          setError(e.message || 'Keystone could not load.');
          setState('error');
        }
      }
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!input) return;
    try {
      const analysis = analyseKeystone(input, { horizon, slots: slots || undefined });
      setResult(analysis);
      localStorage.setItem('orbit.keystone.plan', JSON.stringify(analysis.plan.ids));
      localStorage.setItem('orbit.keystone.cache.v1', JSON.stringify({
        status: analysis.coupling.status,
        heldOut: analysis.coupling.heldOut,
        gain: analysis.coupling.gain,
        coverage: analysis.facts.coverage,
        planK: analysis.plan.K,
        baselineK: analysis.plan.baselineK,
      }));
    } catch (e) {
      setError(e.message || 'Keystone could not build a plan.');
    }
  }, [input, horizon, slots]);

  if (state === 'loading') return <Skeleton lines={5} label="Loading Keystone" />;
  if (state === 'error') return <p className="err">{error}</p>;
  const coupling = result?.coupling;
  const plan = result?.plan;
  const sparse = (result?.facts?.coverage || 0) < 0.05;
  const drawer = {
    title: 'Keystone evidence',
    verdict: statusText(coupling),
    numbers: [
      { label: 'Hard coupling', value: coupling ? String(coupling.lambda.hard) : '—' },
      { label: 'Soft coupling', value: coupling ? String(coupling.lambda.soft) : '—' },
      { label: 'Held-out events', value: coupling?.heldOut == null ? '—' : String(coupling.heldOut) },
      { label: 'Held-out gain', value: coupling?.gain == null ? '—' : Number(coupling.gain).toFixed(3) },
    ],
    method: 'One-hop support only. A validated result was checked on later reviews. An assumed result is the starting guess, not a measurement. Parallax is reported separately and does not change these numbers.',
    provenance: { tables: ['review_events', 'reviews', 'atlas_edges', 'atlas_concepts', 'atlas_evidence'], rows: coupling?.heldOut ?? null, updated: asOf, version: 'k1' },
    controls: [],
    raw: { status: coupling?.status || null, version: 'k1' },
  };
  const curve = result?.curve || [];
  const max = Math.max(1, ...curve.map(point => point.nothing || 0), ...curve.map(point => point.plan || 0));
  const line = (key) => curve.map((point, index) => {
    const x = curve.length === 1 ? 0 : (index / (curve.length - 1)) * 280;
    const y = 90 - ((point[key] || 0) / max) * 80;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="fade-in">
      <h1>Keystone</h1>
      <p className="muted">{state === 'cached' ? `Showing the saved result, as of ${asOf}.` : 'Estimated concepts retained. This does not change a due date until you review.'}</p>
      <p className="tag">{statusText(coupling)}</p>
      {sparse ? <p>Few support links yet: Keystone behaves like due-date order.</p> : null}
      <div className="seg" role="group" aria-label="Horizon">
        {HORIZONS.map(([value, label]) => (
          <button key={value} type="button" data-sound="select" className={horizon === value ? 'on' : ''} onClick={() => setHorizon(value)}>{label}</button>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn" data-sound="tap" onClick={() => { const next = Math.max(1, (slots || result?.slots || 3) - 1); setSlots(next); localStorage.setItem('orbit.keystone.slots', String(next)); }}>Fewer slots</button>
        <span>{slots || result?.slots || 3} slots</span>
        <button type="button" className="btn" data-sound="tap" onClick={() => { const next = Math.min(12, (slots || result?.slots || 3) + 1); setSlots(next); localStorage.setItem('orbit.keystone.slots', String(next)); }}>More slots</button>
      </div>
      {!plan?.topics?.length ? <p className="muted">No plan yet. A fresh account has no reviews to order.</p> : (
        <>
          <p>Expected concepts retained: {plan.empty.toFixed(1)} → {plan.K.toFixed(1)}, versus {plan.baselineK.toFixed(1)} following due-date order.</p>
          {plan.topics.map(topic => (
            <div key={topic.topic_id} className="card">
              <strong>{topic.title}</strong>
              <p className="muted">supports {topic.supports} concepts · estimated recall {topic.recall == null ? '—' : `${Math.round(topic.recall * 100)}%`}</p>
              <a className="btn sm" href={`/journal?review=${topic.topic_id}`}>Review now</a>
            </div>
          ))}
        </>
      )}
      {curve.length ? (
        <svg viewBox="0 0 280 100" role="img" aria-label="Expected concepts retained, do nothing against the plan" width="100%">
          <polyline fill="none" stroke="currentColor" strokeWidth="1.7" points={line('nothing')} />
          <polyline fill="none" stroke="var(--accent)" strokeWidth="1.7" points={line('plan')} />
        </svg>
      ) : null}
      <h2>Keystone concepts</h2>
      {(result?.stake || []).slice(0, 10).map(concept => (
        <Link key={concept.id} href={`/atlas/concept/${concept.id}`} className="card" style={{ display: 'block' }}>
          {input?.names?.[concept.id] || concept.id}
          <span className="muted"> · estimated recall {concept.recall == null ? '—' : `${Math.round(concept.recall * 100)}%`}</span>
        </Link>
      ))}
      {!result?.stake?.length ? <p className="muted">No concept has an estimate yet.</p> : null}
      <p className="muted">Parallax is a separate report and does not change this plan.</p>
      <button type="button" className="btn" data-sound="open" onClick={() => setOpen(true)}>How this works</button>
      <EvidenceDrawer open={open} onClose={() => setOpen(false)} drawer={drawer} />
    </div>
  );
}
