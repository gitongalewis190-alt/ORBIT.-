'use client';

import { useEffect, useRef, useState } from 'react';

export default function EvidenceDrawer({ open, onClose, drawer }) {
  const ref = useRef(null);
  const [formulaOpen, setFormulaOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const node = ref.current;
    const previously = document.activeElement;
    node?.querySelector('button, a, [href]')?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previously && previously.focus) previously.focus();
    };
  }, [open, onClose]);

  if (!open || !drawer) return null;
  async function copy() {
    const safe = JSON.stringify(drawer.raw ?? {}, null, 2);
    try { await navigator.clipboard.writeText(safe); } catch { /* clipboard may be blocked */ }
  }
  return (
    <div className="evidence-root" role="presentation">
      <button type="button" className="evidence-backdrop" aria-label="Close evidence" onClick={onClose} />
      <aside ref={ref} className="evidence-drawer" role="dialog" aria-modal="true" aria-label={drawer.title}>
        <div className="row">
          <h2 style={{ margin: 0 }}>{drawer.title}</h2>
          <button type="button" className="btn sm" data-sound="tap" onClick={onClose}>Close</button>
        </div>
        <p>{drawer.verdict}</p>
        <div className="evidence-numbers">
          {(drawer.numbers || []).map(item => (
            <div key={item.label}><span className="muted">{item.label}</span><strong>{item.value}</strong></div>
          ))}
        </div>
        <h3>How it was worked out</h3>
        <p>{drawer.method}</p>
        <button type="button" className="btn sm" data-sound="toggle" aria-expanded={formulaOpen} onClick={() => setFormulaOpen(value => !value)}>
          {formulaOpen ? 'Hide the method detail' : 'Show the method detail'}
        </button>
        {formulaOpen ? <pre className="evidence-raw">{drawer.method}</pre> : null}
        <h3>Where the data comes from</h3>
        <p className="muted">{(drawer.provenance?.tables || []).join(', ') || '—'} · rows {drawer.provenance?.rows ?? '—'} · {drawer.provenance?.updated || '—'} · {drawer.provenance?.version || '—'}</p>
        {(drawer.controls || []).length ? (
          <>
            <h3>What you can do</h3>
            <div className="row">
              {drawer.controls.map(control => control.action ? (
                <button key={control.id} type="button" className="btn sm" data-sound="tap" onClick={() => window.dispatchEvent(new Event(control.action))}>{control.title}</button>
              ) : (
                <a key={control.id} className="btn sm" href={control.route} data-sound="nav">{control.title}</a>
              ))}
            </div>
          </>
        ) : null}
        <button type="button" className="btn sm" data-sound="tap" onClick={copy}>Copy details</button>
      </aside>
    </div>
  );
}
