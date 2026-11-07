
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { play } from '../../lib/sound';
import { PebbleInk } from '../../components/orbit/EnterScreen';

export default function Login() {
  const router = useRouter();

  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setInfo('');
    setBusy(true);

    const { data, error } = mode === 'in'
      ? await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
      : await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });

    setBusy(false);

    if (error) {
      play('error');
      setErr(error.message);
      return;
    }

    if (mode === 'up' && !data.session) {
      play('success');
      setInfo('Account created. Confirm the email, then sign in.');
      setMode('in');
      return;
    }

    play('success');
    router.replace('/');
  }

  return (
    <div className="orbit-intro login-stage">
      <PebbleInk />
      <div className="wrap fade-in login-card">
      <h1>Orbit</h1>

      <p className="muted">
        {mode === 'in'
          ? 'Sign in to continue.'
          : 'Create your account.'}
      </p>

      <form onSubmit={submit}>
        <input
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div className="pw-field">
          <input
            type={showPw ? 'text' : 'password'}
            autoComplete={
              mode === 'in' ? 'current-password' : 'new-password'
            }
            placeholder="Password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="button"
            className="pw-toggle"
            onClick={() => setShowPw((prev) => !prev)}
            aria-label={showPw ? 'Hide password' : 'Show password'}
            aria-pressed={showPw}
          >
            {showPw ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9 7-.2 1.1-1 2.3-2.2 3.4" />
                <path d="M6.2 6.2C4.2 7.5 2.6 9.5 2 12c.5 2.5 4 7 10 7 1.1 0 2.2-.2 3.2-.5" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        <div className="row">
          <button
            className="btn accent"
            type="submit"
            disabled={busy}
          >
            {busy
              ? 'Working'
              : mode === 'in'
                ? 'Sign in'
                : 'Create account'}
          </button>

          <button
            className="btn"
            type="button"
            onClick={() => {
              setMode(mode === 'in' ? 'up' : 'in');
              setErr('');
              setInfo('');
            }}
          >
            {mode === 'in'
              ? 'New here? Create account'
              : 'Have an account? Sign in'}
          </button>
        </div>
      </form>

      {info && (
        <p className="muted" style={{ marginTop: 14 }}>
          {info}
        </p>
      )}

      {err && (
        <p className="err" style={{ marginTop: 14 }}>
          {err}
        </p>
      )}
      </div>
    </div>
  );
}
