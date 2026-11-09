import { createClient } from '@supabase/supabase-js';
import { memoryLock } from './authGate.js';
import { isTrial } from './trial.js';
import { toast } from './toast.js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const client = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Do not use navigator.locks. On iOS it lets a save's auth burst overlap,
    // the second refresh fails, and the client wipes a still-valid session.
    lock: memoryLock,
  },
});

// Trial mode. Writes look successful on screen but are never sent. Reads still show your real data.
const WRITES = new Set(['insert', 'update', 'upsert', 'delete']);
const CHAIN = ['select', 'eq', 'neq', 'in', 'is', 'gte', 'gt', 'lte', 'lt', 'like', 'ilike', 'order', 'limit', 'range', 'match', 'filter', 'or', 'not', 'single', 'maybeSingle', 'returns', 'throwOnError', 'contains'];

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `t${Date.now()}${Math.random().toString(36).slice(2)}`;
}

function trialWrite(payload) {
  const rows = Array.isArray(payload) ? payload : [payload];
  const withIds = rows.map(r => ({ id: r?.id ?? newId(), ...r }));
  const data = Array.isArray(payload) ? withIds : withIds[0];
  let noted = false;
  const chain = {
    then(resolve, reject) {
      if (!noted) { noted = true; toast('Trial mode: this is not saved.', 'warn', 2600); }
      return Promise.resolve({ data, error: null, count: 0, status: 201, statusText: 'Created' }).then(resolve, reject);
    },
  };
  for (const m of CHAIN) chain[m] = () => chain;
  return chain;
}

export const supabase = new Proxy(client, {
  get(target, prop) {
    if (prop === 'from') {
      return table => {
        const real = target.from(table);
        return new Proxy(real, {
          get(rt, m) {
            if (WRITES.has(m)) return payload => (isTrial() ? trialWrite(payload) : rt[m](payload));
            const v = rt[m];
            return typeof v === 'function' ? v.bind(rt) : v;
          },
        });
      };
    }
    if (prop === 'rpc') return (...args) => (isTrial() ? trialWrite(null) : target.rpc(...args));
    const v = target[prop];
    return typeof v === 'function' ? v.bind(target) : v;
  },
});
