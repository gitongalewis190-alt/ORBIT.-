'use client';
import { useEffect, useState } from 'react';

// Renders messages sent with toast() from lib/toast.js.
export default function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const onToast = e => {
      const item = e.detail;
      setItems(list => [...list.slice(-2), item]);
      setTimeout(() => {
        setItems(list => list.filter(x => x.id !== item.id));
      }, item.ms);
    };
    window.addEventListener('orbit:toast', onToast);
    return () => window.removeEventListener('orbit:toast', onToast);
  }, []);

  if (!items.length) return null;

  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map(t => (
        <div key={t.id} className={`toast toast-${t.tone}`}>{t.text}</div>
      ))}
    </div>
  );
}
