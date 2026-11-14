import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rings = readFileSync(new URL('../components/DayRings.js', import.meta.url), 'utf8');
const topics = readFileSync(new URL('../app/topics/page.js', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../app/settings/page.js', import.meta.url), 'utf8');

test('today shows both timers, and the rings stay one step away', () => {
  const pair = rings.indexOf('className="timer-pair"');
  const fold = rings.indexOf('Daily rings and calendar');
  assert.ok(pair > -1 && fold > pair);
  assert.ok(rings.indexOf('<FocusTimer', pair) < fold);
  assert.ok(rings.indexOf('<ReflectTimer', pair) < fold);
});

test('topics keeps one toolbar and a table head for wide screens', () => {
  assert.match(topics, /className="card topic-toolbar"/);
  assert.match(topics, /className="topic-table-head"/);
  assert.match(topics, /aria-label="Filter by mark"/);
  assert.match(topics, /aria-label="Sort topics"/);
});

test('settings is one catalogue and still reaches under the hood', () => {
  assert.match(settings, /nav className="settings-catalogue"/);
  assert.match(settings, /href="\/inspect"/);
  assert.doesNotMatch(settings, /className="btn" href="\/inspect"/);
});
