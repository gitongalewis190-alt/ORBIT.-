// Single registry for navigation. Screens read this; they do not keep their own lists.
// Study has four clusters because section 5.2 names them. That exceeds the three-cluster
// cap in R2. The clusters are not dropped. The test records the exception.

export const FAMILIES = ['today', 'topics', 'journal', 'study', 'progress', 'system'];

export const PRIMARY = [
  { id: 'today', title: 'Today', route: '/' },
  { id: 'topics', title: 'Topics', route: '/topics' },
  { id: 'journal', title: 'Journal', route: '/journal' },
  { id: 'study', title: 'Study', route: '/study' },
  { id: 'progress', title: 'Progress', route: '/progress' },
];

const PATH_EDGES = {
  '/': ['/topics', '/journal', '/study', '/progress', '/settings', '/welcome'],
  '/study': ['/recall', '/atlas', '/resonance', '/keystone', '/parallax', '/attention', '/log', '/topics', '/settings', '/inspect'],
  '/progress': ['/awards', '/stats', '/log', '/inspect', '/'],
  '/settings': ['/guide', '/inspect', '/study'],
  '/inspect': ['/settings', '/keystone', '/parallax', '/log'],
  '/welcome': ['/login'],
  '/journal': ['/attention', '/recall', '/topics', '/settings', '/'],
  '/topics': ['/', '/journal'],
  '/atlas': ['/resonance', '/study', '/keystone'],
  '/awards': ['/stats', '/log', '/progress'],
  '/log': ['/stats', '/journal', '/progress'],
  '/resonance': ['/atlas', '/journal', '/'],
  '/attention': ['/journal', '/settings'],
  '/recall': ['/study', '/journal'],
  '/stats': ['/awards', '/log', '/progress'],
  '/guide': ['/settings'],
  '/keystone': ['/study', '/atlas', '/parallax'],
  '/parallax': ['/study', '/keystone'],
};

function rec(row) {
  return {
    anchor: null,
    action: null,
    keywords: [],
    statusSource: null,
    related: [],
    children: [],
    ...row,
  };
}

