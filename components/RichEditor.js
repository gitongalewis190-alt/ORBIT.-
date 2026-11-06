'use client';
import { useRef } from 'react';
import { applyFormat } from '../lib/richtext';

const TOOLS = [
  { kind: 'bold', label: 'B', title: 'Bold (Ctrl or Cmd B)', cls: 'tool-bold' },
  { kind: 'italic', label: 'I', title: 'Italic (Ctrl or Cmd I)', cls: 'tool-italic' },
  { kind: 'underline', label: 'U', title: 'Underline (Ctrl or Cmd U)', cls: 'tool-underline' },
  { kind: 'highlight', label: 'H', title: 'Highlight', cls: 'tool-highlight' },
  { kind: 'bullet', label: '•', title: 'Bullet list', cls: 'tool-bullet' },
];
const SHORTCUTS = { b: 'bold', i: 'italic', u: 'underline' };

// A wide writing area with a formatting toolbar. Selected text is wrapped in place.
export default function RichEditor({ value, onChange, placeholder, minHeight = 260, label }) {
  const ref = useRef(null);

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

  return (
    <div className="rich">
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
      </div>
      <textarea
        ref={ref}
        className="rich-area"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={{ minHeight }}
        spellCheck
        autoCapitalize="sentences"
      />
    </div>
  );
}
