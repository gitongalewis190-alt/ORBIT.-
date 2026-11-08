// Keystone: dependency-aware review planner. Facts, predictions and plans stay separate.
import { asFitRows, daysBetween, fitPersonal, predictRecall, recallProbability } from './memory.js';

export const KEYSTONE_VERSION = 'k1';
const PRIOR_HARD = 0.5;
const PRIOR_SOFT = 0.25;
const GAIN_GATE = 0.002;
const LAMBDA_STEP = 0.1;

const HARD = {
  prerequisite_of: 'forward',
  depends_on: 'reverse',
  derived_from: 'reverse',
};
const SOFT = {
  part_of: 'forward',
  contains: 'reverse',
};

export function orientRelationship(relationship) {
  if (HARD[relationship]) return { direction: HARD[relationship], klass: 'hard' };
  if (SOFT[relationship]) return { direction: SOFT[relationship], klass: 'soft' };
  return null;
}

function dayOf(iso) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export function indexSupport(concepts, edges) {
  const archived = new Set((concepts || []).filter(concept => concept.status === 'archived').map(concept => concept.id));
  const pair = new Map();
  for (const edge of edges || []) {
    const orient = orientRelationship(edge.relationship);
    if (!orient) continue;
    if (edge.verification === 'rejected') continue;
    if (archived.has(edge.source_id) || archived.has(edge.target_id)) continue;
    const supporter = orient.direction === 'forward' ? edge.source_id : edge.target_id;
    const dependent = orient.direction === 'forward' ? edge.target_id : edge.source_id;
    if (!supporter || !dependent || supporter === dependent) continue;
    const weight = edge.verification === 'verified' ? 1 : edge.confidence;
    if (weight == null || Number.isNaN(Number(weight))) continue;
    const key = `${supporter}\u0000${dependent}`;
    const prev = pair.get(key);
    const next = { supporter, dependent, w: Number(weight), klass: orient.klass };
    if (!prev) {
      pair.set(key, next);
      continue;
    }
    if (prev.klass !== next.klass) {
      pair.set(key, next.klass === 'hard' ? next : prev);
      continue;
    }
    if (next.w > prev.w) pair.set(key, next);
  }
  const incoming = new Map();
  const outgoing = new Map();
  for (const link of pair.values()) {
    if (!incoming.has(link.dependent)) incoming.set(link.dependent, []);
    incoming.get(link.dependent).push(link);
    if (!outgoing.has(link.supporter)) outgoing.set(link.supporter, []);
    outgoing.get(link.supporter).push(link);
  }
  return { incoming, outgoing, links: [...pair.values()] };
}

export function stronglyConnected(nodes, outgoing) {
  const ids = [...nodes];
  const index = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const groups = [];
  let tick = 0;
  const adj = id => (outgoing.get(id) || []).map(link => link.dependent);

  function strong(start) {
    const frames = [{ id: start, i: 0, phase: 0 }];
    while (frames.length) {
      const frame = frames[frames.length - 1];
      const next = adj(frame.id);
      if (frame.phase === 0) {
        index.set(frame.id, tick);
        low.set(frame.id, tick);
        tick += 1;
        stack.push(frame.id);
        onStack.add(frame.id);
        frame.phase = 1;
      }
      if (frame.i < next.length) {
        const to = next[frame.i];
        frame.i += 1;
        if (!index.has(to)) frames.push({ id: to, i: 0, phase: 0 });
        else if (onStack.has(to)) low.set(frame.id, Math.min(low.get(frame.id), index.get(to)));
        continue;
      }
      frames.pop();
      if (frames.length) {
        const parent = frames[frames.length - 1];
        low.set(parent.id, Math.min(low.get(parent.id), low.get(frame.id)));
      }
      if (low.get(frame.id) === index.get(frame.id)) {
        const group = [];
        let popped;
        do {
          popped = stack.pop();
          onStack.delete(popped);
          group.push(popped);
        } while (popped !== frame.id);
        if (group.length > 1) groups.push(group.sort());
      }
    }
  }

  for (const id of ids) if (!index.has(id)) strong(id);
  return groups;
}

