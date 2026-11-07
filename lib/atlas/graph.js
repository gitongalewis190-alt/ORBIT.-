export function layoutGraph(concepts) {
  const groups = new Map();
  for (const concept of concepts) {
    const key = concept.discipline || 'Other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(concept);
  }
  const keys = [...groups.keys()].sort();
  const nodes = [];
  keys.forEach((key, groupIndex) => {
    const list = groups.get(key);
    const angle = (groupIndex / Math.max(keys.length, 1)) * Math.PI * 2;
    const cx = 500 + Math.cos(angle) * (keys.length === 1 ? 0 : 250);
    const cy = 320 + Math.sin(angle) * (keys.length === 1 ? 0 : 160);
    list.forEach((concept, index) => {
      const turn = (index / list.length) * Math.PI * 2;
      const ring = list.length === 1 ? 0 : 42 + (index % 4) * 22;
      nodes.push({
        id: concept.id,
        name: concept.name,
        discipline: key,
        x: Number((cx + Math.cos(turn) * ring).toFixed(1)),
        y: Number((cy + Math.sin(turn) * ring).toFixed(1)),
      });
    });
  });
  return nodes;
}

export function findPath(edges, fromId, toId) {
  if (fromId === toId) return [fromId];
  const next = new Map();
  for (const edge of edges) {
    if (edge.verification === 'rejected') continue;
    if (!next.has(edge.source_id)) next.set(edge.source_id, []);
    if (!next.has(edge.target_id)) next.set(edge.target_id, []);
    next.get(edge.source_id).push(edge.target_id);
    next.get(edge.target_id).push(edge.source_id);
  }
  const seen = new Set([fromId]);
  const queue = [[fromId]];
  while (queue.length) {
    const path = queue.shift();
    const last = path[path.length - 1];
    for (const step of next.get(last) || []) {
      if (seen.has(step)) continue;
      const grown = [...path, step];
      if (step === toId) return grown;
      seen.add(step);
      queue.push(grown);
    }
  }
  return [];
}

export function clusters(concepts, edges) {
  const ids = concepts.map(concept => concept.id);
  const next = new Map(ids.map(id => [id, []]));
  for (const edge of edges) {
    if (!next.has(edge.source_id) || !next.has(edge.target_id)) continue;
    next.get(edge.source_id).push(edge.target_id);
    next.get(edge.target_id).push(edge.source_id);
  }
  const seen = new Set();
  const groups = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const group = [];
    const stack = [id];
    seen.add(id);
    while (stack.length) {
      const current = stack.pop();
      group.push(current);
      for (const step of next.get(current) || []) {
        if (seen.has(step)) continue;
        seen.add(step);
        stack.push(step);
      }
    }
    groups.push(group);
  }
  return groups;
}
