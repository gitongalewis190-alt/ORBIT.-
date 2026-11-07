'use client';
import { useCallback, useEffect, useState } from 'react';
import { play } from '../lib/sound';
import { downloadBlob, printBlob } from '../lib/download';
import { toast } from '../lib/toast';
import { WINDOWS, rangeFor, createRecord, listRecords, purgeExpired, loadRecordBlob, deleteRecord } from '../lib/printRecord';
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
  const [held, setHeld] = useState(null);
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
        toast(`Built, but it could not be kept in your log: ${res.reason}`, 'warn', 7000);
      }
    } catch (e) {
      play('error');
      toast(`Could not build the record: ${e.message}`, 'err', 6000);
    } finally {
      setBusy(false);
      setStatus('');
    }
  }

  async function hold(record) {
    if (held?.id === record.id) return held;
    setRowBusy(record.id);
    try {
      const blob = await loadRecordBlob(record);
      const next = { id: record.id, blob, title: record.title };
      setHeld(next);
      return next;
    } catch (e) {
      play('error');
      toast(`Could not open that record: ${e.message}`, 'err', 6000);
      return null;
    } finally {
      setRowBusy(null);
    }
  }

  async function saveHeld(record) {
    const file = held?.id === record.id ? held : await hold(record);
    if (file && held?.id === record.id) downloadBlob(file.blob, file.title);
  }

  async function printHeld(record) {
    const file = held?.id === record.id ? held : await hold(record);
    if (file && held?.id === record.id) printBlob(file.blob);
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
          <ul className="print-log">
            {records.map(r => {
              const ready = held?.id === r.id;
              const settings = r.settings || {};
              return (
                <li key={r.id} className="doc-card">
                  <div className="doc-card-copy">
                    <div>{when(r.created_at)}</div>
                    <div className="muted">
                      {r.window_label} · {r.pages} pages · {r.entries} entries
                    </div>
                    <div className="muted">
                      {[settings.format, settings.orientation, settings.textSize, settings.colour === false ? 'black and white' : 'colour'].filter(Boolean).join(' · ') || 'Saved record'}
                      {' · kept until '}{expires(r.expires_at)}
                    </div>
                  </div>
                  {rowBusy === r.id && (
                    <div className="doc-progress" role="status"><span /></div>
                  )}
                  <div className="doc-actions">
                    <div>
                      <button type="button" className="btn sm" onClick={() => saveHeld(r)} disabled={rowBusy === r.id}>
                        {ready ? 'Save' : 'Open'}
                      </button>
                    </div>
                    <div>
                      <button type="button" className="btn sm" onClick={() => printHeld(r)} disabled={!ready || rowBusy === r.id}>Print</button>
                    </div>
                    <div>
                      <button type="button" className="btn sm danger" onClick={() => setToDelete(r)} disabled={rowBusy === r.id}>Remove</button>
                    </div>
                  </div>
                </li>
              );
            })}
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
