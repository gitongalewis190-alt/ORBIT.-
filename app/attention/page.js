'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { attend, ATTENTION } from '../../lib/attention';
import Dictate from '../../components/Dictate';
import { toast } from '../../lib/toast';

// Reserved chat. Attention answers from the journal and can shorten what you type.
export default function AttentionPage() {
  const [uid, setUid] = useState(null);
  const [entries, setEntries] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
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
    <div className="fade-in attention-page">
      <h1>{ATTENTION}</h1>
      <p className="muted">Your journal, in one conversation.</p>
      <div className="attention-log" aria-live="polite">
        {messages.length === 0 && <p className="muted">Ask when you wrote something, or start a message with shorten.</p>}
        {messages.map(message => (
          <div key={message.id} className={`attention-bubble from-${message.role}`}>
            <div className="kicker">{message.role === 'you' ? 'You' : ATTENTION}</div>
            <p>{message.body}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="attention-compose">
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Ask Attention" rows={3} />
        <div className="doc-actions">
          <div><Dictate onText={spoken => setText(value => (value ? `${value.trimEnd()} ${spoken}` : spoken))} /></div>
          <div><button className="btn accent" type="button" onClick={() => send()} disabled={busy || !text.trim()}>Send</button></div>
        </div>
      </div>
    </div>
  );
}
