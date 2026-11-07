import assert from 'node:assert/strict';
import { extractBackup, normalizeBackup, packBackup } from '../lib/backupFormat.js';
import { askJournal, averageWords } from '../lib/assist.js';
import { shorten, attend } from '../lib/attention.js';

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

const packed = packBackup({
  profile: { display_name: 'Lewis', user_id: 'old', word_goal: 120 },
  awards: { focus_first: '2026-01-02T00:00:00.000Z' },
  journal: [{ id: 'j1', body: 'Kept.', created_at: '2026-03-01T08:00:00.000Z', topics: { title: 'Skip me' } }],
  custom_topics: [{ id: 't1', subfield_id: 's1', title: 'Tools', extra: 'no' }],
  custom_sections: [{ id: 's1', field_id: 'f1', name: 'Section', fields: { name: 'no' } }],
  recall: [{ entry_id: 'j1', question: 'What?', answer: 'Kept.', score: 80 }],
  assignments: [{ id: 'a1', topic_id: 't1', assigned_on: '2026-03-01', topics: { title: 'no' } }],
});
assert.equal(packed.version, 5);
assert.equal(packed.profile.user_id, undefined);
assert.equal(packed.journal[0].topics, undefined);
assert.equal(packed.custom_topics[0].subfield_id, 's1');
assert.equal(packed.custom_sections[0].field_id, 'f1');
assert.equal(packed.custom_sections[0].fields, undefined);
assert.equal(packed.recall[0].answer, 'Kept.');
assert.equal(normalizeBackup(packed).journal[0].created_at, '2026-03-01T08:00:00.000Z');

const entries = [
  { id: 'a', topic_id: 'tech', topic_title: 'Technology', body: 'I did a shift on technology and networks.', created_at: '2026-04-01', word_count: 8, confidence: 2 },
  { id: 'b', topic_title: 'Painting', body: 'Colour and light in the studio.', created_at: '2026-04-02', word_count: 40, confidence: 5 },
];
const answer = askJournal(entries, 'When did I do a shift on technology?');
assert.equal(answer.hits[0].id, 'a');
assert.equal(answer.hits[0].created_at, '2026-04-01');
assert.match(answer.answer, /2026-04-01/);
assert.match(answer.answer, /technology/i);
const paraphrased = askJournal(entries, 'Why did the moral side of tech matter?');
assert.equal(paraphrased.hits[0].id, 'a');
assert.ok(answer.recommendations.some(r => r.kind === 'relearn' || r.kind === 'recall'));
assert.equal(averageWords(entries), 24);

const long = 'It is important to note that technology is not neutral. I think that design choices carry moral weight. A second unused remark about the weather sits here.';
const short = shorten(long);
assert.ok(short.length < long.length);
assert.match(short, /not neutral/i);
assert.doesNotMatch(short, /important to note/i);
const job = attend({ entries, text: long, request: 'When did I do a shift on technology?' });
assert.equal(job.name, 'Attention');
assert.match(job.text, /2026-04-01/);
const cut = attend({ entries, text: long, request: 'shorten' });
assert.equal(cut.kind, 'shorten');
assert.ok(cut.text.length < long.length);
console.log('backup and assist ok');
