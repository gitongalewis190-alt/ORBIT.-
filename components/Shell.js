'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { play, soundEnabled, setSound } from '../lib/sound';

const TABS = [['/', 'Today'], ['/journal', 'Journal'], ['/topics', 'Topics'], ['/log', 'Log']];

export default function Shell({ children }) {
  const path = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [sound, setSoundState] = useState(true);

  // Every tap in the app makes a sound.
  useEffect(() => {
    setSoundState(soundEnabled());
    const onClick = e => {
      if (e.target.closest('button, a.btn, nav a')) play('pop');
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session && path !== '/login') router.replace('/login');
      else setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && path !== '/login') router.replace('/login');
    });
    return () => listener.subscription.unsubscribe();
  }, [path]);

  if (path === '/login') return children;
  if (!ready) return <div className="wrap muted">Loading</div>;

  async function signOut() {
    play('whoosh');
    await supabase.auth.signOut();
    router.replace('/login');
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    setSoundState(next);
    if (next) play('chime');
  }

  return (
    <>
      <header className="topbar">
        <span className="brand">Orbit</span>
        <div className="row" style={{ marginTop: 0 }}>
          <button className="btn sm" onClick={toggleSound}>Sound {sound ? 'on' : 'off'}</button>
          <button className="btn sm" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <div className="wrap">{children}</div>
      <nav>
        {TABS.map(([href, label]) => (
          <Link key={href} href={href} className={path === href ? 'on' : ''}>{label}</Link>
        ))}
      </nav>
    </>
  );
}
