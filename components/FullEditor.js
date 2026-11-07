'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HIGHLIGHTS } from '../lib/richtext';

// Full-screen editor for a published entry. Exit and Save stay visible.
// Formatting, highlight colours, and previous/next live in one dropdown so they
// do not sit on top of the text. Markers match the journal:
// **bold**, *italic*, __underline__, ==colour:highlight==.
// Portaled to document.body: .fade-in keeps a transform after its animation,
// which would trap position:fixed inside the memory card.
export default function FullEditor({ title, value, onSave, onClose, onPrev, onNext }) {
  const [draft, setDraft] = useState(value ?? '');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const ref = useRef(null);
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  function wrap(open, close) {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const sel = draft.slice(s, e) || 'text';
    setDraft(draft.slice(0, s) + open + sel + close + draft.slice(e));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + open.length, s + open.length + sel.length);
    });
  }

  function useTool(open, close) {
    wrap(open, close);
    setMenu(false);
  }

  function jump(go) {
    if (!go) return;
    setMenu(false);
    go();
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

  const btn = {
    padding: '8px 14px', borderRadius: 999, border: '1px solid var(--border-strong)',
    background: 'transparent', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer',
  };
  const item = {
    display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px',
    border: 0, borderBottom: '0.5px solid var(--border)', background: 'transparent',
    color: 'var(--text-primary)', fontSize: 16, cursor: 'pointer',
  };

  const ui = (
    <div role="dialog" aria-modal="true" aria-label={`Edit entry: ${title}`} className="orbit-editor"
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--surface-0)', display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}>
        <button type="button" style={btn} onClick={onClose} disabled={busy}>Exit</button>
        <button type="button" style={btn} aria-expanded={menu} aria-controls="edit-tools" onClick={() => setMenu(open => !open)}>
          {menu ? 'Close tools' : 'Tools'}
        </button>
        <button type="button" style={{ ...btn, background: 'var(--text-accent)', color: 'var(--surface-2)', border: 'none' }} onClick={save} disabled={busy || words < 1}>
          {busy ? 'Saving' : 'Save'}
        </button>
      </div>

      <div style={{ padding: '8px 16px 0', fontSize: 14, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>

      {menu && (
        <div id="edit-tools" role="menu" aria-label="Editing tools"
          style={{ display: 'flex', flexDirection: 'column', maxHeight: '46vh', overflowY: 'auto', borderBottom: '0.5px solid var(--border)' }}>
          <button type="button" role="menuitem" style={{ ...item, opacity: onPrev ? 1 : 0.4 }} disabled={!onPrev} onClick={() => jump(onPrev)}>Previous entry</button>
          <button type="button" role="menuitem" style={{ ...item, opacity: onNext ? 1 : 0.4 }} disabled={!onNext} onClick={() => jump(onNext)}>Next entry</button>
          <button type="button" role="menuitem" style={item} onMouseDown={e => e.preventDefault()} onClick={() => useTool('**', '**')}>Bold</button>
          <button type="button" role="menuitem" style={item} onMouseDown={e => e.preventDefault()} onClick={() => useTool('*', '*')}>Italic</button>
          <button type="button" role="menuitem" style={item} onMouseDown={e => e.preventDefault()} onClick={() => useTool('__', '__')}>Underline</button>
          {Object.entries(HIGHLIGHTS).map(([key, hex]) => (
            <button key={key} type="button" role="menuitem" style={item}
              onMouseDown={e => e.preventDefault()}
              onClick={() => useTool(`==${key}:`, '==')}>
              <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 4, background: hex, marginRight: 10, verticalAlign: '-2px' }} />
              Highlight {key}
            </button>
          ))}
        </div>
      )}

      <textarea
        ref={ref}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        aria-label="Entry text"
        style={{ flex: 1, width: 'auto', minHeight: 0, margin: '8px 16px', padding: 14, fontSize: 17, lineHeight: 1.7, border: 'none', borderRadius: 0, outline: 'none',
          background: 'transparent', color: 'var(--text-primary)', resize: 'none' }}
      />

      <div style={{ padding: '8px 16px', fontSize: 13, color: 'var(--text-secondary)', borderTop: '0.5px solid var(--border)' }}>
        {words} {words === 1 ? 'word' : 'words'}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(ui, document.body);
}
