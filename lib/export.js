import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';
import { supabase } from './supabase';
import { getProfile } from './profile';
import { loadStats, unlockedMap, insights, weeklyRecap } from './stats';
import { AWARDS, awardProgress, TIER_LABEL, CATEGORIES } from './awards';
import { today, prettyDate, addDays } from './dates';
import { downloadBlob } from './download';

// Adds doc.autoTable() and doc.lastAutoTable to jsPDF. Works in browsers and in Node.
applyPlugin(jsPDF);

const ACCENT = [196, 98, 61];
const INK = [28, 27, 25];
const MUTED = [120, 116, 109];
const LINE = [232, 229, 224];
const PAPER_TINT = [250, 248, 246];
const PAGE_H = 297;
const PAGE_W = 210;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
const SAFE_BOTTOM = PAGE_H - MARGIN - 6;

// PDF text uses Windows-1252. Fancy punctuation is mapped to plain equivalents
// so nothing prints as a broken character.
const PUNCT = {
  '\u2018': "'", '\u2019': "'", '\u201C': '"', '\u201D': '"',
  '\u2013': '-', '\u2014': '-', '\u2026': '...', '\u00A0': ' ',
  '\u2022': '-', '\u2192': '->',
};

export function clean(value) {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value)
    ? value.join(', ')
    : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text
    .replace(/[\u2018\u2019\u201C\u201D\u2013\u2014\u2026\u00A0\u2022\u2192]/g, c => PUNCT[c])
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[^\u0000-\u00FF]/g, '?');
}

const dateOnly = iso => (iso ? prettyDate(String(iso).slice(0, 10)) : '');
const stamp = iso => (iso ? String(iso).slice(0, 16).replace('T', ' ') : '');
const longDate = iso => (iso ? new Date(iso).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Nairobi',
}) : '');

// Reads a whole table in pages, because Supabase returns at most 1,000 rows at a time.
async function fetchAll(build) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

