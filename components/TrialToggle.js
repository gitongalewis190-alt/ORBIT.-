'use client';
import { useEffect, useState } from 'react';
import { isTrial, setTrial } from '../lib/trial';
import { toast } from '../lib/toast';
import { play } from '../lib/sound';
import ConfirmDialog from './ConfirmDialog';

export default function TrialToggle() {
  const [on, setOn] = useState(false);
  const [pending, setPending] = useState(null); // null | 'on' | 'off'
  useEffect(() => {
    const sync = () => setOn(isTrial());
    sync();
    window.addEventListener('orbit:trial', sync);
    return () => window.removeEventListener('orbit:trial', sync);
  }, []);

  function confirm() {
    if (pending === 'on') {
      setTrial(true);
      play('select');
      toast('Trial mode is on. Entries, swaps, challenges, awards, the Log and your name or photo will not be saved to your account. Reading still shows your real data.', 'info', 7000);
    } else {
      setTrial(false);
      play('save');
      toast('Trial mode is off. Your real data is used again. Anything you did during trial mode was not saved.', 'info', 6000);
    }
    setPending(null);
  }

  return (
    <section className="card trial-card" aria-labelledby="trial-heading">
      <div className="kicker" id="trial-heading">Trial mode</div>
      <p className="muted" style={{ margin: '6px 0 10px', lineHeight: 1.5 }}>
        A private window for testing. While it is on, nothing you change is saved to your account. Your real data still shows.
      </p>
      <button type="button" className={on ? 'btn danger' : 'btn accent'} onClick={() => setPending(on ? 'off' : 'on')} aria-pressed={on}>
        {on ? 'Turn off trial mode' : 'Turn on trial mode'}
      </button>

      <ConfirmDialog
        open={pending === 'on'}
        title="Turn on trial mode?"
        confirmLabel="Turn on"
        onCancel={() => setPending(null)}
        onConfirm={confirm}
      >
        <p style={{ margin: 0 }}>While trial mode is on, nothing you do is saved to your account: entries, swaps, challenges, awards, the Log, your name, and your profile picture. Reading still shows your real data.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={pending === 'off'}
        title="Turn off trial mode?"
        confirmLabel="Turn off"
        danger
        onCancel={() => setPending(null)}
        onConfirm={confirm}
      >
        <p style={{ margin: 0 }}>Your real data is used again. Anything you did during trial mode was not saved.</p>
      </ConfirmDialog>
    </section>
  );
}
