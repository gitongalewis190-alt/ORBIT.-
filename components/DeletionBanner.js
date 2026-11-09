'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { currentUser } from '../lib/session';
import { pendingDeletion, daysLeft, deletionDate, keepAccount } from '../lib/accountDeletion';
import { toast } from '../lib/toast';
import { play } from '../lib/sound';

// Shown on every page while the signed-in account is scheduled for deletion.
// It gives the date and the days left, and lets the person keep the account.
export default function DeletionBanner() {
  const router = useRouter();
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const user = await currentUser();
        if (!alive) return;
        if (!user) { setPending(null); return; }
        const row = await pendingDeletion(user.id);
        if (alive) setPending(row);
      } catch {
        if (alive) setPending(null);
      }
    };
    load();
    window.addEventListener('orbit:account-deletion', load);
    return () => {
      alive = false;
      window.removeEventListener('orbit:account-deletion', load);
    };
  }, []);

  if (!pending) return null;
  const days = daysLeft(pending.scheduled_for);

  async function keep() {
    if (busy) return;
    setBusy(true);
    try {
      await keepAccount();
      play('save');
      toast('Deletion cancelled. Your account is kept.', 'ok', 4500);
      setPending(null);
      window.dispatchEvent(new Event('orbit:account-deletion'));
    } catch (e) {
      play('error');
      toast(e.message, 'err', 6000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="deletion-banner" role="alert">
      <div className="deletion-banner-text">
        <strong>This account is scheduled for deletion.</strong>
        <span>
          {days === 0 ? 'It is removed today.' : `${days} ${days === 1 ? 'day' : 'days'} left, until ${deletionDate(pending.scheduled_for)}.`}
          {' '}Everything is kept until then.
        </span>
      </div>
      <div className="deletion-banner-actions">
        <button type="button" className="btn sm" onClick={() => router.push('/settings#delete')}>About</button>
        <button type="button" className="btn sm accent" onClick={keep} disabled={busy}>
          {busy ? 'Working' : 'Keep my account'}
        </button>
      </div>
    </div>
  );
}
