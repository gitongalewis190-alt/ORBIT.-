'use client';

import { useEffect, useState } from 'react';
import { play } from '../lib/sound';
import { toast } from '../lib/toast';
import { readAssist, writeAssist } from '../lib/assist';
import {
  connectDrive, downloadSnapshot, googleClientId, queueAutoBackup,
  readLocal, restoreSnapshot, saveGoogleClientId, uploadDrive, collectSnapshot,
} from '../lib/backupSync';

export default function BackupPanel({ uid }) {
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState('');
  const [clientId, setClientId] = useState('');
  const [auto, setAuto] = useState(true);
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

  return (
    <div className="card">
      <div className="row" style={{ marginTop: 0 }}>
        <button className="btn accent" disabled={busy || !uid} onClick={() => run(async () => {
          const snap = await downloadSnapshot(uid);
          play('export');
          toast(`Backup saved. ${snap.journal.length} journal entries.`, 'ok');
        })}>Save backup</button>
        <button className="btn" disabled={busy || !uid} onClick={() => run(async () => {
          const local = await readLocal();
          if (!local) throw new Error('No backup is stored on this phone yet.');
          saved(await restoreSnapshot(uid, local));
        })}>Restore this phone</button>
      </div>

      <div className="kicker">Restore</div>
      <input type="file" accept="application/json,.json,text/plain,.txt" onChange={e => {
        const file = e.target.files?.[0];
        if (!file) return;
        run(async () => {
          saved(await restoreSnapshot(uid, await file.text()));
        });
        e.target.value = '';
      }} />
      <textarea value={paste} onChange={e => setPaste(e.target.value)} placeholder="Paste a backup" style={{ minHeight: 88 }} />
      <div className="row" style={{ marginTop: 0 }}>
        <button className="btn" disabled={busy || !paste.trim()} onClick={() => run(async () => {
          saved(await restoreSnapshot(uid, paste));
          setPaste('');
        })}>Restore paste</button>
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
          const snap = await collectSnapshot(uid);
          await uploadDrive(snap);
          play('save');
          toast('Google Drive has this backup.', 'ok');
        })}>Google Drive</button>
      </div>
    </div>
  );
}
