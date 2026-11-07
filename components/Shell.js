
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
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
import { scheduleAtlas } from '../lib/atlas/repository';
import { queueAutoBackup } from '../lib/backupSync';
import Toaster from './Toaster';
import AwardUnlock from './AwardUnlock';
import TabBar from './TabBar';
import Skeleton from './Skeleton';
import PrintSheet from './PrintSheet';
import { activeTabIndex } from '../lib/tabs';

const TABS = [
  ['/', 'Today'],
  ['/topics', 'Topics'],
  ['/journal', 'Journal'],
  ['/awards', 'Awards'],
  ['/log', 'Logs'],
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
  // Any screen can open the print settings sheet with one event.
  useEffect(() => {
    const open = () => setPrintOpen(true);
    window.addEventListener('orbit:open-print', open);
    return () => window.removeEventListener('orbit:open-print', open);
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
        await commitEntry(uid, item.payload);
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

  // Remember the screen they were on, so a recovered session returns there
  // instead of always dumping them on Today after the landing animation.
  useEffect(() => {
    if (path && path !== '/welcome' && path !== '/login') returnTo.current = path;
  }, [path]);

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
            className="gear"
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
            className="gear"
            aria-label="Settings"
            data-sound="open"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="3.2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />

              <path
                d="M12 2.8v2.6M12 18.6v2.6M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2.8 12h2.6M18.6 12h2.6M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </Link>
        </div>
      </header>

      {!online && (
        <div className="offline-banner" role="status">
          Offline. Entries you save now stay on this phone
          and sync when you reconnect.
        </div>
      )}

      <div className="wrap">
        {children}
      </div>

      <TabBar
        tabs={TABS}
        path={path}
        visible={activeTabIndex(TABS, path) >= 0}
      />

      <PrintSheet open={printOpen} onClose={() => setPrintOpen(false)} />

      <Toaster />
      <AwardUnlock />
    </>
  );
}
