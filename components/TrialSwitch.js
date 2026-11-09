'use client';
import { useEffect, useState } from 'react';
import { isTrial, setTrial } from '../lib/trial';
import { toast } from '../lib/toast';
import { play } from '../lib/sound';
import ConfirmDialog from './ConfirmDialog';

// Trial mode as one row with a switch. Tapping the row asks first, then flips the mode.
export default function TrialSwitch() {
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
      toast('Trial mode is on. Nothing you change is saved to your account.', 'info', 6000);
    } else {
      setTrial(false);
      play('save');
      toast('Trial mode is off. Your real data is used again.', 'info', 5000);
    }
    setPending(null);
  }

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Trial mode"
        data-testid="trial-switch"
        style={{ justifyContent: 'space-between' }}
        onClick={() => setPending(on ? 'off' : 'on')}
      >
        <span>Trial mode</span>
        <span className={`switch ${on ? 'on' : ''}`} aria-hidden="true" />
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
    </>
  );
}