function evidenceByConcept(evidence) {
  const map = new Map();
  for (const row of evidence || []) {
    if (!row.concept_id || !row.topic_id) continue;
    if (!map.has(row.concept_id)) map.set(row.concept_id, []);
    if (!map.get(row.concept_id).includes(row.topic_id)) map.get(row.concept_id).push(row.topic_id);
  }
  return map;
}

function conceptsByTopic(evidence) {
  const map = new Map();
  for (const row of evidence || []) {
    if (!row.concept_id || !row.topic_id) continue;
    if (!map.has(row.topic_id)) map.set(row.topic_id, []);
    if (!map.get(row.topic_id).includes(row.concept_id)) map.get(row.topic_id).push(row.concept_id);
  }
  return map;
}

function topicState(reviews) {
  const map = new Map();
  for (const review of reviews || []) {
    if (review.stability == null) continue;
    map.set(review.topic_id, review);
  }
  return map;
}

function recallOf(review, h, fit, today, fresh) {
  if (!review || review.stability == null) return null;
  const elapsed = fresh ? 0 : daysBetween(review.last_reviewed_on, today);
  const value = predictRecall(elapsed + h, Number(review.stability), fit);
  return value.mean == null ? null : value.mean;
}

export function rhoMap({ concepts, evidence, reviews, fit, today, horizon, freshTopics }) {
  const byConcept = evidenceByConcept(evidence);
  const topics = topicState(reviews);
  const fresh = freshTopics || new Set();
  const live = new Set((concepts || []).filter(concept => concept.status !== 'archived').map(concept => concept.id));
  const rho = new Map();
  for (const id of live) {
    const list = byConcept.get(id) || [];
    let best = null;
    for (const topicId of list) {
      const review = topics.get(topicId);
      const value = recallOf(review, horizon, fit, today, fresh.has(topicId));
      if (value == null) continue;
      if (best == null || value > best) best = value;
    }
    rho.set(id, best);
  }
  return rho;
}

export function effectOf(rho, supporters, lambda) {
  if (rho == null) return null;
  let product = 1;
  for (const link of supporters || []) {
    const other = link.rho;
    if (other == null) continue;
    const scale = link.klass === 'hard' ? lambda.hard : lambda.soft;
    product *= 1 - scale * link.w * (1 - other);
  }
  const value = rho * product;
  if (!Number.isFinite(value)) return null;
  return Math.min(rho, Math.max(0, value));
}

export function retained(rho, support, lambda) {
  let total = 0;
  let known = 0;
  for (const [id, value] of rho) {
    const effect = effectOf(value, support.incoming.get(id) || [], lambda);
    if (effect == null) continue;
    total += effect;
    known += 1;
  }
  return { total, known };
}

function decorate(support, rho) {
  const incoming = new Map();
  for (const [id, links] of support.incoming) {
    incoming.set(id, links.map(link => ({ ...link, rho: rho.get(link.supporter) ?? null })));
  }
  return { ...support, incoming };
}