export const RECORDS = [
  rec({ id: 'log-learned', title: 'Log what I learned', description: 'Open the journal for today\u2019s topic.', family: 'today', cluster: 'Daily', route: '/journal', surface: '/', job: 'capture', frequency: 'daily', risk: 'safe', reachBudget: 1, icon: 'pen', keywords: ['log', 'journal', 'learned'], related: ['journal-capture'] }),
  rec({ id: 'review-now', title: 'Review now', description: 'Reviews due today, in due-date or Keystone order.', family: 'today', cluster: 'Daily', route: '/#reviews-due', surface: '/', job: 'practice', frequency: 'daily', risk: 'safe', reachBudget: 1, icon: 'list', keywords: ['reviews', 'due'], related: ['recall-quiz', 'focus'] }),
  rec({ id: 'focus', title: 'Focus timer', description: 'Start, pause and log focus minutes.', family: 'today', cluster: 'Daily', route: '/#focus', surface: '/', job: 'practice', frequency: 'daily', risk: 'safe', reachBudget: 1, icon: 'timer', keywords: ['focus', 'timer'], related: ['review-now'] }),
  rec({ id: 'topic-generation', title: 'Topic generation', description: 'Generate, another, field override, and More for.', family: 'today', cluster: 'Daily', route: '/#more-for', surface: '/', job: 'decide', frequency: 'daily', risk: 'safe', reachBudget: 1, icon: 'spark', keywords: ['generate', 'field', 'more for'], related: ['topics'] }),
  rec({ id: 'study-shortcuts', title: 'Study shortcuts', description: 'Recall model, Recall quiz, Resonance and Study.', family: 'today', cluster: 'Daily', route: '/study', surface: '/', job: 'understand', frequency: 'daily', risk: 'safe', reachBudget: 1, icon: 'compass', keywords: ['study', 'shortcuts'], related: ['recall-model', 'recall-quiz', 'resonance', 'study-hub'] }),
  rec({ id: 'rings', title: 'Daily rings', description: 'Study, journal and review rings.', family: 'today', cluster: 'Daily', route: '/#rings', surface: '/', job: 'measure', frequency: 'daily', risk: 'safe', reachBudget: 1, icon: 'chart', keywords: ['rings'], related: ['smart-notes', 'stats'] }),
  rec({ id: 'smart-notes', title: 'Smart notes', description: 'Notes drawn from today\u2019s record.', family: 'today', cluster: 'Daily', route: '/#smart-notes', surface: '/', job: 'understand', frequency: 'daily', risk: 'safe', reachBudget: 1, icon: 'list', keywords: ['notes'], related: ['rings'] }),

  rec({ id: 'topics', title: 'Topics', description: 'Library, marks, sections, add topics and bulk difficulty.', family: 'topics', cluster: 'Library', route: '/topics', surface: '/topics', job: 'manage', frequency: 'weekly', risk: 'safe', reachBudget: 2, icon: 'book', keywords: ['library', 'topics', 'marks'], related: ['topic-generation', 'journal-capture'] }),
  rec({ id: 'topic-delete', title: 'Delete topic', description: 'Archive, remove or delete a custom topic. Confirmation stays on Topics.', family: 'topics', cluster: 'Library', route: '/topics', surface: '/topics', job: 'manage', frequency: 'rare', risk: 'destructive', reachBudget: 3, icon: 'book', keywords: ['delete', 'archive', 'remove topic'], related: [] }),

  rec({ id: 'journal-capture', title: 'Journal', description: 'Learn, reflect, editor, dictate, topic picker and assist.', family: 'journal', cluster: 'Capture', route: '/journal', surface: '/journal', job: 'capture', frequency: 'daily', risk: 'safe', reachBudget: 1, icon: 'pen', keywords: ['journal', 'dictate', 'editor'], related: ['attention', 'recall-quiz', 'logs'] }),
  rec({ id: 'memory-edit', title: 'Memory list', description: 'Review again or edit an entry.', family: 'journal', cluster: 'Capture', route: '/journal', surface: '/journal', job: 'practice', frequency: 'weekly', risk: 'safe', reachBudget: 2, icon: 'list', keywords: ['memory', 'edit', 'review again'], related: ['review-now', 'recall-quiz'] }),
  rec({ id: 'memory-delete', title: 'Delete journal entry', description: 'Delete stays on the entry, behind the existing confirmation.', family: 'journal', cluster: 'Capture', route: '/journal', surface: '/journal', job: 'manage', frequency: 'rare', risk: 'destructive', reachBudget: 3, icon: 'pen', keywords: ['delete entry'], related: [] }),

  rec({ id: 'study-hub', title: 'Study', description: 'Practice, connect, understand and assist.', family: 'study', cluster: 'none', route: '/study', surface: '/study', job: 'understand', frequency: 'daily', risk: 'safe', reachBudget: 1, icon: 'compass', keywords: ['study', 'hub'], related: ['recall-quiz', 'atlas', 'attention'] }),
  rec({ id: 'recall-quiz', title: 'Recall quiz', description: 'Answer a question from something you logged.', family: 'study', cluster: 'Practice', route: '/recall', surface: '/recall', job: 'practice', frequency: 'weekly', risk: 'safe', reachBudget: 2, icon: 'spark', keywords: ['recall', 'quiz'], related: ['atlas-challenges', 'review-now', 'focus'] }),
  rec({ id: 'atlas-challenges', title: 'Atlas challenges', description: 'Practise a concept from the Atlas.', family: 'study', cluster: 'Practice', route: '/atlas#challenges', surface: '/atlas', job: 'practice', frequency: 'weekly', risk: 'safe', reachBudget: 2, icon: 'spark', keywords: ['challenge'], related: ['recall-quiz', 'atlas'] }),
  rec({ id: 'atlas', title: 'Atlas', description: 'Concepts, links and the five Atlas views.', family: 'study', cluster: 'Connect', route: '/atlas', surface: '/atlas', job: 'connect', frequency: 'weekly', risk: 'safe', reachBudget: 2, icon: 'link', keywords: ['atlas', 'graph', 'concept'], related: ['resonance', 'keystone', 'study-hub'] }),
  rec({ id: 'resonance', title: 'Resonance', description: 'Bridges between fields, and a weave into the journal.', family: 'study', cluster: 'Connect', route: '/resonance', surface: '/resonance', job: 'connect', frequency: 'weekly', risk: 'safe', reachBudget: 2, icon: 'link', keywords: ['resonance', 'weave'], related: ['atlas', 'journal-capture'] }),
  rec({ id: 'keystone', title: 'Keystone', description: 'An estimated review order that uses support links.', family: 'study', cluster: 'Connect', route: '/keystone', surface: '/keystone', job: 'connect', frequency: 'weekly', risk: 'safe', reachBudget: 2, icon: 'link', keywords: ['keystone', 'plan'], related: ['atlas', 'resonance', 'parallax'] }),
  rec({ id: 'recall-model', title: 'Recall model', description: 'Estimated recall from your own reviews.', family: 'study', cluster: 'Understand', route: '/log#recall-model', surface: '/log', job: 'understand', frequency: 'weekly', risk: 'safe', reachBudget: 2, icon: 'chart', keywords: ['memory', 'model', 'constellation'], related: ['parallax', 'atlas-mastery', 'inspect'] }),
  rec({ id: 'parallax', title: 'Parallax', description: 'Whether quiz results agree with the memory model.', family: 'study', cluster: 'Understand', route: '/parallax', surface: '/parallax', job: 'understand', frequency: 'rare', risk: 'safe', reachBudget: 3, icon: 'chart', keywords: ['parallax', 'calibration'], related: ['recall-model', 'atlas-mastery'] }),
  rec({ id: 'atlas-mastery', title: 'Atlas mastery', description: 'Mastery view of the Atlas.', family: 'study', cluster: 'Understand', route: '/atlas#mastery', surface: '/atlas', job: 'understand', frequency: 'weekly', risk: 'safe', reachBudget: 2, icon: 'chart', keywords: ['mastery'], related: ['recall-model', 'parallax', 'atlas'] }),
  rec({ id: 'attention', title: 'Attention', description: 'Ask the journal, or shorten a draft.', family: 'study', cluster: 'Assist', route: '/attention', surface: '/attention', job: 'assist', frequency: 'weekly', risk: 'safe', reachBudget: 2, icon: 'spark', keywords: ['attention', 'shorten'], related: ['assist-settings', 'journal-capture'] }),
  rec({ id: 'assist-settings', title: 'Assist settings', description: 'The same assist preferences the journal uses.', family: 'study', cluster: 'Assist', route: '/settings#assist', surface: '/settings', job: 'assist', frequency: 'weekly', risk: 'safe', reachBudget: 2, icon: 'gear', keywords: ['assist', 'settings'], related: ['attention'] }),

  rec({ id: 'progress-hub', title: 'Progress', description: 'Awards, stats, logs and the record.', family: 'progress', cluster: 'none', route: '/progress', surface: '/progress', job: 'measure', frequency: 'weekly', risk: 'safe', reachBudget: 1, icon: 'chart', keywords: ['progress', 'hub'], related: ['awards', 'stats', 'logs', 'inspect'] }),
  rec({ id: 'awards', title: 'Awards', description: 'Gallery of awards and the benefits they unlock.', family: 'progress', cluster: 'Milestones', route: '/awards', surface: '/awards', job: 'measure', frequency: 'weekly', risk: 'safe', reachBudget: 2, icon: 'award', keywords: ['awards', 'medals'], related: ['stats', 'logs', 'benefits'] }),
  rec({ id: 'benefits', title: 'Benefits', description: 'Benefits unlocked by awards.', family: 'progress', cluster: 'Milestones', route: '/awards', surface: '/awards', job: 'measure', frequency: 'weekly', risk: 'safe', reachBudget: 2, icon: 'award', keywords: ['benefits'], related: ['awards', 'rings'] }),
  rec({ id: 'stats', title: 'Stats', description: 'Streak, rings, observations and the progress card.', family: 'progress', cluster: 'Milestones', route: '/stats', surface: '/stats', job: 'measure', frequency: 'weekly', risk: 'safe', reachBudget: 2, icon: 'chart', keywords: ['stats', 'streak', 'freeze'], related: ['awards', 'logs'] }),
  rec({ id: 'logs', title: 'Logs', description: 'A filterable history of what Orbit recorded.', family: 'progress', cluster: 'Milestones', route: '/log', surface: '/log', job: 'measure', frequency: 'rare', risk: 'safe', reachBudget: 3, icon: 'list', keywords: ['logs', 'history'], related: ['recall-model', 'stats', 'journal-capture'] }),

  rec({ id: 'backup-now', title: 'Back up now', description: 'Download the backup file from Settings.', family: 'system', cluster: 'Data and backup', route: '/settings#export', surface: '/settings', job: 'manage', frequency: 'rare', risk: 'safe', reachBudget: 3, icon: 'shield', keywords: ['backup', 'export'], related: ['restore', 'pdf'] }),
  rec({ id: 'restore', title: 'Restore from file', description: 'Opens Settings. The existing confirmation is unchanged.', family: 'system', cluster: 'Data and backup', route: '/settings#export', surface: '/settings', job: 'manage', frequency: 'rare', risk: 'destructive', reachBudget: 3, icon: 'shield', keywords: ['restore'], related: [] }),
  rec({ id: 'pdf', title: 'Download PDF record', description: 'Open the print sheet.', family: 'system', cluster: 'Data and backup', route: null, action: 'orbit:open-print', surface: '/', job: 'manage', frequency: 'rare', risk: 'safe', reachBudget: 3, icon: 'print', keywords: ['pdf', 'print', 'record'], related: ['backup-now'] }),
  rec({ id: 'storage', title: 'Storage', description: 'How much of your storage is used.', family: 'system', cluster: 'Data and backup', route: '/settings#storage', surface: '/settings', job: 'manage', frequency: 'rare', risk: 'safe', reachBudget: 3, icon: 'shield', keywords: ['storage'], related: ['offline-queue'] }),
  rec({ id: 'offline-queue', title: 'Offline queue', description: 'Entries waiting to sync. Read-only status, plus sync now.', family: 'system', cluster: 'Data and backup', route: '/inspect#sync', surface: '/inspect', job: 'manage', frequency: 'rare', risk: 'safe', reachBudget: 3, icon: 'shield', keywords: ['offline', 'queue', 'sync'], related: ['backup-now'] }),
  rec({ id: 'drive', title: 'Google Drive', description: 'Drive connection lives in Settings, Backups.', family: 'system', cluster: 'Data and backup', route: '/settings#export', surface: '/settings', job: 'manage', frequency: 'rare', risk: 'safe', reachBudget: 3, icon: 'shield', keywords: ['drive', 'google'], related: ['backup-now'] }),

  rec({ id: 'settings', title: 'Settings', description: 'All eleven settings sections.', family: 'system', cluster: 'Settings and help', route: '/settings', surface: '/settings', job: 'manage', frequency: 'rare', risk: 'safe', reachBudget: 3, icon: 'gear', keywords: ['settings'], related: ['guide', 'inspect'] }),
  rec({ id: 'guide', title: 'Guide', description: 'Searchable manual and version history.', family: 'system', cluster: 'Settings and help', route: '/guide', surface: '/guide', job: 'manage', frequency: 'rare', risk: 'safe', reachBudget: 3, icon: 'help', keywords: ['guide', 'help', 'manual'], related: ['settings'] }),
  rec({ id: 'sign-out', title: 'Sign out', description: 'Opens Settings, where sign-out asks twice.', family: 'system', cluster: 'Settings and help', route: '/settings', surface: '/settings', job: 'manage', frequency: 'rare', risk: 'destructive', reachBudget: 3, icon: 'gear', keywords: ['sign out', 'log out'], related: [] }),
  rec({ id: 'reset', title: 'Reset', description: 'Opens the reset section. Confirmation is unchanged.', family: 'system', cluster: 'Settings and help', route: '/settings#reset', surface: '/settings', job: 'manage', frequency: 'rare', risk: 'destructive', reachBudget: 3, icon: 'gear', keywords: ['reset'], related: [] }),
  rec({ id: 'delete-account', title: 'Delete account', description: 'Opens the delete section. Confirmation is unchanged.', family: 'system', cluster: 'Settings and help', route: '/settings#delete', surface: '/settings', job: 'manage', frequency: 'rare', risk: 'destructive', reachBudget: 3, icon: 'gear', keywords: ['delete account'], related: [] }),
  rec({ id: 'inspect', title: 'Under the hood', description: 'Evidence behind each system, and safe controls only.', family: 'system', cluster: 'Under the hood', route: '/inspect', surface: '/inspect', job: 'manage', frequency: 'rare', risk: 'safe', reachBudget: 3, icon: 'eye', keywords: ['inspect', 'evidence', 'hood'], related: ['settings', 'guide'] }),

  rec({ id: 'welcome', title: 'Welcome', description: 'Landing page before sign-in.', family: 'unauthenticated', cluster: 'none', route: '/welcome', surface: '/welcome', job: 'manage', frequency: 'rare', risk: 'safe', reachBudget: 3, icon: 'home', keywords: ['welcome', 'begin'], related: ['login'] }),
  rec({ id: 'login', title: 'Login', description: 'Email and password sign-in.', family: 'unauthenticated', cluster: 'none', route: '/login', surface: '/login', job: 'manage', frequency: 'rare', risk: 'safe', reachBudget: 3, icon: 'home', keywords: ['login', 'sign in'], related: ['welcome'] }),
];

