
// ORBIT -- Sound Engine
// All sounds are synthesised using the Web Audio API.
// No external audio files or downloads required.
//
// Compatible with Safari and installed iOS Home Screen apps.
// Audio is unlocked through genuine user interaction.

const KEY_ON = 'orbit.sound';
const KEY_VOL = 'orbit.volume';

let ctx = null;
let master = null;
let unlockListenersInstalled = false;

// --------------------------------------------------
// USER PREFERENCES
// --------------------------------------------------

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

  try {
    localStorage.setItem(KEY_ON, on ? 'on' : 'off');
  } catch {}
}

export function getVolume() {
  if (typeof window === 'undefined') return 0.7;

  try {
    const raw = localStorage.getItem(KEY_VOL);

    if (raw === null) return 0.7;

    const value = Number(raw);

    if (!Number.isFinite(value)) return 0.7;

    return Math.max(0, Math.min(1, value / 100));
  } catch {
    return 0.7;
  }
}

export function setVolume(percent) {
  if (typeof window === 'undefined') return;

  const value = Math.max(0, Math.min(100, Number(percent) || 0));

  try {
    localStorage.setItem(KEY_VOL, String(value));
  } catch {}

  if (master && ctx) {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(value / 100, now, 0.015);
  }
}

// --------------------------------------------------
// AUDIO CONTEXT
// --------------------------------------------------

function getAudioContext() {
  if (typeof window === 'undefined') return null;

  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;

      if (!AC) return null;

      ctx = new AC();

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

// Explicitly unlock audio after a real user interaction.
// Call this directly from an interaction handler if needed.

export async function unlockAudio() {
  const audioContext = getAudioContext();

  if (!audioContext) return false;

  try {
    if (audioContext.state !== 'running') {
      await audioContext.resume();
    }

    return audioContext.state === 'running';
  } catch {
    return false;
  }
}

// Install interaction listeners once.
// These help iOS unlock audio when the user first interacts.

function installUnlockListeners() {
  if (typeof window === 'undefined') return;
  if (unlockListenersInstalled) return;

  unlockListenersInstalled = true;

  const unlock = () => {
    void unlockAudio();
  };

  window.addEventListener('pointerdown', unlock, {
    capture: true,
    passive: true,
  });

  window.addEventListener('touchend', unlock, {
    capture: true,
    passive: true,
  });

  window.addEventListener('keydown', unlock, {
    capture: true,
  });
}

installUnlockListeners();

function audio() {
  const audioContext = getAudioContext();

  if (!audioContext) return null;

  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch(() => {});
  }

  return audioContext;
}

// --------------------------------------------------
// SOUND SYNTHESIS
// --------------------------------------------------

// One shaped tone:
// Fast attack, exponential decay, optional pitch slide.

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

  try {
    const start = a.currentTime + at;

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

    osc.connect(gain);
    gain.connect(master);

    osc.start(start);
    osc.stop(start + dur + 0.03);

    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
    };
  } catch {
    // Sound failures must never interrupt the application.
  }
}

// Each note: [frequency, startSeconds, duration, volume].

function melody(notes, type = 'sine') {
  notes.forEach(([freq, at, dur, vol]) => {
    tone({ freq, at, dur, vol, type });
  });
}

// --------------------------------------------------
// SOUND LIBRARY
// Original ORBIT sound definitions preserved.
// --------------------------------------------------