export function marginalPlan({ concepts, edges, evidence, reviews, fit, today, horizon, slots, lambda }) {
  const support = indexSupport(concepts, edges);
  const pool = (reviews || [])
    .filter(review => review.stability != null && review.due_on && review.due_on <= addHorizon(today, horizon))
    .map(review => ({ ...review, title: review.title || review.topic_id }))
    .sort((a, b) => String(a.due_on).localeCompare(String(b.due_on)) || String(a.topic_id).localeCompare(String(b.topic_id)));
  const baselineIds = pool.slice(0, slots).map(review => review.topic_id);
  const score = (fresh) => {
    const rho = rhoMap({ concepts, evidence, reviews, fit, today, horizon, freshTopics: fresh });
    return retained(rho, decorate(support, rho), lambda).total;
  };
  const empty = score(new Set());
  const baselineK = score(new Set(baselineIds));
  const chosen = [];
  const chosenSet = new Set();
  for (let round = 0; round < slots; round += 1) {
    let best = null;
    let guard = 0;
    for (const review of pool) {
      if (chosenSet.has(review.topic_id)) continue;
      const next = new Set(chosenSet);
      next.add(review.topic_id);
      const value = score(next);
      const gain = value - (best ? best.value : empty);
      const candidate = { review, value, gain: value - (chosen.length ? score(chosenSet) : empty) };
      if (!best || candidate.value > best.value + 1e-12 || (
        Math.abs(candidate.value - best.value) <= 1e-12 && (
          String(review.due_on) < String(best.review.due_on) ||
          (review.due_on === best.review.due_on && String(review.topic_id) < String(best.review.topic_id))
        )
      )) best = { ...candidate, value: candidate.value };
      guard += 1;
      if (guard % 200 === 0) { /* yield point for the UI loop; tests stay synchronous */ }
    }
    if (!best) break;
    const current = chosen.length ? score(chosenSet) : empty;
    if (best.value - current <= 1e-9) break;
    chosen.push(best.review);
    chosenSet.add(best.review.topic_id);
  }
  const greedyK = score(chosenSet);
  const useBaseline = baselineK > greedyK + 1e-12;
  const finalIds = useBaseline ? baselineIds : chosen.map(review => review.topic_id);
  const finalK = useBaseline ? baselineK : greedyK;
  const byId = new Map(pool.map(review => [review.topic_id, review]));
  const topics = finalIds.map(id => {
    const review = byId.get(id);
    const alone = new Set([id]);
    const lifted = score(alone) - empty;
    const rho = rhoMap({ concepts, evidence, reviews, fit, today, horizon, freshTopics: new Set() });
    const topicConcepts = conceptsByTopic(evidence).get(id) || [];
    return {
      topic_id: id,
      title: review?.title || id,
      due_on: review?.due_on || null,
      recall: recallOf(review, 0, fit, today, false),
      supports: topicConcepts.length,
      lift: lifted,
    };
  });
  return { topics, ids: finalIds, K: finalK, baselineK, baselineIds, empty, greedyK, slots, horizon };
}

function addHorizon(today, horizon) {
  const [year, month, day] = String(today).slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + Number(horizon || 0));
  return date.toISOString().slice(0, 10);
}

function featureRows(input, fit) {
  const support = indexSupport(input.concepts, input.edges);
  const byTopic = conceptsByTopic(input.evidence);
  const byConcept = evidenceByConcept(input.evidence);
  const events = (input.events || [])
    .filter(event => event && !event.derived && Number(event.elapsed_days) > 0 && event.stability_before != null && event.reviewed_at)
    .slice()
    .sort((a, b) => String(a.reviewed_at).localeCompare(String(b.reviewed_at)) || String(a.id).localeCompare(String(b.id)));
  const prior = [];
  const rows = [];
  for (const event of events) {
    const concepts = byTopic.get(event.topic_id) || [];
    const supporters = new Map();
    for (const conceptId of concepts) {
      for (const link of support.incoming.get(conceptId) || []) {
        const prev = supporters.get(link.supporter);
        if (!prev || (prev.klass !== 'hard' && link.klass === 'hard') || (prev.klass === link.klass && link.w > prev.w)) {
          supporters.set(link.supporter, link);
        }
      }
    }
    const features = [];
    for (const [supporter, link] of supporters) {
      const topics = byConcept.get(supporter) || [];
      let rho = null;
      for (const topicId of topics) {
        const earlier = prior.filter(item => item.topic_id === topicId);
        const latest = earlier.length ? earlier[earlier.length - 1] : null;
        if (!latest || latest.stability_after == null) continue;
        const elapsed = daysBetween(dayOf(latest.reviewed_at), dayOf(event.reviewed_at));
        const value = recallProbability(elapsed, Number(latest.stability_after), fit.k);
        if (rho == null || value > rho) rho = value;
      }
      if (rho == null) continue;
      features.push({ klass: link.klass, w: link.w, rho });
    }
    const base = recallProbability(Number(event.elapsed_days), Number(event.stability_before), fit.k);
    rows.push({ event, features, base, y: event.observed_recall ? 1 : 0 });
    prior.push(event);
  }
  return rows;
}

