import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';
import { supabase } from './supabase';
import { getProfile } from './profile';
import { loadStats, unlockedMap, insights, weeklyRecap } from './stats';
import { AWARDS, awardProgress, TIER_LABEL, CATEGORIES } from './awards';
import { today, prettyDate, addDays } from './dates';
import { downloadBlob } from './download';
import { fieldColor } from './palette';
import { dayLabel, minutesLabel, clockLabel } from './format';
import { HIGHLIGHTS, HL_KEYS } from './richtext';
import { sizeScale } from './printSettings';

// Adds doc.autoTable() and doc.lastAutoTable to jsPDF. Works in browsers and in Node.
applyPlugin(jsPDF);

const BASE = {
  ACCENT: [196, 98, 61], INK: [28, 27, 25], MUTED: [120, 116, 109],
  LINE: [232, 229, 224], PAPER_TINT: [250, 248, 246],
};
let ACCENT = BASE.ACCENT;
let INK = BASE.INK;
let MUTED = BASE.MUTED;
let LINE = BASE.LINE;
let PAPER_TINT = BASE.PAPER_TINT;
const MARGIN = 16;
let PAGE_H = 297;
let PAGE_W = 210;
let CONTENT_W = PAGE_W - MARGIN * 2;
let SAFE_BOTTOM = PAGE_H - MARGIN - 6;
let TEXT_SCALE = 1;
let COLOUR = true;
let MEDALS = 'near';
let ALIGN = 'left';

const SHEET = { a4: [210, 297], letter: [215.9, 279.4] };

// Page size in millimetres for a paper format and orientation.
export function pageDims(format = 'a4', orientation = 'portrait') {
  const [w, h] = SHEET[format] ?? SHEET.a4;
  return orientation === 'landscape' ? { w: h, h: w } : { w, h };
}

// Black and white turns a colour into its luminance grey. Colour leaves it unchanged.
export const pickColour = rgb => {
  if (COLOUR) return rgb;
  const l = Math.round(0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2]);
  return [l, l, l];
};

// Text size, alignment and the medal rule come from the print settings sheet.
export function configurePage({ format = 'a4', orientation = 'portrait', colour = true, textSize = 'standard', align = 'left', medals = 'near' } = {}) {
  const { w, h } = pageDims(format, orientation);
  PAGE_W = w;
  PAGE_H = h;
  CONTENT_W = PAGE_W - MARGIN * 2;
  SAFE_BOTTOM = PAGE_H - MARGIN - 6;
  COLOUR = colour;
  ACCENT = pickColour(BASE.ACCENT);
  INK = pickColour(BASE.INK);
  MUTED = pickColour(BASE.MUTED);
  LINE = pickColour(BASE.LINE);
  PAPER_TINT = pickColour(BASE.PAPER_TINT);
  TEXT_SCALE = sizeScale(textSize);
  ALIGN = align;
  MEDALS = medals;
}

// The built-in PDF fonts cover Latin-1 only. Common typographic punctuation is mapped
// to plain equivalents. Anything else (emoji, symbols, other scripts) is drawn as a
// small picture, rendered with the device's own fonts, so it prints as it looks on screen.
const PUNCT = {
  '\u2018': "'", '\u2019': "'", '\u201C': '"', '\u201D': '"',
  '\u2013': '-', '\u2014': '\u2014', '\u2026': '...', '\u00A0': ' ',
  '\u2022': '-', '\u2192': '->',
};
const RASTER_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Segoe UI Symbol","Noto Sans Symbols 2",system-ui,sans-serif';
const PT_TO_MM = 25.4 / 72;
const PX_PER_PT = 8; // Canvas resolution for pictured text: 8 pixels per point.

