'use client';
import { useEffect, useState } from 'react';
import { isTrial, setTrial } from '../lib/trial';

export default function TrialToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(isTrial());
    sync();
    window.addEventListener('orbit:trial', sync);
    return () => window.removeEventListener('orbit:trial', sync);
  }, []);

  function toggle() {
    if (!on) {
      const ok = window.confirm(
        'Turn on trial mode?\n\nWhile it is on, nothing you do is saved to your account. Entries, swaps, challenges, awards and the Log are not recorded. Reading still shows your real data.'
      );
      if (ok) setTrial(true);
    } else {
      const ok = window.confirm(
        'Turn off trial mode?\n\nYour real data is used again. Anything you did during trial mode was not saved.'
      );
      if (ok) setTrial(false);
    }
  }

  return (
    <div className="card trial-card" style={{ margin: '12px 18px' }}>
      <div className="kicker">Trial mode</div>
      <p className="muted" style={{ margin: '6px 0 10px', lineHeight: 1.5 }}>
        A private window for testing. Nothing you do while it is on is saved to your account.
      </p>
      <button type="button" className={on ? 'btn danger' : 'btn accent'} onClick={toggle} aria-pressed={on}>
        {on ? 'Turn off trial mode' : 'Turn on trial mode'}
      </button>
    </div>
  );
}
