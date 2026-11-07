// Stored copies of every PDF record the writer downloads.
// Each PDF goes to the private "print-records" bucket, under the writer's own folder, and a row
// in print_records describes it. Each copy is kept for the retention period chosen when it was made, then removed.
// Row-level security and storage policies mean a writer only ever sees their own copies.
import { supabase } from './supabase';
import { downloadBlob } from './download';
import { today, addDays } from './dates';
import { DEFAULT_RETENTION_DAYS, expiresAt } from './printSettings';

export const BUCKET = 'print-records';

// Time windows for a record. 'all' means no limit.
export const WINDOWS = [
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
];

// A custom from/to period, both days included. Returns null when the dates are missing or reversed.
export function customRange(from, to) {
  if (!from || !to || from > to) return null;
  return { label: `${from} to ${to}`, range: { from, to } };
}

export function rangeFor(key) {
  const w = WINDOWS.find(x => x.key === key) ?? WINDOWS[1];
  if (!w.days) return { label: w.label, range: null };
  const now = today();
  return { label: w.label, range: { from: addDays(now, -(w.days - 1)), to: now } };
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => (c === 'x' ? hex() : (8 + Math.floor(Math.random() * 4)).toString(16)));
}

// Builds the PDF, saves it to the phone, then keeps a stored copy.
// The writer always gets the file, even when the stored copy fails.
// Returns { stored, pages, entries, record?, reason? }.
export async function createRecord(uid, { windowLabel, range, options = {}, preview = null }, onStep = () => {}) {
  const { buildRecordPdf } = await import('./export');
  const { pages, entries, blob, fileName } = await buildRecordPdf(uid, onStep, range, options);
  downloadBlob(blob, fileName, preview);

  const id = newId();
  const path = `${uid}/${id}.pdf`;
  onStep('Keeping a copy');

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (upErr) return { stored: false, pages, entries, reason: upErr.message };

  const { data, error } = await supabase
    .from('print_records')
    .insert({
      id,
      user_id: uid,
      title: fileName,
      window_label: windowLabel,
      range_from: range?.from ?? null,
      range_to: range?.to ?? null,
      pages,
      entries,
      file_path: path,
      file_bytes: blob.size,
      expires_at: expiresAt(options.retentionDays ?? DEFAULT_RETENTION_DAYS),
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { stored: false, pages, entries, reason: error.message };
  }
  return { stored: true, pages, entries, record: data };
}

// Records still inside their retention period, newest first.
export async function listRecords(uid) {
  const { data, error } = await supabase
    .from('print_records')
    .select('*')
    .eq('user_id', uid)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Removes copies past their retention period. Runs quietly when the document log opens.
export async function purgeExpired(uid) {
  const { data, error } = await supabase
    .from('print_records')
    .select('id, file_path')
    .eq('user_id', uid)
    .lte('expires_at', new Date().toISOString());
  if (error || !data?.length) return 0;
  await supabase.storage.from(BUCKET).remove(data.map(r => r.file_path));
  await supabase.from('print_records').delete().in('id', data.map(r => r.id));
  return data.length;
}

// Downloads a stored copy as a file.
export async function downloadRecord(record) {
  const { data, error } = await supabase.storage.from(BUCKET).download(record.file_path);
  if (error) throw error;
  downloadBlob(data, record.title);
}

// Opens a stored copy in a new tab, where it can be printed from the share sheet.
// The tab is opened straight away, so iPhone Safari does not block it.
export async function openRecord(record) {
  const win = window.open('', '_blank');
  const { data, error } = await supabase.storage.from(BUCKET).download(record.file_path);
  if (error) {
    win?.close();
    throw error;
  }
  const url = URL.createObjectURL(data);
  if (win) win.location.href = url;
  else window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Deletes one stored copy: the file first, then its row.
export async function deleteRecord(record) {
  const { error: sErr } = await supabase.storage.from(BUCKET).remove([record.file_path]);
  if (sErr) throw sErr;
  const { error } = await supabase.from('print_records').delete().eq('id', record.id);
  if (error) throw error;
}
