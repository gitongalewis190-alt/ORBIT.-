
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';

import { supabase } from '../lib/supabase';
import { nextAuth, readPersistedUserId } from '../lib/authGate';
import {
  play,
  setSound,
  setVolume,
  installUnlockListeners,
} from '../lib/sound';

import { applyTheme, getStoredTheme } from '../lib/theme';
import { getProfile } from '../lib/profile';
import { toast } from '../lib/toast';
import {
  loadQueue,
  replaceQueue,
  isNetworkError,
} from '../lib/offline';

import { commitEntry } from '../lib/journal';
import { supabase as db } from '../lib/supabase';

// A queued entry saved offline may be a Learn entry on a topic already learned. It is saved as a reflection.
async function asReflection(uid, payload) {
  if (payload.entry_kind === 'reflection' || !payload.topic_id) return payload;
  const { data } = await db.from('journal_entries').select('id')
    .eq('user_id', uid).eq('topic_id', payload.topic_id).eq('entry_kind', 'research').limit(1);
  if (data && data.length) return { ...payload, entry_kind: 'reflection', research_entry_id: data[0].id };
  return payload;
}
import { scheduleAtlas } from '../lib/atlas/repository';
import { queueAutoBackup } from '../lib/backupSync';
import Toaster from './Toaster';
import AwardUnlock from './AwardUnlock';
import TabBar from './TabBar';
import FamilyStrip from './FamilyStrip';
import Skeleton from './Skeleton';
import PrintSheet from './PrintSheet';
import { activeTabIndex } from '../lib/tabs';
import { RECORDS } from '../lib/navMap';

const CommandPalette = dynamic(() => import('./CommandPalette'), { ssr: false });
const MenuDrawer = dynamic(() => import('./MenuDrawer'), { ssr: false });

const TABS = [
  ['/', 'Today'],
  ['/topics', 'Topics'],
  ['/journal', 'Journal'],
  ['/study', 'Study'],
  ['/progress', 'Progress'],
];

// Chooses the sound for a click.
// An element can define its own sound using data-sound.
function soundFor(el) {
  const named = el.closest('[data-sound]');

  if (named) return named.dataset.sound;
  if (el.closest('.obar a')) return 'nav';
  if (el.closest('.btn.danger')) return 'warn';
  if (el.closest('.switch')) return 'toggle';
  if (el.closest('.seg button, .chip')) return 'select';
  if (el.closest('a, button')) return 'tap';

  return null;
}

