'use client';
import { useEffect, useState } from 'react';
import { play } from '../lib/sound';
import { toast } from '../lib/toast';
import { today, addDays } from '../lib/dates';

// Time windows for the printable record. 'all' means no limit.
const WINDOWS = [
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
];

const logKey = uid => `orbit.print-log.${uid}`;

function readLog(uid) {
  try {
    return JSON.parse(localStorage.getItem(logKey(uid)) || '[]');
  } catch {
    return [];
  }
}

// Keeps the most recent 50 entries so the log stays small.
function writeLog(uid, list) {
  try {
    localStorage.setItem(logKey(uid), JSON.stringify(list.slice(0, 50)));
  } catch {}
}

export default function ExportPanel({ uid }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [windowKey, setWindowKey] = useState('30');
  const [log, setLog] = useState([]);

  useEffect(() => {
    if (uid) setLog(readLog(uid));
  }, [uid]);

  function rangeFor(key) {
    const w = WINDOWS.find(x => x.key === key) ?? WINDOWS[1];
    if (!w.days) return { label: w.label, range: null };
    const now = today();
    return { label: w.label, range: { from: addDays(now, -(w.days - 1)), to: now } };
  }

  async function runPdf() {
    if (busy || !uid) return;
    setBusy(true);
    setStatus('Starting');
    const { label, range } = rangeFor(windowKey);
    try {
      const { buildRecordPdf } = await import('../lib/export');
      const { pages, entries } = await buildRecordPdf(uid, setStatus, range);
      const next = [{
        at: new Date().toISOString(),
        window: label,
        from: range?.from ?? null,
        to: range?.to ?? null,
        pages,
        entries,
      }, ...readLog(uid)];
      writeLog(uid, next);
      setLog(next.slice(0, 50));
      play('export');
      toast(`Record saved: ${pages} pages, ${entries} journal entries.`, 'ok', 4500);
    } catch (e) {
      play('error');
      toast(`Could not build the record: ${e.message}`, 'err', 6000);
    } finally {
      setBusy(false);
      setStatus('');
    }
  }

  async function runJson() {
    if (busy || !uid) return;
    setBusy(true);
    try {
      const { buildBackupJson } = await import('../lib/export');
      const { entries } = await buildBackupJson(uid, setStatus);
      play('export');
      toast(`Backup saved with ${entries} journal entries.`, 'ok', 4000);
    } catch (e) {
      play('error');
      toast(`Could not build the backup: ${e.message}`, 'err', 6000);
    } finally {
      setBusy(false);
      setStatus('');
    }
  }

  const fmt = iso => new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi',
  });

  return (
    <>
      <h2>Export your record</h2>
      <div className="card">
        <p className="muted" style={{ marginTop: 0, lineHeight: 1.5 }}>
          <strong>Printable record (PDF).</strong> Choose the period it covers. Journal entries, the decision log
          and focus time are limited to that period, and only awards earned in it are printed, with the three
          closest to unlocking. Every medal back carries your name.
        </p>

        <div className="seg" role="radiogroup" aria-label="Time window" style={{ margin: '12px 0' }}>
          {WINDOWS.map(w => (
            <button
              key={w.key}
              type="button"
              role="radio"
              aria-checked={windowKey === w.key}
              className={windowKey === w.key ? 'on' : ''}
              onClick={() => setWindowKey(w.key)}
              disabled={busy}
            >
              {w.label}
            </button>
          ))}
        </div>

        {busy && (
          <div className="doc-progress" role="progressbar" aria-label="Building document" aria-busy="true">
            <span />
          </div>
        )}

        <div className="row" style={{ marginTop: 0 }}>
          <button className="btn accent" onClick={runPdf} disabled={busy || !uid}>
            {busy && status ? status : 'Create PDF record'}
          </button>
        </div>

        <p className="muted" style={{ lineHeight: 1.5, marginTop: 14 }}>
          <strong>Backup (JSON).</strong> The same data in a machine-readable file, for keeping a copy or moving it
          to another tool.
        </p>
        <div className="row" style={{ marginTop: 0 }}>
          <button className="btn" onClick={runJson} disabled={busy || !uid}>Create JSON backup</button>
        </div>
      </div>

      <h2>Document log</h2>
      <div className="card">
        {log.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No records made yet. Each PDF you create is listed here.</p>
        ) : (
          <ul className="print-log" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {log.map((l, i) => (
              <li key={i} className="print-log-row">
                <span>{fmt(l.at)}</span>
                <span className="muted">{l.window} · {l.pages} pages · {l.entries} entries</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
