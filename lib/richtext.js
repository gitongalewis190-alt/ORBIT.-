// Journal formatting. Entries stay plain text, with light markers:
//   **bold**   *italic*   __underline__   ==highlight==
//   "# " at the start of a line for a heading
//   "- " for a bullet, and "1. " "2. " for a numbered list.
// Rendering escapes everything first, so a pasted tag or script can never run.
// Entries written before headings and numbered lists existed still render the same.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

// Inline marks on one line of already-escaped text.
function inline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
}

export function renderRich(source) {
  const lines = escapeHtml(source).split('\n');
  const parts = []; // { block: boolean, html: string }
  let list = null; // 'ul' | 'ol' while a list is open

  const closeList = () => {
    if (list) {
      parts.push({ block: true, html: `</${list}>` });
      list = null;
    }
  };

  for (const line of lines) {
    const bullet = line.match(/^- (.*)$/);
    const number = line.match(/^\d+\. (.*)$/);
    const heading = line.match(/^# (.*)$/);

    if (bullet || number) {
      const kind = bullet ? 'ul' : 'ol';
      if (list !== kind) {
        closeList();
        parts.push({ block: true, html: `<${kind}>` });
        list = kind;
      }
      parts.push({ block: true, html: `<li>${inline((bullet || number)[1])}</li>` });
      continue;
    }

    closeList();
    if (heading) {
      parts.push({ block: true, html: `<h3 class="rich-h">${inline(heading[1])}</h3>` });
      continue;
    }
    parts.push({ block: false, html: inline(line) });
  }
  closeList();

  // Plain lines are separated by line breaks. Blocks stand on their own.
  let out = '';
  parts.forEach((p, i) => {
    if (i > 0 && !p.block && !parts[i - 1].block) out += '<br/>';
    out += p.html;
  });
  return out;
}

const WRAP = {
  bold: ['**', '**', 'bold text'],
  italic: ['*', '*', 'italic text'],
  underline: ['__', '__', 'underlined text'],
  highlight: ['==', '==', 'highlighted text'],
};

// Lines in [s, e) as a block, found by the line boundaries around the selection.
function lineBlock(text, s, e) {
  const lineStart = text.lastIndexOf('\n', s - 1) + 1;
  const lineEnd = text.indexOf('\n', e);
  const stop = lineEnd === -1 ? text.length : lineEnd;
  return { lineStart, stop, block: text.slice(lineStart, stop) };
}

// Applies a format to the selection [start, end). Returns the new text and selection.
export function applyFormat(text, start, end, kind) {
  const s = Math.max(0, Math.min(start, text.length));
  const e = Math.max(s, Math.min(end, text.length));

  if (kind === 'bullet' || kind === 'numbered' || kind === 'heading') {
    const { lineStart, stop, block } = lineBlock(text, s, e);
    const lines = block.split('\n');
    let converted;
    if (kind === 'bullet') {
      converted = lines.map(l => (l.startsWith('- ') ? l : `- ${l.replace(/^(\d+\. |# )/, '')}`));
    } else if (kind === 'numbered') {
      converted = lines.map((l, i) => `${i + 1}. ${l.replace(/^(- |\d+\. |# )/, '')}`);
    } else {
      // Heading toggles: a line that already starts "# " goes back to plain text.
      const allHeading = lines.every(l => l.startsWith('# '));
      converted = lines.map(l => (allHeading ? l.replace(/^# /, '') : `# ${l.replace(/^(- |\d+\. |# )/, '')}`));
    }
    const joined = converted.join('\n');
    const next = text.slice(0, lineStart) + joined + text.slice(stop);
    return { text: next, start: lineStart, end: lineStart + joined.length };
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
    .replace(/^- /gm, '')
    .replace(/^# /gm, '')
    .replace(/^\d+\. /gm, '');
}
