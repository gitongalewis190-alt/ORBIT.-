// Reads and writes a full Orbit snapshot. Selection, review spacing and awards
// keep their own rules. This only moves the rows the learner already has.
import { supabase } from './supabase';
import { saveProfile } from './profile';
import { applyTheme } from './theme';
import { setSound, setVolume } from './sound';
import { downloadBlob } from './download';
import { today } from './dates';
import { loadStats, syncBadges } from './stats';
import { extractBackup, normalizeBackup, packBackup, profilePatch, FORMAT, VERSION } from './backupFormat';

const DEVICE_KEYS = ['orbit.autocorrect', 'orbit.theme', 'orbit.sound', 'orbit.volume', 'orbit.assist', 'orbit.benefits'];
const DRIVE_NAME = 'orbit-backup.json';

async function fetchAll(run) {
  const page = 1000;
  const rows = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await run().range(from, from + page - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < page) return rows;
  }
}

export async function collectSnapshot(uid) {
  const [journal, assignments, reviews, controls, topics, sections, focus, freezes, decisions, recall, badges, profile, reviewEvents] =
    await Promise.all([
      fetchAll(() => supabase.from('journal_entries').select('id,topic_id,assignment_id,body,key_points,confidence,minutes_spent,word_count,tags,created_at,entry_kind,research_entry_id,editor_font').eq('user_id', uid).order('created_at')),
      fetchAll(() => supabase.from('assignments').select('id,topic_id,assigned_on,due_on,est_minutes,mode,status,created_at').eq('user_id', uid).order('assigned_on')),
      fetchAll(() => supabase.from('reviews').select('topic_id,due_on,interval_days,ease,reps,stability,difficulty,last_reviewed_on').eq('user_id', uid)),
      fetchAll(() => supabase.from('topic_controls').select('topic_id,state,updated_at').eq('user_id', uid)),
      fetchAll(() => supabase.from('topics').select('id,subfield_id,title,description,difficulty,prerequisite_id,created_at').eq('user_id', uid)),
      fetchAll(() => supabase.from('subfields').select('id,field_id,name').eq('user_id', uid)),
      fetchAll(() => supabase.from('focus_sessions').select('id,day,minutes,created_at').eq('user_id', uid)),
      fetchAll(() => supabase.from('streak_freezes').select('day,created_at').eq('user_id', uid)),
      fetchAll(() => supabase.from('decision_log').select('event,topic_id,payload,created_at').eq('user_id', uid).order('created_at')),
      fetchAll(() => supabase.from('recall_questions').select('entry_id,topic_id,topic_title,entry_logged_on,band,question,answer,score,comment,verifier,asked_at').eq('user_id', uid)),
      fetchAll(() => supabase.from('user_badges').select('badge_key,unlocked_on').eq('user_id', uid)),
      supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
      fetchAll(() => supabase.from('review_events').select('id,topic_id,reviewed_at,confidence,grade,observed_recall,elapsed_days,stability_before,difficulty_before,k_used,stability_after,difficulty_after,derived').eq('user_id', uid).order('reviewed_at')),
    ]);
  if (profile.error) throw profile.error;

  const device = {};
  if (typeof localStorage !== 'undefined') {
    for (const key of DEVICE_KEYS) {
      const value = localStorage.getItem(key);
      if (value != null) device[key] = value;
    }
  }

  return {
    format: FORMAT,
    version: VERSION,
    exported_at: new Date().toISOString(),
    profile: profile.data ?? {},
    awards: Object.fromEntries((badges ?? []).map(b => [b.badge_key, b.unlocked_on])),
    journal,
    assignments,
    reviews,
    topic_controls: controls,
    custom_topics: topics,
    custom_sections: sections,
    focus_sessions: focus,
    streak_freezes: freezes,
    decision_log: decisions,
    recall,
    review_events: reviewEvents,
    device,
  };
}

export function snapshotBlob(snapshot) {
  return new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
}

export async function downloadSnapshot(uid) {
  const snapshot = packBackup(await collectSnapshot(uid));
  downloadBlob(snapshotBlob(snapshot), `orbit-backup-${today()}.json`);
  await rememberLocal(snapshot);
  return snapshot;
}

