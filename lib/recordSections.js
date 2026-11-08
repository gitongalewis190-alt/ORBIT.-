// Plain rows for PDF sections 12 to 15. No React, no Supabase, no jsPDF.

const DASH = '\u2014';

export function dash(value) {
  if (value == null || value === '') return DASH;
  if (typeof value === 'number' && !Number.isFinite(value)) return DASH;
  return String(value);
}

export function clip(value, max) {
  if (value == null || value === '') return DASH;
  const text = String(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}\u2026`;
}

function finite(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function inWindow(test, iso) {
  if (typeof test !== 'function') return true;
  return test(iso);
}

export function recallSection(rows, test) {
  const list = (rows || []).filter(row => inWindow(test, row?.asked_at));
  const scores = list.map(row => finite(row.score)).filter(score => score != null);
  const mean = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  const below = scores.filter(score => score < 60).length;
  const by = {};
  for (const row of list) {
    const name = row.verifier || 'unknown';
    by[name] = (by[name] || 0) + 1;
  }
  const ai = list.filter(row => row.verifier && row.verifier !== 'local').length;
  const shown = list.slice(0, 150);
  return {
    title: '12. Recall quizzes',
    paragraphs: [
      list.length
        ? `${list.length} quizzes. Mean score ${mean == null ? DASH : mean.toFixed(1)}. ${below} below 60. ${ai} graded by an AI provider.`
        : 'No recall quizzes in this window.',
      list.length ? `Graded by: ${Object.entries(by).map(([name, count]) => `${name} ${count}`).join(', ')}.` : '',
    ].filter(Boolean),
    headers: ['Date', 'Topic', 'Question', 'Your answer', 'Score', 'Graded by'],
    rows: shown.map(row => [
      dash(String(row.asked_at || '').slice(0, 10)),
      dash(row.topic_title),
      clip(row.question, 140),
      clip(row.answer, 220),
      dash(finite(row.score)),
      dash(row.verifier),
    ]),
    note: list.length > shown.length ? `and ${list.length - shown.length} more are in the app` : '',
    empty: list.length ? '' : 'No recall quizzes in this window.',
  };
}

export function memorySection(reviews, test) {
  const list = (reviews || []).filter(row => !row?.due_on || inWindow(test, row.due_on) || inWindow(test, row.last_reviewed_on));
  const shown = [...list].sort((a, b) => String(a.due_on || '').localeCompare(String(b.due_on || ''))).slice(0, 200);
  return {
    title: '13. Memory model',
    paragraphs: [
      list.length ? `${list.length} review rows. Estimated recall uses the personal multiplier already stored with the model.` : 'No memory-model rows in this window.',
    ],
    headers: ['Topic', 'Last reviewed', 'Stability (days)', 'Difficulty', 'Estimated recall today', 'Next due', 'SM-2 ease, reps and interval'],
    rows: shown.map(row => [
      dash(row.title),
      dash(row.last_reviewed_on),
      dash(row.stability),
      dash(row.difficulty),
      dash(row.recall),
      dash(row.due_on),
      [row.ease, row.reps, row.interval_days].every(value => value == null) ? DASH : `${dash(row.ease)}, ${dash(row.reps)}, ${dash(row.interval_days)}`,
    ]),
    note: list.length > shown.length ? `and ${list.length - shown.length} more are in the app` : '',
    empty: list.length ? '' : 'No memory-model rows in this window.',
  };
}

export function atlasSection(input = {}) {
  const concepts = input.concepts || [];
  const edges = input.edges || [];
  const claims = input.claims || [];
  const mastery = input.mastery || [];
  const discoveries = input.discoveries || [];
  if (!concepts.length && !edges.length && !claims.length && !mastery.length) {
    return {
      title: '14. Knowledge Atlas',
      paragraphs: ['No Atlas data yet.'],
      headers: [],
      rows: [],
      note: '',
      empty: 'No Atlas data yet.',
      extra: null,
    };
  }
  const byStatus = {};
  for (const concept of concepts) byStatus[concept.status || 'unknown'] = (byStatus[concept.status || 'unknown'] || 0) + 1;
  const byVerification = {};
  for (const edge of edges) byVerification[edge.verification || 'unknown'] = (byVerification[edge.verification || 'unknown'] || 0) + 1;
  const verified = edges.filter(edge => edge.verification === 'verified');
  const shownLinks = verified.slice(0, 120);
  const shownMastery = mastery.slice(0, 100);
  const open = discoveries.filter(item => item.verification === 'candidate' || item.status === 'open').length;
  return {
    title: '14. Knowledge Atlas',
    paragraphs: [
      `Concepts: ${Object.entries(byStatus).map(([name, count]) => `${name} ${count}`).join(', ') || DASH}.`,
      `Links: ${Object.entries(byVerification).map(([name, count]) => `${name} ${count}`).join(', ') || DASH}. Claims: ${claims.length}. Open discoveries: ${open}.`,
    ],
    headers: ['Concept', 'Relationship', 'Concept'],
    rows: shownLinks.map(edge => [clip(edge.source, 80), dash(edge.relationship), clip(edge.target, 80)]),
    note: verified.length > shownLinks.length ? `and ${verified.length - shownLinks.length} more are in the app` : '',
    empty: '',
    extra: {
      headers: ['Concept', 'Recall', 'Explanation', 'Application', 'Transfer', 'Retention', 'Label', 'Observations'],
      rows: shownMastery.map(row => [
        dash(row.name), dash(row.recall), dash(row.explanation), dash(row.application),
        dash(row.transfer), dash(row.retention), dash(row.label), dash(row.observations),
      ]),
      note: mastery.length > shownMastery.length ? `and ${mastery.length - shownMastery.length} more are in the app` : '',
    },
  };
}

function statusLine(coupling) {
  if (!coupling || coupling.status == null) return 'insufficient evidence yet';
  if (coupling.status === 'assumed') return 'Assumed structure effect';
  if (coupling.status === 'validated') {
    const gain = coupling.gain == null ? DASH : Number(coupling.gain).toFixed(3);
    return `Validated on your history (${dash(coupling.heldOut)} events, held-out gain ${gain})`;
  }
  if (coupling.status === 'not supported') return 'Not supported by your history yet';
  return 'insufficient evidence yet';
}

export function resultsSection({ asOf, keystone, parallax } = {}) {
  const lines = [`Learning results as of ${dash(asOf)}. These are results only.`];
  if (!keystone) {
    lines.push('Keystone: insufficient evidence yet.');
  } else {
    lines.push(`Keystone: ${statusLine(keystone.coupling)}. Events used: ${dash(keystone.events)}. Coverage: ${keystone.coverage == null ? DASH : `${Math.round(keystone.coverage * 100)} percent`}.`);
    lines.push(`Expected concepts retained: plan ${dash(keystone.planK)}, due-date order ${dash(keystone.baselineK)}.`);
    const topics = (keystone.topics || []).slice(0, 5);
    lines.push(topics.length ? `Tomorrow plan: ${topics.map(topic => `${topic.title} ${topic.recall == null ? DASH : `${Math.round(topic.recall * 100)} percent`}`).join('; ')}.` : 'Tomorrow plan: insufficient evidence yet.');
    const concepts = (keystone.concepts || []).slice(0, 5);
    lines.push(concepts.length ? `Keystone concepts: ${concepts.map(concept => `${concept.name} (${dash(concept.direct)} direct)`).join('; ')}.` : 'Keystone concepts: insufficient evidence yet.');
    if (keystone.coupling?.status === 'not supported' || keystone.sparse) {
      lines.push('Not supported by your history yet. Few support links yet: Keystone behaves like due-date order.');
    }
  }
  if (!parallax || parallax.n == null || parallax.n < 20) {
    lines.push('Parallax: insufficient evidence yet.');
  } else {
    lines.push(`Parallax: ${dash(parallax.n)} LLM-graded probes. Gap: ${dash(parallax.status)}.`);
    lines.push(`Confidence: ${parallax.auc == null ? 'not distinguishable' : dash(parallax.auc)}.`);
    lines.push(parallax.assumption || 'Quiz grading is done by a small AI model or a keyword matcher, so some results are wrong.');
  }
  lines.push('These are estimates from your own records. They are not diagnoses and they do not change your schedule.');
  return {
    title: '15. Learning results',
    paragraphs: lines,
    headers: [],
    rows: [],
    note: '',
    empty: '',
  };
}
