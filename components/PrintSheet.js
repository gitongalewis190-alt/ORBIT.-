'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { play } from '../lib/sound';
import { toast } from '../lib/toast';
import { WINDOWS, rangeFor, customRange, createRecord } from '../lib/printRecord';
import { today } from '../lib/dates';
import { RETENTION_OPTIONS, TEXT_SIZES, ALIGNMENTS, MEDAL_RULES, DEFAULT_PRINT, retentionLabel } from '../lib/printSettings';

const FORMATS = [['a4', 'A4'], ['letter', 'Letter']];
const ORIENTATIONS = [['portrait', 'Portrait'], ['landscape', 'Landscape']];

// One labelled setting. Every choice in the sheet uses this, so they all look and behave alike.
function Field({ label, value, onChange, disabled, children }) {
  return (
    <label className="kicker" style={{ display: 'grid', gap: 6 }}>
      {label}
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>{children}</select>
    </label>
  );
}

// The Download PDF sheet, opened from the top bar. It replaces the old time-range prompt with the full
// print settings. The record is downloaded and also kept for the retention period chosen here.
export default function PrintSheet({ open, onClose }) {
  const ref = useRef(null);
  const [mode, setMode] = useState('window');
  const [windowKey, setWindowKey] = useState('30');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(today());
  const [opt, setOpt] = useState({ ...DEFAULT_PRINT });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const set = patch => setOpt(o => ({ ...o, ...patch }));

  function chosenRange() {
    return mode === 'window' ? rangeFor(windowKey) : customRange(from, to);
  }

  async function create() {
    if (busy) return;
    const choice = chosenRange();
    if (!choice) {
      play('error');
      toast('Choose a from date and a to date, with from on or before to.', 'err', 5000);
      return;
    }
    setBusy(true);
    setStatus('Starting');
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) throw new Error('Sign in again to make a record.');
      const res = await createRecord(uid, { windowLabel: choice.label, range: choice.range, options: opt }, setStatus);
      play('export');
      if (res.stored) {
        toast(`Record ready: ${res.pages} pages. Kept for ${retentionLabel(opt.retentionDays).toLowerCase()}.`, 'ok', 5000);
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

  const segBtn = (active, onClick, label) => (
    <button type="button" role="radio" aria-checked={active} className={active ? 'on' : ''} onClick={onClick} disabled={busy}>
      {label}
    </button>
  );

  return (
    <dialog ref={ref} className="orbit-dialog" aria-labelledby="print-sheet-title" onClose={() => { if (open) onClose(); }}>
      <div className="sheet-body">
        <h2 id="print-sheet-title">Download PDF record</h2>

        <h3 style={{ fontSize: 15, margin: '14px 0 6px' }}>Period</h3>
        <div className="seg" role="radiogroup" aria-label="Period type">
          {segBtn(mode === 'window', () => setMode('window'), 'Preset')}
          {segBtn(mode === 'custom', () => setMode('custom'), 'From and to')}
        </div>
        {mode === 'window' ? (
          <div className="seg" role="radiogroup" aria-label="Time window" style={{ marginTop: 8 }}>
            {WINDOWS.map(w => segBtn(windowKey === w.key, () => setWindowKey(w.key), w.label))}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <label className="kicker" style={{ display: 'grid', gap: 6 }}>From
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} disabled={busy} />
            </label>
            <label className="kicker" style={{ display: 'grid', gap: 6 }}>To
              <input type="date" value={to} onChange={e => setTo(e.target.value)} disabled={busy} />
            </label>
          </div>
        )}

        <h3 style={{ fontSize: 15, margin: '14px 0 6px' }}>Paper</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          <Field label="Size" value={opt.format} onChange={v => set({ format: v })} disabled={busy}>
            {FORMATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Field>
          <Field label="Orientation" value={opt.orientation} onChange={v => set({ orientation: v })} disabled={busy}>
            {ORIENTATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Field>
          <Field label="Colour" value={opt.colour ? 'colour' : 'bw'} onChange={v => set({ colour: v === 'colour' })} disabled={busy}>
            <option value="colour">Colour, with highlights</option>
            <option value="bw">Black and white</option>
          </Field>
        </div>

        <h3 style={{ fontSize: 15, margin: '14px 0 6px' }}>Text</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          <Field label="Type size" value={opt.textSize} onChange={v => set({ textSize: v })} disabled={busy}>
            {TEXT_SIZES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </Field>
          <Field label="Alignment" value={opt.align} onChange={v => set({ align: v })} disabled={busy}>
            {ALIGNMENTS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
          </Field>
          <Field label="Medals" value={opt.medals} onChange={v => set({ medals: v })} disabled={busy}>
            {MEDAL_RULES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </Field>
        </div>

        <h3 style={{ fontSize: 15, margin: '14px 0 6px' }}>Keep the copy</h3>
        <Field label="Keep this copy for" value={opt.retentionDays} onChange={v => set({ retentionDays: Number(v) })} disabled={busy}>
          {RETENTION_OPTIONS.map(r => <option key={r.days} value={r.days}>{r.label}</option>)}
        </Field>

        {busy && (
          <div className="doc-progress" role="progressbar" aria-label="Building document" aria-busy="true">
            <span />
          </div>
        )}

        <div className="sheet-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn accent" onClick={create} disabled={busy}>
            {busy && status ? status : 'Create PDF'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
