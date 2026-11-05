
const KEY_ON = 'orbit.sound';
const KEY_VOL = 'orbit.volume';

let ctx = null;
let master = null;
let unlockListenersInstalled = false;

export function soundEnabled() {
  if (typeof window === 'undefined') return true;

  try {
    return localStorage.getItem(KEY_ON) !== 'off';
  } catch {
    return true;
  }
}

export function setSound(on) {
  if (typeof window === 'undefined') return;

  const enabled = on == null ? true : Boolean(on);

  try {
    localStorage.setItem(KEY_ON, enabled ? 'on' : 'off');
  } catch {}
}

export function getVolume() {
  if (typeof window === 'undefined') return 0.7;

  try {
    const raw = localStorage.getItem(KEY_VOL);
    if (raw === null) return 0.7;

    const value = Number(raw);

    return Number.isFinite(value)
      ? Math.max(0, Math.min(100, value)) / 100
      : 0.7;
  } catch {
    return 0.7;
  }
}

export function setVolume(percent) {
  if (typeof window === 'undefined') return;

  const parsed = percent == null ? 70 : Number(percent);

  const value = Number.isFinite(parsed)
    ? Math.max(0, Math.min(100, parsed))
    : 70;

  try {
    localStorage.setItem(KEY_VOL, String(value));
  } catch {}

  if (master && ctx) {
    master.gain.setTargetAtTime(
      value / 100,
      ctx.currentTime,
      0.015
    );
  }
}

function getAudioContext() {
  if (typeof window === 'undefined') return null;

  if (!ctx) {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return null;

    try {
      ctx = new AudioContextClass();
      master = ctx.createGain();
      master.gain.value = getVolume();
      master.connect(ctx.destination);
    } catch {
      ctx = null;
      master = null;
      return null;
    }
  }

  return ctx;
}

export function unlockAudio() {
  const audioContext = getAudioContext();

  if (!audioContext) return false;

  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }

  return audioContext.state === 'running';
}

export function installUnlockListeners() {
  if (typeof window === 'undefined' || unlockListenersInstalled) return;

  unlockListenersInstalled = true;

  const unlock = () => {
    unlockAudio();
  };

  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('touchend', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}

function audio() {
  const a = getAudioContext();

  if (!a) return null;

  if (a.state === 'suspended') {
    a.resume().catch(() => {});
  }

  return a;
}

function tone({
  freq,
  at = 0,
  dur = 0.12,
  type = 'sine',
  vol = 0.12,
  slideTo = null,
}) {
  const a = audio();

  if (!a || !master) return;

  const start = a.currentTime + at;

  try {
    const osc = a.createOscillator();
    const gain = a.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);

    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(
        slideTo,
        start + dur
      );
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      vol,
      start + 0.012
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + dur
    );

    osc.connect(gain).connect(master);

    osc.start(start);
    osc.stop(start + dur + 0.03);
  } catch {
    // Audio must never interrupt the app.
  }
}

function melody(notes, type = 'sine') {
  notes.forEach(([freq, at, dur, vol]) => {
    tone({ freq, at, dur, vol, type });
  });
}

const SOUNDS = {
  tap: () => tone({ freq: 680, dur: 0.045, vol: 0.045 }),
  select: () => tone({ freq: 520, dur: 0.065, vol: 0.06 }),
  toggle: () => melody([[440, 0, 0.07, 0.07], [660, 0.055, 0.08, 0.06]]),
  nav: () => tone({ freq: 580, dur: 0.075, vol: 0.055 }),
  open: () => melody([[420, 0, 0.09, 0.07], [620, 0.07, 0.12, 0.065]]),
  close: () => melody([[620, 0, 0.08, 0.06], [420, 0.055, 0.1, 0.055]]),
  save: () => melody([[520, 0, 0.08, 0.07], [780, 0.09, 0.12, 0.07]]),
  success: () => melody([[523, 0, 0.12, 0.08], [659, 0.12, 0.12, 0.08], [784, 0.24, 0.2, 0.09]]),
  error: () => melody([[330, 0, 0.12, 0.09], [247, 0.12, 0.16, 0.08]], 'triangle'),
  warn: () => melody([[440, 0, 0.1, 0.07], [392, 0.12, 0.1, 0.07]], 'triangle'),
  delete: () => melody([[600, 0, 0.08, 0.07], [360, 0.08, 0.13, 0.06]]),
  reveal: () => melody([[392, 0, 0.12, 0.06], [523, 0.1, 0.12, 0.07], [659, 0.2, 0.16, 0.07]]),
  tick: () => tone({ freq: 900, dur: 0.025, vol: 0.035 }),
  land: () => tone({ freq: 260, dur: 0.11, vol: 0.065, type: 'triangle', slideTo: 180 }),
  chime: () => melody([[784, 0, 0.22, 0.07], [988, 0.13, 0.25, 0.065], [1175, 0.28, 0.3, 0.06]]),
  badge: () => melody([[523, 0, 0.14, 0.08], [659, 0.12, 0.14, 0.08], [784, 0.24, 0.14, 0.08], [1047, 0.36, 0.3, 0.09]]),
  streak: () => melody([[440, 0, 0.1, 0.07], [554, 0.1, 0.1, 0.07], [659, 0.2, 0.1, 0.08], [880, 0.3, 0.25, 0.09]]),
  goal: () => melody([[392, 0, 0.12, 0.07], [523, 0.12, 0.12, 0.07], [659, 0.24, 0.2, 0.08]]),
  slide: () => tone({ freq: 500, dur: 0.08, vol: 0.04, slideTo: 720 }),
  trash: () => melody([[500, 0, 0.08, 0.06], [300, 0.08, 0.12, 0.055]]),
  welcome: () => melody([[392, 0, 0.15, 0.07], [523, 0.13, 0.15, 0.07], [659, 0.26, 0.15, 0.07], [784, 0.39, 0.25, 0.08]]),
  bye: () => melody([[784, 0, 0.13, 0.06], [659, 0.12, 0.13, 0.06], [523, 0.24, 0.2, 0.055]]),
  ringclose: () => melody([[523, 0, 0.1, 0.07], [659, 0.1, 0.1, 0.07], [784, 0.2, 0.2, 0.08]]),
  focusstart: () => melody([[392, 0, 0.15, 0.07], [587, 0.15, 0.2, 0.07]]),
  focusdone: () => melody([[523, 0, 0.12, 0.08], [659, 0.12, 0.12, 0.08], [784, 0.24, 0.12, 0.08], [1047, 0.36, 0.3, 0.09]]),
  freeze: () => tone({ freq: 330, dur: 0.2, vol: 0.06, type: 'triangle', slideTo: 220 }),
  toast: () => tone({ freq: 740, dur: 0.07, vol: 0.05 }),
  offline: () => melody([[440, 0, 0.1, 0.06], [330, 0.12, 0.16, 0.055]]),
  online: () => melody([[330, 0, 0.1, 0.06], [440, 0.12, 0.1, 0.06], [660, 0.24, 0.16, 0.07]]),
  export: () => melody([[523, 0, 0.1, 0.07], [659, 0.1, 0.1, 0.07], [880, 0.2, 0.2, 0.08]]),
  onboard: () => melody([[392, 0, 0.12, 0.06], [494, 0.12, 0.12, 0.06], [587, 0.24, 0.12, 0.07], [784, 0.36, 0.25, 0.08]]),
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
