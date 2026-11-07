'use client';

import { useMemo, useRef, useState } from 'react';
import { layoutGraph } from '../../lib/atlas/graph';

const COLOURS = [
  ['psychology', '#c4623d'],
  ['philosophy', '#3b7a6a'],
  ['business', '#b08a2e'],
  ['art', '#9b5fa8'],
  ['computer', '#3f7fb5'],
  ['artificial', '#2f9a8c'],
  ['physics', '#7a6ad8'],
  ['biology', '#5f9b3a'],
  ['neuroscience', '#c05a8a'],
];

const PAN_SLOP = 6;

export function disciplineColor(name) {
  const text = String(name || '').toLowerCase();
  const found = COLOURS.find(([key]) => text.includes(key));
  return found ? found[1] : '#8a867f';
}

function shortName(name) {
  const text = String(name || '');
  return text.length > 16 ? `${text.slice(0, 15)}…` : text;
}

export default function KnowledgeGraph({ concepts, edges, selectedId, pathIds = [], onSelect }) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const gesture = useRef(null);
  const moved = useRef(false);
  const shown = concepts.slice(0, 80);
  const nodes = useMemo(() => layoutGraph(shown), [shown]);
  const byId = new Map(nodes.map(node => [node.id, node]));
  const onPath = new Set(pathIds);

  function nodeFromEvent(event) {
    const el = event.target?.closest?.('[data-node]');
    if (!el) return null;
    const key = el.getAttribute('data-node');
    const node = nodes.find(item => String(item.id) === key);
    return node ? node.id : null;
  }

  function pointerDown(event) {
    if (event.button != null && event.button !== 0) return;
    moved.current = false;
    gesture.current = {
      x: event.clientX,
      y: event.clientY,
      pan,
      moved: false,
      nodeId: nodeFromEvent(event),
    };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* already captured or unsupported */ }
  }

  function pointerMove(event) {
    const drag = gesture.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) <= PAN_SLOP) return;
    drag.moved = true;
    moved.current = true;
    setPan({ x: drag.pan.x + dx, y: drag.pan.y + dy });
  }

  function finish(event, allowSelect) {
    const drag = gesture.current;
    if (!drag) return;
    const dx = event?.clientX != null ? event.clientX - drag.x : 0;
    const dy = event?.clientY != null ? event.clientY - drag.y : 0;
    const didMove = drag.moved || moved.current || Math.hypot(dx, dy) > PAN_SLOP;
    const nodeId = drag.nodeId;
    if (didMove) moved.current = true;
    gesture.current = null;
    if (allowSelect && !didMove && nodeId != null) {
      const id = nodeId;
      setTimeout(() => {
        if (moved.current) return;
        onSelect(id);
      }, 0);
    }
  }

  return (
    <div className="atlas-graph">
      <div className="row" style={{ marginTop: 0 }}>
        <button type="button" className="btn sm" onClick={() => setScale(value => Math.min(2.2, value + 0.15))}>Closer</button>
        <button type="button" className="btn sm" onClick={() => setScale(value => Math.max(0.6, value - 0.15))}>Further</button>
        <button type="button" className="btn sm" onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}>Fit</button>
      </div>
      <svg
        viewBox="0 0 1000 640"
        role="img"
        aria-label="Knowledge graph"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={event => finish(event, true)}
        onPointerCancel={event => finish(event, false)}
        onLostPointerCapture={() => { gesture.current = null; }}
      >
        <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
          {edges.map(edge => {
            const a = byId.get(edge.source_id);
            const b = byId.get(edge.target_id);
            if (!a || !b) return null;
            const marked = onPath.has(edge.source_id) && onPath.has(edge.target_id);
            return (
              <line
                key={edge.id}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={marked ? 'var(--accent)' : 'var(--line)'}
                strokeWidth={marked ? 2.5 : 1.2}
                strokeDasharray={edge.verification === 'verified' ? '0' : '5 4'}
              />
            );
          })}
          {nodes.map(node => (
            <g
              key={node.id}
              data-node={String(node.id)}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                if (moved.current) return;
                onSelect(node.id);
              }}
            >
              <circle
                cx={node.x} cy={node.y} r={selectedId === node.id ? 16 : 11}
                fill={disciplineColor(node.discipline)}
                stroke={selectedId === node.id ? 'var(--ink)' : 'transparent'}
                strokeWidth="2"
              />
              <text x={node.x + 14} y={node.y + 4} fontSize="11" fill="var(--ink)">{shortName(node.name)}</text>
            </g>
          ))}
        </g>
      </svg>
      {concepts.length > shown.length && <p className="muted">Showing 80 concepts. Search the list for the rest.</p>}
    </div>
  );
}
