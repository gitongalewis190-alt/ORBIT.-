'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { play } from '../../lib/sound';
import {
  loadAtlas, createConcept, createEdge, setEdgeVerification, setConceptStatus,
  setDiscoveryVerification, openChallenge, submitChallenge, disputeAssessment,
} from '../../lib/atlas/repository';
import { composite, masteryLabel } from '../../lib/atlas/mastery';
import { findPath, clusters } from '../../lib/atlas/graph';
import { RELATIONSHIPS } from '../../lib/atlas/relationships';
import KnowledgeGraph from './KnowledgeGraph';

const VIEWS = [
  ['overview', 'Overview'],
  ['universe', 'Universe'],
  ['discoveries', 'Discoveries'],
  ['mastery', 'Mastery'],
  ['challenges', 'Challenges'],
];

function Stat({ label, value }) {
  return <div className="atlas-stat"><strong>{value}</strong><span className="muted">{label}</span></div>;
}

export default function AtlasScreen({ focusId = null }) {
  const [uid, setUid] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState(focusId ? 'universe' : 'overview');
  const [selectedId, setSelectedId] = useState(focusId);
  const [query, setQuery] = useState('');
  const [pathFrom, setPathFrom] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [link, setLink] = useState({ sourceId: '', targetId: '', relationship: 'related_to' });
  const [answer, setAnswer] = useState('');
  const [predicted, setPredicted] = useState('');
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  async function refresh(userId) {
    const next = await loadAtlas(userId);
    setData(next);
    return next;
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: auth }) => {
      if (!auth.user) return;
      setUid(auth.user.id);
      try {
        await refresh(auth.user.id);
      } catch (e) {
        setError(e.message);
      }
    });
  }, []);

  const concepts = data?.concepts || [];
  const visible = concepts.filter(concept => concept.status !== 'archived');
  const selected = concepts.find(concept => concept.id === selectedId) || null;
  const masteryById = useMemo(() => new Map((data?.mastery || []).map(row => [row.concept_id, row])), [data]);
  const filtered = visible.filter(concept => concept.name.toLowerCase().includes(query.trim().toLowerCase()));
  const verifiedEdges = (data?.edges || []).filter(edge => edge.verification === 'verified');
  const groups = data ? clusters(visible, data.edges) : [];
  const path = selected && pathFrom ? findPath(data.edges, pathFrom, selected.id) : [];

  async function run(fn) {
    setBusy(true);
    try {
      await fn();
      await refresh(uid);
      play('save');
    } catch (e) {
      play('error');
      toast(e.message, 'err', 6000);
    } finally {
      setBusy(false);
    }
  }

  const claimsFor = id => (data?.claims || []).filter(claim => claim.concept_id === id);
  const evidenceFor = id => (data?.evidence || []).filter(item => item.concept_id === id);

  return (
    <div className="fade-in">
      <h1>Cognitive Atlas</h1>
      <p className="muted">Explore the structure of what you know.</p>
      {error && <p className="err">{error}</p>}
      {!data && !error && <p className="muted">Loading your atlas</p>}
      {data && (
        <>
          <div className="atlas-stats">
            <Stat label="Concepts" value={visible.length} />
            <Stat label="Verified links" value={verifiedEdges.length} />
            <Stat label="Clusters" value={groups.length} />
            <Stat label="Open comparisons" value={(data.discoveries || []).filter(item => item.verification === 'candidate').length} />
            <Stat label="Opportunities" value={data.opportunities.length} />
          </div>
          <div className="seg" role="tablist" aria-label="Atlas sections">
            {VIEWS.map(([key, label]) => (
              <button key={key} type="button" className={view === key ? 'on' : ''} onClick={() => setView(key)}>{label}</button>
            ))}
          </div>

          {view === 'overview' && (
            <section>
              {!visible.length ? (
                <div className="card">
                  <p style={{ marginTop: 0 }}>Nothing is mapped yet. Save a journal entry, or add a concept yourself. Counts stay at zero until something is stored.</p>
                </div>
              ) : (
                <div className="card">
                  <div className="kicker">Today’s comparison</div>
                  {data.discoveries[0] ? (
                    <>
                      <h2>{data.discoveries[0].title}</h2>
                      <p>{data.discoveries[0].explanation}</p>
                      <p className="muted">Candidate only. Score {data.discoveries[0].score}. About 15 minutes to inspect.</p>
                      <button type="button" className="btn sm" onClick={() => setView('discoveries')}>Inspect</button>
                    </>
                  ) : <p className="muted">No comparison yet. One appears only when two fields share recorded words.</p>}
                </div>
              )}
              <h2>Opportunities</h2>
              {data.opportunities.length === 0 && <p className="muted">No recommendation until a concept is stored.</p>}
              {data.opportunities.map(item => (
                <div key={item.conceptId} className="card">
                  <div className="kicker">{item.category}</div>
                  <strong>{item.name}</strong>
                  <p>{item.why}</p>
                  <p className="muted">About {item.minutes} minutes. This does not replace today’s topic.</p>
                  <button type="button" className="btn sm" onClick={() => { setSelectedId(item.conceptId); setView('universe'); }}>Open</button>
                </div>
              ))}
              <h2>Add a concept</h2>
              <div className="card">
                <input value={name} placeholder="Concept name" onChange={e => setName(e.target.value)} />
                <input value={discipline} placeholder="Discipline" onChange={e => setDiscipline(e.target.value)} />
                <button type="button" className="btn accent" disabled={busy || !name.trim()} onClick={() => run(async () => {
                  await createConcept(uid, { name, discipline });
                  setName('');
                  setDiscipline('');
                  toast('Concept saved.', 'ok');
                })}>Add concept</button>
              </div>
            </section>
          )}

          {view === 'universe' && (
            <section>
              <input value={query} placeholder="Search concepts" onChange={e => setQuery(e.target.value)} />
              <KnowledgeGraph
                concepts={filtered}
                edges={data.edges}
                selectedId={selectedId}
                pathIds={path}
                onSelect={setSelectedId}
              />
              <label className="muted">Path from
                <select value={pathFrom} onChange={e => setPathFrom(e.target.value)}>
                  <option value="">Choose a concept</option>
                  {visible.map(concept => <option key={concept.id} value={concept.id}>{concept.name}</option>)}
                </select>
              </label>
              <div>
                {filtered.map(concept => (
                  <button key={concept.id} type="button" className="entry" style={{ display: 'block', width: '100%', textAlign: 'left' }} onClick={() => setSelectedId(concept.id)}>
                    <div>{concept.name}</div>
                    <div className="muted">{concept.discipline || 'No discipline'} · {concept.status} · {masteryLabel(masteryById.get(concept.id))}</div>
                  </button>
                ))}
              </div>
              <h2>Link two concepts</h2>
              <div className="card">
                <select value={link.sourceId} onChange={e => setLink({ ...link, sourceId: e.target.value })}>
                  <option value="">From</option>
                  {visible.map(concept => <option key={concept.id} value={concept.id}>{concept.name}</option>)}
                </select>
                <select value={link.relationship} onChange={e => setLink({ ...link, relationship: e.target.value })}>
                  {RELATIONSHIPS.map(item => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
                </select>
                <select value={link.targetId} onChange={e => setLink({ ...link, targetId: e.target.value })}>
                  <option value="">To</option>
                  {visible.map(concept => <option key={concept.id} value={concept.id}>{concept.name}</option>)}
                </select>
                <button type="button" className="btn" disabled={busy} onClick={() => run(async () => {
                  await createEdge(uid, link);
                  toast('Link saved as a candidate.', 'ok');
                })}>Add link</button>
              </div>
            </section>
          )}

          {view === 'discoveries' && (
            <section>
              {data.discoveries.length === 0 && <p className="muted">No comparisons yet.</p>}
              {data.discoveries.map(item => (
                <article key={item.id} className="card">
                  <div className="kicker">{item.discovery_type} · {item.verification}</div>
                  <h2>{item.title}</h2>
                  <p>{item.explanation}</p>
                  <p className="muted">Accepting this keeps it as a comparison. It does not make the mechanisms the same.</p>
                  {item.verification === 'candidate' && (
                    <div className="row">
                      <button type="button" className="btn sm accent" disabled={busy} onClick={() => run(() => setDiscoveryVerification(uid, item.id, 'verified'))}>Accept comparison</button>
                      <button type="button" className="btn sm" disabled={busy} onClick={() => run(() => setDiscoveryVerification(uid, item.id, 'rejected'))}>Reject</button>
                    </div>
                  )}
                </article>
              ))}
            </section>
          )}

          {view === 'mastery' && (
            <section>
              <p className="muted">These estimates come only from challenges. A journal confidence score is not mastery.</p>
              {visible.map(concept => {
                const mastery = masteryById.get(concept.id);
                const overall = composite(mastery);
                return (
                  <article key={concept.id} className="card">
                    <strong>{concept.name}</strong>
                    <div className="muted">{masteryLabel(mastery)}{overall.score == null ? '' : ` · estimate ${Math.round(overall.score * 100)}% from ${overall.known} dimensions`}</div>
                    {['recall', 'explanation', 'application', 'transfer', 'retention'].map(key => (
                      <div key={key} style={{ marginTop: 6 }}>
                        <span className="muted">{key} {mastery?.[key] == null ? 'unknown' : Math.round(mastery[key] * 100)}</span>
                        <div className="atlas-bar"><span style={{ width: `${mastery?.[key] == null ? 0 : mastery[key] * 100}%` }} /></div>
                      </div>
                    ))}
                  </article>
                );
              })}
            </section>
          )}

          {view === 'challenges' && (
            <section>
              {(data.challenges || []).length === 0 && <p className="muted">Open a concept and start a challenge. The prompt is built from that concept, not from a generic bank.</p>}
              {(data.challenges || []).map(challenge => (
                <article key={challenge.id} className="card">
                  <div className="kicker">{challenge.kind} · {challenge.status}</div>
                  <h2>{challenge.title}</h2>
                  <p>{challenge.prompt}</p>
                  {challenge.status === 'open' && (
                    <button type="button" className="btn sm" onClick={() => { setActiveChallenge(challenge); setSelectedId(challenge.concept_id); }}>Answer</button>
                  )}
                </article>
              ))}
              {activeChallenge && (
                <div className="card">
                  <div className="kicker">Answer</div>
                  <p>{activeChallenge.prompt}</p>
                  <input value={predicted} placeholder="How likely are you to cover it, 0 to 100" onChange={e => setPredicted(e.target.value)} />
                  <textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Your answer" />
                  <button type="button" className="btn accent" disabled={busy || !answer.trim()} onClick={() => run(async () => {
                    const concept = concepts.find(item => item.id === activeChallenge.concept_id);
                    const guess = predicted.trim() === '' ? null : Math.min(1, Math.max(0, Number(predicted) / 100));
                    const result = await submitChallenge(uid, activeChallenge, concept, claimsFor(concept.id), answer, guess);
                    setLastResult(result);
                    setAnswer('');
                    setActiveChallenge(null);
                    toast(result.note, 'ok', 5000);
                  })}>Submit answer</button>
                </div>
              )}
              {lastResult?.assessmentId && (
                <button type="button" className="btn sm" onClick={() => run(async () => {
                  await disputeAssessment(uid, lastResult.assessmentId, 'The score missed the point.');
                  toast('Dispute saved. The estimate is marked, not silently rewritten.', 'info');
                })}>This score missed the point</button>
              )}
            </section>
          )}
        </>
      )}

      {selected && (
        <>
          <button type="button" className="atlas-back" aria-label="Close concept" onClick={() => setSelectedId(null)} />
          <aside className="atlas-sheet" role="dialog" aria-modal="true" aria-label={selected.name}>
            <div className="kicker">{selected.discipline || 'No discipline'} · {selected.status}</div>
            <h2 style={{ marginTop: 4 }}>{selected.name}</h2>
            <p>{selected.description || 'No description stored yet.'}</p>
            <p className="muted">{masteryLabel(masteryById.get(selected.id))}. {path.length > 1 ? `Path length ${path.length - 1}.` : ''}</p>
            <h3>Links</h3>
            {(data.edges || []).filter(edge => edge.source_id === selected.id || edge.target_id === selected.id).map(edge => {
              const otherId = edge.source_id === selected.id ? edge.target_id : edge.source_id;
              const other = concepts.find(concept => concept.id === otherId);
              return (
                <div key={edge.id} className="row">
                  <span>{edge.relationship.replaceAll('_', ' ')} · {other?.name || 'Concept'} · {edge.verification}</span>
                  {edge.verification === 'candidate' && (
                    <button type="button" className="btn sm" disabled={busy} onClick={() => run(() => setEdgeVerification(uid, edge.id, 'verified'))}>Verify</button>
                  )}
                </div>
              );
            })}
            <h3>Evidence</h3>
            {evidenceFor(selected.id).length === 0 && <p className="muted">No journal entry is linked yet.</p>}
            {evidenceFor(selected.id).map(item => (
              <p key={item.id} className="muted">Journal entry {String(item.journal_entry_id).slice(0, 8)}</p>
            ))}
            {claimsFor(selected.id).slice(0, 4).map(claim => <p key={claim.id}>{claim.claim_text}</p>)}
            <div className="row">
              <button type="button" className="btn sm accent" disabled={busy} onClick={() => run(async () => {
                const challenge = await openChallenge(uid, selected, masteryById.get(selected.id));
                setActiveChallenge(challenge);
                setView('challenges');
                setSelectedId(null);
              })}>Start challenge</button>
              <button type="button" className="btn sm" disabled={busy} onClick={() => run(() => setConceptStatus(uid, selected.id, 'verified'))}>Mark verified</button>
              <button type="button" className="btn sm" disabled={busy} onClick={() => run(async () => {
                await setConceptStatus(uid, selected.id, 'archived');
                setSelectedId(null);
              })}>Archive</button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
