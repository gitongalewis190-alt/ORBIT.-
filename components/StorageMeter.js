'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

// Shows two numbers: your own share of storage, and the whole project against the free limit.
// Your share is measured per row, so it is an estimate of what your data takes.
export default function StorageMeter() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    supabase.rpc('my_storage_usage').then(({ data, error }) => {
      if (!alive) return;
      if (error) setErr(error.message);
      else setData(data);
    });
    return () => { alive = false; };
  }, []);

  if (err) return <p className="err">Storage unavailable: {err}</p>;
  if (!data) return <p className="muted">Measuring storage…</p>;

  const projectPct = Math.min(100, (data.project_bytes / data.limit_bytes) * 100);
  const left = Math.max(0, data.limit_bytes - data.project_bytes);

  return (
    <section aria-label="Storage">
      <p>Project storage: {formatBytes(data.project_bytes)} of {formatBytes(data.limit_bytes)} used · {formatBytes(left)} left</p>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(projectPct)}
        style={{ height: 8, borderRadius: 4, background: '#e6dfd2', overflow: 'hidden' }}>
        <div style={{ width: `${projectPct}%`, height: '100%', background: '#b4532a' }} />
      </div>
      <p className="muted">Your data: {formatBytes(data.used_bytes)}</p>
      <ul>
        {data.parts.filter(p => p.bytes > 0).map(p => (
          <li key={p.name}>{p.name}: {formatBytes(p.bytes)}</li>
        ))}
      </ul>
    </section>
  );
}
