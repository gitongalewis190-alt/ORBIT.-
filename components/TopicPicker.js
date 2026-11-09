'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fieldColor } from '../lib/palette';
import { searchTopics } from '../lib/search';

// A themed topic search. Type to filter, use the arrow keys to move, Enter to choose,
// and Escape to close. Each result is marked with its field colour.
// Accepts onPick (preferred) or onChange, so callers that use either name work.
export default function TopicPicker({ topics, value = null, onPick, onChange, placeholder = 'Search your topics' }) {
  const pick = onPick ?? onChange;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);

  const results = useMemo(() => {
    if (!query.trim()) return topics.slice(0, 8);
    return searchTopics(topics, query).slice(0, 30);
  }, [query, topics]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  // Close when the user taps anywhere outside the picker.
  useEffect(() => {
    function outside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);

  function choose(topic) {
    pick?.(topic);
    setQuery('');
    setOpen(false);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive(a => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      if (results[active]) {
        e.preventDefault();
        choose(results[active]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="picker" ref={boxRef}>
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-label="Search your topics"
        value={query}
        placeholder={value?.title ? `Selected: ${value.title}. Search to change` : placeholder}
        onFocus={() => setOpen(true)}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <div className="picker-list" role="listbox">
          {results.length === 0 && (
            <div className="picker-empty">No topic matches. Try a shorter word, or add it on the Topics screen.</div>
          )}
          {results.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="option"
              aria-selected={i === active}
              className={`picker-item ${i === active ? 'is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(t)}
            >
              <span className="picker-dot" style={{ background: fieldColor(t.fieldId) }} aria-hidden="true" />
              <span className="picker-text">
                <span className="picker-title">{t.title}</span>
                <span className="picker-sub">{t.field}{t.section ? ` · ${t.section}` : ''}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
