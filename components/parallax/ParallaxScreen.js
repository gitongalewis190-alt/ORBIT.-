'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { currentUser } from '../../lib/session';
import { loadParallaxInputs } from '../../lib/memoryStore';
import { asFitRows, fitPersonal } from '../../lib/memory';
import { pairProbe, parallaxReport } from '../../lib/parallax';
import Skeleton from '../Skeleton';

const EvidenceDrawer = dynamic(() => import('../inspect/EvidenceDrawer'), { ssr: false });

export default function ParallaxScreen() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [epsMax, setEpsMax] = useState(0.2);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = Number(localStorage.getItem('orbit.parallax.eps'));
    if (saved === 0.1 || saved === 0.2 || saved === 0.3) setEpsMax(saved);
    currentUser().then(async (user) => {
      if (!user) { setRows([]); return; }
      try {
        const loaded = await loadParallaxInputs(user.id);
        const fit = fitPersonal(asFitRows(loaded.events));
        const paired = [];
        for (const question of loaded.questions) {
          const prior = (loaded.events || [])
            .filter(event => event.topic_id === question.topic_id && String(event.reviewed_at) < String(question.asked_at))
            .sort((a, b) => String(b.reviewed_at).localeCompare(String(a.reviewed_at)))[0];
          const row = pairProbe(prior, question, fit);
          if (row) paired.push(row);
        }
        setRows(paired);
      } catch (e) {
        setError(e.message || 'Parallax could not load.');
        setRows([]);
      }
    });
  }, []);

  const report = useMemo(() => (rows ? parallaxReport(rows, { epsMax }) : null), [rows, epsMax]);
  if (!report) return <Skeleton lines={4} label="Loading Parallax" />;
  const gap = report.gap;
  const insufficient = gap.status === 'insufficient evidence yet';
  const drawer = {
    title: 'Parallax evidence',
    verdict: insufficient ? 'Not enough evidence yet.' : gap.status,
    numbers: [
      { label: 'Probes', value: gap.n == null ? '—' : String(gap.n) },
      { label: 'Assumption', value: `${Math.round(epsMax * 100)} percent` },
      { label: 'Version', value: report.version },
    ],
    method: report.assumption,
    provenance: { tables: ['recall_questions', 'review_events'], rows: gap.n, updated: null, version: 'p1' },
    controls: [],
    raw: { status: gap.status, version: 'p1', epsMax },
  };
  return (
    <div className="fade-in">
      <h1>Parallax</h1>
      {error ? <p className="err">{error}</p> : null}
      <section className="card">
        <h2>Your model against your recall</h2>
        <p>{insufficient ? 'Not enough evidence yet. Take a Recall quiz when you want a second measurement.' : gap.status}</p>
        <p className="muted">n {gap.n ?? '—'} · predicted mean {gap.pbar == null ? '—' : gap.pbar.toFixed(2)}</p>
      </section>
      <section className="card">
        <h2>Assumption</h2>
        <p>{report.assumption}</p>
        <div className="seg" role="group" aria-label="Grader-error assumption">
          {[0.1, 0.2, 0.3].map(value => (
            <button key={value} type="button" data-sound="select" className={epsMax === value ? 'on' : ''} onClick={() => { setEpsMax(value); localStorage.setItem('orbit.parallax.eps', String(value)); }}>{Math.round(value * 100)}%</button>
          ))}
        </div>
        {(gap.reports || []).map(item => (
          <p key={item.threshold} className="muted">Threshold {item.threshold}: {item.status}</p>
        ))}
      </section>
      <section className="card">
        <h2>Confidence</h2>
        <p>{report.confidence.flag ? 'Your confidence ratings track your quiz results.' : 'Not enough to claim that confidence tracks the quizzes.'}</p>
        <p className="muted">AUC {report.confidence.auc == null ? '—' : report.confidence.auc.toFixed(2)}. Prediction AUC {report.predictionAuc.auc == null ? '—' : report.predictionAuc.auc.toFixed(2)}. {report.distinguishable ? '' : 'Not distinguishable.'}</p>
      </section>
      <section className="card">
        <h2>Illusion list</h2>
        {report.illusions.length ? report.illusions.map(row => (
          <Link key={`${row.entry_id}-${row.topic_id}`} href={`/recall?entry=${row.entry_id}`}>{row.topic_id}</Link>
        )) : <p className="muted">None yet.</p>}
      </section>
      <section className="card">
        <h2>Bands</h2>
        {report.bands.map(band => (
          <p key={band.low} className="muted">{band.low}–{band.high}: n {band.n}, {band.status}</p>
        ))}
      </section>
      <button type="button" className="btn" data-sound="open" onClick={() => setOpen(true)}>How this works</button>
      <EvidenceDrawer open={open} onClose={() => setOpen(false)} drawer={drawer} />
    </div>
  );
}
