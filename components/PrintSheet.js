'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { play } from '../lib/sound';
import { toast } from '../lib/toast';
import { WINDOWS, rangeFor, createRecord } from '../lib/printRecord';

// The Download PDF sheet, opened from the top bar. Choose the period, then create the record.
// The record is downloaded and also kept for 365 days in the document log in Settings.
export default function PrintSheet({ open, onClose }) {
  const ref = useRef(null);
  const [windowKey, setWindowKey] = useState('30');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  async function create() {
    if (busy) return;
    setBusy(true);
    setStatus('Starting');
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) throw new Error('Sign in again to make a record.');
      const { label, range } = rangeFor(windowKey);
      const res = await createRecord(uid, { windowLabel: label, range }, setStatus);
      play('export');
      if (res.stored) {
        toast(`Record ready: ${res.pages} pages. A copy is kept for 365 days in Settings.`, 'ok', 5000);
      } else {
        toast(`Downloaded, but it could not be kept in your log: ${res.reason}`, 'warn', 7000);
      }
      onClose();
    } catch (e) {
      play('error');
      toast(`Could not build the record: ${e.message}`, 'err', 6000);
    } finally {
      setBusy(false);
      setStatus('');
    }
  }

  return (
    <dialog ref={ref} className="orbit-dialog" aria-labelledby="print-sheet-title" onClose={() => { if (open) onClose(); }}>
      <div className="sheet-body">
        <h2 id="print-sheet-title">Download PDF record</h2>
        <p className="muted" style={{ marginTop: 0, lineHeight: 1.5 }}>
          Choose the period it covers. Journal entries, the decision log and focus time are limited to that period.
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

        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn accent" onClick={create} disabled={busy}>
            {busy && status ? status : 'Create PDF'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
