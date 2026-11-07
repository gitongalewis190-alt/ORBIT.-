// Orbit backup format. Pure: no network, no browser storage.
// A backup is one JSON document. Google Docs and other editors may wrap it in
// sentences or a code fence, so restore searches the text for the document.

export const FORMAT = 'orbit-backup';
export const VERSION = 5;

const JOURNAL_KEYS = [
  'id', 'topic_id', 'assignment_id', 'body', 'key_points', 'confidence', 'minutes_spent',
  'word_count', 'tags', 'created_at', 'entry_kind', 'research_entry_id', 'editor_font',
];

function copy(row, keys) {
  const out = {};
  for (const k of keys) if (row[k] !== undefined) out[k] = row[k];
  return out;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

// Pulls an Orbit backup out of a file, a paste, or text copied from a Google Doc.
export function extractBackup(input) {
  if (input && typeof input === 'object' && !Array.isArray(input)) return input;
  const text = String(input ?? '').replace(/^\uFEFF/, '').trim();
  if (!text) throw new Error('Nothing to restore.');
  const tries = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) tries.push(fenced[1].trim());
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) tries.push(text.slice(start, end + 1));
  let last = null;
  for (const piece of tries) {
    try {
      return JSON.parse(piece);
    } catch (e) {
      last = e;
    }
  }
  throw new Error('No Orbit backup found in that text.');
}

function awardsOf(raw) {
  if (raw.awards && typeof raw.awards === 'object' && !Array.isArray(raw.awards)) return raw.awards;
  if (raw.awards_earned && typeof raw.awards_earned === 'object') return raw.awards_earned;
  const list = asArray(raw.user_badges);
  return Object.fromEntries(list.map(b => [b.badge_key || b.key, b.unlocked_on || b.earned_at || null]));
}

// Turns a v4 or v5 backup into the rows a restore writes. Dates stay as they were exported.
export function normalizeBackup(raw) {
  if (!raw || raw.format !== FORMAT) throw new Error('This is not an Orbit backup.');
  const journal = asArray(raw.journal).map(row => {
    const item = copy(row, JOURNAL_KEYS);
    item.key_points = asArray(item.key_points);
    item.tags = asArray(item.tags);
    item.entry_kind = item.entry_kind === 'reflection' ? 'reflection' : 'research';
    return item;
  }).filter(row => row.id && String(row.body || '').trim() && row.created_at);

  journal.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)));

  return {
    version: Number(raw.version) || 4,
    exported_at: raw.exported_at || null,
    profile: raw.profile && typeof raw.profile === 'object' ? raw.profile : {},
    awards: awardsOf(raw),
    journal,
    assignments: asArray(raw.assignments),
    reviews: asArray(raw.reviews),
    topic_controls: asArray(raw.topic_controls),
    custom_topics: asArray(raw.custom_topics),
    custom_sections: asArray(raw.custom_sections),
    focus_sessions: asArray(raw.focus_sessions),
    streak_freezes: asArray(raw.streak_freezes),
    decision_log: asArray(raw.decision_log),
    recall: asArray(raw.recall),
    device: raw.device && typeof raw.device === 'object' ? raw.device : {},
  };
}

export const PROFILE_KEYS = [
  'display_name', 'age', 'daily_minutes', 'word_goal', 'weekly_entry_goal', 'theme',
  'sound_on', 'sound_volume', 'timezone', 'onboarded', 'full_name', 'date_of_birth',
  'location', 'school_or_work', 'learning_goal', 'bio',
];

export function profilePatch(profile) {
  const patch = {};
  for (const key of PROFILE_KEYS) {
    if (profile[key] !== undefined) patch[key] = profile[key];
  }
  return patch;
}
