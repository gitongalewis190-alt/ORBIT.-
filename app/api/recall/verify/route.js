// Verifies a recall answer. Tries free AI providers in order. A provider that is rate-limited
// is put on a cooldown window and skipped until the window ends. If every provider fails,
// the local scorer answers, so the learner always gets a score.
import { heuristicReview, clampScore } from '../../../../lib/recall';

export const runtime = 'nodejs';

const WINDOW_MS = 10 * 60 * 1000;
const cooldownUntil = {};

const PROVIDERS = [
  { name: 'groq', key: process.env.GROQ_API_KEY,
    url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.1-8b-instant', style: 'openai' },
  { name: 'openrouter', key: process.env.OPENROUTER_API_KEY,
    url: 'https://openrouter.ai/api/v1/chat/completions', model: 'meta-llama/llama-3.1-8b-instruct:free', style: 'openai' },
  { name: 'gemini', key: process.env.GEMINI_API_KEY, style: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent' },
];

const SYSTEM = 'You grade a learner recalling their own journal entry. Score only against the source text. ' +
  'Reply with JSON only, no preamble: {"score": integer 0-100, "comment": "two short sentences: what they recalled correctly and what they missed"}.';

async function verifyWith(p, source, answer) {
  const user = JSON.stringify({ source, answer });
  let res;
  if (p.style === 'gemini') {
    res = await fetch(`${p.url}?key=${p.key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ parts: [{ text: user }] }], generationConfig: { responseMimeType: 'application/json' } }),
    });
  } else {
    res = await fetch(p.url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
      body: JSON.stringify({ model: p.model, temperature: 0.2,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] }),
    });
  }
  if (res.status === 429) { cooldownUntil[p.name] = Date.now() + WINDOW_MS; throw new Error('rate limited'); }
  if (!res.ok) throw new Error(`${p.name} ${res.status}`);
  const data = await res.json();
  const text = p.style === 'gemini'
    ? data?.candidates?.[0]?.content?.parts?.[0]?.text
    : data?.choices?.[0]?.message?.content;
  const parsed = JSON.parse(String(text).replace(/```json|```/g, '').trim());
  const score = clampScore(parsed.score);
  if (score == null || typeof parsed.comment !== 'string') throw new Error('bad shape');
  return { score, comment: parsed.comment.slice(0, 600), verifier: p.name };
}

async function signedInUser(req) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
  return res.ok ? await res.json() : null;
}

export async function POST(req) {
  const user = await signedInUser(req);
  if (!user) return Response.json({ error: 'Sign in to verify recall.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const answer = String(body?.answer ?? '').slice(0, 4000);
  const source = {
    body: String(body?.source?.body ?? '').slice(0, 8000),
    key_points: (body?.source?.key_points ?? []).slice(0, 20).map(String),
  };
  if (!answer.trim() || !source.body.trim()) {
    return Response.json({ error: 'Answer and source are required.' }, { status: 400 });
  }

  for (const p of PROVIDERS) {
    if (!p.key || (cooldownUntil[p.name] ?? 0) > Date.now()) continue;
    try {
      return Response.json(await verifyWith(p, source, answer));
    } catch {
      // try the next provider
    }
  }
  return Response.json(heuristicReview(answer, source));
}
