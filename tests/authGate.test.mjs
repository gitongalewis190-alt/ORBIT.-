import assert from 'node:assert/strict';
import { memoryLock, nextAuth, readPersistedUserId } from '../lib/authGate.js';

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log('  ok  ' + name);
};

console.log('Auth gate');

check('a live session stays signed in', () => {
  const d = nextAuth({
    event: 'TOKEN_REFRESHED',
    session: { user: { id: 'u1' } },
    persistedUserId: null,
    knownUserId: null,
  });
  assert.deepEqual(d, { authed: true, userId: 'u1', settle: false });
});

check('initial empty session does not count as a sign-out', () => {
  const d = nextAuth({
    event: 'INITIAL_SESSION',
    session: null,
    persistedUserId: null,
    knownUserId: null,
  });
  assert.equal(d.authed, null);
  assert.equal(d.settle, false);
});

check('a null refresh keeps the user we already had', () => {
  const d = nextAuth({
    event: 'TOKEN_REFRESHED',
    session: null,
    persistedUserId: null,
    knownUserId: 'u1',
  });
  assert.deepEqual(d, { authed: true, userId: 'u1', settle: false });
});

check('signed out with the session still on disk is not a sign-out', () => {
  const d = nextAuth({
    event: 'SIGNED_OUT',
    session: null,
    persistedUserId: 'u1',
    knownUserId: 'u1',
  });
  assert.equal(d.authed, true);
  assert.equal(d.userId, 'u1');
  assert.equal(d.settle, true);
});

check('a real sign-out has nothing left on disk', () => {
  const d = nextAuth({
    event: 'SIGNED_OUT',
    session: null,
    persistedUserId: null,
    knownUserId: 'u1',
  });
  assert.deepEqual(d, { authed: false, userId: null, settle: true });
});

check('persisted user id is read from the supabase auth key', () => {
  const rows = {
    'sb-abc-auth-token': JSON.stringify({
      access_token: 'tok',
      user: { id: 'user-9' },
    }),
  };
  const storage = {
    length: 1,
    key: () => 'sb-abc-auth-token',
    getItem: (key) => rows[key] ?? null,
  };
  assert.equal(readPersistedUserId(storage), 'user-9');
});

check('unrelated keys are ignored', () => {
  const storage = {
    length: 1,
    key: () => 'orbit.theme',
    getItem: () => 'dark',
  };
  assert.equal(readPersistedUserId(storage), null);
});

const order = [];
let release;
const gate = new Promise((resolve) => { release = resolve; });
const first = memoryLock('t', 0, () => gate.then(() => { order.push('first'); }));
const second = memoryLock('t', 0, async () => { order.push('second'); });
assert.deepEqual(order, []);
release();
await first;
await second;
assert.deepEqual(order, ['first', 'second']);
passed += 1;
console.log('  ok  auth work runs one at a time');

console.log(passed + ' passed');
