'use client';
import { useEffect, useState } from 'react';
import { getProfile, saveProfile } from '../lib/profile';
import { play } from '../lib/sound';
import { toast } from '../lib/toast';

const FIELDS = ['full_name', 'date_of_birth', 'location', 'school_or_work', 'learning_goal', 'bio'];

// Personal details that appear in your PDF record. Every field is optional.
export default function ProfileDetails({ uid }) {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid) return;
    getProfile(uid).then(p => {
      const f = Object.fromEntries(FIELDS.map(k => [k, p[k] ?? '']));
      setForm(f);
      setSaved(f);
    }).catch(() => {});
  }, [uid]);

  if (!form) return null;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  async function save() {
    if (form.date_of_birth) {
      const d = new Date(form.date_of_birth);
      if (Number.isNaN(d.getTime()) || d > new Date()) {
        play('error');
        return toast('Enter a real date of birth in the past.', 'err');
      }
    }
    setBusy(true);
    try {
      const patch = Object.fromEntries(FIELDS.map(k => [k, (form[k] ?? '').toString().trim() || null]));
      await saveProfile(uid, patch);
      setSaved(form);
      play('save');
      toast('Personal details saved.', 'ok');
    } catch (e) {
      play('error');
      toast(e.message, 'err', 5000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2>Personal details</h2>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>These appear on your printed record. Only you can see them.</p>

        <div className="kicker">Full name</div>
        <input value={form.full_name} placeholder="As you would like it printed" onChange={e => set('full_name', e.target.value)} />

        <div className="kicker">Date of birth</div>
        <input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />

        <div className="kicker">Location</div>
        <input value={form.location} placeholder="City and country" onChange={e => set('location', e.target.value)} />

        <div className="kicker">School or work</div>
        <input value={form.school_or_work} placeholder="School, university, or employer" onChange={e => set('school_or_work', e.target.value)} />

        <div className="kicker">Learning goal</div>
        <textarea style={{ minHeight: 70 }} value={form.learning_goal}
          placeholder="What are you working towards?" onChange={e => set('learning_goal', e.target.value)} />

        <div className="kicker">About me</div>
        <textarea style={{ minHeight: 70 }} value={form.bio}
          placeholder="A few lines about you" onChange={e => set('bio', e.target.value)} />

        <div className="row">
          <button className="btn accent" onClick={save} disabled={busy || !dirty}>
            {busy ? 'Saving' : dirty ? 'Save details' : 'Saved'}
          </button>
        </div>
      </div>
    </>
  );
}