function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('orbit-backup', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('copies');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function rememberLocal(snapshot) {
  if (typeof indexedDB === 'undefined') return;
  const base = await db();
  await new Promise((resolve, reject) => {
    const tx = base.transaction('copies', 'readwrite');
    tx.objectStore('copies').put(snapshot, 'latest');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  base.close();
}

export async function readLocal() {
  if (typeof indexedDB === 'undefined') return null;
  const base = await db();
  const snapshot = await new Promise((resolve, reject) => {
    const tx = base.transaction('copies', 'readonly');
    const req = tx.objectStore('copies').get('latest');
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
  base.close();
  return snapshot;
}

async function putRows(table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

// Writes a backup onto the signed-in account. Journal dates, award dates and settings are kept.
export async function restoreSnapshot(uid, input) {
  const snap = normalizeBackup(extractBackup(input));
  const report = { journal: 0, awards: 0, recall: 0, settings: false, review_events: 0 };

  if (snap.custom_sections.length) {
    await putRows('subfields', snap.custom_sections.filter(s => s.id && s.field_id && s.name).map(s => ({
      id: s.id, user_id: uid, field_id: s.field_id, name: s.name,
    })), 'id');
  }

  const topics = snap.custom_topics.filter(t => t.id && t.subfield_id && t.title);
  if (topics.length) {
    await putRows('topics', topics.map(t => ({
      id: t.id,
      user_id: uid,
      subfield_id: t.subfield_id,
      title: t.title,
      description: t.description ?? null,
      difficulty: t.difficulty || 'intermediate',
      prerequisite_id: null,
      created_at: t.created_at || new Date().toISOString(),
    })), 'id');
    const linked = topics.filter(t => t.prerequisite_id);
    for (const t of linked) {
      await supabase.from('topics').update({ prerequisite_id: t.prerequisite_id }).eq('id', t.id).eq('user_id', uid);
    }
  }

  if (snap.assignments.length) {
    await putRows('assignments', snap.assignments.filter(a => a.id && a.topic_id && a.assigned_on).map(a => ({
      id: a.id,
      user_id: uid,
      topic_id: a.topic_id,
      assigned_on: a.assigned_on,
      due_on: a.due_on || a.assigned_on,
      est_minutes: a.est_minutes > 0 ? a.est_minutes : 30,
      mode: a.mode || 'auto',
      status: a.status || 'generated',
      created_at: a.created_at || a.assigned_on,
    })), 'id');
  }

  const parents = snap.journal.filter(e => !e.research_entry_id);
  const children = snap.journal.filter(e => e.research_entry_id);
  const journalRows = [...parents, ...children].map(e => ({
    ...e,
    user_id: uid,
    key_points: e.key_points || [],
    tags: e.tags || [],
    word_count: e.word_count ?? String(e.body).trim().split(/\s+/).filter(Boolean).length,
  }));
  if (journalRows.length) {
    await putRows('journal_entries', journalRows, 'id');
    report.journal = journalRows.length;
  }

  if (snap.reviews.length) {
    await putRows('reviews', snap.reviews.filter(r => r.topic_id && r.due_on).map(r => ({
      user_id: uid,
      topic_id: r.topic_id,
      due_on: r.due_on,
      interval_days: r.interval_days ?? 1,
      ease: r.ease ?? 2.5,
      reps: r.reps ?? 0,
      ...(r.stability != null ? { stability: r.stability } : {}),
      ...(r.difficulty != null ? { difficulty: r.difficulty } : {}),
      ...(r.last_reviewed_on ? { last_reviewed_on: r.last_reviewed_on } : {}),
    })), 'user_id,topic_id');
  }

  if (snap.review_events?.length) {
    await putRows('review_events', snap.review_events.map(event => ({ ...event, user_id: uid })), 'id');
    report.review_events = snap.review_events.length;
  }

  if (snap.topic_controls.length) {
    await putRows('topic_controls', snap.topic_controls.filter(c => c.topic_id && c.state).map(c => ({
      user_id: uid,
      topic_id: c.topic_id,
      state: c.state,
      updated_at: c.updated_at || new Date().toISOString(),
    })), 'user_id,topic_id');
  }

  const awardRows = Object.entries(snap.awards).filter(([key]) => key).map(([badge_key, unlocked_on]) => ({
    user_id: uid,
    badge_key,
    unlocked_on: unlocked_on || new Date().toISOString(),
  }));
  if (awardRows.length) {
    await putRows('user_badges', awardRows, 'user_id,badge_key');
    report.awards = awardRows.length;
  }

  if (snap.focus_sessions.length) {
    const withId = [];
    const noId = [];
    for (const f of snap.focus_sessions) {
      if (!(f.day && f.minutes > 0)) continue;
      const row = { user_id: uid, day: f.day, minutes: f.minutes, created_at: f.created_at || f.day };
      if (f.id) withId.push({ ...row, id: f.id });
      else noId.push(row);
    }
    if (withId.length) await putRows('focus_sessions', withId, 'id');
    if (noId.length) {
      const { error } = await supabase.from('focus_sessions').insert(noId);
      if (error) throw new Error(`focus_sessions: ${error.message}`);
    }
  }

  if (snap.streak_freezes.length) {
    await putRows('streak_freezes', snap.streak_freezes.filter(f => f.day).map(f => ({
      user_id: uid, day: f.day, created_at: f.created_at || f.day,
    })), 'user_id,day');
  }

  if (snap.decision_log.length) {
    const { data: have } = await supabase.from('decision_log').select('event,topic_id,created_at').eq('user_id', uid);
    const seen = new Set((have ?? []).map(d => `${d.created_at}|${d.event}|${d.topic_id}`));
    const fresh = snap.decision_log.filter(d => d.event && d.created_at && !seen.has(`${d.created_at}|${d.event}|${d.topic_id ?? ''}`));
    for (let i = 0; i < fresh.length; i += 100) {
      const chunk = fresh.slice(i, i + 100).map(d => ({
        user_id: uid, event: d.event, topic_id: d.topic_id ?? null, payload: d.payload || {}, created_at: d.created_at,
      }));
      const { error } = await supabase.from('decision_log').insert(chunk);
      if (error) throw new Error(`decision_log: ${error.message}`);
    }
  }

  if (snap.recall.length) {
    const { data: have } = await supabase.from('recall_questions').select('entry_id,asked_at,question').eq('user_id', uid);
    const seen = new Set((have ?? []).map(r => `${r.entry_id}|${r.asked_at}|${r.question}`));
    const fresh = snap.recall.filter(r => r.entry_id && r.question && r.answer && !seen.has(`${r.entry_id}|${r.asked_at}|${r.question}`));
    for (let i = 0; i < fresh.length; i += 100) {
      const chunk = fresh.slice(i, i + 100).map(r => ({ ...r, user_id: uid }));
      const { error } = await supabase.from('recall_questions').insert(chunk);
      if (error) throw new Error(`recall: ${error.message}`);
    }
    report.recall = fresh.length;
  }

  const patch = profilePatch(snap.profile);
  if (Object.keys(patch).length) {
    const saved = await saveProfile(uid, patch);
    applyTheme(saved.theme ?? 'light');
    setSound(saved.sound_on ?? true);
    setVolume(saved.sound_volume ?? 70);
    report.settings = true;
  }

  if (typeof localStorage !== 'undefined' && snap.device) {
    for (const key of DEVICE_KEYS) {
      if (typeof snap.device[key] === 'string') localStorage.setItem(key, snap.device[key]);
    }
  }

  try {
    const profile = { ...(snap.profile || {}) };
    const stats = await loadStats(uid, profile);
    await syncBadges(uid, stats);
  } catch {
    // The copied awards are already written. A stats pass is only a second chance.
  }

  return report;
}

export function googleClientId() {
  const fromEnv = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID : '';
  if (fromEnv) return fromEnv;
  try { return localStorage.getItem('orbit.googleClientId') || ''; } catch { return ''; }
}

export function saveGoogleClientId(id) {
  localStorage.setItem('orbit.googleClientId', String(id || '').trim());
}

function driveToken() {
  try {
    const raw = sessionStorage.getItem('orbit.drive.token');
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved.access || saved.exp < Date.now()) return null;
    return saved.access;
  } catch {
    return null;
  }
}

function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google sign-in did not load.'));
    document.head.appendChild(script);
  });
}

export async function connectDrive() {
  const clientId = googleClientId();
  if (!clientId) throw new Error('Add a Google client ID first.');
  await loadGis();
  const token = await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: resp => (resp.error ? reject(new Error(resp.error)) : resolve(resp)),
    });
    client.requestAccessToken();
  });
  sessionStorage.setItem('orbit.drive.token', JSON.stringify({
    access: token.access_token,
    exp: Date.now() + ((token.expires_in || 3600) - 60) * 1000,
  }));
  return true;
}

