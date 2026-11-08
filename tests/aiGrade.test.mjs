import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyFailure,
  cooldownMs,
  planAttempt,
  extractJson,
  validateGrade,
  telemetryEntry,
  providerConfig,
} from '../lib/aiGrade.js';

test('classifies 429, 401, 403, 404, and 500', () => {
  assert.equal(classifyFailure({ status: 429 }), 'rate_limit');
  assert.equal(classifyFailure({ status: 401 }), 'auth');
  assert.equal(classifyFailure({ status: 403 }), 'auth');
  assert.equal(classifyFailure({ status: 404 }), 'not_found');
  assert.equal(classifyFailure({ status: 500 }), 'server');
  assert.equal(classifyFailure({ status: 503 }), 'server');
});

test('classifies timeout and network, otherwise bad shape', () => {
  assert.equal(classifyFailure({ errorName: 'AbortError' }), 'timeout');
  assert.equal(classifyFailure({ errorName: 'TimeoutError' }), 'timeout');
  assert.equal(classifyFailure({ message: 'request timeout' }), 'timeout');
  assert.equal(classifyFailure({ errorName: 'TypeError' }), 'network');
  assert.equal(classifyFailure({ errorName: 'network' }), 'network');
  assert.equal(classifyFailure({ status: 400 }), 'bad_shape');
  assert.equal(classifyFailure({}), 'bad_shape');
});

test('429 uses Retry-After seconds, otherwise a 10 minute window', () => {
  assert.equal(cooldownMs({ klass: 'rate_limit', retryAfterSec: 30 }), 30000);
  assert.equal(cooldownMs({ klass: 'rate_limit' }), 600000);
  assert.equal(cooldownMs({ klass: 'rate_limit', retryAfterSec: null }), 600000);
  assert.equal(cooldownMs({ klass: 'rate_limit', retryAfterSec: Number.NaN }), 600000);
});

test('404 and auth cool down for an hour', () => {
  assert.equal(cooldownMs({ klass: 'not_found' }), 3600000);
  assert.equal(cooldownMs({ klass: 'auth' }), 3600000);
});

test('5xx doubles 30, 60, 120 capped at 600 and reset on success', () => {
  assert.equal(cooldownMs({ klass: 'server', previousMs: 0 }), 30000);
  assert.equal(cooldownMs({ klass: 'server', previousMs: 30000 }), 60000);
  assert.equal(cooldownMs({ klass: 'server', previousMs: 60000 }), 120000);
  assert.equal(cooldownMs({ klass: 'server', previousMs: 120000 }), 240000);
  assert.equal(cooldownMs({ klass: 'server', previousMs: 240000 }), 480000);
  assert.equal(cooldownMs({ klass: 'server', previousMs: 480000 }), 600000);
  assert.equal(cooldownMs({ klass: 'server', previousMs: 600000 }), 600000);
  assert.equal(cooldownMs({ klass: 'timeout', previousMs: 30000 }), 60000);
  assert.equal(cooldownMs({ klass: 'network', previousMs: 60000 }), 120000);
  assert.equal(cooldownMs({ klass: 'server', previousMs: 120000, success: true }), 0);
  assert.equal(cooldownMs({ klass: 'rate_limit', retryAfterSec: 30, success: true }), 0);
});

test('bad shape waits until the second consecutive failure', () => {
  assert.equal(cooldownMs({ klass: 'bad_shape', previousMs: 0 }), 0);
  assert.equal(cooldownMs({ klass: 'bad_shape', previousMs: 1 }), 300000);
  assert.equal(cooldownMs({ klass: 'bad_shape', previousMs: 2 }), 300000);
});

test('skips an attempt when remaining is under 1500 and caps the timeout', () => {
  assert.deepEqual(planAttempt({ now: 0, deadline: 1499, perProviderMs: 4500 }), { skip: true, timeoutMs: 0 });
  assert.deepEqual(planAttempt({ now: 1000, deadline: 2400, perProviderMs: 4500 }), { skip: true, timeoutMs: 0 });
  assert.deepEqual(planAttempt({ now: 0, deadline: 2000, perProviderMs: 4500 }), { skip: false, timeoutMs: 1500 });
  assert.deepEqual(planAttempt({ now: 0, deadline: 20000, perProviderMs: 4500 }), { skip: false, timeoutMs: 4500 });
  assert.deepEqual(planAttempt({ now: 0, deadline: 1500, perProviderMs: 4500 }), { skip: false, timeoutMs: 1000 });
  assert.deepEqual(planAttempt({ now: 0, deadline: 9000, perProviderMs: 0 }), { skip: true, timeoutMs: 0 });
});

