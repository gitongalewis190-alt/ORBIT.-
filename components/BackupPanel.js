'use client';

import { useEffect, useState } from 'react';
import { play } from '../lib/sound';
import { toast } from '../lib/toast';
import { readAssist, writeAssist } from '../lib/assist';
import { packBackup } from '../lib/backupFormat';
import ConfirmDialog from './ConfirmDialog';
import {
  connectDrive, downloadSnapshot, googleClientId, queueAutoBackup,
  readLocal, restoreSnapshot, saveGoogleClientId, uploadDrive, collectSnapshot,
} from '../lib/backupSync';

export default function BackupPanel({ uid }) {
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState('');
  const [clientId, setClientId] = useState('');
  const [auto, setAuto] = useState(true);
  const [pending, setPending] = useState(null);
  useEffect(() => { setAuto(readAssist(localStorage).autoBackup !== false); }, []);

  async function run(fn) {
    if (busy || !uid) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      play('error');
      toast(e.message, 'err', 6000);
    } finally {
      setBusy(false);
    }
  }

  function saved(report) {
    play('save');
    const awards = report.awards ? `${report.awards} awards` : 'awards';
    toast(`Restored ${report.journal} journal entries, ${awards}, settings and personal details.`, 'ok', 5000);
  }

  function confirmRestore() {
    const job = pending;
    setPending(null);
    if (!job) return;
    run(async () => {
      if (job.kind === 'phone') {
        const local = await readLocal();
        if (!local) throw new Error('No backup is stored on this phone yet.');
        saved(await restoreSnapshot(uid, local));
        return;
      }
      saved(await restoreSnapshot(uid, job.text));
      if (job.kind === 'paste') setPaste('');
    });
  }

  return (
    <>
    <div className="card">
      <div className="row" style={{ marginTop: 0 }}>
        <button className="btn accent" disabled={busy || !uid} onClick={() => run(async () => {
          const snap = await downloadSnapshot(uid);
          play('export');
          toast(`Exported ${snap.journal.length} journal entries for restore.`, 'ok');
        })}>Export</button>
        <button className="btn" disabled={busy || !uid} onClick={() => setPending({ kind: 'phone' })}>Restore this phone</button>
      </div>

      <div className="kicker">Restore</div>
      <input type="file" accept="application/json,.json,text/plain,.txt" onChange={e => {
        const file = e.target.files?.[0];
        if (!file) return;
        file.text().then(text => setPending({ kind: 'file', text })).catch(err => toast(err.message, 'err'));
        e.target.value = '';
      }} />
      <textarea value={paste} onChange={e => setPaste(e.target.value)} placeholder="Paste a backup" style={{ minHeight: 88 }} />
      <div className="row" style={{ marginTop: 0 }}>
        <button className="btn" disabled={busy || !paste.trim()} onClick={() => setPending({ kind: 'paste', text: paste })}>Restore paste</button>
      </div>

      <div className="switchrow">
        <span>Auto backup</span>
        <button className={`switch ${auto ? 'on' : ''}`} aria-label="Auto backup" onClick={() => {
          const next = !auto;
          setAuto(next);
          writeAssist(localStorage, { autoBackup: next });
          if (next && uid) queueAutoBackup(uid);
        }} />
      </div>

      <div className="kicker">Google Drive</div>
      {!googleClientId() && (
        <input value={clientId} placeholder="Google client ID" onChange={e => setClientId(e.target.value)}
          onBlur={() => clientId.trim() && saveGoogleClientId(clientId)} />
      )}
      <div className="row" style={{ marginTop: 0 }}>
        <button className="btn" disabled={busy} onClick={() => run(async () => {
          if (clientId.trim()) saveGoogleClientId(clientId);
          await connectDrive();
          const snap = packBackup(await collectSnapshot(uid));
          await uploadDrive(snap);
          play('save');
          toast('Google Drive has this backup.', 'ok');
        })}>Google Drive</button>
      </div>
    </div>
    <ConfirmDialog
      open={!!pending}
      title="Restore this backup?"
      confirmLabel="Restore"
      busy={busy}
      onConfirm={confirmRestore}
      onCancel={() => setPending(null)}
    >
      <p style={{ marginTop: 0 }}>This writes the backup onto the account you are signed in to. Export a fresh copy first if you want a record of what is here now.</p>
    </ConfirmDialog>
    </>
  );
}