// Splits entry text into styled runs. Markers: **bold**, *italic*, __underline__, ==highlight==.
const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export function richRuns(text) {
  const marker = /(\*\*[\s\S]+?\*\*|__[\s\S]+?__|==[\s\S]+?==|\*[^*\n]+?\*)/g;
  const out = [];
  let last = 0;
  let m;
  while ((m = marker.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    const t = m[0];
    if (t.startsWith('**')) out.push({ text: t.slice(2, -2), bold: true });
    else if (t.startsWith('__')) out.push({ text: t.slice(2, -2), underline: true });
    else if (t.startsWith('==')) {
      const body = t.slice(2, -2);
      const k = body.match(new RegExp(`^(${HL_KEYS.join('|')}):`));
      out.push(k ? { text: body.slice(k[0].length), highlight: k[1] } : { text: body, highlight: 'yellow' });
    }
    else out.push({ text: t.slice(1, -1), italic: true });
    last = m.index + t.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export const needsRaster = value => /[^\u0000-\u00FF]/.test(String(value ?? ''));

// Draws text as a transparent PNG. Returns the picture size in mm and the baseline offset.
function rasterize(text, { size = 9.5, bold = false, color = INK } = {}) {
  const fontPx = size * PX_PER_PT;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${bold ? 'bold ' : ''}${fontPx}px ${RASTER_FONT}`;
  const width = Math.max(1, Math.ceil(ctx.measureText(text).width));
  const height = Math.ceil(fontPx * 1.3);
  canvas.width = width;
  canvas.height = height;
  const c2 = canvas.getContext('2d');
  c2.font = ctx.font;
  c2.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  c2.textBaseline = 'alphabetic';
  c2.fillText(text, 0, fontPx);
  return {
    src: canvas.toDataURL('image/png'),
    w: (width / PX_PER_PT) * PT_TO_MM,
    h: (height / PX_PER_PT) * PT_TO_MM,
    base: (fontPx / PX_PER_PT) * PT_TO_MM,
  };
}

// Writes one line of text at baseline (x, y). Pictures the text when it needs it.
// o: { align: 'left' | 'center' | 'right', maxWidth, size, bold, color }
function put(doc, value, x, y, o = {}) {
  const text = clean(value);
  if (!needsRaster(text)) {
    doc.text(text, x, y, { align: o.align, maxWidth: o.maxWidth });
    return;
  }
  const pic = rasterize(text, { size: o.size ?? doc.internal.getFontSize(), bold: o.bold, color: o.color ?? INK });
  let left = x;
  if (o.align === 'center') left = x - pic.w / 2;
  else if (o.align === 'right') left = x - pic.w;
  doc.addImage(pic.src, 'PNG', left, y - pic.base, pic.w, pic.h);
}

// Runs autoTable, with pictured text in any cell that holds an emoji or symbol.
function autoTableSafe(doc, opts) {
  const pics = new Map();
  const convert = (rows, section) => (rows || []).map((row, r) => row.map((value, c) => {
    const text = clean(value);
    if (!needsRaster(text)) return text;
    pics.set(`${section}:${r}:${c}`, { text, section });
    return '';
  }));
  const userDraw = opts.didDrawCell;
  doc.autoTable({
    ...opts,
    head: opts.head ? convert(opts.head, 'head') : undefined,
    body: convert(opts.body, 'body'),
    didDrawCell: data => {
      const key = `${data.section}:${data.row.index}:${data.column.index}`;
      const pic = pics.get(key);
      if (pic) {
        const drawn = rasterize(pic.text, {
          size: data.section === 'head' ? 8 : 8,
          bold: data.section === 'head',
          color: data.section === 'head' ? [255, 255, 255] : INK,
        });
        doc.addImage(drawn.src, 'PNG', data.cell.x + data.cell.padding('left'), data.cell.y + data.cell.padding('top'), drawn.w, drawn.h);
      }
      userDraw?.(data);
    },
  });
}

export function clean(value) {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value)
    ? value.join(', ')
    : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text
    .replace(/[\u2018\u2019\u201C\u201D\u2013\u2014\u2026\u00A0\u2022\u2192]/g, c => PUNCT[c])
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
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

const hexToRgb = hex => {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const WEEKDAY3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Draws every award as a picture. If the device cannot draw, the PDF still builds with text only.
async function renderMedalPictures(awards, badges, dateOf, holder) {
  try {
    const { renderMedalImages } = await import('./medalImage');
    const items = awards.map(a => {
      const earned = badges.get(a.key);
      return {
        key: a.key,
        tier: a.tier,
        emblem: a.emblem,
        name: a.name,
        dateLabel: earned ? dateOf(earned) : '',
        locked: !earned,
        holder,
      };
    });
    const images = await renderMedalImages(items, 512);
    return new Map(images.map(i => [i.key, i]));
  } catch (e) {
    console.warn('Medal pictures could not be drawn:', e);
    return null;
  }
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

// Returns a test for whether a timestamp falls inside { from, to } (YYYY-MM-DD, inclusive).
// No range means everything.
// Decision details as plain words: "confidence 4 · 30 min · 120 words", not raw JSON.
const PAYLOAD_LABEL = {
  confidence: v => `confidence ${v}`,
  minutes: v => minutesLabel(v),
  words: v => `${v} words`,
  next_review: v => `next review ${v}`,
  reps: v => `${v} review${Number(v) === 1 ? '' : 's'}`,
  mode: v => `${v} mode`,
  level: v => `${v} level`,
};
export function describePayload(payload) {
  if (!payload || typeof payload !== 'object') return '';
  return Object.entries(payload)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => (PAYLOAD_LABEL[k] ? PAYLOAD_LABEL[k](v) : `${k.replace(/_/g, ' ')} ${v}`))
    .join(' · ');
}

export function windowTest(range) {
  if (!range || (!range.from && !range.to)) return () => true;
  return iso => {
    const d = String(iso ?? '').slice(0, 10);
    return (!range.from || d >= range.from) && (!range.to || d <= range.to);
  };
}

// The printable record. Built for paper and for reading on a laptop.
// range: optional { from, to } window. It limits the journal, decision log, focus time and awards.
export async function buildRecordPdf(uid, onStep = () => {}, range = null, options = {}) {
  configurePage(options);
  onStep('Collecting your record');
  const r = await collectRecord(uid);
  const inWin = windowTest(range);
  r.journal = r.journal.filter(e => inWin(e.created_at));
  r.decisions = r.decisions.filter(d => inWin(d.created_at));
  r.focus = r.focus.filter(f => inWin(f.created_at));
  r.badges = new Map([...r.badges].filter(([, when]) => inWin(when)));
  const p = r.profile;
  const s = r.stats;
  const name = clean(p.full_name || p.display_name || 'Orbit learner');
  const freezeDays = r.freezes.map(f => f.day);
  const journalDays = r.journal.map(e => String(e.created_at).slice(0, 10));
  const best = longestStreak(journalDays, freezeDays);
  const holder = p.full_name || p.display_name || 'Lewis Gitonga';
  const earnedCount = AWARDS.filter(a => r.badges.has(a.key)).length;

  const todayStr = today();
  const doc = new jsPDF({ unit: 'mm', format: options.format ?? 'a4', orientation: options.orientation ?? 'portrait', compress: true });
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
    size = size * TEXT_SCALE;
    room(size * 0.5 + 10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    setInk();
    put(doc, text, MARGIN, y, { size, bold: true });
    y += size * 0.42 + 2;
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, y, MARGIN + 22, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
  };

  // Entry text with its formatting kept: bold, italic, underline and highlight in any palette colour.
  // Each word is drawn in its own style. Lines wrap, then align left, centred, right or justified.
  const richPara = (text, size = 9.5, indent = 0) => {
    size = size * TEXT_SCALE;
    const lineH = size * 0.42 + 1.1;
    const width = CONTENT_W - indent;
    const isSpace = t => /^\s+$/.test(t);
    const styleOf = w => {
      const style = w.bold && w.italic ? 'bolditalic' : w.bold ? 'bold' : w.italic ? 'italic' : 'normal';
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      doc.setTextColor(...INK);
    };
    const words = [];
    for (const run of richRuns(clean(text) || ' ')) {
      for (const part of run.text.split(/(\s+)/)) if (part) words.push({ ...run, text: part });
    }
    const drawLine = (items, last) => {
      room(size * 0.45 + 1.5);
      let line = items;
      while (line.length && isSpace(line[line.length - 1].text)) line = line.slice(0, -1);
      const contentW = line.reduce((t, w) => t + w.width, 0);
      const gaps = line.filter(w => isSpace(w.text)).length;
      let x = MARGIN + indent;
      if (ALIGN === 'center') x += (width - contentW) / 2;
      else if (ALIGN === 'right') x += width - contentW;
      const extra = ALIGN === 'justify' && !last && gaps > 0 ? (width - contentW) / gaps : 0;
      for (const w of line) {
        const ww = w.width + (isSpace(w.text) ? extra : 0);
        styleOf(w);
        if (w.highlight) {
          const hex = HIGHLIGHTS[w.highlight] ?? HIGHLIGHTS.yellow;
          doc.setFillColor(...(COLOUR ? hexRgb(hex) : [215, 215, 215]));
          doc.rect(x, y - size * 0.33, ww, size * 0.42 + 0.6, 'F');
        }
        put(doc, w.text, x, y, { size, bold: !!w.bold, color: INK });
        if (w.underline) {
          doc.setDrawColor(...INK);
          doc.setLineWidth(0.2);
          doc.line(x, y + 0.7, x + ww, y + 0.7);
        }
        x += ww;
      }
      y += lineH;
    };
    let line = [];
    let lineW = 0;
    for (const w of words) {
      styleOf(w);
      w.width = doc.getTextWidth(w.text);
      if (!isSpace(w.text) && lineW + w.width > width && line.some(x => !isSpace(x.text))) {
        drawLine(line, false);
        line = [];
        lineW = 0;
      }
      if (isSpace(w.text) && line.length === 0) continue;
      line.push(w);
      lineW += w.width;
    }
    if (line.length) drawLine(line, true);
    y += 2;
    setInk();
    doc.setFont('helvetica', 'normal');
  };

  const subheading = text => {
    room(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5 * TEXT_SCALE);
    setInk();
    put(doc, text, MARGIN, y, { size: 10.5, bold: true });
    y += 5.2;
    doc.setFont('helvetica', 'normal');
  };

  const para = (text, size = 9.5, color = INK, indent = 0) => {
    size = size * TEXT_SCALE;
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(clean(text) || ' ', CONTENT_W - indent);
    for (const line of lines) {
      room(size * 0.45 + 1.5);
      put(doc, line, MARGIN + indent, y, { size });
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
    autoTableSafe(doc, {
      startY: y,
      head: [head],
      body,
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
  put(doc, 'Orbit', MARGIN, 30, { size: 34, bold: true, color: [255, 255, 255] });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  put(doc, 'Personal learning record', MARGIN, 40, { size: 13, color: [255, 255, 255] });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  put(doc, name, MARGIN, 60, { size: 22, bold: true, color: [255, 255, 255] });
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
  autoTableSafe(doc, {
    startY: y,
    body: coverRows,
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
    ['Study time, all time', minutesLabel(r.journal.reduce((t, e) => t + (e.minutes_spent || 0), 0) + r.focus.reduce((t, f) => t + f.minutes, 0))],
    ['Focus time, all time', minutesLabel(s.focusTotal)],
    ['Topics completed', String(s.completed)],
    ['Review sessions', String(s.reviewSessions)],
    ['Fields explored', String(s.fields)],
    ['Average confidence', s.avgConfidence === null ? 'No ratings yet' : `${s.avgConfidence} of 5`],
    ['Best confidence', s.bestConfidence === null ? 'No ratings yet' : `${s.bestConfidence} of 5`],
    ['Awards earned', `${earnedCount} of ${AWARDS.length}`],
  ], { 0: { cellWidth: 70, fontStyle: 'bold' } });

  subheading('Today\u2019s rings');
  table(['Ring', 'Progress', 'What it measures'], [
    ['Study', `${Math.round(s.rings.study * 100)}%`, `${minutesLabel(s.minutesToday)} of ${minutesLabel(p.daily_minutes)}`],
    ['Journal', `${Math.round(s.rings.journal * 100)}%`, `${s.wordsToday} of ${p.word_goal} words`],
    ['Review', `${Math.round(s.rings.review * 100)}%`, `${s.reviewsDoneToday} done, ${s.dueToday} due`],
  ]);

  // Charts: last seven days, and entries by field.
  const barChart = (title, items, height = 26) => {
    room(height + 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    setInk();
    put(doc, title, MARGIN, y, { size: 9.5, bold: true });
    y += 5;
    const max = Math.max(1, ...items.map(i => i.value));
    const gap = 3;
    const barW = (CONTENT_W - gap * (items.length - 1)) / items.length;
    items.forEach((it, i) => {
      const x = MARGIN + i * (barW + gap);
      const h = (it.value / max) * height;
      doc.setFillColor(...LINE);
      doc.rect(x, y, barW, height, 'F');
      if (h > 0) {
        doc.setFillColor(...(it.colour ?? ACCENT));
        doc.rect(x, y + height - h, barW, h, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      put(doc, String(it.value), x + barW / 2, Math.max(y + 3, y + height - h - 1.2), { align: 'center', size: 7.5, color: MUTED });
      put(doc, it.label, x + barW / 2, y + height + 4, { align: 'center', maxWidth: barW, size: 7.5, color: MUTED });
      setInk();
    });
    y += height + 12;
  };

  barChart('Words written, last seven days', s.week.map(d => ({
    label: WEEKDAY3[new Date(d.day + 'T12:00:00Z').getUTCDay()],
    value: d.words,
  })));

  const byField = new Map();
  for (const e of r.journal) {
    const name = e.topics?.subfields?.fields?.name;
    const id = e.topics?.subfields?.field_id;
    if (!name) continue;
    const cur = byField.get(name) ?? { name, id, value: 0 };
    cur.value += 1;
    byField.set(name, cur);
  }
  const fieldItems = [...byField.values()].sort((a, b) => b.value - a.value).slice(0, 8);
  if (fieldItems.length) {
    barChart('Journal entries by field', fieldItems.map(f => ({
      label: f.name.charAt(0) + f.name.slice(1, 4).toLowerCase(),
      value: f.value,
      colour: pickColour(hexToRgb(fieldColor(f.id))),
    })));
  }

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
    ['Focus time', minutesLabel(recap.focusWeek)],
  ], { 0: { cellWidth: 60, fontStyle: 'bold' } });
  subheading('Observations');
  bullets(insights(s));

  // ---------- 4. Awards ----------
  onStep('Drawing your medals');
  const nearest = AWARDS.filter(a => !r.badges.has(a.key))
    .map(a => { const pr = awardProgress(a, s); return { a, ratio: pr.value / pr.target }; })
    .sort((x, y) => y.ratio - x.ratio)
    .slice(0, 3)
    .map(x => x.a);
  const shownKeys = new Set([...AWARDS.filter(a => r.badges.has(a.key)), ...(MEDALS === 'earned' ? [] : MEDALS === 'all' ? AWARDS : nearest)].map(a => a.key));
  const shownAwards = AWARDS.filter(a => shownKeys.has(a.key));
  const medalPics = await renderMedalPictures(shownAwards, r.badges, longDate, holder);
  section('4. Awards');
  para(`${earnedCount} of ${AWARDS.length} awards earned in this period. ${MEDALS === 'earned' ? 'Only earned awards are shown.' : MEDALS === 'all' ? 'Every award is shown, earned or locked.' : 'Only earned awards and the three closest to unlocking are shown.'}`, 9.5, MUTED);
  const drawMedalRow = items => {
    if (!medalPics) return;
    const cell = CONTENT_W / 3;
    const size = 25;
    for (let i = 0; i < items.length; i += 3) {
      room(size + 22);
      items.slice(i, i + 3).forEach((a, k) => {
        const x = MARGIN + k * cell;
        const pic = medalPics.get(a.key);
        if (pic) {
          doc.addImage(pic.front, 'PNG', x, y, size, size);
          doc.addImage(pic.back, 'PNG', x + size + 2, y, size, size);
        }
        const earned = r.badges.get(a.key);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        setInk();
        put(doc, a.name, x, y + size + 4.5, { maxWidth: cell - 4, size: 8.5, bold: true });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...MUTED);
        put(doc, earned ? `Earned ${longDate(earned)}` : 'Locked', x, y + size + 9, { maxWidth: cell - 4, size: 7.5, color: MUTED });
        setInk();
      });
      y += size + 17;
    }
  };

  for (const cat of CATEGORIES) {
    const items = shownAwards.filter(a => a.category === cat.key);
    if (!items.length) continue;
    subheading(cat.label);
    drawMedalRow(items);
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
    e.minutes_spent ? minutesLabel(e.minutes_spent) : '',
    (e.tags || []).join(', '),
  ]), { 1: { cellWidth: 48 }, 6: { cellWidth: 36 } });

  section('6. Journal entries in full');
  if (!r.journal.length) para('No journal entries yet.', 9.5, MUTED);
  for (const e of r.journal) {
    room(22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    setInk();
    put(doc, `${dateOnly(String(e.created_at).slice(0, 10))}  ·  ${e.topics?.title ?? 'Removed topic'}`, MARGIN, y, { size: 11, bold: true });
    y += 5.2;
    doc.setFont('helvetica', 'normal');
    const meta = [
      e.topics?.subfields?.fields?.name && `Field: ${e.topics.subfields.fields.name}`,
      `Confidence ${e.confidence ?? 'not rated'} of 5`,
      `${e.word_count ?? 0} words`,
      e.minutes_spent ? minutesLabel(e.minutes_spent) : null,
      clockLabel(e.created_at),
    ].filter(Boolean).join('  ·  ');
    para(meta, 8.5, MUTED);
    richPara(e.body, 9.5, 2);
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
  table(['Assigned', 'Done by', 'Topic', 'Field', 'Level', 'Time', 'How chosen', 'Status'], r.assignments.map(a => [
    dayLabel(a.assigned_on, todayStr, prettyDate),
    dayLabel(a.due_on, todayStr, prettyDate),
    a.topics?.title ?? 'Removed topic',
    a.topics?.subfields?.fields?.name ?? '',
    a.topics?.difficulty ?? '',
    minutesLabel(a.est_minutes),
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
  para(`${r.focus.length} session${r.focus.length === 1 ? '' : 's'}, ${minutesLabel(focusTotal)} in total.`, 9.5, MUTED);
  table(['Day', 'Focus time', 'Recorded at'], r.focus.map(f => [dayLabel(f.day, todayStr, prettyDate), minutesLabel(f.minutes), clockLabel(f.created_at)]));
  subheading('Streak freezes used');
  table(['Day covered', 'Recorded at'], r.freezes.map(f => [dayLabel(f.day, todayStr, prettyDate), clockLabel(f.created_at)]));

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
    `${dayLabel(String(d.created_at).slice(0, 10), todayStr, prettyDate)}, ${clockLabel(d.created_at)}`,
    String(d.event).replace(/_/g, ' '),
    d.topics?.title ?? '',
    describePayload(d.payload),
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
    put(doc, sct.title, MARGIN, cy, { size: 10.5 });
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
  put(doc, 'How to read this record: start with section 2 for the overview, section 5 for the journal index, and section 6 for every entry in full.', MARGIN, cy, { maxWidth: CONTENT_W, size: 9, color: MUTED });

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
    put(doc, `Orbit  ·  ${name}  ·  ${todayStr}`, MARGIN, PAGE_H - MARGIN + 6, { size: 8, color: MUTED });
    doc.text(`Page ${i} of ${total}`, PAGE_W - MARGIN, PAGE_H - MARGIN + 6, { align: 'right' });
  }

  onStep('Saving');
  const blob = doc.output('blob');
  return { pages: total, entries: r.journal.length, blob, fileName: `orbit-record-${todayStr}.pdf` };
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