test('reads JSON from a bare object, a fence, prose, or nothing', () => {
  assert.deepEqual(extractJson('{"score":80,"comment":"ok"}'), { score: 80, comment: 'ok' });
  assert.deepEqual(
    extractJson('```json\n{"score":80,"comment":"ok"}\n```'),
    { score: 80, comment: 'ok' },
  );
  assert.deepEqual(
    extractJson('sure {"score":80,"comment":"ok"} thanks'),
    { score: 80, comment: 'ok' },
  );
  assert.deepEqual(
    extractJson('note {"score":70,"comment":"a {b} c"} tail'),
    { score: 70, comment: 'a {b} c' },
  );
  assert.equal(extractJson('garbage'), null);
  assert.equal(extractJson(''), null);
  assert.equal(extractJson(null), null);
});

test('clamps a grade to an integer 0..100 and cuts the comment', () => {
  assert.deepEqual(validateGrade({ score: 140, comment: 'high' }), { score: 100, comment: 'high' });
  assert.deepEqual(validateGrade({ score: -4, comment: 'low' }), { score: 0, comment: 'low' });
  assert.deepEqual(validateGrade({ score: 80.2, comment: 'mid' }), { score: 80, comment: 'mid' });
  assert.deepEqual(validateGrade({ score: 10 }), { score: 10, comment: '' });
  assert.equal(validateGrade({ score: Number.NaN, comment: 'x' }), null);
  assert.equal(validateGrade({ comment: 'no score' }), null);
  assert.equal(validateGrade({ score: 50, comment: 'z'.repeat(800) }).comment.length, 600);
});

test('a local fallback shape is a valid grade', () => {
  assert.deepEqual(
    validateGrade({ score: 64, comment: 'You missed: chlorophyll.', verifier: 'local' }),
    { score: 64, comment: 'You missed: chlorophyll.' },
  );
});

test('telemetry keeps the allowed fields and drops text and answer', () => {
  const entry = telemetryEntry({
    t: 1,
    provider: 'groq',
    outcome: 'ok',
    ms: 120,
    charsSent: 40,
    fallbackReason: null,
    test: false,
    text: 'the source',
    answer: 'the recall',
  });
  assert.deepEqual(entry, {
    t: 1,
    provider: 'groq',
    outcome: 'ok',
    ms: 120,
    charsSent: 40,
    fallbackReason: null,
    test: false,
  });
  assert.equal('text' in entry, false);
  assert.equal('answer' in entry, false);
  assert.equal(Object.hasOwn(entry, 'text'), false);
  assert.equal(Object.hasOwn(entry, 'answer'), false);
});

test('provider config keeps the free model ids and the default order', () => {
  const cfg = providerConfig({});
  assert.deepEqual(cfg.order, ['groq', 'openrouter', 'gemini']);
  assert.deepEqual(cfg.models, {
    groq: 'llama-3.1-8b-instant',
    openrouter: 'meta-llama/llama-3.1-8b-instruct:free',
    gemini: 'gemini-1.5-flash',
  });
  assert.equal(cfg.totalMs, 9000);
  assert.equal(cfg.timeoutMs, 4500);

  const custom = providerConfig({
    GROQ_MODEL: 'custom-groq',
    OPENROUTER_MODEL: 'custom/or',
    GEMINI_MODEL: 'custom-gemini',
    AI_PROVIDER_ORDER: 'gemini, nope, groq',
    AI_TOTAL_MS: '12000',
    AI_TIMEOUT_MS: '3000',
  });
  assert.deepEqual(custom.order, ['gemini', 'groq']);
  assert.equal(custom.models.groq, 'custom-groq');
  assert.equal(custom.models.openrouter, 'custom/or');
  assert.equal(custom.models.gemini, 'custom-gemini');
  assert.equal(custom.totalMs, 12000);
  assert.equal(custom.timeoutMs, 3000);
  assert.deepEqual(providerConfig({ AI_PROVIDER_ORDER: '   ' }).order, ['groq', 'openrouter', 'gemini']);
  assert.deepEqual(providerConfig({ AI_PROVIDER_ORDER: 'nope' }).order, ['groq', 'openrouter', 'gemini']);
});
