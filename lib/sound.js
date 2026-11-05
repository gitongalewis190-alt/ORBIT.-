// Every sound is synthesised with the Web Audio API. Nothing to download.
// Preferences are cached in localStorage so sound starts instantly on load.
const KEY_ON = 'orbit.sound';
const KEY_VOL = 'orbit.volume';

let ctx = null;
let master = null;

export function soundEnabled() {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(KEY_ON) !== 'off';
}

export function setSound(on) {
  if (typeof window !== 'undefined') localStorage.setItem(KEY_ON, on ? 'on' : 'off');
}

export function getVolume() {
  if (typeof window === 'undefined') return 0.7;
  const raw = localStorage.getItem(KEY_VOL);
  if (raw === null) return 0.7;
  const v = Number(raw);
  return Number.isFinite(v) ? v / 100 : 0.7;
}

export function setVolume(percent) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY_VOL, String(percent));
  if (master) master.gain.value = percent / 100;
}

function audio() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = getVolume();
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// One shaped tone: fast attack, exponential decay, optional pitch slide.
function tone({ freq, at = 0, dur = 0.12, type = 'sine', vol = 0.12, slideTo = null }) {
  const a = audio();
  if (!a) return;
  const start = a.currentTime + at;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.03);
}

// Each notes list is [freq, startSeconds, duration, volume].
function melody(notes, type = 'sine') {
  notes.forEach(([freq, at, dur, vol]) => tone({ freq, at, dur, vol, type }));
}

const SOUNDS = {
  tap: () => tone({ freq: 640, dur: 0.07, vol: 0.09, slideTo: 980 }),
  select: () => tone({ freq: 880, dur: 0.05, vol: 0.07, slideTo: 1100 }),
  toggle: () => melody([[520, 0, 0.05, 0.08], [780, 0.04, 0.07, 0.08]]),
  nav: () => tone({ freq: 480, dur: 0.06, vol: 0.06, slideTo: 620, type: 'triangle' }),
  open: () => tone({ freq: 300, dur: 0.18, vol: 0.06, slideTo: 720 }),
  close: () => tone({ freq: 720, dur: 0.14, vol: 0.05, slideTo: 300 }),
  save: () => melody([[659.25, 0, 0.09, 0.12], [987.77, 0.08, 0.16, 0.12]]),
  success: () => melody([[523.25, 0, 0.12, 0.12], [659.25, 0.09, 0.12, 0.12], [783.99, 0.18, 0.28, 0.12]]),
  error: () => {
    tone({ freq: 220, dur: 0.22, type: 'triangle', vol: 0.16, slideTo: 140 });
    tone({ freq: 180, at: 0.16, dur: 0.22, type: 'triangle', vol: 0.12, slideTo: 110 });
  },
  warn: () => melody([[392, 0, 0.12, 0.12], [311.13, 0.12, 0.2, 0.12]], 'triangle'),
  delete: () => tone({ freq: 260, dur: 0.3, type: 'sawtooth', vol: 0.05, slideTo: 90 }),
  reveal: () => tone({ freq: 220, dur: 0.45, type: 'sawtooth', vol: 0.035, slideTo: 880 }),
  tick: () => tone({ freq: 1500, dur: 0.025, type: 'square', vol: 0.025 }),
  land: () => melody([[392, 0, 0.09, 0.14], [587.33, 0.07, 0.22, 0.14]]),
  chime: () => melody([[880, 0, 0.1, 0.09], [1174.66, 0.08, 0.16, 0.09]]),
  badge: () => melody([
    [523.25, 0, 0.12, 0.13], [659.25, 0.1, 0.12, 0.13], [783.99, 0.2, 0.12, 0.13],
    [1046.5, 0.3, 0.35, 0.15], [1318.5, 0.36, 0.4, 0.1],
  ]),
  streak: () => melody([[392, 0, 0.1, 0.12], [493.88, 0.09, 0.1, 0.12], [587.33, 0.18, 0.1, 0.12], [783.99, 0.27, 0.3, 0.13]], 'triangle'),
  goal: () => melody([[783.99, 0, 0.08, 0.1], [987.77, 0.07, 0.2, 0.1]]),
  slide: () => tone({ freq: 700, dur: 0.02, type: 'square', vol: 0.02 }),
  trash: () => tone({ freq: 500, dur: 0.1, type: 'triangle', vol: 0.08, slideTo: 200 }),
  welcome: () => melody([[392, 0, 0.14, 0.11], [523.25, 0.12, 0.14, 0.11], [659.25, 0.24, 0.3, 0.12]]),
  bye: () => melody([[659.25, 0, 0.12, 0.1], [392, 0.12, 0.3, 0.1]]),
  // New in version 3.
  ringclose: () => melody([[523.25, 0, 0.1, 0.13], [783.99, 0.09, 0.1, 0.13], [1046.5, 0.18, 0.4, 0.14], [1568, 0.2, 0.3, 0.06]]),
  focusstart: () => melody([[330, 0, 0.08, 0.1], [495, 0.07, 0.14, 0.1]]),
  focusdone: () => melody([[659.25, 0, 0.14, 0.13], [880, 0.14, 0.14, 0.13], [1174.66, 0.28, 0.36, 0.13]]),
  freeze: () => melody([[1174.66, 0, 0.12, 0.08], [880, 0.1, 0.22, 0.08]], 'triangle'),
  toast: () => tone({ freq: 1046.5, dur: 0.1, vol: 0.06, slideTo: 1318.5 }),
  offline: () => melody([[440, 0, 0.12, 0.09], [330, 0.12, 0.22, 0.09]], 'triangle'),
  online: () => melody([[330, 0, 0.12, 0.09], [495, 0.12, 0.22, 0.09]], 'triangle'),
  export: () => melody([[587.33, 0, 0.08, 0.1], [740, 0.08, 0.08, 0.1], [880, 0.16, 0.2, 0.11]]),
  onboard: () => melody([[392, 0, 0.1, 0.1], [587.33, 0.1, 0.1, 0.1], [783.99, 0.2, 0.2, 0.11]]),
};

export function play(name) {
  if (!soundEnabled()) return;
  try {
    SOUNDS[name]?.();
  } catch {
    // Audio must never break the app.
  }
}

export const SOUND_NAMES = Object.keys(SOUNDS);
