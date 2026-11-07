'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HIGHLIGHTS } from '../lib/richtext';
import Dictate from './Dictate';

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

  const ui = (
    <div role="dialog" aria-modal="true" aria-label={`Edit entry: ${title}`} className="orbit-editor">
      <div className="orbit-editor-bar">
        <button type="button" className="btn sm" onClick={onClose} disabled={busy}>Exit</button>
        <button type="button" className="btn sm" aria-expanded={menu} aria-controls="edit-tools" onClick={() => setMenu(open => !open)}>
          {menu ? 'Close tools' : 'Tools'}
        </button>
        <Dictate onText={text => setDraft(d => (d ? `${d.trimEnd()} ${text}` : text))} />
        <button type="button" className="btn sm accent" onClick={save} disabled={busy || words < 1}>
          {busy ? 'Saving' : 'Save'}
        </button>
      </div>

      <div className="orbit-editor-title">{title}</div>

      {menu && (
        <div id="edit-tools" className="tool-menu" role="menu" aria-label="Editing tools">
          <button type="button" role="menuitem" style={{ opacity: onPrev ? 1 : 0.4 }} disabled={!onPrev} onClick={() => jump(onPrev)}>Previous entry</button>
          <button type="button" role="menuitem" style={{ opacity: onNext ? 1 : 0.4 }} disabled={!onNext} onClick={() => jump(onNext)}>Next entry</button>
          <button type="button" role="menuitem" onMouseDown={e => e.preventDefault()} onClick={() => useTool('**', '**')}>Bold</button>
          <button type="button" role="menuitem" onMouseDown={e => e.preventDefault()} onClick={() => useTool('*', '*')}>Italic</button>
          <button type="button" role="menuitem" onMouseDown={e => e.preventDefault()} onClick={() => useTool('__', '__')}>Underline</button>
          {Object.entries(HIGHLIGHTS).map(([key, hex]) => (
            <button key={key} type="button" role="menuitem"
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
        className="orbit-editor-text"
      />

      <div className="orbit-editor-count">
        {words} {words === 1 ? 'word' : 'words'}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(ui, document.body);
}
