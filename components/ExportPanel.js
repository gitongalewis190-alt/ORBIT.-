'use client';
import { useCallback, useEffect, useState } from 'react';
import { play } from '../lib/sound';
import { toast } from '../lib/toast';
import { WINDOWS, rangeFor, createRecord, listRecords, purgeExpired, downloadRecord, openRecord, deleteRecord } from '../lib/printRecord';
import { prettyDate, addDays } from '../lib/dates';
import ConfirmDialog from './ConfirmDialog';

// Shown in the document log. Dates are read in Nairobi time.
const when = iso => new Date(iso).toLocaleString('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi',
});

export default function ExportPanel({ uid }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [windowKey, setWindowKey] = useState('30');
  const [records, setRecords] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [rowBusy, setRowBusy] = useState(null);
  const [loadError, setLoadError] = useState('');

  const refresh = useCallback(async () => {
    if (!uid) return;
    try {
      setLoadError('');
      setRecords(await listRecords(uid));
    } catch (e) {
      setLoadError(e.message || 'Unknown error');
    } finally {
      setLoaded(true);
    }
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    purgeExpired(uid).catch(() => 0).finally(refresh);
  }, [uid, refresh]);

  async function runPdf() {
    if (busy || !uid) return;
    setBusy(true);
    setStatus('Starting');
    const { label, range } = rangeFor(windowKey);
    try {
      const res = await createRecord(uid, { windowLabel: label, range }, setStatus);
      play('export');
      if (res.stored) {
        toast(`Record saved: ${res.pages} pages, ${res.entries} journal entries.`, 'ok', 4500);
        refresh();
      } else {
        toast(`Downloaded, but it could not be kept in your log: ${res.reason}`, 'warn', 7000);
      }
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
      const { downloadSnapshot } = await import('../lib/backupSync');
      const snap = await downloadSnapshot(uid);
      play('export');
      toast(`Backup saved with ${snap.journal.length} journal entries.`, 'ok', 4000);
    } catch (e) {
      play('error');
      toast(`Could not build the backup: ${e.message}`, 'err', 6000);
    } finally {
      setBusy(false);
      setStatus('');
    }
  }

  async function rowAction(record, action) {
    setRowBusy(record.id);
    try {
      if (action === 'download') await downloadRecord(record);
      if (action === 'open') await openRecord(record);
      play('export');
    } catch (e) {
      play('error');
      toast(`Could not open that record: ${e.message}`, 'err', 6000);
    } finally {
      setRowBusy(null);
    }
  }

  async function confirmDelete() {
    const record = toDelete;
    if (!record) return;
    setRowBusy(record.id);
    try {
      await deleteRecord(record);
      setRecords(list => list.filter(r => r.id !== record.id));
      play('delete');
      toast('That record has been removed.', 'ok');
    } catch (e) {
      play('error');
      toast(`Could not remove that record: ${e.message}`, 'err', 6000);
    } finally {
      setRowBusy(null);
      setToDelete(null);
    }
  }

  const expires = iso => prettyDate(String(iso).slice(0, 10));

  return (
    <section className="settings-group" aria-labelledby="records-heading">
      <h2 id="records-heading">Records and backups</h2>
      <div className="card">
        <p className="muted" style={{ marginTop: 0, lineHeight: 1.5 }}>
          <strong>Printable record (PDF).</strong> Choose the period it covers. Every record you download is kept for
          in the document log below until it expires, so you can download or print it again.
        </p>

        <div className="row" style={{ marginTop: 12 }}>
        <button className="btn accent" onClick={() => window.dispatchEvent(new Event('orbit:open-print'))} disabled={!uid}>
            Create PDF record
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
        {loadError && (
          <div role="alert" style={{ marginBottom: 12 }}>
            <p className="err" style={{ margin: '0 0 8px' }}>Could not load your document log: {loadError}</p>
            <button className="btn sm" onClick={refresh}>Try again</button>
          </div>
        )}
        {!loaded ? (
          <p className="muted" style={{ margin: 0 }}>Loading your records</p>
        ) : records.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No records yet. Each PDF you create is kept here for as long as you choose when you make it.</p>
        ) : (
          <ul className="print-log" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {records.map(r => (
              <li key={r.id} className="print-log-row">
                <div>
                  <div>{when(r.created_at)}</div>
                  <div className="muted">
                    {r.window_label} · {r.pages} pages · {r.entries} entries · kept until {expires(r.expires_at)}
                  </div>
                </div>
                <div className="print-log-actions">
                  <button type="button" className="chip" onClick={() => rowAction(r, 'download')} disabled={rowBusy === r.id}>Download</button>
                  <button type="button" className="chip" onClick={() => rowAction(r, 'open')} disabled={rowBusy === r.id}>Open to print</button>
                  <button type="button" className="chip" onClick={() => setToDelete(r)} disabled={rowBusy === r.id}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Remove this record?"
        danger
        confirmLabel="Remove record"
        busy={!!rowBusy}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      >
        <p style={{ marginTop: 0 }}>
          The stored copy of this PDF will be deleted and cannot be recovered. Any copy you already downloaded to your
          phone is not affected. Your journal and other records stay as they are.
        </p>
      </ConfirmDialog>
    </section>
  );
}