function probability(row, lambda) {
  let product = 1;
  for (const feature of row.features) {
    const scale = feature.klass === 'hard' ? lambda.hard : lambda.soft;
    product *= 1 - scale * feature.w * (1 - feature.rho);
  }
  const value = row.base * product;
  return Math.min(1 - 1e-6, Math.max(1e-6, value));
}

function meanLoss(rows, lambda) {
  if (!rows.length) return null;
  let total = 0;
  for (const row of rows) {
    const p = probability(row, lambda);
    total += -(row.y * Math.log(p) + (1 - row.y) * Math.log(1 - p));
  }
  return total / rows.length;
}

function objective(rows, lambda) {
  const loss = meanLoss(rows, lambda);
  if (loss == null) return Infinity;
  const penalty = ((lambda.hard - PRIOR_HARD) ** 2 + (lambda.soft - PRIOR_SOFT) ** 2) / (2 * 0.1);
  return loss + penalty;
}

function gridFit(rows) {
  let best = { hard: PRIOR_HARD, soft: PRIOR_SOFT, score: Infinity };
  for (let hard = 0; hard <= 1.0001; hard += LAMBDA_STEP) {
    for (let soft = 0; soft <= 1.0001; soft += LAMBDA_STEP) {
      const lambda = { hard: Math.round(hard * 10) / 10, soft: Math.round(soft * 10) / 10 };
      const score = objective(rows, lambda);
      if (score < best.score - 1e-12 || (
        Math.abs(score - best.score) <= 1e-12 && (lambda.hard < best.hard || (lambda.hard === best.hard && lambda.soft < best.soft))
      )) best = { ...lambda, score };
    }
  }
  return best;
}

export function fitCoupling(input) {
  const fit = fitPersonal(asFitRows(input.events || []));
  const rows = featureRows(input, fit).filter(row => row.features.length);
  const cut = Math.floor(((input.events || []).filter(event => event && !event.derived && Number(event.elapsed_days) > 0 && event.stability_before != null).length) * 0.7);
  const orderedIds = (input.events || [])
    .filter(event => event && !event.derived && Number(event.elapsed_days) > 0 && event.stability_before != null && event.reviewed_at)
    .slice()
    .sort((a, b) => String(a.reviewed_at).localeCompare(String(b.reviewed_at)) || String(a.id).localeCompare(String(b.id)));
  const trainIds = new Set(orderedIds.slice(0, cut).map(event => event.id));
  const train = rows.filter(row => trainIds.has(row.event.id));
  const test = rows.filter(row => !trainIds.has(row.event.id));
  if (test.length < 20) {
    return { status: 'assumed', lambda: { hard: PRIOR_HARD, soft: PRIOR_SOFT }, heldOut: test.length, gain: null, fit, version: KEYSTONE_VERSION };
  }
  const fitted = gridFit(train);
  const loss0 = meanLoss(test, { hard: 0, soft: 0 });
  const lossFit = meanLoss(test, fitted);
  const gain = loss0 == null || lossFit == null ? 0 : loss0 - lossFit;
  if (gain > GAIN_GATE) {
    const full = gridFit(rows);
    return { status: 'validated', lambda: { hard: full.hard, soft: full.soft }, heldOut: test.length, gain, fit, version: KEYSTONE_VERSION };
  }
  return { status: 'not supported', lambda: { hard: 0, soft: 0 }, heldOut: test.length, gain, fit, version: KEYSTONE_VERSION };
}

export function atStakeList({ concepts, edges, evidence, reviews, fit, today, horizon, lambda }) {
  const support = indexSupport(concepts, edges);
  const rho = rhoMap({ concepts, evidence, reviews, fit, today, horizon, freshTopics: new Set() });
  const decorated = decorate(support, rho);
  const list = [];
  for (const concept of concepts || []) {
    if (concept.status === 'archived') continue;
    const own = rho.get(concept.id);
    if (own == null) continue;
    const dependents = support.outgoing.get(concept.id) || [];
    let stake = 0;
    for (const link of dependents) {
      const rhoI = rho.get(link.dependent);
      if (rhoI == null) continue;
      const others = (decorated.incoming.get(link.dependent) || []).filter(item => item.supporter !== concept.id);
      let product = 1;
      for (const other of others) {
        if (other.rho == null) continue;
        const scale = other.klass === 'hard' ? lambda.hard : lambda.soft;
        product *= 1 - scale * other.w * (1 - other.rho);
      }
      const scale = link.klass === 'hard' ? lambda.hard : lambda.soft;
      stake += rhoI * product * scale * link.w * own;
    }
    list.push({ id: concept.id, stake, recall: own });
  }
  list.sort((a, b) => b.stake - a.stake || String(a.id).localeCompare(String(b.id)));
  return list;
}

