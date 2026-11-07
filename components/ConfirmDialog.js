'use client';
import { useEffect, useRef } from 'react';

// A native dialog for actions that cannot be undone. The parent controls it:
// open shows it, and the buttons call onConfirm or onCancel. children holds any extra
// field, such as a typed word or a password, and canConfirm decides when the button works.
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  danger = false,
  canConfirm = true,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="orbit-dialog"
      aria-labelledby={`confirm-${title.replace(/\W+/g, '-')}`}
      onCancel={e => { e.preventDefault(); if (!busy) onCancel(); }}
      onClose={() => { if (open) onCancel(); }}
    >
      <div className="sheet-body">
        <h2 id={`confirm-${title.replace(/\W+/g, '-')}`}>{title}</h2>
        <div className="sheet-text">{children}</div>
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button
            type="button"
            className={`btn ${danger ? 'danger' : 'accent'}`}
            onClick={onConfirm}
            disabled={busy || !canConfirm}
          >
            {busy ? 'Working' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