export const HUBS = {
  study: {
    Practice: ['recall-quiz', 'atlas-challenges', 'review-now', 'focus'],
    Connect: ['atlas', 'resonance', 'keystone', 'topics'],
    Understand: ['recall-model', 'parallax', 'atlas-mastery', 'inspect'],
    Assist: ['attention', 'assist-settings'],
  },
  progress: ['awards', 'benefits', 'stats', 'logs', 'recall-model', 'rings', 'smart-notes', 'pdf', 'inspect'],
};

export const SETTINGS_SECTIONS = [
  ['profile', 'Profile'],
  ['appearance', 'Appearance'],
  ['sound', 'Sound'],
  ['learning', 'Journal'],
  ['assist', 'Assist'],
  ['study', 'Study'],
  ['export', 'Backups'],
  ['storage', 'Storage'],
  ['help', 'Help'],
  ['reset', 'Reset'],
  ['delete', 'Delete account'],
];

const PREFIXES = [
  ['/atlas', 'study'],
  ['/keystone', 'study'],
  ['/parallax', 'study'],
  ['/recall', 'study'],
  ['/attention', 'study'],
  ['/resonance', 'study'],
  ['/study', 'study'],
  ['/topics', 'topics'],
  ['/journal', 'journal'],
  ['/progress', 'progress'],
  ['/awards', 'progress'],
  ['/stats', 'progress'],
  ['/log', 'progress'],
  ['/settings', 'system'],
  ['/guide', 'system'],
  ['/inspect', 'system'],
  ['/welcome', 'unauthenticated'],
  ['/login', 'unauthenticated'],
];