function longestStreak(days, freezeDays) {
  const sorted = [...new Set([...days, ...freezeDays])].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

// Everything Orbit holds for this user, in one object.
export async function collectRecord(uid) {
  const profile = await getProfile(uid);
  const stats = await loadStats(uid, profile);
  const badges = await unlockedMap(uid);

  const [journal, assignments, reviews, controls, customTopics, customSections, focus, freezes, decisions] =
    await Promise.all([
      fetchAll(() => supabase.from('journal_entries')
        .select('*, topics(title, subfields(name, fields(name)))')
        .eq('user_id', uid).order('created_at', { ascending: true }).order('id')),
      fetchAll(() => supabase.from('assignments')
        .select('*, topics(title, difficulty, subfields(name, fields(name)))')
        .eq('user_id', uid).order('assigned_on', { ascending: true }).order('id')),
      fetchAll(() => supabase.from('reviews')
        .select('*, topics(title)')
        .eq('user_id', uid).order('due_on', { ascending: true }).order('topic_id')),
      fetchAll(() => supabase.from('topic_controls')
        .select('*, topics(title, difficulty, subfields(name, fields(name)))')
        .eq('user_id', uid).order('topic_id')),
      fetchAll(() => supabase.from('topics')
        .select('id, title, description, difficulty, created_at, subfields(name, fields(name))')
        .eq('user_id', uid).order('created_at', { ascending: true }).order('id')),
      fetchAll(() => supabase.from('subfields')
        .select('id, name, fields(name)')
        .eq('user_id', uid).order('id')),
      fetchAll(() => supabase.from('focus_sessions')
        .select('day, minutes, created_at')
        .eq('user_id', uid).order('day', { ascending: true }).order('id')),
      fetchAll(() => supabase.from('streak_freezes')
        .select('day, created_at')
        .eq('user_id', uid).order('day', { ascending: true })),
      fetchAll(() => supabase.from('decision_log')
        .select('event, topic_id, payload, created_at, topics(title)')
        .eq('user_id', uid).order('created_at', { ascending: true }).order('id')),
    ]);

  return {
    profile, stats, badges, journal, assignments, reviews, controls,
    customTopics, customSections, focus, freezes, decisions,
  };
}

// The printable record. Built for paper and for reading on a laptop.
export async function buildRecordPdf(uid, onStep = () => {}) {
  onStep('Collecting your record');
  const r = await collectRecord(uid);
  const p = r.profile;
  const s = r.stats;
  const name = clean(p.full_name || p.display_name || 'Orbit learner');
  const freezeDays = r.freezes.map(f => f.day);
  const journalDays = r.journal.map(e => String(e.created_at).slice(0, 10));
  const best = longestStreak(journalDays, freezeDays);
  const earnedCount = AWARDS.filter(a => r.badges.has(a.key)).length;

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({
    title: `Orbit personal record: ${name}`,
    subject: 'Personal learning record',
    author: 'Orbit',
    creator: 'Orbit',
  });
  doc.setFont('helvetica', 'normal');

  let y = MARGIN;
  const sections = [];

  const newPage = () => {
    doc.addPage();
    y = MARGIN + 8;
  };
  const room = h => {
    if (y + h > SAFE_BOTTOM) newPage();
  };
  const setInk = () => doc.setTextColor(...INK);

  const section = title => {
    newPage();
    sections.push({ title, page: doc.getNumberOfPages() });
    heading(title, 17);
  };

  const heading = (text, size = 13) => {
    room(size * 0.5 + 10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    setInk();
    doc.text(clean(text), MARGIN, y);
    y += size * 0.42 + 2;
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, y, MARGIN + 22, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
  };

  const subheading = text => {
    room(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    setInk();
    doc.text(clean(text), MARGIN, y);
    y += 5.2;
    doc.setFont('helvetica', 'normal');
  };

  const para = (text, size = 9.5, color = INK, indent = 0) => {
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(clean(text) || ' ', CONTENT_W - indent);
    for (const line of lines) {
      room(size * 0.45 + 1.5);
      doc.text(line, MARGIN + indent, y);
      y += size * 0.42 + 1.1;
    }
    y += 2;
    setInk();
  };

  const bullets = (items, size = 9.5) => {
    for (const item of items) para(`- ${item}`, size, INK, 2);
  };

  const table = (head, body, columnStyles = {}) => {
    if (!body.length) {
      para('Nothing recorded yet.', 9, MUTED);
      return;
    }
    doc.autoTable({
      startY: y,
      head: [head.map(clean)],
      body: body.map(row => row.map(clean)),
      margin: { left: MARGIN, right: MARGIN, top: MARGIN + 8, bottom: MARGIN + 6 },
      styles: {
        font: 'helvetica', fontSize: 8, cellPadding: 1.8, textColor: INK,
        lineColor: LINE, lineWidth: 0.1, overflow: 'linebreak', valign: 'top',
      },
      headStyles: { fillColor: ACCENT, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: PAPER_TINT },
      columnStyles,
    });
    y = doc.lastAutoTable.finalY + 6;
  };

  // ---------- Cover ----------
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, PAGE_W, 74, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(34);
  doc.text('Orbit', MARGIN, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text('Personal learning record', MARGIN, 40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(name, MARGIN, 60);
  setInk();
  y = 90;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setInk();
  const coverRows = [
    ['Age', p.age ? String(p.age) : 'Not given'],
    ['Location', clean(p.location) || 'Not given'],
    ['School or work', clean(p.school_or_work) || 'Not given'],
    ['Timezone', clean(p.timezone)],
    ['Record generated', longDate(new Date().toISOString())],
    ['Member since', longDate(p.created_at)],
    ['Journal entries', String(r.journal.length)],
    ['Words written', Number(s.wordsTotal).toLocaleString()],
    ['Current streak', `${s.streak} day${s.streak === 1 ? '' : 's'} (longest ${best})`],
    ['Awards earned', `${earnedCount} of ${AWARDS.length}`],
  ];
  doc.autoTable({
    startY: y,
    body: coverRows.map(([k, v]) => [clean(k), clean(v)]),
    margin: { left: MARGIN, right: MARGIN },
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 2.4, textColor: INK },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 52, textColor: MUTED } },
  });
  y = doc.lastAutoTable.finalY + 10;
  para('This document holds everything Orbit has recorded for you: your profile, your journal, your study and review history, your focus time, your awards, and the decisions the app made along the way. It is written to be read on paper or on a computer, with no app or internet needed.', 9.5, MUTED);

  // ---------- Contents (page 2 is filled in at the end) ----------
  newPage();
  const contentsPage = doc.getNumberOfPages();

  // ---------- 1. Profile ----------
  section('1. About you');
  subheading('Personal details');
  table(['Field', 'Your entry'], [
    ['Full name', p.full_name],
    ['Display name', p.display_name],
    ['Age', p.age],
    ['Date of birth', longDate(p.date_of_birth)],
    ['Location', p.location],
    ['School or work', p.school_or_work],
    ['Timezone', p.timezone],
  ].map(([k, v]) => [k, v === null || v === undefined || v === '' ? 'Not given' : v]), { 0: { cellWidth: 46, fontStyle: 'bold' } });

  subheading('Learning goal');
  para(p.learning_goal || 'No learning goal written yet.', 9.5, p.learning_goal ? INK : MUTED);
  subheading('About me');
  para(p.bio || 'No bio written yet.', 9.5, p.bio ? INK : MUTED);

  subheading('Targets and preferences');
  table(['Setting', 'Value'], [
    ['Daily study minutes', `${p.daily_minutes} min`],
    ['Word goal per entry', `${p.word_goal} words`],
    ['Journal entries per week', `${p.weekly_entry_goal}`],
    ['Theme', p.theme],
    ['Sounds', p.sound_on ? `On, volume ${p.sound_volume}%` : 'Off'],
    ['Onboarding finished', p.onboarded ? 'Yes' : 'Not yet'],
    ['Profile last updated', stamp(p.updated_at)],
  ], { 0: { cellWidth: 60, fontStyle: 'bold' } });

  // ---------- 2. Overview ----------
  section('2. Overview and statistics');
  table(['Measure', 'Value'], [
    ['Current streak', `${s.streak} day${s.streak === 1 ? '' : 's'}`],
    ['Longest streak', `${best} day${best === 1 ? '' : 's'}`],
    ['Streak freezes used', String(freezeDays.length)],
    ['Journal entries', String(s.entries)],
    ['Words written, all time', Number(s.wordsTotal).toLocaleString()],
    ['Words this week', Number(s.wordsWeek).toLocaleString()],
    ['Study minutes, all time', `${Number(r.journal.reduce((t, e) => t + (e.minutes_spent || 0), 0) + r.focus.reduce((t, f) => t + f.minutes, 0)).toLocaleString()}`],
    ['Focus minutes, all time', Number(s.focusTotal).toLocaleString()],
    ['Topics completed', String(s.completed)],
    ['Review sessions', String(s.reviewSessions)],
    ['Fields explored', String(s.fields)],
    ['Average confidence', s.avgConfidence === null ? 'No ratings yet' : `${s.avgConfidence} of 5`],
    ['Best confidence', s.bestConfidence === null ? 'No ratings yet' : `${s.bestConfidence} of 5`],
    ['Awards earned', `${earnedCount} of ${AWARDS.length}`],
  ], { 0: { cellWidth: 70, fontStyle: 'bold' } });

  subheading('Today\u2019s rings');
  table(['Ring', 'Progress', 'What it measures'], [
    ['Study', `${Math.round(s.rings.study * 100)}%`, `${s.minutesToday} of ${p.daily_minutes} minutes`],
    ['Journal', `${Math.round(s.rings.journal * 100)}%`, `${s.wordsToday} of ${p.word_goal} words`],
    ['Review', `${Math.round(s.rings.review * 100)}%`, `${s.reviewsDoneToday} done, ${s.dueToday} due`],
  ]);

  // ---------- 3. Week in review ----------
  section('3. Week in review');
  const recap = weeklyRecap(s);
  table(['This week', 'Result'], [
    ['Words written', Number(recap.wordsWeek).toLocaleString()],
    ['Entries', String(recap.entriesWeek)],
    ['Change from last week', recap.change === null ? 'No earlier week to compare' : `${recap.change >= 0 ? '+' : ''}${recap.change}%`],
    ['Best day', recap.bestDay ? `${prettyDate(recap.bestDay.day)} (${recap.bestDay.words} words)` : 'None yet'],
    ['Most-worked topic', recap.topTopic ? `${recap.topTopic.title} (${recap.topTopic.count} entries)` : 'None yet'],
    ['Most-worked field', recap.topField ? `${recap.topField.name} (${recap.topField.words} words)` : 'None yet'],
    ['Focus minutes', String(recap.focusWeek)],
  ], { 0: { cellWidth: 60, fontStyle: 'bold' } });
  subheading('Observations');
  bullets(insights(s));

  // ---------- 4. Awards ----------
  section('4. Awards');
  para(`${earnedCount} of ${AWARDS.length} awards earned. Earned awards show the date they were won. Locked awards show your progress toward them.`, 9.5, MUTED);
  for (const cat of CATEGORIES) {
    const items = AWARDS.filter(a => a.category === cat.key);
    subheading(cat.label);
    table(['Award', 'Tier', 'Status', 'What it takes'], items.map(a => {
      const earned = r.badges.get(a.key);
      const prog = awardProgress(a, s);
      return [
        a.name,
        TIER_LABEL[a.tier],
        earned
          ? `Earned ${longDate(earned)}`
          : prog.done ? 'Reached, saving now' : `Locked, ${prog.value} of ${prog.target}`,
        a.description,
      ];
    }));
  }

  // ---------- 5. Journal ----------
  section('5. Journal index');
  para(`${r.journal.length} entries, oldest first. Each full entry follows in section 6.`, 9.5, MUTED);
  table(['Date', 'Topic', 'Field', 'Conf.', 'Words', 'Min', 'Tags'], r.journal.map(e => [
    dateOnly(String(e.created_at).slice(0, 10)),
    e.topics?.title ?? 'Removed topic',
    e.topics?.subfields?.fields?.name ?? '',
    e.confidence ?? '',
    e.word_count ?? 0,
    e.minutes_spent ?? '',
    (e.tags || []).join(', '),
  ]), { 1: { cellWidth: 48 }, 6: { cellWidth: 36 } });

  section('6. Journal entries in full');
  if (!r.journal.length) para('No journal entries yet.', 9.5, MUTED);
  for (const e of r.journal) {
    room(22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    setInk();
    doc.text(clean(`${dateOnly(String(e.created_at).slice(0, 10))}  ·  ${e.topics?.title ?? 'Removed topic'}`), MARGIN, y);
    y += 5.2;
    doc.setFont('helvetica', 'normal');
    const meta = [
      e.topics?.subfields?.fields?.name && `Field: ${e.topics.subfields.fields.name}`,
      `Confidence ${e.confidence ?? 'not rated'} of 5`,
      `${e.word_count ?? 0} words`,
      e.minutes_spent ? `${e.minutes_spent} min` : null,
      stamp(e.created_at).slice(11),
    ].filter(Boolean).join('  ·  ');
    para(meta, 8.5, MUTED);
    para(e.body, 9.5, INK, 2);
    if (e.key_points?.length) {
      subheading('Key points');
      bullets(e.key_points, 9.2);
    }
    if (e.tags?.length) para(`Tags: ${e.tags.join(', ')}`, 8.5, MUTED);
    y += 3;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    room(4);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 5;
  }

  // ---------- 7. Study log ----------
  section('7. Study log');
  para(`Every topic Orbit has assigned to you, ${r.assignments.length} in total, with its status.`, 9.5, MUTED);
  table(['Assigned', 'Done by', 'Topic', 'Field', 'Level', 'Min', 'How chosen', 'Status'], r.assignments.map(a => [
    dateOnly(a.assigned_on),
    dateOnly(a.due_on),
    a.topics?.title ?? 'Removed topic',
    a.topics?.subfields?.fields?.name ?? '',
    a.topics?.difficulty ?? '',
    a.est_minutes,
    a.mode,
    a.status,
  ]), { 2: { cellWidth: 42 } });

  // ---------- 8. Reviews ----------
  section('8. Review schedule');
  para('Each topic you have journaled, with how often you have returned to it and when it is next due.', 9.5, MUTED);
  table(['Topic', 'Reviews', 'Next review', 'Interval (days)', 'Ease'], r.reviews.map(v => [
    v.topics?.title ?? 'Removed topic',
    v.reps,
    dateOnly(v.due_on),
    v.interval_days,
    Number(v.ease).toFixed(2),
  ]), { 0: { cellWidth: 74 } });

  // ---------- 9. Focus and freezes ----------
  section('9. Focus sessions and streak freezes');
  subheading('Focus sessions');
  const focusTotal = r.focus.reduce((t, f) => t + f.minutes, 0);
  para(`${r.focus.length} sessions, ${focusTotal} minutes in total.`, 9.5, MUTED);
  table(['Day', 'Minutes', 'Logged at'], r.focus.map(f => [dateOnly(f.day), f.minutes, stamp(f.created_at)]));
  subheading('Streak freezes used');
  table(['Day covered', 'Recorded at'], r.freezes.map(f => [dateOnly(f.day), stamp(f.created_at)]));

  // ---------- 10. Topic library ----------
  section('10. Topic library');
  subheading('Your marks on library topics');
  table(['Topic', 'Field', 'Section', 'Level', 'Your mark'], r.controls.map(c => [
    c.topics?.title ?? 'Removed topic',
    c.topics?.subfields?.fields?.name ?? '',
    c.topics?.subfields?.name ?? '',
    c.topics?.difficulty ?? '',
    c.state.replace(/_/g, ' '),
  ]), { 0: { cellWidth: 56 } });
  subheading('Topics you added');
  table(['Topic', 'Field', 'Section', 'Level', 'Added', 'Description'], r.customTopics.map(t => [
    t.title,
    t.subfields?.fields?.name ?? '',
    t.subfields?.name ?? '',
    t.difficulty,
    dateOnly(String(t.created_at).slice(0, 10)),
    t.description ?? '',
  ]), { 0: { cellWidth: 40 }, 5: { cellWidth: 40 } });
  subheading('Sections you created');
  table(['Section', 'Under field'], r.customSections.map(c => [c.name, c.fields?.name ?? '']));

  // ---------- 11. Decision log ----------
  section('11. Decision log');
  para('Every choice recorded by Orbit: topics generated, accepted or rejected, entries saved, marks changed. Orbit uses this history to refine what it suggests.', 9.5, MUTED);
  table(['When', 'Event', 'Topic', 'Details'], r.decisions.map(d => [
    stamp(d.created_at),
    String(d.event).replace(/_/g, ' '),
    d.topics?.title ?? '',
    d.payload && Object.keys(d.payload).length ? JSON.stringify(d.payload) : '',
  ]), { 0: { cellWidth: 30 }, 3: { cellWidth: 60 } });

  // ---------- Contents page ----------
  doc.setPage(contentsPage);
  let cy = MARGIN + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  setInk();
  doc.text('Contents', MARGIN, cy);
  cy += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  for (const sct of sections) {
    doc.text(clean(sct.title), MARGIN, cy);
    doc.setTextColor(...MUTED);
    doc.text(String(sct.page), PAGE_W - MARGIN, cy, { align: 'right' });
    setInk();
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.15);
    doc.line(MARGIN + doc.getTextWidth(clean(sct.title)) + 2, cy - 1, PAGE_W - MARGIN - 8, cy - 1);
    cy += 8;
  }
  cy += 6;
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(clean('How to read this record: start with section 2 for the overview, section 5 for the journal index, and section 6 for every entry in full.'), MARGIN, cy, { maxWidth: CONTENT_W });

  // ---------- Header and footer on every page after the cover ----------
  onStep('Finishing the pages');
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, PAGE_H - MARGIN + 1, PAGE_W - MARGIN, PAGE_H - MARGIN + 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(clean(`Orbit  ·  ${name}  ·  ${today()}`), MARGIN, PAGE_H - MARGIN + 6);
    doc.text(`Page ${i} of ${total}`, PAGE_W - MARGIN, PAGE_H - MARGIN + 6, { align: 'right' });
  }

  onStep('Saving');
  doc.save(`orbit-record-${today()}.pdf`);
  return { pages: total, entries: r.journal.length };
}

// A complete machine-readable copy of the same data, for backups or another app.
export async function buildBackupJson(uid, onStep = () => {}) {
  onStep('Collecting your record');
  const r = await collectRecord(uid);
  const payload = {
    format: 'orbit-backup',
    version: 4,
    exported_at: new Date().toISOString(),
    profile: r.profile,
    awards_earned: Object.fromEntries(r.badges),
    journal: r.journal,
    assignments: r.assignments,
    reviews: r.reviews,
    topic_controls: r.controls,
    custom_topics: r.customTopics,
    custom_sections: r.customSections,
    focus_sessions: r.focus,
    streak_freezes: r.freezes,
    decision_log: r.decisions,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `orbit-backup-${today()}.json`);
  return { entries: r.journal.length };
}
