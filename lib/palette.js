// One colour per field, so a journal entry's colour tells you its subject at a glance.
export const FIELD_COLORS = {
  '01': '#c4623d', // Psychology
  '02': '#3b7a6a', // Philosophy
  '03': '#b08a2e', // Business
  '04': '#9b5fa8', // Art
  '05': '#3f7fb5', // Computer science
  '06': '#2f9a8c', // Artificial intelligence
  '07': '#7a6ad8', // Particle physics
  '08': '#5f9b3a', // Human biology
  '09': '#c05a8a', // Neuroscience
  '10': '#7b7f8c', // Future and additional fields
};

export const fieldColor = id => FIELD_COLORS[id] ?? '#8a867f';

// Guided prompts for Reflect mode. Tapping one adds it to the entry.
export const REFLECT_PROMPTS = [
  'What did I understand clearly today?',
  'What was harder than I expected, and why?',
  'Which idea will I test or explain to someone else?',
  'What did I notice about how I was thinking or feeling?',
  'What is the next small step I will take?',
];

// Extra prompts, unlocked by the Five more prompts benefit.
export const EXTRA_PROMPTS = [
  'What assumption did I make that turned out to be wrong?',
  'What example would make this idea clearer to a friend?',
  'Where did I feel stuck, and what got me unstuck?',
  'What do I want to remember a month from now?',
  'What question has this topic left me with?',
];