export default function Shell({ children }) {
  const path = usePathname();
  const router = useRouter();

  const [authed, setAuthed] = useState(null);
  const [online, setOnline] = useState(true);

  const uidRef = useRef(null);
  const returnTo = useRef('/');
  const [printOpen, setPrintOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Any screen can open the print settings sheet with one event.
  useEffect(() => {
    const open = () => setPrintOpen(true);
    window.addEventListener('orbit:open-print', open);
    const flush = () => { flushQueue(); };
    window.addEventListener('orbit:flush-queue', flush);
    return () => {
      window.removeEventListener('orbit:open-print', open);
      window.removeEventListener('orbit:flush-queue', flush);
    };
  }, []);

  // Sends saved offline entries to Supabase when a connection returns.
  async function flushQueue() {
    const uid = uidRef.current;

    if (!uid || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return;
    }

    const items = loadQueue(uid);

    if (!items.length) return;

    const keep = [];
    let synced = 0;

    for (const item of items) {
      try {
        const payload = await asReflection(uid, item.payload);
        await commitEntry(uid, payload);
        scheduleAtlas(uid, item.payload.id);
        synced++;
      } catch (e) {
        keep.push(item);

        if (!isNetworkError(e)) {
          toast(
            `A saved entry could not sync: ${e.message}`,
            'err',
            6000
          );
        }
      }
    }

    replaceQueue(uid, keep);

    if (synced) {
      play('success');

      toast(
        `${synced} saved entr${synced === 1 ? 'y' : 'ies'} synced.`,
        'ok'
      );
    }
  }

  // Connection monitoring, audio unlocking and global interactions.
  useEffect(() => {
    setOnline(navigator.onLine);

    // Important for iOS Home Screen installed apps.
    // Audio becomes available after the user's first interaction.
    installUnlockListeners();

    const onUp = () => {
      setOnline(true);
      play('online');

      toast('Back online. Syncing your saved entries.', 'ok');

      flushQueue();
    };

    const onDown = () => {
      setOnline(false);
      play('offline');

      toast(
        'You are offline. Entries will save on this phone.',
        'warn',
        4500
      );
    };

    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);

    // Global click sounds.
    const onClick = (e) => {
      const el =
        e.target instanceof Element ? e.target : null;

      if (!el) return;

      const name = soundFor(el);

      if (name) play(name);
    };

    // Select dropdown sounds.
    const onChange = (e) => {
      if (e.target.matches?.('select')) {
        play('select');
      }
    };

    // Range slider sounds.
    const onInput = (e) => {
      if (e.target.matches?.('input[type="range"]')) {
        play('slide');
      }
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('change', onChange, true);
    document.addEventListener('input', onInput, true);

    // Follow the device's appearance when ORBIT uses system theme.
    const mq = window.matchMedia(
      '(prefers-color-scheme: dark)'
    );

    const onSystem = () => {
      if (getStoredTheme() === 'system') {
        applyTheme('system');
      }
    };

    mq.addEventListener?.('change', onSystem);

    // Register the offline service worker in production.
    if (
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);

      document.removeEventListener('click', onClick, true);
      document.removeEventListener('change', onChange, true);
      document.removeEventListener('input', onInput, true);

      mq.removeEventListener?.('change', onSystem);
    };
  }, []);

  // Load authentication state and saved preferences.
  // A missing session is not a sign-out until we have confirmed the phone
  // no longer has one. iOS briefly reports a null session while a save is
  // refreshing the token; sending the learner to the landing animation then
  // is the save-and-logs loop.
  useEffect(() => {
    let alive = true;
    let settleTimer = 0;

    const persistId = () => readPersistedUserId(window.localStorage);

    const adopt = (userId) => {
      if (!alive || !userId) return;
      window.clearTimeout(settleTimer);
      setAuthed(true);
      uidRef.current = userId;
    };

    const confirmSignOut = () => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        if (!alive) return;
        supabase.auth.getSession().then(({ data }) => {
          if (!alive) return;
          const recovered = data.session?.user?.id || persistId();
          if (recovered) {
            adopt(recovered);
            return;
          }
          setAuthed(false);
          uidRef.current = null;
        }).catch(() => {
          if (!alive) return;
          const recovered = persistId();
          if (recovered) adopt(recovered);
          else {
            setAuthed(false);
            uidRef.current = null;
          }
        });
      }, 600);
    };

    const apply = (decision) => {
      if (!alive) return;
      if (decision.settle && decision.authed === false) {
        confirmSignOut();
        return;
      }
      if (decision.authed === true) adopt(decision.userId);
    };

    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;

      const session = data.session;
      const userId = session?.user?.id || persistId();

      if (!userId) {
        setAuthed(false);
        return;
      }

      adopt(userId);

      if (!session) return;

      try {
        const p = await getProfile(session.user.id);

        if (!alive) return;

        applyTheme(p.theme ?? getStoredTheme());

        // Protect against missing settings in older profiles.
        setSound(p.sound_on ?? true);
        setVolume(p.sound_volume ?? 70);
      } catch {
        if (alive) {
          applyTheme(getStoredTheme());
        }
      }

      if (alive) {
        flushQueue();
        queueAutoBackup(session.user.id);
      }
    }).catch(() => {
      if (!alive) return;
      const userId = persistId();
      if (userId) adopt(userId);
      else setAuthed(false);
    });

    const { data: listener } =
      supabase.auth.onAuthStateChange((event, session) => {
        apply(nextAuth({
          event,
          session,
          persistedUserId: persistId(),
          knownUserId: uidRef.current,
        }));
      });

    return () => {
      alive = false;
      window.clearTimeout(settleTimer);
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (path && path !== '/welcome' && path !== '/login') returnTo.current = path;
    setMenuOpen(false);
    if (!path || path === '/welcome' || path === '/login') return;
    const row = RECORDS.find(item => item.route && item.route.split('#')[0].split('?')[0] === path && item.risk !== 'destructive');
    if (!row) return;
    try {
      const raw = localStorage.getItem('orbit.nav.recent.v1');
      const list = raw ? JSON.parse(raw) : [];
      const next = [row.id, ...(Array.isArray(list) ? list : []).filter(id => id !== row.id)].slice(0, 5);
      localStorage.setItem('orbit.nav.recent.v1', JSON.stringify(next));
    } catch {
      // storage is optional
    }
  }, [path]);

  useEffect(() => {
    const chord = { at: 0 };
    const onKey = (event) => {
      const tag = event.target?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable || event.target?.closest?.('.orbit-editor');
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (typing) return;
      if (event.key === '/') {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (event.key === '?') {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (event.key === 'g') { chord.at = Date.now(); return; }
      if (chord.at && Date.now() - chord.at < 1200) {
        const dest = { t: '/', j: '/journal', s: '/study', p: '/progress', i: '/inspect' }[event.key];
        if (dest) { event.preventDefault(); router.push(dest); }
        chord.at = 0;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  // The welcome drawing and the sign-in form are outside the signed-in shell.
  const door = path === '/login' || path === '/welcome';
  useEffect(() => {
    if (authed === false && !door) router.replace('/welcome');
    if (authed === true && path === '/welcome') {
      const back = returnTo.current && returnTo.current !== '/welcome' ? returnTo.current : '/';
      router.replace(back);
    }
  }, [authed, path, router, door]);

  if (door) {
    if (authed === true && path === '/welcome') {
      return <div className="wrap"><Skeleton lines={3} label="Loading Orbit" /></div>;
    }
    return (
      <>
        {children}
        <Toaster />
      </>
    );
  }

  // Wait until authentication has been checked.
  if (authed !== true) {
    return (
      <div className="wrap">
        <Skeleton lines={3} label="Loading Orbit" />
      </div>
    );
  }

  return (
    <>
      <header className="topbar">
        <Link
          href="/"
          className="brand"
          data-sound="nav"
          aria-label="Orbit home"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <ellipse
              cx="12"
              cy="12"
              rx="10"
              ry="4.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              transform="rotate(-24 12 12)"
            />

            <circle
              cx="12"
              cy="12"
              r="3"
              fill="var(--accent)"
            />

            <circle
              cx="19.2"
              cy="8.4"
              r="1.6"
              fill="currentColor"
            />
          </svg>

          <span>Orbit</span>
        </Link>

        <div className="topbar-actions">
          <button
            type="button"
            className="gear search-control"
            aria-label="Search Orbit"
            data-sound="open"
            onClick={() => setPaletteOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16.5 20 20.5" />
            </svg>
          </button>
          <button
            type="button"
            className="gear print-control"
            aria-label="Download PDF record"
            title="Download PDF record"
            data-sound="open"
            onClick={() => setPrintOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
            </svg>
          </button>

          <Link
            href="/settings"
            className={`gear${path.startsWith('/settings') ? ' on' : ''}`}
            aria-label="Settings"
            aria-current={path.startsWith('/settings') ? 'page' : undefined}
            data-sound="open"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14.8 3.3 14.3 6a6 6 0 0 1 2.1 1.2l2.3-1 1.4 2.3-2 1.4a6 6 0 0 1 0 2.2l2 1.4-1.4 2.3-2.3-1a6 6 0 0 1-2.1 1.2l.5 2.7h-2.6l-.5-2.7a6 6 0 0 1-2.1-1.2l-2.3 1-1.4-2.3 2-1.4a6 6 0 0 1 0-2.2l-2-1.4 1.4-2.3 2.3 1A6 6 0 0 1 11.7 6L12.2 3.3z" />
              <circle cx="12" cy="12" r="2.4" />
            </svg>
          </Link>
          <button
            type="button"
            className="gear menu-trigger"
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls="orbit-menu"
            data-sound="open"
            onClick={() => setMenuOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </header>

      {!online && (
        <div className="offline-banner" role="status">
          Offline. Entries you save now stay on this phone
          and sync when you reconnect.
        </div>
      )}

      {activeTabIndex(TABS, path) < 0 && (
        <FamilyStrip path={path} />
      )}

      <div className="wrap">
        {children}
      </div>

      <TabBar tabs={TABS} path={path} visible orientation="horizontal" />
      <TabBar tabs={TABS} path={path} visible orientation="vertical" />

      <PrintSheet open={printOpen} onClose={() => setPrintOpen(false)} />
      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} onSearch={() => { setMenuOpen(false); setPaletteOpen(true); }} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      <Toaster />
      <AwardUnlock />
    </>
  );
}
