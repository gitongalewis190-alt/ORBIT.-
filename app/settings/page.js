'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { getProfile, saveProfile, DEFAULT_PROFILE } from '../../lib/profile';
import { play, setSound, setVolume } from '../../lib/sound';
import { applyTheme } from '../../lib/theme';
import { toast } from '../../lib/toast';
import ProfileDetails from '../../components/ProfileDetails';
import ExportPanel from '../../components/ExportPanel';
import { APP_VERSION } from '../../lib/version';

const TIMEZONES = [
  'Africa/Nairobi', 'Africa/Lagos', 'Africa/Johannesburg', 'Europe/London',
  'Europe/Berlin', 'Asia/Dubai', 'Asia/Kolkata', 'America/New_York', 'UTC',
];
const RESET_TABLES = ['decision_log', 'journal_entries', 'reviews', 'topic_controls', 'assignments', 'user_badges', 'streak_freezes', 'focus_sessions'];

export default function Settings() {
  const router = useRouter();
  const [uid, setUid] = useState(null);
  const [email, setEmail] = useState('');
  const [p, setP] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleteText, setDeleteText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
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

  async function signOut() {
    play('bye');
    await supabase.auth.signOut();
    router.replace('/login');
  }

  // Removes every personal record. The shared library and the account stay.
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
      setConfirmText('');
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

  return (
    <div className="fade-in">
      <h1>Settings</h1>
      <p className="muted">{email}</p>

      <h2>Profile</h2>
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
      </div>

      <h2>Appearance</h2>
      <div className="card">
        <div className="seg">
          {themeChoices.map(([v, l]) => (
            <button key={v} className={p.theme === v ? 'on' : ''} onClick={() => chooseTheme(v)}>{l}</button>
          ))}
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>System follows your iPhone's light or dark setting.</p>
      </div>

      <h2>Sound</h2>
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

      <h2>How selection works</h2>
      <div className="card">
        <p style={{ marginTop: 0, lineHeight: 1.55, fontSize: 14 }}>
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

      <ProfileDetails uid={uid} />

      <ExportPanel uid={uid} />

      <h2>Guide and version</h2>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>The searchable manual explains every screen, rule and smart note.</p>
        <div className="row" style={{ marginTop: 0, alignItems: 'center' }}>
          <a className="btn accent" href="/guide">Open the guide</a>
          <span className="muted">Version {APP_VERSION}</span>
        </div>
      </div>

      <h2>Account</h2>
      <div className="card">
        <div className="row" style={{ marginTop: 0 }}>
          <button className="btn" onClick={signOut}>Sign out</button>
        </div>
      </div>

      <h2>Reset everything</h2>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          Clears your journal, medals, reviews, assignments, topic controls, custom topics and sections, freezes,
          focus sessions and log. Your account and sign-in stay. The shared library is untouched. This cannot be undone.
        </p>
        <input placeholder="Type RESET to confirm" value={confirmText}
          onChange={e => setConfirmText(e.target.value)} />
        <div className="row">
          <button className="btn danger" onClick={resetEverything} disabled={busy || confirmText !== 'RESET'}>
            {busy ? 'Working' : 'Reset everything'}
          </button>
        </div>
      </div>

      <h2>Delete account</h2>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          Permanently deletes your sign-in and every record tied to it. You will not be able to sign back in
          to this data. Use Reset if you only want a clean start.
        </p>
        <div className="kicker">Type DELETE</div>
        <input placeholder="DELETE" value={deleteText}
          onChange={e => setDeleteText(e.target.value)} />
        <div className="kicker">Your account password</div>
        <input type="password" autoComplete="current-password" placeholder="Password" value={deletePassword}
          onChange={e => setDeletePassword(e.target.value)} />
        <div className="row">
          <button className="btn danger" onClick={deleteAccount} disabled={busy || deleteText !== 'DELETE' || !deletePassword}>
            {busy ? 'Working' : 'Delete my account'}
          </button>
        </div>
      </div>
    </div>
  );
}