export function pathnameOf(route) {
  if (!route) return null;
  const path = String(route).split('#')[0].split('?')[0];
  return path || '/';
}

export function recordById(id) {
  return RECORDS.find(row => row.id === id) || null;
}

export function familyForPath(path) {
  const bare = String(path || '/').split('?')[0].split('#')[0] || '/';
  if (bare === '/') return 'today';
  let best = null;
  for (const [prefix, family] of PREFIXES) {
    if (bare === prefix || bare.startsWith(`${prefix}/`)) {
      if (!best || prefix.length > best[0].length) best = [prefix, family];
    }
  }
  return best ? best[1] : null;
}

export function routeRecord(route) {
  const path = String(route || '/').split('?')[0];
  if (path.startsWith('/atlas/concept')) return recordById('atlas');
  const exact = RECORDS.find(row => pathnameOf(row.route) === path);
  if (exact) return exact;
  const normalized = path.replace(/\/:[^/]+/g, '').replace(/\/$/, '') || '/';
  return RECORDS.find(row => pathnameOf(row.route) === normalized) || null;
}

export function clustersOf() {
  const out = {};
  for (const row of RECORDS) {
    if (!row.cluster || row.cluster === 'none') continue;
    if (!out[row.family]) out[row.family] = {};
    if (!out[row.family][row.cluster]) out[row.family][row.cluster] = [];
    out[row.family][row.cluster].push(row);
  }
  return out;
}