export function defaultSlots(events, today) {
  const counts = new Map();
  for (const event of events || []) {
    if (!event || event.derived || !event.reviewed_at) continue;
    const day = dayOf(event.reviewed_at);
    if (daysBetween(day, today) > 14) continue;
    counts.set(day, (counts.get(day) || 0) + 1);
  }
  if (counts.size < 3) return 3;
  const values = [...counts.values()].sort((a, b) => a - b);
  const mid = values.length % 2 ? values[(values.length - 1) / 2] : values[values.length / 2 - 1];
  return Math.min(12, Math.max(1, mid));
}

export function dependentCounts(concepts, edges) {
  const support = indexSupport(concepts, edges);
  const live = (concepts || []).filter(concept => concept.status !== 'archived').map(concept => concept.id);
  const cycles = stronglyConnected(live, support.outgoing);
  const counts = {};
  for (const id of live) {
    const direct = new Set((support.outgoing.get(id) || []).map(link => link.dependent));
    const seen = new Set([id]);
    const queue = [...direct];
    let transitive = 0;
    while (queue.length) {
      const next = queue.shift();
      if (seen.has(next)) continue;
      seen.add(next);
      transitive += 1;
      for (const link of support.outgoing.get(next) || []) if (!seen.has(link.dependent)) queue.push(link.dependent);
    }
    counts[id] = { direct: direct.size, transitive };
  }
  const linked = live.filter(id => (support.incoming.get(id) || []).length || (support.outgoing.get(id) || []).length).length;
  return {
    counts,
    cycles,
    coverage: live.length ? linked / live.length : 0,
  };
}

export function forecastCurve({ concepts, edges, evidence, reviews, fit, today, lambda, planIds }) {
  const points = [];
  for (let h = 0; h <= 14; h += 1) {
    const nothing = rhoMap({ concepts, evidence, reviews, fit, today, horizon: h, freshTopics: new Set() });
    const planned = rhoMap({ concepts, evidence, reviews, fit, today, horizon: h, freshTopics: new Set(planIds || []) });
    const supportN = decorate(indexSupport(concepts, edges), nothing);
    const supportP = decorate(indexSupport(concepts, edges), planned);
    points.push({
      h,
      nothing: retained(nothing, supportN, lambda).total,
      plan: retained(planned, supportP, lambda).total,
    });
  }
  return points;
}

export function knowledgeAt(input, freshIds) {
  const support = indexSupport(input.concepts, input.edges);
  const rho = rhoMap({ ...input, freshTopics: new Set(freshIds || []) });
  const incoming = new Map();
  for (const [id, links] of support.incoming) {
    incoming.set(id, links.map(link => ({ ...link, rho: rho.get(link.supporter) ?? null })));
  }
  return retained(rho, { incoming }, input.lambda).total;
}

export function analyseKeystone(input, options = {}) {
  const today = input.today;
  const coupling = fitCoupling(input);
  const lambda = options.lambda || coupling.lambda;
  const horizon = options.horizon ?? 1;
  const slots = options.slots ?? defaultSlots(input.events, today);
  const fit = coupling.fit;
  const facts = dependentCounts(input.concepts, input.edges);
  const plan = marginalPlan({ ...input, fit, today, horizon, slots, lambda });
  const stake = atStakeList({ ...input, fit, today, horizon, lambda });
  const curve = forecastCurve({ ...input, fit, today, lambda, planIds: plan.ids });
  return { version: KEYSTONE_VERSION, coupling, lambda, horizon, slots, facts, plan, stake, curve, fit };
}
