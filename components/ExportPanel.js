'use client';
import { useState } from 'react';
import { play } from '../lib/sound';
import { toast } from '../lib/toast';

// Your whole record, for reading on paper or a computer, or for keeping safe.
export default function ExportPanel({ uid }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  async function runPdf() {
    if (busy || !uid) return;
    setBusy(true);
    try {
      const { buildRecordPdf } = await import('../lib/export');
      const { pages, entries } = await buildRecordPdf(uid, setStatus);
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

  return (
    <>
      <h2>Export your record</h2>
      <div className="card">
        <p className="muted" style={{ marginTop: 0, lineHeight: 1.5 }}>
          <strong>Printable record (PDF).</strong> Your profile, statistics, week in review, every award,
          every journal entry in full, your study log, review schedule, focus time, topic library and the
          decision log. Opens in any PDF reader, prints on A4, and needs no app or internet.
        </p>
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
    </>
  );
}
