import { supabase } from './supabase';
import { addDays, today } from './dates';

// Supabase caps each response at 1,000 rows, so the library is read in pages.
export async function fetchAllTopics() {
  const page = 1000;
  const rows = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.from('topics')
      .select('id,title,difficulty,user_id,prerequisite_id,subfields(name,field_id,fields(name))')
      .order('id')
      .range(from, from + page - 1);
    if (error) return { data: null, error };
    rows.push(...data);
    if (data.length < page) break;
  }
  return { data: rows, error: null };
}

// One pass that gathers everything the selector needs.
export async function buildContext(userId) {
  const t = today();
  const [topicsRes, ctrlRes, assignRes, journalRes, linkRes] = await Promise.all([
    fetchAllTopics(),
    supabase.from('topic_controls').select('topic_id,state').eq('user_id', userId),
    supabase.from('assignments').select('topic_id,assigned_on')
      .eq('user_id', userId).neq('status', 'rejected')
      .gte('assigned_on', addDays(t, -30)),
    supabase.from('journal_entries').select('topic_id,confidence,created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(200),
    supabase.from('field_links').select('field_a,field_b'),
  ]);

  for (const r of [topicsRes, ctrlRes, assignRes, journalRes, linkRes]) {
    if (r.error) throw r.error;
  }

  const topics = topicsRes.data.map(r => ({
    id: r.id,
    title: r.title,
    difficulty: r.difficulty,
    prerequisiteId: r.prerequisite_id,
    fieldId: r.subfields.field_id,
    fieldName: r.subfields.fields.name,
    subfieldName: r.subfields.name,
  }));

  const fieldOf = new Map(topics.map(x => [x.id, x.fieldId]));
  const controls = new Map(ctrlRes.data.map(r => [r.topic_id, r.state]));

  const recentTopicIds = new Set(
    assignRes.data.filter(a => a.assigned_on >= addDays(t, -14)).map(a => a.topic_id)
  );
  const recentFieldIds = new Set(
    assignRes.data
      .filter(a => a.assigned_on >= addDays(t, -2))
      .map(a => fieldOf.get(a.topic_id))
      .filter(Boolean)
  );

  const journal = journalRes.data;
  const lastFieldId = journal.length ? fieldOf.get(journal[0].topic_id) ?? null : null;
  const completedIds = new Set(journal.map(j => j.topic_id).filter(Boolean));

  const confByField = new Map();
  for (const j of journal) {
    const f = fieldOf.get(j.topic_id);
    if (!f || j.confidence == null) continue;
    if (!confByField.has(f)) confByField.set(f, []);
    confByField.get(f).push(j.confidence);
  }
  const fieldConfidence = new Map(
    [...confByField].map(([f, arr]) => [f, arr.reduce((a, b) => a + b, 0) / arr.length])
  );

  const links = new Map();
  for (const { field_a: a, field_b: b } of linkRes.data) {
    if (!links.has(a)) links.set(a, new Set());
    if (!links.has(b)) links.set(b, new Set());
    links.get(a).add(b);
    links.get(b).add(a);
  }

  const recentConfidences = journal.map(j => j.confidence).filter(c => c != null);

  return {
    topics,
    controls,
    recentTopicIds,
    recentFieldIds,
    lastFieldId,
    fieldConfidence,
    completedIds,
    links,
    recentConfidences,
  };
}
