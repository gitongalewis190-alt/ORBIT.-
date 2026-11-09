// Account deletion with a 60 day window. The account stays until the date, then a nightly job removes it.
import { supabase } from './supabase.js';
import { collectSnapshot } from './backupSync.js';
import { packBackup } from './backupFormat.js';
import { downloadBlob } from './download.js';

export { DELETION_WINDOW_DAYS, daysLeft, deletionDate } from './deletionWindow.js';

// Returns the pending deletion for the signed-in user, or null.
export async function pendingDeletion(uid) {
  if (!uid) return null;
  const { data, error } = await supabase
    .from('account_deletions')
    .select('requested_at, scheduled_for')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function requestDeletion() {
  const { data, error } = await supabase.rpc('request_account_deletion', { p_export_confirmed: true });
  if (error) throw error;
  return data;
}

export async function keepAccount() {
  const { error } = await supabase.rpc('cancel_account_deletion');
  if (error) throw error;
}

// Saves everything the account holds. kind is 'json' (full backup) or 'pdf' (full record).
export async function exportEverything(uid, kind) {
  if (kind === 'json') {
    const snapshot = packBackup(await collectSnapshot(uid));
    const stamp = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `orbit-everything-${stamp}.json`);
    return 'json';
  }
  const { buildRecordPdf } = await import('./export.js');
  const { blob, fileName } = await buildRecordPdf(uid, () => {}, null);
  downloadBlob(blob, fileName);
  return 'pdf';
}

