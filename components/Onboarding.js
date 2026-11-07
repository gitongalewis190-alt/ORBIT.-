'use client';
import { useEffect, useState } from 'react';
import { currentUser } from '../lib/session';
import { getProfile, saveProfile } from '../lib/profile';
import { play, setSound, setVolume } from '../lib/sound';
import { applyTheme } from '../lib/theme';
import { toast } from '../lib/toast';

const STEPS = ['Welcome', 'Your rhythm', 'Look and sound'];

// Shown once, to a new account, until onboarded is set in the profile.
export default function Onboarding() {
  const [uid, setUid] = useState(null);
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    full_name: '', age: '', daily_minutes: 90, word_goal: 150,
    weekly_entry_goal: 5, theme: 'light', sound_on: true, sound_volume: 70,
  });

  useEffect(() => {
    currentUser().then(async (user) => {
      if (!user) return;
      try {
        const p = await getProfile(user.id);
        setUid(user.id);
        if (!p.onboarded) {
          setForm(f => ({
            ...f,
            full_name: p.full_name || p.display_name || '',
            age: p.age ?? '',
            daily_minutes: p.daily_minutes,
            word_goal: p.word_goal,
            weekly_entry_goal: p.weekly_entry_goal,
            theme: p.theme,
            sound_on: p.sound_on,
            sound_volume: p.sound_volume,
          }));
          setShow(true);
          play('onboard');
        }
      } catch {
        // If the profile cannot load, skip onboarding rather than block the app.
      }
    });
  }, []);

  function validate() {
    const age = form.age === '' ? null : Number(form.age);
    if (age !== null && !(age >= 5 && age <= 120)) return 'Age must be between 5 and 120.';
    if (!(Number(form.daily_minutes) >= 15 && Number(form.daily_minutes) <= 480)) return 'Daily minutes must be between 15 and 480.';
    if (!(Number(form.word_goal) >= 20 && Number(form.word_goal) <= 2000)) return 'Word goal must be between 20 and 2000.';
    if (!(Number(form.weekly_entry_goal) >= 1 && Number(form.weekly_entry_goal) <= 7)) return 'Weekly entries must be between 1 and 7.';
    return '';
  }

  async function finish(skipped) {
    if (busy || !uid) return;
    const problem = skipped ? '' : validate();
    if (problem) {
      setErr(problem);
      play('error');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const patch = skipped ? { onboarded: true } : {
        full_name: form.full_name.trim() || null,
        display_name: form.full_name.trim().split(' ')[0] || null,
        age: form.age === '' ? null : Number(form.age),
        daily_minutes: Number(form.daily_minutes),
        word_goal: Number(form.word_goal),
        weekly_entry_goal: Number(form.weekly_entry_goal),
        theme: form.theme,
        sound_on: form.sound_on,
        sound_volume: Number(form.sound_volume),
        onboarded: true,
      };
      await saveProfile(uid, patch);
      if (!skipped) {
        applyTheme(form.theme);
        setSound(form.sound_on);
        setVolume(form.sound_volume);
      }
      play('welcome');
      toast(skipped ? 'You can set this up later in Settings.' : 'Welcome to Orbit.', 'ok', 4000);
      setShow(false);
    } catch (e) {
      setErr(e.message);
      play('error');
    } finally {
      setBusy(false);
    }
  }

  if (!show) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const last = step === STEPS.length - 1;

  return (
    <div className="unlock" role="dialog" aria-modal="true" aria-label="Set up Orbit">
      <div className="unlock-card onboard-card fade-in">
        <div className="kicker">Step {step + 1} of {STEPS.length} · {STEPS[step]}</div>

        {step === 0 && (
          <>
            <h2 className="onboard-title">Let&apos;s set Orbit up for you</h2>
            <p className="muted" style={{ textAlign: 'left' }}>
              Orbit picks one topic a day, helps you write about it, and keeps your rings, medals and record.
              Tell it a little about you. Everything stays in your own account.
            </p>
            <div className="kicker" style={{ textAlign: 'left' }}>Your name</div>
            <input value={form.full_name} placeholder="Full name" onChange={e => set('full_name', e.target.value)} />
            <div className="kicker" style={{ textAlign: 'left' }}>Age</div>
            <input type="number" inputMode="numeric" value={form.age} placeholder="Optional"
              onChange={e => set('age', e.target.value)} />
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="onboard-title">How much time you have</h2>
            <p className="muted" style={{ textAlign: 'left' }}>These set your rings. You can change them any time.</p>
            <div className="kicker" style={{ textAlign: 'left' }}>Study minutes a day</div>
            <div className="seg">
              {[30, 60, 90, 120].map(m => (
                <button key={m} className={Number(form.daily_minutes) === m ? 'on' : ''} onClick={() => set('daily_minutes', m)}>{m}</button>
              ))}
            </div>
            <div className="kicker" style={{ textAlign: 'left' }}>Words per entry</div>
            <div className="seg">
              {[100, 150, 250, 400].map(w => (
                <button key={w} className={Number(form.word_goal) === w ? 'on' : ''} onClick={() => set('word_goal', w)}>{w}</button>
              ))}
            </div>
            <div className="kicker" style={{ textAlign: 'left' }}>Entries a week</div>
            <div className="seg">
              {[3, 5, 7].map(n => (
                <button key={n} className={Number(form.weekly_entry_goal) === n ? 'on' : ''} onClick={() => set('weekly_entry_goal', n)}>{n}</button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="onboard-title">Make it yours</h2>
            <div className="kicker" style={{ textAlign: 'left' }}>Theme</div>
            <div className="seg">
              {[['light', 'Light'], ['dark', 'Dark'], ['system', 'System']].map(([v, l]) => (
                <button key={v} className={form.theme === v ? 'on' : ''} onClick={() => { set('theme', v); applyTheme(v); }}>{l}</button>
              ))}
            </div>
            <div className="switchrow">
              <span>Sounds</span>
              <button className={`switch ${form.sound_on ? 'on' : ''}`} onClick={() => set('sound_on', !form.sound_on)} aria-label="Toggle sounds" />
            </div>
          </>
        )}

        {err && <p className="err" style={{ textAlign: 'left' }}>{err}</p>}

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn sm" onClick={() => finish(true)} disabled={busy}>Skip for now</button>
          <div className="row" style={{ marginTop: 0 }}>
            {step > 0 && <button className="btn" onClick={() => setStep(step - 1)} disabled={busy}>Back</button>}
            {last
              ? <button className="btn accent" onClick={() => finish(false)} disabled={busy}>{busy ? 'Saving' : 'Finish'}</button>
              : <button className="btn accent" onClick={() => setStep(step + 1)}>Next</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
