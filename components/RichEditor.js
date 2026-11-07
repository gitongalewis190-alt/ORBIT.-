'use client';
import { useEffect, useRef, useState } from 'react';
import { applyFormat } from '../lib/richtext';
import { autocorrectInput, autocorrectOn } from '../lib/autocorrect';

// Toolbar tools. Each one wraps or converts the selected text in place.
const TOOLS = [
  { kind: 'bold', label: 'B', title: 'Bold (Ctrl or Cmd B)', cls: 'tool-bold' },
  { kind: 'italic', label: 'I', title: 'Italic (Ctrl or Cmd I)', cls: 'tool-italic' },
  { kind: 'underline', label: 'U', title: 'Underline (Ctrl or Cmd U)', cls: 'tool-underline' },
  { kind: 'highlight', label: 'Mark', title: 'Highlight', cls: 'tool-highlight' },
  { kind: 'heading', label: 'Heading', title: 'Heading for this line', cls: 'tool-heading' },
  { kind: 'bullet', label: '• List', title: 'Bullet list', cls: 'tool-bullet' },
  { kind: 'numbered', label: '1. List', title: 'Numbered list', cls: 'tool-numbered' },
];

export const FONTS = [
  { key: 'sans', label: 'Sans' },
  { key: 'serif', label: 'Serif' },
  { key: 'mono', label: 'Mono' },
];

const SHORTCUTS = { b: 'bold', i: 'italic', u: 'underline' };

// A wide writing area with a formatting toolbar and a font choice.
// Typing is corrected as you go when autocorrect is on (see lib/autocorrect.js).
export default function RichEditor({ value, onChange, placeholder, minHeight = 260, label, font = 'sans', onFont }) {
  const ref = useRef(null);
  const [auto, setAuto] = useState(true);

  useEffect(() => { setAuto(autocorrectOn()); }, []);

  function run(kind) {
    const el = ref.current;
    if (!el) return;
    const result = applyFormat(value, el.selectionStart, el.selectionEnd, kind);
    onChange(result.text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.start, result.end);
    });
  }

  function onKeyDown(e) {
    if (!(e.metaKey || e.ctrlKey)) return;
    const kind = SHORTCUTS[e.key.toLowerCase()];
    if (kind) {
      e.preventDefault();
      run(kind);
    }
  }

  // Reads each typed character. Only single characters and Enter are corrected, so pasted
  // text and phone predictions are left exactly as they were written.
  function onInput(e) {
    const el = e.target;
    const native = e.nativeEvent;
    let typed = null;
    if (native?.inputType === 'insertText' && typeof native.data === 'string' && native.data.length === 1) typed = native.data;
    if (native?.inputType === 'insertLineBreak') typed = '\n';

    if (auto && typed) {
      const fixed = autocorrectInput(el.value, el.selectionStart, typed);
      if (fixed.text !== el.value) {
        onChange(fixed.text);
        requestAnimationFrame(() => {
          if (ref.current) ref.current.setSelectionRange(fixed.cursor, fixed.cursor);
        });
        return;
      }
    }
    onChange(el.value);
  }

  const fontClass = font === 'serif' ? 'f-serif' : font === 'mono' ? 'f-mono' : '';

  return (
    <div className={`rich ${fontClass}`}>
      <div className="rich-toolbar" role="toolbar" aria-label={label ?? 'Formatting'}>
        {TOOLS.map(t => (
          <button
            key={t.kind}
            type="button"
            className={`rich-tool ${t.cls}`}
            title={t.title}
            aria-label={t.title}
            onMouseDown={e => e.preventDefault()}
            onClick={() => run(t.kind)}
          >
            {t.label}
          </button>
        ))}
        {onFont && (
          <select
            className="rich-font"
            aria-label="Font"
            value={font}
            onChange={e => onFont(e.target.value)}
          >
            {FONTS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        )}
      </div>
      <textarea
        ref={ref}
        className="rich-area"
        value={value}
        onChange={onInput}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={{ minHeight }}
        spellCheck
        autoCapitalize="sentences"
      />
    </div>
  );
}
