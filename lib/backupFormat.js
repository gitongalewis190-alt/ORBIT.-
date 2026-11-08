// Orbit backup format. Pure: no network, no browser storage.
// A backup is one JSON document. Google Docs and other editors may wrap it in
// sentences or a code fence, so restore searches the text for the document.

export const FORMAT = 'orbit-backup';
export const VERSION = 6;

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

// Turns a v4, v5 or v6 backup into the rows a restore writes. Dates stay as they were exported.
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
    review_events: asArray(raw.review_events).filter(validReviewEvent),
    device: raw.device && typeof raw.device === 'object' ? raw.device : {},
  };
}

const SECTION_KEYS = ['id', 'field_id', 'name'];
const TOPIC_KEYS = ['id', 'subfield_id', 'title', 'description', 'difficulty', 'prerequisite_id', 'created_at'];
const ASSIGNMENT_KEYS = ['id', 'topic_id', 'assigned_on', 'due_on', 'est_minutes', 'mode', 'status', 'created_at'];
const REVIEW_KEYS = ['topic_id', 'due_on', 'interval_days', 'ease', 'reps', 'stability', 'difficulty', 'last_reviewed_on'];
const REVIEW_EVENT_KEYS = [
  'id', 'topic_id', 'reviewed_at', 'confidence', 'grade', 'observed_recall', 'elapsed_days',
  'stability_before', 'difficulty_before', 'k_used', 'stability_after', 'difficulty_after', 'derived',
];
const CONTROL_KEYS = ['topic_id', 'state', 'updated_at'];
const FOCUS_KEYS = ['id', 'day', 'minutes', 'created_at'];
const FREEZE_KEYS = ['day', 'created_at'];
const DECISION_KEYS = ['event', 'topic_id', 'payload', 'created_at'];
const RECALL_KEYS = ['entry_id', 'topic_id', 'topic_title', 'entry_logged_on', 'band', 'question', 'answer', 'score', 'comment', 'verifier', 'asked_at'];

function validReviewEvent(row) {
  if (!row || !row.id || !row.topic_id || !row.reviewed_at) return false;
  const grade = Number(row.grade);
  if (![1, 2, 3, 4].includes(grade)) return false;
  if (!(row.observed_recall === 0 || row.observed_recall === 1)) return false;
  if (row.k_used == null || row.stability_after == null || row.difficulty_after == null) return false;
  return true;
}

function rows(list, keys) {
  return asArray(list).map(row => copy(row, keys));
}

// The file restore reads. Nothing else is written into it.
export function packBackup(raw) {
  const profile = profilePatch(raw.profile && typeof raw.profile === 'object' ? raw.profile : {});
  const awards = awardsOf(raw);
  return {
    format: FORMAT,
    version: VERSION,
    exported_at: raw.exported_at || new Date().toISOString(),
    profile,
    awards,
    journal: asArray(raw.journal).map(row => {
      const item = copy(row, JOURNAL_KEYS);
      item.key_points = asArray(item.key_points);
      item.tags = asArray(item.tags);
      if (item.entry_kind !== 'reflection') item.entry_kind = 'research';
      return item;
    }).filter(row => row.id && String(row.body || '').trim() && row.created_at),
    assignments: rows(raw.assignments, ASSIGNMENT_KEYS).filter(row => row.id && row.topic_id && row.assigned_on),
    reviews: rows(raw.reviews, REVIEW_KEYS).filter(row => row.topic_id && row.due_on),
    topic_controls: rows(raw.topic_controls, CONTROL_KEYS).filter(row => row.topic_id && row.state),
    custom_topics: rows(raw.custom_topics, TOPIC_KEYS).filter(row => row.id && row.subfield_id && row.title),
    custom_sections: rows(raw.custom_sections, SECTION_KEYS).filter(row => row.id && row.field_id && row.name),
    focus_sessions: rows(raw.focus_sessions, FOCUS_KEYS).filter(row => row.day && row.minutes > 0),
    streak_freezes: rows(raw.streak_freezes, FREEZE_KEYS).filter(row => row.day),
    decision_log: rows(raw.decision_log, DECISION_KEYS).filter(row => row.event && row.created_at),
    recall: rows(raw.recall, RECALL_KEYS).filter(row => row.entry_id && row.question && row.answer),
    review_events: rows(raw.review_events, REVIEW_EVENT_KEYS).filter(validReviewEvent),
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
