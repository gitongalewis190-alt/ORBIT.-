'use client';

import { useMemo, useState } from 'react';
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

export function disciplineColor(name) {
  const text = String(name || '').toLowerCase();
  const found = COLOURS.find(([key]) => text.includes(key));
  return found ? found[1] : '#8a867f';
}

export default function KnowledgeGraph({ concepts, edges, selectedId, pathIds = [], onSelect }) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState(null);
  const shown = concepts.slice(0, 80);
  const nodes = useMemo(() => layoutGraph(shown), [shown]);
  const byId = new Map(nodes.map(node => [node.id, node]));
  const onPath = new Set(pathIds);

  function move(event) {
    if (!drag) return;
    const point = event.touches ? event.touches[0] : event;
    setPan({ x: drag.pan.x + point.clientX - drag.x, y: drag.pan.y + point.clientY - drag.y });
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
        onPointerDown={event => setDrag({ x: event.clientX, y: event.clientY, pan })}
        onPointerMove={move}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
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
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              <circle
                cx={node.x} cy={node.y} r={selectedId === node.id ? 16 : 11}
                fill={disciplineColor(node.discipline)}
                stroke={selectedId === node.id ? 'var(--ink)' : 'transparent'}
                strokeWidth="2"
              />
              <text x={node.x + 16} y={node.y + 4} fontSize="13" fill="var(--ink)">{node.name.slice(0, 28)}</text>
            </g>
          ))}
        </g>
      </svg>
      {concepts.length > shown.length && <p className="muted">Showing 80 concepts. Search the list for the rest.</p>}
    </div>
  );
}
