'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { currentUser } from '../../lib/session';
import { attend, ATTENTION } from '../../lib/attention';
import Dictate from '../../components/Dictate';
import { toast } from '../../lib/toast';

const DRAFT_KEY = 'orbit.draft.attention';

function readDraft() {
  try { return window.localStorage.getItem(DRAFT_KEY) || ''; } catch { return ''; }
}

function writeDraft(value) {
  try {
    if (value) window.localStorage.setItem(DRAFT_KEY, value);
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch { /* private mode */ }
}

// Reserved chat. Attention answers from the journal and can shorten what you type.
export default function AttentionPage() {
  const [uid, setUid] = useState(null);
  const [entries, setEntries] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const end = useRef(null);

  useEffect(() => {
    setText(readDraft());
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    writeDraft(text);
  }, [text, draftReady]);

  useEffect(() => {
    currentUser().then(async (user) => {
      if (!user) return;
      setUid(user.id);
      const [journal, thread] = await Promise.all([
        supabase.from('journal_entries')
          .select('id,topic_id,body,key_points,tags,confidence,word_count,created_at,topics(title)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(400),
        supabase.from('attention_messages')
          .select('id,role,body,created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(80),
      ]);
      if (!journal.error) {
        setEntries((journal.data ?? []).map(row => ({ ...row, topic_title: row.topics?.title })));
      }
      if (!thread.error) setMessages(thread.data ?? []);
    });
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages, busy]);

  async function send(raw) {
    const body = (raw ?? text).trim();
    if (!body || !uid || busy) return;
    setText('');
    writeDraft('');
    setBusy(true);
    const mine = { id: `local-${Date.now()}`, role: 'you', body };
    setMessages(list => [...list, mine]);
    const result = attend({ entries, text: body, request: body });
    const reply = result.text || 'Nothing in your journal matches that.';
    const answer = { id: `local-${Date.now()}-a`, role: 'attention', body: reply };
    setMessages(list => [...list, answer]);
    const { error } = await supabase.from('attention_messages').insert([
      { user_id: uid, role: 'you', body: body.slice(0, 4000) },
      { user_id: uid, role: 'attention', body: reply.slice(0, 4000) },
    ]);
    if (error) toast('Shown here, not saved to your account yet.', 'warn');
    setBusy(false);
  }

  return (
    <div className="fade-in attention-page" style={{ maxWidth: '100%', overflowX: 'hidden', paddingBottom: 120 }}>
      <Link href="/study" className="muted" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 15, textDecoration: 'none' }}>Study</Link>
      <h1 style={{ fontSize: '1.4rem' }}>{ATTENTION}</h1>
      <p className="muted">Your journal, in one conversation.</p>
      <div className="attention-log" aria-live="polite">
        {messages.length === 0 && <p className="muted">Ask when you wrote something, or start a message with shorten.</p>}
        {messages.map(message => (
          <div key={message.id} className={`attention-bubble from-${message.role}`} style={{ maxWidth: '100%', minWidth: 0, overflowWrap: 'anywhere' }}>
            <div className="kicker">{message.role === 'you' ? 'You' : ATTENTION}</div>
            <p style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', fontSize: 16 }}>{message.body}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="attention-compose" style={{ paddingBottom: 120 }}>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Ask Attention" rows={3} />
        <div className="doc-actions">
          <div><Dictate onText={spoken => setText(value => (value ? `${value.trimEnd()} ${spoken}` : spoken))} /></div>
          <div><button className="btn accent" type="button" onClick={() => send()} disabled={busy || !text.trim()} style={{ minHeight: 44 }}>{busy ? 'Sending' : 'Send'}</button></div>
        </div>
      </div>
    </div>
  );
}
