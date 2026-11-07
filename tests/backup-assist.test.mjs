import assert from 'node:assert/strict';
import { extractBackup, normalizeBackup } from '../lib/backupFormat.js';
import { askJournal, averageWords } from '../lib/assist.js';

const doc = {
  format: 'orbit-backup',
  version: 4,
  profile: { display_name: 'Lewis', word_goal: 120, theme: 'dark' },
  awards_earned: { focus_first: '2026-01-02T00:00:00.000Z' },
  journal: [
    { id: 'j1', topic_id: 't1', body: 'A shift on technology and tools.', created_at: '2026-03-01T08:00:00.000Z', word_count: 6, confidence: 2, topics: { title: 'Tools' } },
    { id: 'j2', body: '   ', created_at: '2026-03-02T08:00:00.000Z' },
  ],
};

const wrapped = `Here is the copy from my doc.\n\n\`\`\`json\n${JSON.stringify(doc)}\n\`\`\`\nPlease keep it.`;
const parsed = normalizeBackup(extractBackup(wrapped));
assert.equal(parsed.journal.length, 1);
assert.equal(parsed.journal[0].id, 'j1');
assert.equal(parsed.journal[0].created_at, '2026-03-01T08:00:00.000Z');
assert.equal(parsed.awards.focus_first, '2026-01-02T00:00:00.000Z');
assert.equal(parsed.profile.display_name, 'Lewis');

const entries = [
  { id: 'a', topic_id: 'tech', topic_title: 'Technology', body: 'I did a shift on technology and networks.', created_at: '2026-04-01', word_count: 8, confidence: 2 },
  { id: 'b', topic_title: 'Painting', body: 'Colour and light in the studio.', created_at: '2026-04-02', word_count: 40, confidence: 5 },
];
const answer = askJournal(entries, 'When did I do a shift on technology?');
assert.equal(answer.hits[0].id, 'a');
assert.equal(answer.hits[0].created_at, '2026-04-01');
assert.ok(answer.recommendations.some(r => r.kind === 'relearn' || r.kind === 'recall'));
assert.equal(averageWords(entries), 24);
console.log('backup and assist ok');
