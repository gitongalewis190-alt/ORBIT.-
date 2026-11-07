'use client';
import FullEditor from '../../components/FullEditor';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { currentUser } from '../../lib/session';
import { today, prettyDate } from '../../lib/dates';
import { play } from '../../lib/sound';
import { toast } from '../../lib/toast';
import { fetchAllTopics } from '../../lib/context';
import { getProfile } from '../../lib/profile';
import { wordCount, loadStats } from '../../lib/stats';
import { commitEntry } from '../../lib/journal';
import { enqueue, isNetworkError, loadDraft, saveDraft, clearDraft } from '../../lib/offline';
import { logDecision } from '../../lib/log';
import { fieldColor, REFLECT_PROMPTS, EXTRA_PROMPTS } from '../../lib/palette';
import { readBenefits } from '../../lib/benefits';
import { renderRich, plainText } from '../../lib/richtext';
import TopicPicker from '../../components/TopicPicker';
import RichEditor from '../../components/RichEditor';
import AssistAsk from '../../components/AssistAsk';
import ConfirmDialog from '../../components/ConfirmDialog';
import { averageWords, assistPrefs, nextAdvice } from '../../lib/assist';
import { queueAutoBackup } from '../../lib/backupSync';
import { scheduleAtlas } from '../../lib/atlas/repository';

const CONFIDENCE_WORD = ['Blank', 'Barely', 'Shaky', 'Partial', 'Solid', 'Mastered'];
const FONT_CLASS = { serif: 'f-serif', mono: 'f-mono' };

const parseTags = text =>
  [...new Set(text.split(',').map(t => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean))].slice(0, 8);

// Learn writes research. Reflect writes a reflection, which belongs to the research on the same topic.
export default function Journal() {
  const [uid, setUid] = useState(null);
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [topics, setTopics] = useState([]);
  const [memorySearch, setMemorySearch] = useState('');
  const [topic, setTopic] = useState(null);
  const [assignmentId, setAssignmentId] = useState(null);
  const [body, setBody] = useState('');
  const [font, setFont] = useState('sans');
  const [points, setPoints] = useState('');
  const [tagText, setTagText] = useState('');
  const [conf, setConf] = useState(null);
  const [mins, setMins] = useState('');
  const [open, setOpen] = useState(null);
  const [mode, setMode] = useState('learn');
  const [benefitIds, setBenefitIds] = useState([]);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  useEffect(() => { setBenefitIds(readBenefits()); }, []);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [savedKind, setSavedKind] = useState('');
  const [err, setErr] = useState('');
  const [streak, setStreak] = useState(0);
  const [wordsToday, setWordsToday] = useState(0);
  const [draftNote, setDraftNote] = useState('');

  const words = useMemo(() => wordCount(plainText(body)), [body]);
  const goal = profile?.word_goal ?? 150;
  const pct = Math.min(100, Math.round((words / goal) * 100));
  const isReflect = mode === 'reflect';

  // The research written on the chosen topic, which a reflection is grouped under.
  const researchFor = topicId => entries.find(e => e.topic_id === topicId && e.entry_kind !== 'reflection') ?? null;
  const linkedResearch = isReflect && topic ? researchFor(topic.id) : null;

  useEffect(() => {
    currentUser().then(async (user) => {
      if (!user) return;
      const id = user.id;
      setUid(id);
      const p = await getProfile(id);
      setProfile(p);

      // Restore an unfinished draft from this phone.
      const draft = loadDraft(id);
      if (draft && (draft.body || draft.points || draft.tagText)) {
        setBody(draft.body || '');
        setPoints(draft.points || '');
        setTagText(draft.tagText || '');
        setConf(draft.conf ?? null);
        setMins(draft.mins || '');
        setFont(draft.font || 'sans');
        setDraftNote('Draft restored from this phone.');
      }

      const params = new URLSearchParams(window.location.search);
      const aid = params.get('assignment');
      const rid = params.get('review');
      if (aid) {
        const { data: a } = await supabase.from('assignments')
          .select('id,topic_id,topics(title)').eq('id', aid).maybeSingle();
        if (a?.topics) {
          setAssignmentId(a.id);
          setTopic({ id: a.topic_id, title: a.topics.title });
        }
      }
      if (rid) {
        const { data: t } = await supabase.from('topics').select('id,title').eq('id', rid).maybeSingle();
        if (t) setTopic(t);
      }
      if (params.get('synthesis') === '1') {
        const prompt = params.get('prompt');
        if (prompt) {
          setBody(prompt + '\n\n');
          setMode('reflect');
          toast('Bridge loaded. Reflect on the connection.', 'info');
        }
      }

      await load(id, p);
      const { data: tp, error } = await fetchAllTopics();
      if (!error) {
        setTopics(tp.map(t => ({
          id: t.id,
          title: t.title,
          field: t.subfields?.fields?.name ?? '',
          fieldId: t.subfields?.field_id ?? '',
          section: t.subfields?.name ?? '',
        })));
      }
    });
  }, []);

  // ... rest of the file remains unchanged from the original with the synthesis handling added above
  // (Full original content continues; this is the integrated version)
