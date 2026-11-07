'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { getProfile, saveProfile, DEFAULT_PROFILE } from '../../lib/profile';
import { play, setSound, setVolume } from '../../lib/sound';
import { applyTheme } from '../../lib/theme';
import StorageMeter from '../../components/StorageMeter';
import { toast } from '../../lib/toast';
import { autocorrectOn, setAutocorrect } from '../../lib/autocorrect';
import ProfileDetails from '../../components/ProfileDetails';
import ExportPanel from '../../components/ExportPanel';
import BackupPanel from '../../components/BackupPanel';
import ConfirmDialog from '../../components/ConfirmDialog';
import { APP_VERSION } from '../../lib/version';
import { readAssist, writeAssist, ASSIST_DEFAULTS } from '../../lib/assist';

const TIMEZONES = [
  'Africa/Nairobi', 'Africa/Lagos', 'Africa/Johannesburg', 'Europe/London',
  'Europe/Berlin', 'Asia/Dubai', 'Asia/Kolkata', 'America/New_York', 'UTC',
];
// Personal records cleared by Reset. Stored PDF copies in the document log are kept on purpose.
const RESET_TABLES = ['decision_log', 'journal_entries', 'reviews', 'topic_controls', 'assignments', 'user_badges', 'streak_freezes', 'focus_sessions'];

// The catalogue. Each entry opens its own page. Danger rows are red-labelled and sit at the end.
const CATALOGUE = [
  { key: 'profile', title: 'Profile' },
  { key: 'appearance', title: 'Appearance' },
  { key: 'sound', title: 'Sound' },
  { key: 'learning', title: 'Journal' },
  { key: 'assist', title: 'Assist' },
  { key: 'export', title: 'Backups' },
  { key: 'storage', title: 'Storage' },
  { key: 'help', title: 'Help' },
  { key: 'recall', title: 'Recall', href: '/recall' },
  { key: 'reset', title: 'Reset', danger: true },
  { key: 'delete', title: 'Delete account', danger: true },
];

const rowStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, width: '100%',
  padding: '14px 2px', background: 'transparent', border: 0, borderBottom: '0.5px solid var(--border)',
  color: 'inherit', textAlign: 'left', fontSize: 16, lineHeight: 1.35, cursor: 'pointer', whiteSpace: 'normal',
};

const ASSIST_ROWS = [
  ['pace', 'Learn my usual length'],
  ['suggestions', 'Suggestions'],
  ['ask', 'Ask my journal'],
  ['dictate', 'Speak to write'],
];

function AssistSettings() {
  const [prefs, setPrefs] = useState(ASSIST_DEFAULTS);
  useEffect(() => { setPrefs(readAssist(localStorage)); }, []);
  function toggle(key) {
    const next = writeAssist(localStorage, { [key]: !prefs[key] });
    setPrefs(next);
    play('toggle');
  }
  return (
    <div className="card">
      {ASSIST_ROWS.map(([key, label]) => (
        <div className="switchrow" key={key}>
          <span>{label}</span>
          <button className={`switch ${prefs[key] ? 'on' : ''}`} aria-label={label} onClick={() => toggle(key)} />
        </div>
      ))}
    </div>
  );
}

