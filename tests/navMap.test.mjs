import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { RECORDS, PRIMARY, FAMILIES, familyForPath, rankMatches, measuredReach, clustersOf, routeRecord } from '../lib/navMap.js';

const SEED = {
  'log-learned': 1,
  'review-now': 1,
  focus: 1,
  'topic-generation': 1,
  'study-shortcuts': 1,
  'journal-capture': 1,
  'memory-edit': 2,
  'memory-delete': 3,
  topics: 2,
  'topic-delete': 3,
  'recall-quiz': 2,
  'atlas-challenges': 2,
  'recall-model': 2,
  parallax: 3,
  atlas: 2,
  resonance: 2,
  keystone: 2,
  attention: 2,
  awards: 2,
  stats: 2,
  logs: 3,
  guide: 3,
  settings: 3,
  inspect: 3,
  pdf: 3,
  'backup-now': 3,
  restore: 3,
  storage: 3,
  'offline-queue': 3,
  'sign-out': 3,
  reset: 3,
  'delete-account': 3,
  rings: 1,
  'smart-notes': 1,
  benefits: 2,
  drive: 3,
};

function pages(dir, prefix = '') {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) continue;
    if (fs.statSync(full).isDirectory()) out.push(...pages(full, `${prefix}/${name}`));
    else if (name === 'page.js') out.push((prefix || '/').replace(/\[.*?\]/g, ':id'));
  }
  return out;
}

const routes = pages(path.join(process.cwd(), 'app'));
assert.ok(routes.includes('/'));
assert.ok(routes.includes('/atlas/concept/:id'));
for (const route of routes) {
  const hit = routeRecord(route);
  assert.ok(hit, `missing record for ${route}`);
  assert.ok(hit.family, route);
  assert.ok(hit.cluster, route);
}

for (const row of RECORDS) {
  if (row.risk === 'destructive') {
    assert.equal(row.action, null, row.id);
    assert.equal(row.children.length, 0, row.id);
  }
  const reach = measuredReach(row.id);
  assert.ok(reach <= row.reachBudget, `${row.id} reach ${reach} budget ${row.reachBudget}`);
}

for (const [id, budget] of Object.entries(SEED)) {
  const row = RECORDS.find(item => item.id === id);
  assert.ok(row, id);
  assert.equal(row.reachBudget, budget, id);
  assert.ok(measuredReach(id) <= budget, id);
}

assert.deepEqual(PRIMARY.map(item => item.route), ['/', '/topics', '/journal', '/study', '/progress']);
assert.deepEqual(FAMILIES, ['today', 'topics', 'journal', 'study', 'progress', 'system']);

const clusters = clustersOf();
for (const [family, groups] of Object.entries(clusters)) {
  const names = Object.keys(groups);
  if (family === 'study') {
    assert.equal(names.length, 4, 'section 5.2 names four Study clusters; R2 says three');
    assert.deepEqual(names.sort(), ['Assist', 'Connect', 'Practice', 'Understand']);
  } else if (family !== 'unauthenticated') {
    assert.ok(names.length <= 3, family);
  }
  for (const [name, list] of Object.entries(groups)) {
    assert.ok(list.length <= 7, `${family}/${name} ${list.length}`);
  }
}

assert.equal(familyForPath('/atlas/concept/abc'), 'study');
assert.equal(familyForPath('/atlas'), 'study');
assert.equal(familyForPath('/settings'), 'system');
assert.equal(familyForPath('/settings#export'), 'system');
assert.equal(familyForPath('/'), 'today');
assert.equal(familyForPath('/welcome'), 'unauthenticated');
assert.equal(familyForPath('/log'), 'progress');

const once = rankMatches('re').map(row => row.id);
const twice = rankMatches('re').map(row => row.id);
assert.deepEqual(once, twice);
assert.ok(once.length > 0);

const required = ['/', '/topics', '/journal', '/awards', '/log', '/study', '/recall', '/attention', '/atlas', '/resonance', '/stats', '/guide', '/settings', '/welcome', '/login', '/keystone', '/parallax', '/progress', '/inspect'];
for (const route of required) assert.ok(routeRecord(route), route);

console.log('nav map ok');
