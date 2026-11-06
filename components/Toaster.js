'use client';
import { useEffect, useRef, useState } from 'react';

// Messages stack in one column under the header. They never sit on top of each other,
// never cover the tab bar, and never repeat. At most three show at once; the oldest leaves first.
const MAX_VISIBLE = 3;
const LEAVE_MS = 240;

export default function Toaster() {
  const [items, setItems] = useState([]);
  const itemsRef = useRef([]);
  const lifeTimers = useRef(new Map());

  useEffect(() => {
    const commit = next => {
      itemsRef.current = next;
      setItems(next);
    };

    const remove = id => {
      commit(itemsRef.current.filter(x => x.id !== id));
    };

    const dismiss = id => {
      const life = lifeTimers.current.get(id);
      if (life) clearTimeout(life);
      lifeTimers.current.delete(id);
      const current = itemsRef.current.find(x => x.id === id);
      if (!current || current.leaving) return;
      commit(itemsRef.current.map(x => (x.id === id ? { ...x, leaving: true } : x)));
      setTimeout(() => remove(id), LEAVE_MS);
    };

    const arm = (id, ms) => {
      const old = lifeTimers.current.get(id);
      if (old) clearTimeout(old);
      lifeTimers.current.set(id, setTimeout(() => dismiss(id), ms));
    };

    const onToast = e => {
      const item = e.detail;
      const live = itemsRef.current.filter(x => !x.leaving);

      // The same message already showing: restart its timer instead of stacking a copy.
      const twin = live.find(x => x.text === item.text);
      if (twin) {
        arm(twin.id, item.ms);
        return;
      }

      // Make room: the oldest visible message leaves first.
      if (live.length >= MAX_VISIBLE) dismiss(live[0].id);

      commit([...itemsRef.current, { ...item, leaving: false }]);
      arm(item.id, item.ms);
    };

    window.addEventListener('orbit:toast', onToast);
    const timers = lifeTimers.current;
    return () => {
      window.removeEventListener('orbit:toast', onToast);
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  if (!items.length) return null;

  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map((t, i) => (
        <div
          key={t.id}
          className={`toast toast-${t.tone} ${t.leaving ? 'is-leaving' : ''}`}
          style={{ animationDelay: `${i * 40}ms` }}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
