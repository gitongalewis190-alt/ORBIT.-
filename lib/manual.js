// The Orbit manual. Each section is searchable by title, body and keywords.
export const MANUAL = [
  {
    id: 'start',
    title: 'Getting started',
    keywords: ['sign in', 'login', 'password', 'eye', 'setup', 'onboarding'],
    body: [
      'Sign in with your email and password. Tap the eye beside the password to show or hide what you typed.',
      'The first time you sign in, a short setup asks for your name, age, daily rhythm and look. You can skip it and change everything later in Settings.',
    ],
  },
  {
    id: 'today',
    title: 'Today',
    keywords: ['daily topic', 'reveal', 'generate', 'field override'],
    body: [
      'Today shows your three rings, four smart notes, the focus timer and today\u2019s topic.',
      'Tap Generate today\u2019s topic to draw one. You can also choose a field first to study within it. The reveal cycles through topics and lands on yours.',
    ],
  },
  {
    id: 'accept',
    title: 'Accepting and rejecting',
    keywords: ['accept', 'reject', 'skip', 'topic'],
    body: [
      'A generated topic waits for you. Accept it to commit to it today, or reject it to be offered another.',
      'A rejected topic is not offered again for two weeks.',
    ],
  },
  {
    id: 'rings',
    title: 'Your three rings',
    keywords: ['study', 'journal', 'review', 'progress', 'percent'],
    body: [
      'Study fills as you log minutes, from focus sessions and journal entries. Journal fills as you write words toward your word goal. Review fills as the reviews due today are completed.',
      'The first time each ring closes in a day, you hear a sound and see a message.',
    ],
  },
  {
    id: 'focus',
    title: 'Focus timer',
    keywords: ['pomodoro', 'timer', 'custom minutes', 'plus', 'log time'],
    body: [
      'Choose 25, 45 or 60 minutes, or tap + to enter your own time between 5 and 240 minutes. Custom times are kept on the phone.',
      'You can pause and resume, or log the time so far. The timer keeps running if you close the app. Finished time counts toward the Study ring.',
    ],
  },
  {
    id: 'journal',
    title: 'Journal',
    keywords: ['entry', 'write', 'tags', 'draft', 'colour', 'color', 'field', 'bold', 'italic', 'underline', 'highlight', 'bullet', 'format'],
    body: [
      'Write in Learn mode to explain a topic in your own words. The toolbar bolds, italicises, underlines, highlights and makes bullet lists. Select text first, then tap a button, or use Ctrl or Cmd B, I and U.',
      'Add tags separated by commas, up to eight. Each entry\u2019s coloured edge marks its field. Your draft is kept on the phone as you type.',
    ],
  },
  {
    id: 'reflect',
    title: 'Reflect mode',
    keywords: ['reflection', 'prompts', 'journaling', 'thinking', 'feeling'],
    body: [
      'Switch to Reflect for five guided prompts: what you understood, what was harder than expected, what you will test, how you were thinking, and your next step.',
      'Tap a prompt to add it to your entry. Reflections are tagged automatically, so you can find them later.',
    ],
  },
  {
    id: 'reviews',
    title: 'Reviews and spacing',
    keywords: ['spaced repetition', 'confidence', 'interval', 'schedule', 'due'],
    body: [
      'Rate your confidence from 0 to 5 when you save an entry. Orbit schedules the next review with spaced repetition.',
      'A low rating brings the topic back tomorrow. Strong ratings push it further out. Reviews due appear on Today.',
    ],
  },
  {
    id: 'topics',
    title: 'Topics catalogue',
    keywords: ['catalogue', 'library', 'search', 'filter', 'sort', 'field', 'level', 'more', 'less', 'archive', 'remove', 'section', 'bulk', 'paste', 'typo'],
    body: [
      'Search matches every word you type, in any order. Part-words work, accents are ignored, and a single typo in a longer word still finds it. Matches are highlighted.',
      'Narrow the list with the mark, field and level filters, and sort by best match, A to Z, field or level.',
      'Add many topics at once: paste one per line into Add topics. The panel is built for long lists.',
    ],
  },
  {
    id: 'logs',
    title: 'Logs and statistics',
    keywords: ['records', 'decisions', 'history', 'statistics', 'week', 'totals', 'fields', 'insights'],
    body: [
      'Logs opens with statistics: totals, the last seven days, where your entries went by field, and what the numbers say.',
      'Below them, Records lists every decision Orbit made and every change you made, grouped by day. Search it, or filter it by Topics, Entries or System.',
    ],
  },
  {
    id: 'awards',
    title: 'Awards',
    keywords: ['medals', 'badges', 'milestones', 'chain', 'steps', 'casing', 'turn', 'drag', 'progress'],
    body: [
      'Awards come in chains of steps: First focus, then Ten hours, then Fifty hours, for example. Each step must be earned after the one before, and each later step asks for much more.',
      'Tap an award to see its requirement and your progress. Drag an earned medal to turn it within a limited arc and see its front and its engraved back.',
    ],
  },
  {
    id: 'benefits',
    title: 'Benefits',
    keywords: ['benefit', 'reward', 'preset', 'freeze', 'prompts', 'unlock'],
    body: [
      'Some awards grant a benefit that changes how Orbit works. Second freeze: reaching a 7-day streak lets you save a streak twice in any seven days.',
      'Deep focus preset (Ten hours) adds a 90 minute preset. Marathon preset (Fifty hours) adds 180 minutes. Five more prompts (first five reflections) adds five extra prompts in Reflect mode.',
    ],
  },
  {
    id: 'streaks',
    title: 'Streaks and freezes',
    keywords: ['streak', 'freeze', 'missed day', 'protection'],
    body: [
      'A streak counts consecutive days with an entry or a freeze. If you miss a day, use a freeze for yesterday from Statistics.',
      'You get one freeze every seven days.',
    ],
  },
  {
    id: 'smart',
    title: 'Smart notes',
    keywords: ['guardian', 'pace', 'tutor', 'rhythm', 'advice', 'coach'],
    body: [
      'Four smart notes appear on Today. The streak guardian says what today needs to keep your streak. The pace coach shows how many entries your weekly goal still needs.',
      'The confidence tutor names the field where your confidence is lowest. The review rhythm tells you what is due and where to start.',
    ],
  },
  {
    id: 'settings',
    title: 'Settings and personalisation',
    keywords: ['profile', 'theme', 'dark', 'light', 'sound', 'volume', 'timezone', 'goal'],
    body: [
      'Set your daily minutes, word goal and weekly entry goal in Profile. Choose light, dark or system theme under Appearance.',
      'Sounds can be switched off or set to a volume you like. Personal details appear on your printed record.',
    ],
  },
  {
    id: 'export',
    title: 'Export and backup',
    keywords: ['pdf', 'record', 'print', 'json', 'backup', 'download'],
    body: [
      'From Settings, create a printable PDF record. It holds your profile, statistics, every journal entry in full, your study log, reviews, focus time, freezes, topics and decisions.',
      'A JSON backup holds the same data in a file you can keep or move to another tool.',
    ],
  },
  {
    id: 'reset',
    title: 'Reset and delete',
    keywords: ['reset', 'delete account', 'erase', 'clear', 'remove data'],
    body: [
      'Reset clears your records but keeps your account and sign-in. Delete account permanently removes your sign-in and everything tied to it.',
      'Both ask you to type a word to confirm, and neither can be undone. Export a backup first if you want to keep your data.',
    ],
  },
  {
    id: 'offline',
    title: 'Offline use',
    keywords: ['offline', 'connection', 'network', 'sync', 'queue'],
    body: [
      'Orbit opens without a connection from its saved copy. Finished journal entries are kept on the phone and sent when you are back online.',
    ],
  },
  {
    id: 'troubleshoot',
    title: 'Troubleshooting',
    keywords: ['help', 'problem', 'not updating', 'sign in fails', 'error'],
    body: [
      'If a screen does not update, close the app and open it again. If sign in fails, check your email and password, and use the eye button to confirm what you typed.',
      'If a problem continues, export a backup before anything else, then note what you were doing.',
    ],
  },
];
