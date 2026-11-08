'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { currentUser } from '../../lib/session';
import { loadResonance, loadWeaves, resonancePhrase, saveWeave } from '../../lib/resonance';
import { play } from '../../lib/sound';
import { toast } from '../../lib/toast';
import { RelatedStrip } from '../../components/MenuDrawer';

export default function ResonancePage() {
  const [field, setField] = useState(null);
  const [weaves, setWeaves] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const uidRef = useRef(null);

  useEffect(() => {
    let alive = true;
    currentUser().then(async (user) => {
      if (!user) {
        if (alive) { setLoading(false); setField(null); }
        return;
      }
      try {
        uidRef.current = user.id;
        const [data, woven] = await Promise.all([
          loadResonance(user.id),
          loadWeaves(user.id),
        ]);
        if (alive) {
          setField(data);
          setWeaves(woven);
        }
      } catch (e) {
        if (alive) setError(e.message || 'Could not read the resonance field.');
      } finally {
        if (alive) setLoading(false);
      }
    });
    return () => { alive = false; };
  }, []);

  const nodes = useMemo(() => {
    if (!field?.topics?.length) return [];
    const n = field.topics.length;
    return field.topics.map((t, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const r = 118;
      return {
        ...t,
        x: 160 + Math.cos(angle) * r,
        y: 160 + Math.sin(angle) * r,
      };
    });
  }, [field]);

  const edges = useMemo(() => {
    if (!field?.resonances?.length || !nodes.length) return [];
    const byTitle = Object.fromEntries(nodes.map(n => [n.title, n]));
    return field.resonances.slice(0, 12).map(p => ({
      ...p,
      ax: byTitle[p.a]?.x,
      ay: byTitle[p.a]?.y,
      bx: byTitle[p.b]?.x,
      by: byTitle[p.b]?.y,
    })).filter(e => e.ax != null && e.bx != null);
  }, [field, nodes]);

  async function weave(bridge) {
    play('success');
    if (uidRef.current) {
      try {
        await saveWeave(uidRef.current, bridge);
        setWeaves(list => [{
          id: `local-${Date.now()}`,
          prompt: bridge.prompt,
          topics: bridge.topics,
          shared: bridge.shared,
          created_at: new Date().toISOString(),
        }, ...list]);
      } catch (e) {
        toast(e.message || 'The bridge was not saved to your account.', 'warn');
      }
    }
    const params = new URLSearchParams({
      synthesis: '1',
      prompt: bridge.prompt,
    });
    toast('Opening journal with the bridge.', 'info');
    window.location.href = `/journal?${params.toString()}`;
  }

  if (loading) {
    return (
      <div className="fade-in">
        <h1>Resonance</h1>
        <p className="muted">Reading the field…</p>
      </div>
    );
  }

  if (!field) {
    return (
      <div className="fade-in">
        <h1>Resonance</h1>
        <p className="muted">Sign in to see the conceptual field you have been building.</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <h1>Resonance</h1>
      <RelatedStrip ids={['atlas', 'journal-capture', 'rings']} />
      <p className="muted">Conceptual gravity between what you have already learned.</p>

      {error && <p className="err">{error}</p>}

      <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
        <div className="kicker">Density</div>
        <div style={{
          fontSize: 48,
          fontWeight: 650,
          letterSpacing: '-0.03em',
          color: 'var(--accent)',
          lineHeight: 1,
          margin: '6px 0 4px',
        }}>
          {field.density}
        </div>
        <div className="muted" style={{ fontSize: 13 }}>
          {resonancePhrase(field.density)}
        </div>
        <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          {field.entryCount} entries · {field.topicCount} topics in the field
        </div>
        <svg width="100%" height="8" viewBox="0 0 100 8" style={{ marginTop: 14, display: 'block' }}>
          <rect x="0" y="2" width="100" height="4" rx="2" fill="var(--ring-track)" />
          <rect x="0" y="2" width={field.density} height="4" rx="2" fill="var(--accent)" />
        </svg>
      </div>

      {nodes.length > 1 && (
        <div className="card" style={{ padding: 12 }}>
          <div className="kicker">Field</div>
          <svg viewBox="0 0 320 320" width="100%" style={{ display: 'block', margin: '8px 0' }}>
            {edges.map((e, i) => (
              <line
                key={i}
                x1={e.ax}
                y1={e.ay}
                x2={e.bx}
                y2={e.by}
                stroke={e.crossField ? 'var(--accent)' : 'var(--line)'}
                strokeWidth={e.crossField ? 1.6 : 1}
                strokeOpacity={0.45 + e.score * 0.5}
              />
            ))}
            {nodes.map((n, i) => (
              <g key={i}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.entryCount > 2 ? 7 : 5}
                  fill={n.avgConfidence >= 4 ? 'var(--accent)' : 'var(--surface)'}
                  stroke="var(--ink)"
                  strokeWidth="1.2"
                />
                <text
                  x={n.x}
                  y={n.y + 18}
                  textAnchor="middle"
                  fontSize="8"
                  fill="var(--muted)"
                  style={{ pointerEvents: 'none' }}
                >
                  {n.title.length > 18 ? n.title.slice(0, 16) + '…' : n.title}
                </text>
              </g>
            ))}
          </svg>
          <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
            Nodes are topics. Lines are shared conceptual gravity. Accent lines cross fields.
          </p>
        </div>
      )}

      {field.bridges.length > 0 && (
        <>
          <h2>Bridges</h2>
          {field.bridges.map((b, i) => (
            <div key={i} className="card">
              <p style={{ margin: '0 0 10px', lineHeight: 1.45 }}>{b.prompt}</p>
              <div style={{ marginBottom: 10 }}>
                {b.shared.map(term => (
                  <span key={term} className="tag">{term}</span>
                ))}
              </div>
              <button className="btn accent sm" onClick={() => weave(b)}>
                Weave into journal
              </button>
            </div>
          ))}
        </>
      )}

      {weaves.length > 0 && (
        <>
          <h2>Woven</h2>
          {weaves.map(w => (
            <div key={w.id} className="card">
              <p style={{ margin: 0, lineHeight: 1.45 }}>{w.prompt}</p>
              <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
                Saved to your account
              </p>
            </div>
          ))}
        </>
      )}

      <h2>Strongest resonances</h2>
      {field.resonances.length ? field.resonances.map((p, i) => (
        <div key={i} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              {p.a} <span className="muted" style={{ fontWeight: 400 }}>↔</span> {p.b}
            </div>
            <span className="tag" style={{ margin: 0 }}>{Math.round(p.score * 100)}%</span>
          </div>
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            {p.fieldA}{p.crossField ? ' · ' + p.fieldB : ''}
          </div>
          <div style={{ marginTop: 8 }}>
            {p.shared.slice(0, 5).map(term => (
              <span key={term} className="tag">{term}</span>
            ))}
          </div>
        </div>
      )) : (
        <p className="muted">
          Not enough shared conceptual mass yet. Write entries with deliberate key points and the field will answer.
        </p>
      )}

      <div className="row" style={{ marginTop: 20 }}>
        <Link href="/" className="btn">Today</Link>
        <Link href="/journal" className="btn accent">Journal</Link>
      </div>
    </div>
  );
}