const SOUNDS = {
  tap: () =>
    tone({ freq: 640, dur: 0.07, vol: 0.09, slideTo: 980 }),

  select: () =>
    tone({ freq: 880, dur: 0.05, vol: 0.07, slideTo: 1100 }),

  toggle: () =>
    melody([[520, 0, 0.05, 0.08], [780, 0.04, 0.07, 0.08]]),

  nav: () =>
    tone({
      freq: 480,
      dur: 0.06,
      vol: 0.06,
      slideTo: 620,
      type: 'triangle',
    }),

  open: () =>
    tone({ freq: 300, dur: 0.18, vol: 0.06, slideTo: 720 }),

  close: () =>
    tone({ freq: 720, dur: 0.14, vol: 0.05, slideTo: 300 }),

  save: () =>
    melody([[659.25, 0, 0.09, 0.12], [987.77, 0.08, 0.16, 0.12]]),

  success: () =>
    melody([
      [523.25, 0, 0.12, 0.12],
      [659.25, 0.09, 0.12, 0.12],
      [783.99, 0.18, 0.28, 0.12],
    ]),

  error: () => {
    tone({ freq: 220, dur: 0.22, type: 'triangle', vol: 0.16, slideTo: 140 });
    tone({ freq: 180, at: 0.16, dur: 0.22, type: 'triangle', vol: 0.12, slideTo: 110 });
  },

  warn: () =>
    melody([[392, 0, 0.12, 0.12], [311.13, 0.12, 0.2, 0.12]], 'triangle'),

  delete: () =>
    tone({ freq: 260, dur: 0.3, type: 'sawtooth', vol: 0.05, slideTo: 90 }),

  reveal: () =>
    tone({ freq: 220, dur: 0.45, type: 'sawtooth', vol: 0.035, slideTo: 880 }),

  tick: () =>
    tone({ freq: 1500, dur: 0.025, type: 'square', vol: 0.025 }),

  land: () =>
    melody([[392, 0, 0.09, 0.14], [587.33, 0.07, 0.22, 0.14]]),

  chime: () =>
    melody([[880, 0, 0.1, 0.09], [1174.66, 0.08, 0.16, 0.09]]),

  badge: () =>
    melody([
      [523.25, 0, 0.12, 0.13],
      [659.25, 0.1, 0.12, 0.13],
      [783.99, 0.2, 0.12, 0.13],
      [1046.5, 0.3, 0.35, 0.15],
      [1318.5, 0.36, 0.4, 0.1],
    ]),

  streak: () =>
    melody([
      [392, 0, 0.1, 0.12],
      [493.88, 0.09, 0.1, 0.12],
      [587.33, 0.18, 0.1, 0.12],
      [783.99, 0.27, 0.3, 0.13],
    ], 'triangle'),

  goal: () =>
    melody([[783.99, 0, 0.08, 0.1], [987.77, 0.07, 0.2, 0.1]]),

  slide: () =>
    tone({ freq: 700, dur: 0.02, type: 'square', vol: 0.02 }),

  trash: () =>
    tone({ freq: 500, dur: 0.1, type: 'triangle', vol: 0.08, slideTo: 200 }),

  welcome: () =>
    melody([
      [392, 0, 0.14, 0.11],
      [523.25, 0.12, 0.14, 0.11],
      [659.25, 0.24, 0.3, 0.12],
    ]),

  bye: () =>
    melody([[659.25, 0, 0.12, 0.1], [392, 0.12, 0.3, 0.1]]),

  // Version 3 sounds.

  ringclose: () =>
    melody([
      [523.25, 0, 0.1, 0.13],
      [783.99, 0.09, 0.1, 0.13],
      [1046.5, 0.18, 0.4, 0.14],
      [1568, 0.2, 0.3, 0.06],
    ]),

  focusstart: () =>
    melody([[330, 0, 0.08, 0.1], [495, 0.07, 0.14, 0.1]]),

  focusdone: () =>
    melody([
      [659.25, 0, 0.14, 0.13],
      [880, 0.14, 0.14, 0.13],
      [1174.66, 0.28, 0.36, 0.13],
    ]),

  freeze: () =>
    melody([[1174.66, 0, 0.12, 0.08], [880, 0.1, 0.22, 0.08]], 'triangle'),

  toast: () =>
    tone({ freq: 1046.5, dur: 0.1, vol: 0.06, slideTo: 1318.5 }),

  offline: () =>
    melody([[440, 0, 0.12, 0.09], [330, 0.12, 0.22, 0.09]], 'triangle'),

  online: () =>
    melody([[330, 0, 0.12, 0.09], [495, 0.12, 0.22, 0.09]], 'triangle'),

  export: () =>
    melody([
      [587.33, 0, 0.08, 0.1],
      [740, 0.08, 0.08, 0.1],
      [880, 0.16, 0.2, 0.11],
    ]),

  onboard: () =>
    melody([
      [392, 0, 0.1, 0.1],
      [587.33, 0.1, 0.1, 0.1],
      [783.99, 0.2, 0.2, 0.11],
    ]),
};

// --------------------------------------------------
// PUBLIC PLAYBACK API
// --------------------------------------------------

export function play(name) {
  if (!soundEnabled()) return;

  try {
    const effect = SOUNDS[name];

    if (typeof effect === 'function') {
      effect();
    }
  } catch {
    // Audio must never break the app.
  }
}

export const SOUND_NAMES = Object.keys(SOUNDS);
