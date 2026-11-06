// Journal formatting. Entries stay plain text, with light markers:
//   **bold**   *italic*   __underline__   ==highlight==   and lines starting "- " for bullets.
// Rendering escapes everything first, so a pasted tag or script can never run.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

export function renderRich(source) {
  let html = escapeHtml(source);
  // Bullets: consecutive "- " lines become one list.
  const lines = html.split('\n');
  const out = [];
  let inList = false;
  for (const line of lines) {
    const m = line.match(/^- (.*)$/);
    if (m) {
      if (!inList) out.push('<ul>');
      out.push(`<li>${m[1]}</li>`);
      inList = true;
    } else {
      if (inList) out.push('</ul>');
      inList = false;
      out.push(line);
    }
  }
  if (inList) out.push('</ul>');
  html = out.join('\n');
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  // Line breaks outside lists.
  return html.replace(/\n(?!<\/?ul>|<li>|<\/li>)/g, '<br/>').replace(/<\/ul><br\/>/g, '</ul>');
}

const WRAP = {
  bold: ['**', '**', 'bold text'],
  italic: ['*', '*', 'italic text'],
  underline: ['__', '__', 'underlined text'],
  highlight: ['==', '==', 'highlighted text'],
};

// Applies a format to the selection [start, end). Returns the new text and selection.
export function applyFormat(text, start, end, kind) {
  const s = Math.max(0, Math.min(start, text.length));
  const e = Math.max(s, Math.min(end, text.length));
  if (kind === 'bullet') {
    const lineStart = text.lastIndexOf('\n', s - 1) + 1;
    const lineEnd = text.indexOf('\n', e);
    const stop = lineEnd === -1 ? text.length : lineEnd;
    const block = text.slice(lineStart, stop);
    const converted = block.split('\n').map(l => (l.startsWith('- ') ? l : `- ${l}`)).join('\n');
    const next = text.slice(0, lineStart) + converted + text.slice(stop);
    return { text: next, start: lineStart, end: lineStart + converted.length };
  }
  const spec = WRAP[kind];
  if (!spec) return { text, start: s, end: e };
  const [open, close, placeholder] = spec;
  const selected = text.slice(s, e);
  const body = selected || placeholder;
  const next = text.slice(0, s) + open + body + close + text.slice(e);
  return { text: next, start: s + open.length, end: s + open.length + body.length };
}

// Words in the entry, ignoring the formatting marks.
export function plainText(source) {
  return String(source ?? '')
    .replace(/\*\*|__|==/g, '')
    .replace(/(^|\s)\*(?=\S)|(?<=\S)\*(?=\s|$|[.,!?;:])/g, '$1')
    .replace(/^- /gm, '');
}
