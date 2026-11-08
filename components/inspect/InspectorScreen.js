'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { dataBackupCard, cardShell } from '../../lib/inspect';
import { readAiLog, aiGradingEnabled, setAiGradingEnabled, verifyAnswer } from '../../lib/recallClient';
import { loadQueue } from '../../lib/offline';
import { currentUser } from '../../lib/session';
import Skeleton from '../Skeleton';

const EvidenceDrawer = dynamic(() => import('./EvidenceDrawer'), { ssr: false });

const CARDS = [
  ['topic', 'Today\u2019s topic choice', 'Unknown until a topic is drawn on this phone.'],
  ['reviews', 'Reviews and Recall model', 'Open the Recall model for the numbers.'],
  ['quiz', 'Quiz grading and AI', 'External grading sends only the answer, the entry and up to 20 key points.'],
  ['atlas', 'Atlas processing', 'Atlas AI: not connected. Jobs stay in atlas_processing_jobs.'],
  ['keystone', 'Keystone', 'No plan is stored until Keystone has run.'],
  ['parallax', 'Parallax', 'insufficient evidence yet'],
  ['awards', 'Awards and streak', 'Open Stats for the streak and freezes.'],
  ['data', 'Data and backup', 'Backup, restore, the PDF, storage, the queue and Drive.'],
  ['decisions', 'Decisions', 'The log is the list of recorded choices.'],
];

export default function InspectorScreen() {
  const [uid, setUid] = useState(null);
  const [open, setOpen] = useState(null);
  const [aiOn, setAiOn] = useState(true);
  const [queue, setQueue] = useState(0);
  const [health, setHealth] = useState(null);
  const [testNote, setTestNote] = useState('');

  useEffect(() => {
    setAiOn(aiGradingEnabled());
    currentUser().then((user) => {
      if (!user) { setUid(''); return; }
      setUid(user.id);
      setQueue(loadQueue(user.id).length);
    });
  }, []);

  const backup = dataBackupCard({ lastBackup: null, queue, drive: '—', storage: null });
  function drawerFor(id) {
    if (id === 'data') return backup;
    if (id === 'quiz') {
      return cardShell('Quiz grading and AI', aiOn ? 'AI grading is on. A failed call falls back to the keyword check on this phone.' : 'AI grading is off. Nothing is sent.', [
        { label: 'Calls on this phone', value: String(readAiLog().length) },
        { label: 'This server instance', value: health ? 'loaded' : 'not loaded' },
      ]);
    }
    const card = CARDS.find(item => item[0] === id);
    return cardShell(card[1], card[2], []);
  }

  async function loadHealth() {
    const { supabase } = await import('../../lib/supabase');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setTestNote('Sign in again.'); return; }
    const res = await fetch('/api/recall/verify', { headers: { Authorization: `Bearer ${token}` } });
    setHealth(res.ok ? await res.json() : null);
  }

  async function testGrader() {
    const started = Date.now();
    const graded = await verifyAnswer('The note said the idea was not neutral.', { body: 'Technology is not neutral.', key_points: ['not neutral'] }, { test: true });
    setTestNote(`${graded.verifier} in ${Date.now() - started} ms${graded.meta?.fallbackReason ? `, ${graded.meta.fallbackReason}` : ''}.`);
  }

  if (uid == null) return <Skeleton lines={4} label="Loading Under the hood" />;

  return (
    <div className="fade-in">
      <h1>Under the hood</h1>
      <p className="muted">Evidence only. Nothing here deletes a record or changes a score.</p>
      <div className="hub-grid">
        {CARDS.map(([id, title, line]) => (
          <article key={id} className="card" id={id === 'data' ? 'sync' : undefined}>
            <span className="tag">Unknown</span>
            <h2>{title}</h2>
            <p className="muted">{line}</p>
            <button type="button" className="btn sm" data-sound="open" onClick={() => setOpen(id)}>Open evidence</button>
          </article>
        ))}
      </div>
      <div className="card">
        <h2>Safe controls</h2>
        <div className="row">
          <button type="button" className="btn" data-sound="tap" onClick={() => window.dispatchEvent(new Event('orbit:flush-queue'))}>Sync the offline queue now</button>
          <button type="button" className="btn" data-sound="toggle" aria-pressed={aiOn} onClick={() => { const next = !aiOn; setAiOn(next); setAiGradingEnabled(next); }}>AI grading: {aiOn ? 'on' : 'off'}</button>
          <button type="button" className="btn" data-sound="tap" onClick={loadHealth}>Check this server instance</button>
          <button type="button" className="btn" data-sound="tap" onClick={testGrader}>Test AI grader</button>
          <button type="button" className="btn" data-sound="warn" onClick={() => { localStorage.removeItem('orbit.ai.log.v1'); setTestNote('Local AI log cleared.'); }}>Clear the local AI log</button>
          <Link className="btn" href="/log">Decisions</Link>
        </div>
        {testNote ? <p role="status">{testNote}</p> : null}
        {health ? <p className="muted">Order {health.order.join(', ')}. Budget {health.budgetMs} ms. This server instance.</p> : null}
      </div>
      <EvidenceDrawer open={Boolean(open)} onClose={() => setOpen(null)} drawer={open ? drawerFor(open) : null} />
    </div>
  );
}
