'use client';

import { useRef, useState } from 'react';
import { HIGHLIGHTS } from '../lib/richtext';

// Full-screen editor for a published entry. Exit, Save, previous and next entry, formatting,
// and twelve highlight colours. Markers match the journal: **bold**, *italic*, __underline__, ==colour:highlight==.
export default function FullEditor({ title, value, onSave, onClose, onPrev, onNext }) {
  const [draft, setDraft] = useState(value ?? '');
  const [colour, setColour] = useState('yellow');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  function wrap(open, close) {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    // With nothing selected, wrap a placeholder word so no empty markers are written.
    const sel = draft.slice(s, e) || 'text';
    setDraft(draft.slice(0, s) + open + sel + close + draft.slice(e));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + open.length, s + open.length + sel.length);
    });
  }

  async function save() {
    if (busy || words < 1) return;
    setBusy(true);
    try {
      await onSave(draft);
    } finally {
      setBusy(false);
    }
  }

  const bar = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' };
  const btn = { padding: '8px 14px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer' };
  const dim = { ...btn, opacity: 0.4, cursor: 'default' };

  return (
    <div role="dialog" aria-modal="true" aria-label={`Edit entry: ${title}`}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'var(--surface-0)', display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div style={{ ...bar, justifyContent: 'space-between', padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}>
        <button type="button" style={btn} onClick={onClose} disabled={busy}>Exit</button>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40%' }}>{title}</span>
        <button type="button" style={{ ...btn, background: 'var(--text-accent)', color: 'var(--surface-2)', border: 'none' }} onClick={save} disabled={busy || words < 1}>
          {busy ? 'Saving' : 'Save'}
        </button>
      </div>

      <div style={{ ...bar, justifyContent: 'space-between', padding: '8px 16px' }}>
        <button type="button" style={onPrev ? btn : dim} onClick={onPrev ?? undefined} disabled={!onPrev}>Previous entry</button>
        <button type="button" style={onNext ? btn : dim} onClick={onNext ?? undefined} disabled={!onNext}>Next entry</button>
      </div>

      <div style={{ ...bar, padding: '6px 16px' }} role="toolbar" aria-label="Formatting">
        <button type="button" style={btn} onMouseDown={e => e.preventDefault()} onClick={() => wrap('**', '**')}>Bold</button>
        <button type="button" style={btn} onMouseDown={e => e.preventDefault()} onClick={() => wrap('*', '*')}>Italic</button>
        <button type="button" style={btn} onMouseDown={e => e.preventDefault()} onClick={() => wrap('__', '__')}>Underline</button>
      </div>

      <div style={{ padding: '6px 16px' }} aria-label="Highlight colour">
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Highlight colour</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(HIGHLIGHTS).map(([key, hex]) => (
            <button key={key} type="button" aria-label={`Highlight ${key}`} aria-pressed={colour === key}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { setColour(key); wrap(`==${key}:`, '=='); }}
              style={{ width: 32, height: 32, borderRadius: 999, background: hex, cursor: 'pointer',
                border: colour === key ? '2px solid var(--text-primary)' : '0.5px solid var(--border-strong)' }} />
          ))}
        </div>
      </div>

      <textarea
        ref={ref}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        aria-label="Entry text"
        style={{ flex: 1, margin: '0 16px', padding: 14, fontSize: 17, lineHeight: 1.7, border: 'none', outline: 'none',
          background: 'transparent', color: 'var(--text-primary)', resize: 'none' }}
      />

      <div style={{ padding: '8px 16px', fontSize: 13, color: 'var(--text-secondary)', borderTop: '0.5px solid var(--border)' }}>
        {words} {words === 1 ? 'word' : 'words'}
      </div>
    </div>
  );
}
