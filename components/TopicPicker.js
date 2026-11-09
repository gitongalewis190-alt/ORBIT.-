'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fieldColor } from '../lib/palette';
import { searchTopics } from '../lib/search';

// Topic search. Type a topic, tap it to choose it. A chosen topic shows as a chip you can clear.
// Props:
//   topics    list of { id, title, field, section, fieldId }
//   value     the chosen topic, or null
//   onPick    called with the topic, or null when cleared (onChange is accepted too)
//   loading   true while the library is still loading
//   error     message when the library failed to load
//   onRetry   reloads the library after an error
export default function TopicPicker({ topics = [], value = null, onPick, onChange, loading = false, error = '', onRetry, placeholder = 'Search your topics' }) {
  const pick = onPick ?? onChange;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);

  const results = useMemo(() => {
    if (!query.trim()) return topics.slice(0, 8);
    return searchTopics(topics, query).slice(0, 30);
  }, [query, topics]);

  useEffect(() => { setActive(0); }, [query]);

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
      {value && (
        <div className="picker-chosen" role="status">
          <span className="picker-dot" style={{ background: fieldColor(value.fieldId) }} aria-hidden="true" />
          <span className="picker-title">{value.title}</span>
          <button type="button" className="btn sm" onClick={() => pick?.(null)} aria-label={`Clear topic ${value.title}`}>Change</button>
        </div>
      )}
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-label="Search your topics"
        value={query}
        placeholder={value ? 'Search to pick a different topic' : placeholder}
        onFocus={() => setOpen(true)}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={onKeyDown}
        disabled={loading && !topics.length}
      />
      {open && (
        <div className="picker-list" role="listbox">
          {loading && !topics.length && <div className="picker-empty">Loading your topics…</div>}
          {!loading && error && (
            <div className="picker-empty" role="alert">
              Topics could not load: {error}
              {onRetry && <div style={{ marginTop: 8 }}><button type="button" className="btn sm" onClick={onRetry}>Try again</button></div>}
            </div>
          )}
          {!loading && !error && topics.length === 0 && (
            <div className="picker-empty">The topic library is empty. Add topics on the Topics screen.</div>
          )}
          {!error && topics.length > 0 && results.length === 0 && (
            <div className="picker-empty">No topic matches “{query.trim()}”. Try a shorter word, or the field name.</div>
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
