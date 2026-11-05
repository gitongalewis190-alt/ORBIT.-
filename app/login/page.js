'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { play } from '../../lib/sound';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState('in'); // 'in' | 'up'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setInfo('');
    setBusy(true);
    const { data, error } = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
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
    <div className="wrap fade-in">
      <h1>Orbit</h1>
      <p className="muted">{mode === 'in' ? 'Sign in to continue.' : 'Create your account.'}</p>

      <form onSubmit={submit}>
        <input
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          placeholder="Password"
          minLength={8}
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <div className="row">
          <button className="btn accent" type="submit" disabled={busy}>
            {busy ? 'Working' : mode === 'in' ? 'Sign in' : 'Create account'}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); setInfo(''); }}
          >
            {mode === 'in' ? 'New here? Create account' : 'Have an account? Sign in'}
          </button>
        </div>
      </form>

      {info && <p className="muted" style={{ marginTop: 14 }}>{info}</p>}
      {err && <p className="err" style={{ marginTop: 14 }}>{err}</p>}
    </div>
  );
}
