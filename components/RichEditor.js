'use client';
import { useEffect, useRef, useState } from 'react';
import { applyFormat } from '../lib/richtext';
import { autocorrectInput, autocorrectOn } from '../lib/autocorrect';
import Dictate from './Dictate';

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
  const [menu, setMenu] = useState(false);

  useEffect(() => { setAuto(autocorrectOn()); }, []);

  function run(kind) {
    const el = ref.current;
    if (!el) return;
    const result = applyFormat(value, el.selectionStart, el.selectionEnd, kind);
    onChange(result.text);
    setMenu(false);
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
      <div className="rich-toolbar">
        <button
          type="button"
          className="rich-tool"
          aria-expanded={menu}
          aria-controls="write-tools"
          onMouseDown={e => e.preventDefault()}
          onClick={() => setMenu(open => !open)}
        >
          {menu ? 'Close tools' : 'Tools'}
        </button>
        <Dictate onText={text => onChange(value ? `${value.trimEnd()} ${text}` : text)} />
      </div>
      {menu && (
        <div id="write-tools" className="tool-menu" role="menu" aria-label={label ?? 'Formatting'}>
          {TOOLS.map(t => (
            <button
              key={t.kind}
              type="button"
              role="menuitem"
              className={t.cls}
              onMouseDown={e => e.preventDefault()}
              onClick={() => run(t.kind)}
            >
              {t.title}
            </button>
          ))}
          {onFont && FONTS.map(f => (
            <button
              key={f.key}
              type="button"
              role="menuitem"
              aria-pressed={font === f.key}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onFont(f.key); setMenu(false); }}
            >
              Font · {f.label}
            </button>
          ))}
        </div>
      )}
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