function distances() {
  const dist = new Map([['/', 0]]);
  const queue = ['/'];
  while (queue.length) {
    const current = queue.shift();
    const soFar = dist.get(current);
    for (const next of PATH_EDGES[current] || []) {
      if (dist.has(next)) continue;
      dist.set(next, soFar + 1);
      queue.push(next);
    }
  }
  return dist;
}

export function measuredReach(id) {
  const row = recordById(id);
  if (!row) return 99;
  const surface = row.surface || pathnameOf(row.route) || '/';
  if (surface === '/') return 0;
  const dist = distances();
  return dist.has(surface) ? dist.get(surface) : 99;
}

function isSubsequence(text, query) {
  let i = 0;
  for (const ch of text) {
    if (ch === query[i]) i += 1;
    if (i === query.length) return true;
  }
  return query.length === 0;
}

// Exact title, then prefix, then word prefix, then keyword, then subsequence.
// Ties keep registry order.
export function rankMatches(query, records = RECORDS) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const scored = [];
  records.forEach((row, index) => {
    const title = row.title.toLowerCase();
    const words = title.split(/\s+/);
    let rank = null;
    if (title === q) rank = 0;
    else if (title.startsWith(q)) rank = 1;
    else if (words.some(word => word.startsWith(q))) rank = 2;
    else if ((row.keywords || []).some(word => String(word).toLowerCase().includes(q))) rank = 3;
    else if (isSubsequence(title, q)) rank = 4;
    if (rank == null) return;
    scored.push({ row, rank, index });
  });
  scored.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return scored.map(item => item.row);
}

export function paletteGroups(query) {
  const rows = query ? rankMatches(query) : RECORDS.filter(row => row.risk !== 'destructive').slice(0, 8);
  const groups = { 'Go to': [], Do: [], Settings: [], Help: [] };
  for (const row of rows) {
    if (row.risk === 'destructive') continue;
    if (row.action) groups.Do.push(row);
    else if (row.id === 'guide' || (row.keywords || []).includes('manual')) groups.Help.push(row);
    else if (String(row.route || '').startsWith('/settings') || row.id === 'settings') groups.Settings.push(row);
    else if (row.route) groups['Go to'].push(row);
  }
  return groups;
}
