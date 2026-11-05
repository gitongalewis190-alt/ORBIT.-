// Every sound is synthesised in the browser with the Web Audio API.
// No audio files to host, and nothing to download on an iPhone.
const KEY = 'orbit.sound';
let ctx = null;

export function soundEnabled() {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(KEY) !== 'off';
}

export function setSound(on) {
  localStorage.setItem(KEY, on ? 'on' : 'off');
}

function audio() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// One shaped tone: quick attack, exponential decay, optional pitch slide.
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
  osc.connect(gain).connect(a.destination);
  osc.start(start);
  osc.stop(start + dur + 0.03);
}

const SOUNDS = {
  // Every tap.
  pop: () => tone({ freq: 640, dur: 0.07, vol: 0.09, slideTo: 980 }),
  // Each step of the selection reveal.
  tick: () => tone({ freq: 1500, dur: 0.025, type: 'square', vol: 0.025 }),
  // Start of the selection reveal.
  whoosh: () => tone({ freq: 220, dur: 0.45, type: 'sawtooth', vol: 0.035, slideTo: 880 }),
  // Topic landed.
  land: () => {
    tone({ freq: 392, dur: 0.09, vol: 0.14 });
    tone({ freq: 587.33, at: 0.07, dur: 0.22, vol: 0.14 });
  },
  // Accepted, saved, or completed.
  success: () => {
    tone({ freq: 523.25, dur: 0.12, vol: 0.12 });
    tone({ freq: 659.25, at: 0.09, dur: 0.12, vol: 0.12 });
    tone({ freq: 783.99, at: 0.18, dur: 0.28, vol: 0.12 });
  },
  // Something failed.
  error: () => {
    tone({ freq: 220, dur: 0.22, type: 'triangle', vol: 0.16, slideTo: 140 });
    tone({ freq: 180, at: 0.16, dur: 0.22, type: 'triangle', vol: 0.12, slideTo: 110 });
  },
  // Re-learn queued, or a topic changed.
  chime: () => {
    tone({ freq: 880, dur: 0.1, vol: 0.09 });
    tone({ freq: 1174.66, at: 0.08, dur: 0.16, vol: 0.09 });
  },
};

export function play(name) {
  if (!soundEnabled()) return;
  try {
    SOUNDS[name]?.();
  } catch {
    // Audio must never break the app.
  }
}
