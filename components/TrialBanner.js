'use client';
import { useEffect, useState } from 'react';
import { isTrial } from '../lib/trial';

export default function TrialBanner() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(isTrial());
    sync();
    window.addEventListener('orbit:trial', sync);
    return () => window.removeEventListener('orbit:trial', sync);
  }, []);
  if (!on) return null;
  return (
    <div className="trial-banner" role="status">
      Trial mode. What you do here is not saved to your account.
    </div>
  );
}
