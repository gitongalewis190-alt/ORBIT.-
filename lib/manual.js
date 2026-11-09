// The Orbit manual. Each section is searchable by title, body and keywords.
export const MANUAL = [
  {
    id: 'start',
    title: 'Getting started',
    keywords: ['sign in', 'login', 'password', 'eye', 'setup', 'onboarding'],
    body: [
      'Sign in with your email and password. Tap the eye beside the password to show or hide what you typed.',
      'The first time you sign in, a short setup asks for your name, age, daily rhythm and look. You can skip it and change everything later in Settings.',
      'Move between screens with the floating bar at the bottom. Journal is the raised button in the centre. The bar slides out of the way on Settings and whenever a dialog is open.',
      'The top bar holds the PDF button, which opens the record maker, and the Settings icon. The Guide is in Settings, under Help and version.',
    ],
  },
  {
    id: 'today',
    title: 'Today',
    keywords: ['daily topic', 'reveal', 'generate', 'field override'],
    body: [
      'Today shows your three rings, four smart notes and today\u2019s topic. The learning or reflection timer sits at the bottom of the rings card.',
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
    keywords: ['entry', 'write', 'tags', 'draft', 'colour', 'color', 'field', 'bold', 'italic', 'underline', 'highlight', 'bullet', 'format', 'heading', 'numbered', 'list', 'font', 'autocorrect', 'typo', 'spelling'],
    body: [
      'Write in Learn mode to explain a topic in your own words. The toolbar bolds, italicises, underlines, highlights, adds headings and makes bullet or numbered lists. Select text first, then tap a button, or use Ctrl or Cmd B, I and U.',
      'Choose a typeface for the entry from the font menu. Autocorrect fixes common typos when you finish a word, capitalises the start of sentences and the word I, and tidies spaces around punctuation. Turn it off in Settings under Journal and learning.',
      'Add tags separated by commas, up to eight. Each entry\u2019s coloured edge marks its field. Your draft is kept on the phone as you type.',
    ],
  },
  {
    id: 'reflect',
    title: 'Reflect mode',
    keywords: ['reflection', 'prompts', 'journaling', 'thinking', 'feeling'],
    body: [
      'Switch to Reflect for five guided prompts: what you understood, what was harder than expected, what you will test, how you were thinking, and your next step.',
      'Tap a prompt to add it to your entry. Reflections are linked to the research they belong to.',
      'In the memory view, each reflection sits under the research on the same topic, so you can read your thinking beside what you studied. Reflections without a matching research entry appear on their own.',
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
      'Under Help and version you will find the Guide, the version number and the change history. Sign out asks you to confirm twice.',
    ],
  },
  {
    id: 'export',
    title: 'Export and backup',
    keywords: ['pdf', 'record', 'print', 'json', 'backup', 'download', 'document log', 'reprint', 'window', 'emoji', 'symbols'],
    body: [
      'Tap the PDF button in the top bar to make a printable record. Choose the last 7, 30 or 90 days, or all of your history. The record holds your profile, statistics, journal entries in full, your study log, reviews, focus time, freezes, earned awards and topics.',
      'Each record you make is saved to the document log in Settings for one year. From there you can download it again, open it to print, or remove it. Emoji and symbols are drawn as they appear on screen.',
      'A JSON backup holds the same data in a file you can keep or move to another tool.',
      'A backup now also keeps review stability, difficulty, the last reviewed day, and the review events those estimates were learned from. Version 5 files still restore. The Atlas is not inside the backup file.',
    ],
  },
  {
    id: 'reset',
    title: 'Reset and delete',
    keywords: ['reset', 'delete account', 'erase', 'clear', 'remove data'],
    body: [
      'Reset clears your records but keeps your account and sign-in. Delete account permanently removes your sign-in and everything tied to it.',
      'Each one takes two steps. Sign out and reset ask you to confirm twice, with a warning first. Delete account asks you to type DELETE and enter your password before it runs.',
      'Reset keeps your account, your sign-in and the records you have already printed. None of these steps can be undone, so export a backup first if you want to keep your data.',
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
  {
    id: 'navigation',
    title: 'Navigation, menu, search and shortcuts',
    keywords: ['menu', 'search', 'rail', 'palette', 'shortcut'],
    body: [
      'The primary bar holds Today, Topics, Journal, Study and Progress. Journal stays in the centre.',
      'Search sits in the top bar on every screen. It opens the same list as Ctrl or Command K, and as the slash key when you are not typing.',
      'Below a laptop width the menu holds the same destinations as the side rail, because five primary destinations cannot show more than twenty others. The menu is not a second map. It closes when you move to a screen.',
      'On a laptop the side rail replaces the menu and the primary bar. G followed by T, J, S, P or I moves to Today, Journal, Study, Progress or Under the hood.',
    ],
  },
  {
    id: 'study-hub',
    title: 'Study hub and its four clusters',
    keywords: ['study', 'practice', 'connect', 'understand', 'assist'],
    body: [
      'Study groups practice, connections, understanding and assist. Each row keeps its own screen.',
      'Practice holds the recall quiz, Atlas challenges, reviews due and the focus timer. Connect holds Atlas, Resonance, Keystone and topic links. Understand holds the recall model, Parallax, Atlas mastery and a link to Under the hood. Assist holds Attention and the assist settings.',
    ],
  },
  {
    id: 'recall-chapter',
    title: 'Recall quiz and Recall model',
    keywords: ['recall', 'quiz', 'model'],
    body: [
      'Recall asks about an entry you wrote. A weak answer can put that topic into today\u2019s reviews. The line under a result names the grader.',
      'The recall model is the estimate of how much of a topic you would still retrieve. It is not a promise, and it stays on the Logs screen at the recall-model anchor.',
    ],
  },
  {
    id: 'attention-chapter',
    title: 'Attention',
    keywords: ['attention', 'shorten', 'ask'],
    body: [
      'Attention asks your journal or shortens a draft. It uses the same assist preferences as the journal.',
    ],
  },
  {
    id: 'resonance-chapter',
    title: 'Resonance',
    keywords: ['resonance', 'weave', 'bridge'],
    body: [
      'Resonance shows bridges and the strongest links between what you have studied, and it can weave a line into the journal.',
    ],
  },
  {
    id: 'atlas-chapter',
    title: 'Cognitive Atlas',
    keywords: ['atlas', 'concept', 'graph'],
    body: [
      'The Atlas keeps concepts, links, discoveries, mastery and challenges. The five views can be opened from their own links.',
    ],
  },
  {
    id: 'keystone-chapter',
    title: 'Keystone',
    keywords: ['keystone', 'plan', 'support'],
    body: [
      'Keystone estimates which reviews support the most concepts. The status is assumed, validated on your history, or not supported yet. Due-date order stays available, and a plan never hides a review.',
    ],
  },
  {
    id: 'parallax-chapter',
    title: 'Parallax',
    keywords: ['parallax', 'gap', 'quiz'],
    body: [
      'Parallax compares the memory model with recall quizzes. It reports a gap only when the direction survives the grader-error assumption. It does not change a prediction or a due date.',
    ],
  },
  {
    id: 'hood-chapter',
    title: 'Under the hood and the evidence drawers',
    keywords: ['inspect', 'evidence', 'drawer', 'hood'],
    body: [
      'Under the hood shows one card for each system, including data and backup. An evidence control explains the verdict, the numbers and where the rows came from. The controls there do not delete data.',
    ],
  },
  {
    id: 'pdf-record',
    title: 'Reading your PDF record',
    keywords: ['pdf', 'sections', 'record'],
    body: [
      'Sections 1 to 11 are the profile, statistics, week, awards, journal, study log, reviews, focus, library and decisions. Sections 12 to 15 add recall quizzes, the memory model, the Atlas and learning results when that switch is on.',
    ],
  },
  {
    id: 'timers',
    title: 'Learning and reflection timers',
    keywords: ['learning timer', 'reflection timer', 'reflect focus', 'discard', 'revoke', 'start confirmation', 'agree and continue', 'topic target', 'minutes'],
    body: [
      'The timer at the bottom of the rings card matches the switch at the top. On Learn it is the learning timer, and its minutes count toward the Study ring. On Reflect it is the reflection timer.',
      'If today\u2019s accepted topic has a target, the learning timer is set to that many minutes and cannot be changed. Otherwise you choose 25, 45 or 60 minutes, or your own time.',
      'Starting or resuming a timer asks you to confirm first. Discard stops a running timer and logs nothing. Revoke removes a logged session from today\u2019s totals, after a confirmation.',
    ],
  },
  {
    id: 'calendar',
    title: 'Rings calendar',
    keywords: ['calendar', 'history', 'past days', 'completed', 'red day', 'month', 'day detail'],
    body: [
      'Tap Open calendar on the rings card to see any month. Move between months with the arrows. Days after today cannot be opened.',
      'A red day was completed: its learning minutes and words met your daily goals. Tap any day to see the topics you learned, your words, your focus minutes and your reflection time.',
    ],
  },
  {
    id: 'trial',
    title: 'Trial mode',
    keywords: ['trial', 'test', 'try', 'private', 'not saved', 'toast', 'banner'],
    body: [
      'Trial mode is a private window for testing. It is at the top of Settings. Turning it on asks you to confirm and explains what changes.',
      'While trial mode is on, nothing you change is saved to your account: entries, swaps, challenges, awards, the Log, your name and your profile picture. Reading still shows your real data.',
      'A banner shows while trial mode is on. Turn it off from the same place. Anything you did in trial mode is not saved.',
    ],
  },
];