// Two-step confirmations. Each flow moves from step 1 (the warning) to step 2 (the final check).
// Nothing is changed until step 2 is confirmed.
export default function Settings() {
  const router = useRouter();
  const [uid, setUid] = useState(null);
  const [email, setEmail] = useState('');
  const [p, setP] = useState(null);
  const [autoFix, setAutoFix] = useState(true);
  const [view, setView] = useState(null);
  const [flow, setFlow] = useState(null); // { action: 'signout' | 'reset' | 'delete', step: 1 | 2 }
  const [confirmText, setConfirmText] = useState('');
  const [deleteText, setDeleteText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    setAutoFix(autocorrectOn());
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUid(data.user.id);
      setEmail(data.user.email ?? '');
      try {
        setP(await getProfile(data.user.id));
      } catch (e) {
        setErr(e.message);
      }
    });
  }, []);

  async function update(patch, sound = 'save') {
    if (!uid) return;
    try {
      const saved = await saveProfile(uid, patch);
      setP(saved);
      play(sound);
      toast('Saved.', 'ok');
      return saved;
    } catch (e) {
      play('error');
      toast(e.message, 'err');
    }
  }

  async function chooseTheme(theme) {
    applyTheme(theme);
    await update({ theme }, 'select');
  }

  async function toggleSound() {
    const next = !p.sound_on;
    setSound(next);
    await update({ sound_on: next }, 'toggle');
  }

  function previewVolume(v) {
    setP({ ...p, sound_volume: v });
    setVolume(v);
  }

  async function commitVolume() {
    await update({ sound_volume: p.sound_volume }, 'slide');
  }

  function toggleAutocorrect() {
    const next = !autoFix;
    setAutoFix(next);
    setAutocorrect(next);
    play('toggle');
    toast(next ? 'Autocorrect is on.' : 'Autocorrect is off.', 'ok');
  }

  async function saveNumbers() {
    const minutes = Number(p.daily_minutes);
    const words = Number(p.word_goal);
    const weekly = Number(p.weekly_entry_goal);
    const age = p.age === '' || p.age === null ? null : Number(p.age);
    if (!(minutes >= 15 && minutes <= 480)) return toast('Daily minutes must be between 15 and 480.', 'err');
    if (!(words >= 20 && words <= 2000)) return toast('Word goal must be between 20 and 2000.', 'err');
    if (!(weekly >= 1 && weekly <= 7)) return toast('Weekly entries must be between 1 and 7.', 'err');
    if (age !== null && !(age >= 5 && age <= 120)) return toast('Age must be between 5 and 120.', 'err');
    await update({
      display_name: (p.display_name || '').trim() || null,
      age,
      daily_minutes: minutes,
      word_goal: words,
      weekly_entry_goal: weekly,
      timezone: p.timezone,
    });
  }

  function closeFlow() {
    setFlow(null);
    setConfirmText('');
    setDeleteText('');
    setDeletePassword('');
  }

  async function signOut() {
    setBusy(true);
    play('bye');
    applyTheme('system');
    await supabase.auth.signOut();
    router.replace('/login');
  }

  // Removes every personal record. The shared library, the account and printed copies stay.
  async function resetEverything() {
    if (confirmText !== 'RESET') {
      play('error');
      return toast('Type RESET in capitals to confirm.', 'err');
    }
    setBusy(true);
    try {
      for (const table of RESET_TABLES) {
        const { error } = await supabase.from(table).delete().eq('user_id', uid);
        if (error) throw new Error(`${table}: ${error.message}`);
      }
      const { error: tErr } = await supabase.from('topics').delete().eq('user_id', uid);
      if (tErr) throw new Error(`topics: ${tErr.message}`);
      const { error: sErr } = await supabase.from('subfields').delete().eq('user_id', uid);
      if (sErr) throw new Error(`sections: ${sErr.message}`);

      const saved = await saveProfile(uid, { ...DEFAULT_PROFILE });
      setP(saved);
      applyTheme(saved.theme);
      setSound(saved.sound_on);
      setVolume(saved.sound_volume);
      closeFlow();
      play('delete');
      toast('Everything has been reset. The shared library is untouched.', 'ok', 4500);
    } catch (e) {
      play('error');
      toast(e.message, 'err', 6000);
    } finally {
      setBusy(false);
    }
  }

  // Permanently deletes the account and every record in it.
  // Deleting asks for the account password again, so a stray tap can never remove data.
  async function deleteAccount() {
    if (deleteText !== 'DELETE') {
      play('error');
      return toast('Type DELETE in capitals to confirm.', 'err');
    }
    if (!deletePassword) {
      play('error');
      return toast('Enter your account password to continue.', 'warn');
    }
    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: deletePassword,
      });
      if (authError) {
        play('error');
        toast('That password is not right. Nothing was deleted.', 'err', 5000);
        setBusy(false);
        return;
      }
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
      await supabase.auth.signOut();
      play('bye');
      router.replace('/login');
    } catch (e) {
      play('error');
      toast(e.message, 'err', 6000);
      setBusy(false);
    }
  }

  if (!p) return <div className="fade-in"><h1>Settings</h1>{err ? <p className="err">{err}</p> : <p className="muted">Loading</p>}</div>;

  const themeChoices = [['light', 'Light'], ['dark', 'Dark'], ['system', 'System']];
  const step = action => (flow?.action === action ? flow.step : 0);
  const current = CATALOGUE.find(c => c.key === view);

  // A plain render function, not a component, so inputs keep focus while typing.
  function renderPage() {
    switch (view) {
      case 'profile':
        return (
          <div className="card">
            <div className="kicker">Name</div>
            <input value={p.display_name ?? ''} placeholder="What should Orbit call you?"
              onChange={e => setP({ ...p, display_name: e.target.value })} />
            <div className="kicker">Age</div>
            <input type="number" inputMode="numeric" value={p.age ?? ''} placeholder="Shown on your PDF export"
              onChange={e => setP({ ...p, age: e.target.value })} />
            <div className="kicker">Daily study minutes</div>
            <input type="number" inputMode="numeric" value={p.daily_minutes}
              onChange={e => setP({ ...p, daily_minutes: e.target.value })} />
            <div className="kicker">Words per journal entry (goal)</div>
            <input type="number" inputMode="numeric" value={p.word_goal}
              onChange={e => setP({ ...p, word_goal: e.target.value })} />
            <div className="kicker">Journal entries per week (goal)</div>
            <input type="number" inputMode="numeric" value={p.weekly_entry_goal}
              onChange={e => setP({ ...p, weekly_entry_goal: e.target.value })} />
            <div className="kicker">Timezone</div>
            <select value={p.timezone} onChange={e => setP({ ...p, timezone: e.target.value })}>
              {TIMEZONES.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
            <div className="row">
              <button className="btn accent" onClick={saveNumbers}>Save profile</button>
            </div>
            <ProfileDetails uid={uid} />
          </div>
        );
      case 'appearance':
        return (
          <div className="card">
            <div className="seg">
              {themeChoices.map(([v, l]) => (
                <button key={v} className={p.theme === v ? 'on' : ''} onClick={() => chooseTheme(v)}>{l}</button>
              ))}
            </div>
            <p className="muted" style={{ marginBottom: 0 }}>System follows your iPhone's light or dark setting.</p>
          </div>
        );
      case 'sound':
        return (
          <div className="card">
            <div className="switchrow">
              <span>Sounds</span>
              <button className={`switch ${p.sound_on ? 'on' : ''}`} onClick={toggleSound} aria-label="Toggle sounds" />
            </div>
            <div className="kicker" style={{ marginTop: 10 }}>Volume · {p.sound_volume}%</div>
            <input type="range" min="0" max="100" value={p.sound_volume}
              onChange={e => previewVolume(Number(e.target.value))}
              onMouseUp={commitVolume} onTouchEnd={commitVolume} />
            <div className="kicker" style={{ marginTop: 10 }}>Preview</div>
            <div className="choices" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['tap', 'select', 'toggle', 'save', 'success', 'badge', 'streak', 'reveal', 'warn'].map(s => (
                <button key={s} className="chip" data-sound={s}>{s}</button>
              ))}
            </div>
          </div>
        );
      case 'learning':
        return (
          <>
            <div className="card">
              <div className="switchrow">
                <span>Autocorrect in the journal</span>
                <button className={`switch ${autoFix ? 'on' : ''}`} onClick={toggleAutocorrect} aria-label="Toggle autocorrect" />
              </div>
              <p className="muted" style={{ marginBottom: 0, lineHeight: 1.5 }}>
                Fixes common typos, capitals at the start of sentences, and spacing around punctuation as you type.
                The setting applies to this phone only.
              </p>
            </div>
            <div className="card" style={{ marginTop: 12 }}>
              <div className="kicker">How selection works</div>
              <p style={{ marginTop: 6, lineHeight: 1.55, fontSize: 14 }}>
                Each day Orbit picks one topic from your library. Most days it draws at random, weighted toward
                what you've marked More and away from what you've marked Less. On about 15% of days it chooses from
                a field linked to what you studied last, to build bridges between subjects. About 10% of days are
                fully random. About 5% of days it leans toward fields where your recent confidence is low.
              </p>
              <p style={{ lineHeight: 1.55, fontSize: 14 }}>
                Orbit won't repeat a topic within 14 days or the same field two days running. If your recent
                confidence is high it raises the difficulty; if it's low it lowers it. If a topic has an unfinished
                prerequisite, the prerequisite comes first. Each topic's time budget and deadline follow its
                difficulty: 30 minutes for beginner, 45 for intermediate, 75 for advanced.
              </p>
            </div>
          </>
        );
      case 'export':
        return (
          <>
            <BackupPanel uid={uid} />
            <ExportPanel uid={uid} />
          </>
        );
      case 'assist':
        return <AssistSettings />;
      case 'storage':
        return <div className="card"><StorageMeter /></div>;
      case 'help':
        return (
          <div className="card">
            <p className="muted" style={{ marginTop: 0 }}>The searchable manual explains every screen, rule and smart note.</p>
            <div className="row" style={{ marginTop: 0, alignItems: 'center' }}>
              <a className="btn accent" href="/guide">Open the guide</a>
              <span className="muted">Version {APP_VERSION}</span>
            </div>
          </div>
        );
      case 'reset':
        return (
          <div className="card">
            <p className="muted" style={{ marginTop: 0 }}>
              Clears your journal, medals, reviews, assignments, topic controls, custom topics and sections, freezes,
              focus sessions and log. Your account and sign-in stay, and so do the PDF copies in your document log.
              The shared library is untouched. This cannot be undone.
            </p>
            <div className="row" style={{ marginTop: 0 }}>
              <button className="btn danger" onClick={() => setFlow({ action: 'reset', step: 1 })} disabled={busy}>Reset everything</button>
            </div>
          </div>
        );
      case 'delete':
        return (
          <div className="card">
            <p className="muted" style={{ marginTop: 0 }}>
              Permanently deletes your sign-in and every record tied to it, including the PDF copies in your document
              log. You will not be able to sign back in to this data. Use Reset if you only want a clean start.
            </p>
            <div className="row" style={{ marginTop: 0 }}>
              <button className="btn danger" onClick={() => setFlow({ action: 'delete', step: 1 })} disabled={busy}>Delete my account</button>
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="fade-in settings">
      {view === null ? (
        <>
          <h1>Settings</h1>
          <p className="muted">{email}</p>
          <nav className="settings-catalogue" aria-label="Settings catalogue">
            {CATALOGUE.map(c => c.href ? (
              <a key={c.key} href={c.href} style={{ ...rowStyle, textDecoration: 'none', color: c.danger ? 'var(--text-danger)' : 'inherit' }}>{c.title}</a>
            ) : (
              <button key={c.key} type="button" style={{ ...rowStyle, color: c.danger ? 'var(--text-danger)' : 'inherit' }} onClick={() => setView(c.key)}>
                {c.title}
              </button>
            ))}
          </nav>
          <div style={{ marginTop: 24 }}>
            <button className="btn" onClick={() => setFlow({ action: 'signout', step: 1 })} disabled={busy}>Sign out</button>
          </div>
        </>
      ) : (
        <>
          <div className="row" style={{ marginTop: 0, alignItems: 'center' }}>
            <button className="btn sm" onClick={() => setView(null)} aria-label="Back to settings">‹ Settings</button>
          </div>
          <h1 style={{ marginTop: 12 }}>{current?.title}</h1>
          {view === 'profile' && <p className="muted">{email}</p>}
          {renderPage()}
        </>
      )}

      {/* Sign out */}
      <ConfirmDialog
        open={step('signout') === 1}
        title="Sign out of Orbit?"
        confirmLabel="Continue"
        onConfirm={() => setFlow({ action: 'signout', step: 2 })}
        onCancel={closeFlow}
      >
        <p style={{ marginTop: 0 }}>
          You will be signed out on this phone. Entries you saved while offline stay on this phone and sync the next time you sign in.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={step('signout') === 2}
        title="Are you sure you want to sign out?"
        confirmLabel="Sign out"
        busy={busy}
        onConfirm={signOut}
        onCancel={closeFlow}
      >
        <p style={{ marginTop: 0 }}>This is the last step. Your journal and records are safe in your account.</p>
      </ConfirmDialog>

      {/* Reset */}
      <ConfirmDialog
        open={step('reset') === 1}
        title="Reset everything?"
        danger
        confirmLabel="Continue"
        onConfirm={() => setFlow({ action: 'reset', step: 2 })}
        onCancel={closeFlow}
      >
        <p style={{ marginTop: 0 }}>
          This permanently clears your journal entries, medals, reviews, topic marks, custom topics, focus sessions and log.
          Your account, your profile and the PDF copies in your document log stay. The shared library is untouched.
          It cannot be undone.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={step('reset') === 2}
        title="Last check before reset"
        danger
        confirmLabel="Reset everything"
        busy={busy}
        canConfirm={confirmText === 'RESET'}
        onConfirm={resetEverything}
        onCancel={closeFlow}
      >
        <p style={{ marginTop: 0 }}>Type RESET in capitals to confirm.</p>
        <input placeholder="RESET" value={confirmText} autoComplete="off" autoCapitalize="characters"
          onChange={e => setConfirmText(e.target.value)} />
      </ConfirmDialog>

      {/* Delete account */}
      <ConfirmDialog
        open={step('delete') === 1}
        title="Delete your account?"
        danger
        confirmLabel="Continue"
        onConfirm={() => setFlow({ action: 'delete', step: 2 })}
        onCancel={closeFlow}
      >
        <p style={{ marginTop: 0 }}>
          This permanently deletes your sign-in, your profile, every journal entry, every progress record and every PDF copy
          in your document log. It cannot be undone, and you will not be able to sign back in to this data.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={step('delete') === 2}
        title="Final check before deleting"
        danger
        confirmLabel="Delete my account"
        busy={busy}
        canConfirm={deleteText === 'DELETE' && !!deletePassword}
        onConfirm={deleteAccount}
        onCancel={closeFlow}
      >
        <p style={{ marginTop: 0 }}>Type DELETE in capitals, then enter your account password. Nothing is removed until both are right.</p>
        <div className="kicker">Type DELETE</div>
        <input placeholder="DELETE" value={deleteText} autoComplete="off" autoCapitalize="characters"
          onChange={e => setDeleteText(e.target.value)} />
        <div className="kicker">Your account password</div>
        <input type="password" autoComplete="current-password" placeholder="Password" value={deletePassword}
          onChange={e => setDeletePassword(e.target.value)} />
      </ConfirmDialog>
    </div>
  );
}
