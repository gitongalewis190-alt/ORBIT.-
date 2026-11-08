// Pure helpers for the recall AI verifier. No React, no Supabase, no network.
// Default model ids are the free tiers; override them only through providerConfig(env).

const RATE_LIMIT_WINDOW_MS = 600000;
const HOUR_MS = 3600000;
const BACKOFF_START_MS = 30000;
const BACKOFF_CAP_MS = 600000;
const BAD_SHAPE_COOLDOWN_MS = 300000;
const MIN_REMAINING_MS = 1500;
const DEADLINE_RESERVE_MS = 500;
const COMMENT_MAX = 600;

const DEFAULT_ORDER = ['groq', 'openrouter', 'gemini'];
const KNOWN = new Set(DEFAULT_ORDER);
const DEFAULT_MODELS = {
  groq: 'llama-3.1-8b-instant',
  openrouter: 'meta-llama/llama-3.1-8b-instruct:free',
  gemini: 'gemini-1.5-flash',
};
const DEFAULT_TOTAL_MS = 9000;
const DEFAULT_TIMEOUT_MS = 4500;

// status wins over the error name. Timeout and network are named failures with no HTTP status.
export function classifyFailure({ status, errorName, message } = {}) {
  if (status === 429) return 'rate_limit';
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not_found';
  if (typeof status === 'number' && status >= 500) return 'server';
  const name = String(errorName ?? '');
  const msg = String(message ?? '');
  if (name === 'AbortError' || name === 'TimeoutError' || /timeout/i.test(name) || /timeout/i.test(msg)) {
    return 'timeout';
  }
  if (name === 'TypeError' || name === 'network') return 'network';
  return 'bad_shape';
}

// success clears the window. previousMs for server/timeout/network is the last cooldown
// (0 if none). previousMs for bad_shape is the consecutive bad_shape count BEFORE this
// failure; the cooldown starts when that count + 1 >= 2.
export function cooldownMs({ klass, retryAfterSec, previousMs = 0, success } = {}) {
  if (success === true) return 0;
  if (klass === 'rate_limit') {
    return Number.isFinite(retryAfterSec) ? retryAfterSec * 1000 : RATE_LIMIT_WINDOW_MS;
  }
  if (klass === 'auth' || klass === 'not_found') return HOUR_MS;
  if (klass === 'server' || klass === 'timeout' || klass === 'network') {
    if (previousMs > 0) return Math.min(BACKOFF_CAP_MS, previousMs * 2);
    return BACKOFF_START_MS;
  }
  if (klass === 'bad_shape') {
    return previousMs + 1 >= 2 ? BAD_SHAPE_COOLDOWN_MS : 0;
  }
  return 0;
}

// Skip when the deadline is closer than 1.5s. Otherwise cap the attempt so 500ms
// remains for the next decision. A non-positive cap still skips.
export function planAttempt({ now, deadline, perProviderMs } = {}) {
  const remaining = deadline - now;
  if (!(remaining >= MIN_REMAINING_MS)) return { skip: true, timeoutMs: 0 };
  const budget = remaining - DEADLINE_RESERVE_MS;
  const per = Number.isFinite(perProviderMs) ? perProviderMs : budget;
  const timeoutMs = Math.min(per, budget);
  if (!(timeoutMs > 0)) return { skip: true, timeoutMs: 0 };
  return { skip: false, timeoutMs };
}

function asObject(text) {
  try {
    const value = JSON.parse(text);
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {
    // try the next strategy
  }
  return null;
}

function balancedSlice(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function firstObject(text) {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    const slice = balancedSlice(text, i);
    if (!slice) continue;
    const parsed = asObject(slice);
    if (parsed) return parsed;
  }
  return null;
}

// Whole text, then the same text with code fences stripped, then the first {...} object.
export function extractJson(text) {
  if (text == null) return null;
  const raw = String(text).trim();
  const direct = asObject(raw);
  if (direct) return direct;
  const unfenced = raw.replace(/```[a-zA-Z0-9_-]*[ \t]*\r?\n?/g, '').trim();
  if (unfenced !== raw) {
    const parsed = asObject(unfenced);
    if (parsed) return parsed;
  }
  return firstObject(unfenced);
}

export function validateGrade(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (typeof obj.score !== 'number' || !Number.isFinite(obj.score)) return null;
  const score = Math.min(100, Math.max(0, Math.round(obj.score)));
  const comment = typeof obj.comment === 'string' ? obj.comment.slice(0, COMMENT_MAX) : '';
  return { score, comment };
}

// Telemetry is counts and labels only. Never copy the learner's text or answer.
export function telemetryEntry({ t, provider, outcome, ms, charsSent, fallbackReason, test } = {}) {
  return { t, provider, outcome, ms, charsSent, fallbackReason, test };
}

function readMs(value, fallback) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function readModel(value, fallback) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
}

function readOrder(value) {
  const text = String(value ?? '').trim();
  if (!text) return DEFAULT_ORDER.slice();
  const names = text.split(/[,]+/).flatMap(part => part.trim().toLowerCase().split(/\s+/)).filter(Boolean);
  const order = [];
  for (const name of names) {
    if (!KNOWN.has(name) || order.includes(name)) continue;
    order.push(name);
  }
  return order.length ? order : DEFAULT_ORDER.slice();
}

export function providerConfig(env = {}) {
  const src = env || {};
  return {
    order: readOrder(src.AI_PROVIDER_ORDER),
    models: {
      groq: readModel(src.GROQ_MODEL, DEFAULT_MODELS.groq),
      openrouter: readModel(src.OPENROUTER_MODEL, DEFAULT_MODELS.openrouter),
      gemini: readModel(src.GEMINI_MODEL, DEFAULT_MODELS.gemini),
    },
    totalMs: readMs(src.AI_TOTAL_MS, DEFAULT_TOTAL_MS),
    timeoutMs: readMs(src.AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  };
}
