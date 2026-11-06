// Bump APP_VERSION with every release, and add a CHANGELOG entry at the top.
export const APP_VERSION = '7.0.0';

export const CHANGELOG = [
  {
    version: '7.0.0',
    date: '6 November 2026',
    notes: [
      'Guide button in the top bar, always one tap away.',
      'Benefits panel on Today and Awards: every benefit, its state, and the award that unlocks it.',
      'Topics search: several words, part-words, accents ignored, typo-forgiving, matches highlighted. Level filter added.',
      'Larger add-topics panel for pasting many topics at once.',
      'Journal editor with bold, italic, underline, highlight and bullet lists, and a wider writing area.',
      'Logs opens with statistics: totals, the week, entries by field, and what the numbers say.',
      'Deleting your account asks for your password first.',
      'Messages stack under the header without covering each other, and never repeat.',
      'Four typefaces for headings, text, numbers and labels, with a sequenced entrance on each screen.',
      'Medals are drawn as pictures in the PDF record, front and back, with bar charts for the week and for fields.',
    ],
  },
  {
    version: '6.0.0',
    date: '6 November 2026',
    notes: [
      'Awards are chains: each step must be earned in order, and later steps ask for much more.',
      'Benefits are real: a second streak freeze, 90 and 180 minute focus presets, and five extra reflection prompts.',
      'Topics catalogue: search, filter by mark and field, sort, group by field, and a detail sheet for each topic.',
      'A themed topic picker, colour-coded by field, replaces the plain search in the Journal.',
      'Unlock moments show the benefit you gained.',
    ],
  },
  {
    version: '5.0.0',
    date: '6 November 2026',
    notes: [
      'Five-tab bar with a liquid pebble: tap a tab, or press and drag to slide it.',
      'Logs replaces Stats in the bar, with Records and Statistics views.',
      'Logs search, filters and day grouping, with colour-coded rows.',
      'Reflect mode in the journal, with five guided prompts.',
      'Journal entries are colour-coded by field.',
      'Four smart notes on Today: streak guardian, pace coach, confidence tutor and review rhythm.',
      'A searchable Guide with version history, linked from Settings.',
      'Medals turn within a limited arc, and earned medals wear a casing.',
      'Custom focus times with the + button.',
      'Skeleton loaders in place of plain loading text.',
      'Password eye toggle on sign in.',
    ],
  },
  {
    version: '4.0.0',
    notes: [
      'Printable PDF record with every section of your data.',
      'Personal details: full name, date of birth, location, school or work, learning goal and bio.',
      'JSON backup of your data.',
    ],
  },
  {
    version: '3.0.0',
    notes: [
      'Focus timer that keeps running when the app is closed.',
      'Onboarding for new accounts.',
      'Offline drafts and queued entries that sync when you reconnect.',
      'Streak freezes, one every seven days.',
    ],
  },
  {
    version: '2.0.0',
    notes: [
      'Medal awards with unlock moments.',
      'Week view, totals and the progress card.',
    ],
  },
  {
    version: '1.0.0',
    notes: [
      'Daily topic selection with a reveal.',
      'Three rings for study, journal and review.',
      'Journal with spaced review.',
    ],
  },
];