async function driveFileId(token) {
  const q = encodeURIComponent(`name='${DRIVE_NAME}' and trashed=false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Google Drive could not be read.');
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

export async function uploadDrive(snapshot) {
  const token = driveToken();
  if (!token) return false;
  const json = JSON.stringify(snapshot);
  const id = await driveFileId(token);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  let res;
  if (id) {
    res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
      method: 'PATCH', headers, body: json,
    });
  } else {
    const boundary = `orbit${Date.now()}`;
    res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: DRIVE_NAME, mimeType: 'application/json' })}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`,
    });
  }
  if (!res.ok) throw new Error('Google Drive did not keep the backup.');
  return true;
}

let timer = 0;
export function queueAutoBackup(uid) {
  if (!uid || typeof window === 'undefined') return;
  // Trial mode sends nothing to the account or to Drive.
  if (localStorage.getItem('orbit.trial') === '1') return;
  let prefs = { autoBackup: true };
  try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem('orbit.assist') || '{}') }; } catch {}
  if (prefs.autoBackup === false) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(async () => {
    try {
      const snapshot = packBackup(await collectSnapshot(uid));
      await rememberLocal(snapshot);
      if (driveToken()) await uploadDrive(snapshot);
    } catch {
      // A failed backup must not block saving an entry.
    }
  }, 1200);
}
