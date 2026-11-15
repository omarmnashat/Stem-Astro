/**
 * Sound effects for ExoLife, made live with the Web Audio API – no audio files needed.
 *
 * Every sound is built from a few oscillators + filtered noise so it has the feel of a
 * sci-fi cockpit / space-station UI: crisp clicks, rocket whooshes, shimmering rewards.
 * Sounds only start after the player clicks something (browser rule) and can be muted in
 * the top bar.
 *
 *   playSound('jump')                       – names are listed in SOUNDS below
 *   playSound('rocket', { duration: 2.4 })  – some sounds accept options
 *   initUiSounds()                          – soft tick on every button / link
 */

import { getAudio, resumeAudio, duckMusic, makeImpulse } from './audioEngine.js';

let enabled = true;
let ctx = null;
let out = null; // sfx bus on the shared engine (limiter + music ducking live there)
let verb = null; // little reverb send for sparkle
let noiseBuf = null;

// Minimum gap (ms) between two plays of the same sound – stops rapid repeats stacking into a buzz.
const MIN_GAP = { tick: 45, hover: 70, click: 50, footstep: 110, switch: 60, land: 120 };
const DEFAULT_GAP = 45;
// How much the music dips under each sound (1 = not at all). Light UI sounds don't duck it.
const DUCK = {
  tick: 1, hover: 1, footstep: 1, click: 0.9, switch: 0.85, action: 0.8, coin: 0.8, day: 0.8,
};
const lastPlayed = {};
const recent = []; // timestamps of recent plays, for a global polyphony cap

export function setSoundEnabled(value) {
  enabled = Boolean(value);
}

function getContext() {
  if (ctx) return ctx;
  const a = getAudio();
  if (!a) return null;
  try {
    ctx = a.ctx;
    out = a.sfx;

    // short, bright reverb tail
    verb = ctx.createConvolver();
    verb.buffer = makeImpulse(ctx, 1.0, 2.6);
    const vg = ctx.createGain();
    vg.gain.value = 0.45;
    verb.connect(vg).connect(out);

    const nl = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, nl, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nl; i += 1) nd[i] = Math.random() * 2 - 1;
  } catch {
    ctx = null;
  }
  return ctx;
}

/* ---------- building blocks ---------- */

/** A shaped oscillator note. `to` glides the pitch, `rev` sends to the reverb. */
function tone(c, { freq, to, start = 0, dur = 0.12, type = 'sine', gain = 0.08, attack = 0.012, rev = 0 }) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  const t0 = c.currentTime + start;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(out);
  if (rev) {
    const r = c.createGain();
    r.gain.value = rev;
    g.connect(r).connect(verb);
  }
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** A burst of filtered noise (whooshes, thuds, clicks). */
function noise(c, { start = 0, dur = 0.2, filter = 'bandpass', freq = 1200, to, q = 0.8, gain = 0.08, attack = 0.01, rev = 0 }) {
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  const t0 = c.currentTime + start;
  f.frequency.setValueAtTime(freq, t0);
  if (to) f.frequency.exponentialRampToValueAtTime(Math.max(30, to), t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g);
  g.connect(out);
  if (rev) {
    const r = c.createGain();
    r.gain.value = rev;
    g.connect(r).connect(verb);
  }
  src.start(t0, Math.random() * 1.5);
  src.stop(t0 + dur + 0.05);
}

/** Rising / falling arpeggio of sparkly notes. */
function arp(c, notes, { step = 0.07, start = 0, dur = 0.35, type = 'triangle', gain = 0.06, rev = 0.5 } = {}) {
  notes.forEach((freq, i) => tone(c, { freq, start: start + i * step, dur, type, gain, rev }));
}

/* ---------- the sound library ----------
 * All melodic sounds use notes from D-minor pentatonic (D F G A C) – the same key as the
 * soundtrack – so a sound effect can never play a "wrong" note against the music. Percussive
 * sounds are unpitched noise for the same reason (a pitched thud near a bass note beats/buzzes). */
const SOUNDS = {
  // UI
  click: (c) => {
    tone(c, { freq: 880, to: 587.33, dur: 0.07, type: 'triangle', gain: 0.07 });
    noise(c, { dur: 0.03, filter: 'highpass', freq: 5000, gain: 0.03 });
  },
  tick: (c) => tone(c, { freq: 1500, to: 1200, dur: 0.035, type: 'sine', gain: 0.025 }),
  hover: (c) => tone(c, { freq: 1174.66, dur: 0.04, type: 'sine', gain: 0.015 }),
  switch: (c) => {
    tone(c, { freq: 261.63, to: 146.83, dur: 0.06, type: 'square', gain: 0.035 });
    tone(c, { freq: 146.83, to: 110, start: 0.06, dur: 0.08, type: 'square', gain: 0.035 });
  },
  panel: (c) => {
    noise(c, { dur: 0.35, freq: 500, to: 3500, q: 1.2, gain: 0.06, attack: 0.08, rev: 0.3 });
    tone(c, { freq: 440, to: 880, dur: 0.25, type: 'sine', gain: 0.045, rev: 0.4 });
  },
  error: (c) => {
    tone(c, { freq: 200, to: 140, dur: 0.18, type: 'sawtooth', gain: 0.07 });
    tone(c, { freq: 190, to: 120, start: 0.12, dur: 0.22, type: 'sawtooth', gain: 0.07 });
  },

  // Movement
  jump: (c) => {
    tone(c, { freq: 220, to: 620, dur: 0.18, type: 'square', gain: 0.045 });
    tone(c, { freq: 440, to: 1100, dur: 0.2, type: 'sine', gain: 0.05, rev: 0.3 });
    noise(c, { dur: 0.14, freq: 1500, to: 4000, gain: 0.035 });
  },
  land: (c) => {
    tone(c, { freq: 160, to: 75, dur: 0.18, type: 'sine', gain: 0.14 });
    noise(c, { dur: 0.12, filter: 'lowpass', freq: 900, to: 200, gain: 0.12 });
  },
  footstep: (c) => {
    noise(c, { dur: 0.07, filter: 'lowpass', freq: 700, to: 250, gain: 0.07 });
  },

  // Rockets & ship
  ignite: (c) => {
    noise(c, { dur: 1.1, filter: 'lowpass', freq: 500, to: 1800, gain: 0.14, attack: 0.3 });
    tone(c, { freq: 90, to: 140, dur: 1.1, type: 'sawtooth', gain: 0.05, attack: 0.3 });
  },
  rocket: (c, o) => {
    const d = o.duration || 2;
    noise(c, { dur: d, filter: 'lowpass', freq: 300, to: 2600, gain: 0.16, attack: d * 0.25, rev: 0.25 });
    noise(c, { dur: d, filter: 'bandpass', freq: 800, to: 5000, q: 0.6, gain: 0.05, attack: d * 0.3 });
    tone(c, { freq: 90, to: 150, dur: d, type: 'sawtooth', gain: 0.05, attack: d * 0.25 });
  },
  whoosh: (c) => noise(c, { dur: 0.6, freq: 400, to: 4200, q: 0.9, gain: 0.09, attack: 0.2, rev: 0.3 }),
  zoom: (c) => {
    noise(c, { dur: 0.9, freq: 3800, to: 300, q: 0.9, gain: 0.08, attack: 0.1, rev: 0.4 });
    tone(c, { freq: 150, to: 900, dur: 0.9, type: 'sine', gain: 0.05, rev: 0.5 });
  },
  arrive: (c) => {
    tone(c, { freq: 600, to: 200, dur: 0.5, type: 'sine', gain: 0.07, rev: 0.5 });
    arp(c, [523.25, 783.99, 1046.5], { step: 0.08, dur: 0.5, gain: 0.045 });
  },

  // Game feedback
  action: (c) => arp(c, [440, 587.33], { step: 0.07, dur: 0.15, type: 'sine', gain: 0.06, rev: 0.2 }),
  build: (c) => {
    noise(c, { dur: 0.16, filter: 'lowpass', freq: 600, to: 150, gain: 0.12 }); // unpitched thud
    noise(c, { dur: 0.1, filter: 'bandpass', freq: 2500, gain: 0.06 });
    arp(c, [392, 523.25, 783.99], { step: 0.07, start: 0.1, dur: 0.3, gain: 0.05 });
  },
  eat: (c) => {
    [0, 0.11, 0.22].forEach((s) => noise(c, { start: s, dur: 0.07, filter: 'bandpass', freq: 1800, q: 1.5, gain: 0.06 }));
    tone(c, { freq: 500, to: 700, start: 0.3, dur: 0.12, type: 'sine', gain: 0.04 });
  },
  heal: (c) => arp(c, [523.25, 698.46, 880, 1046.5], { step: 0.08, dur: 0.5, type: 'sine', gain: 0.05 }),
  coin: (c) => {
    tone(c, { freq: 880, dur: 0.08, type: 'square', gain: 0.04 });
    tone(c, { freq: 1174.66, start: 0.07, dur: 0.3, type: 'square', gain: 0.04, rev: 0.3 });
  },
  success: (c) => arp(c, [587.33, 698.46, 880, 1174.66, 1396.91], { step: 0.09, dur: 0.6, gain: 0.06 }),
  discover: (c) => {
    arp(c, [392, 523.25, 587.33, 698.46, 880, 1046.5], { step: 0.07, dur: 0.8, type: 'sine', gain: 0.06, rev: 0.7 });
    tone(c, { freq: 220, dur: 1.0, type: 'sine', gain: 0.06, attack: 0.1 });
  },
  warning: (c) => {
    tone(c, { freq: 349.23, dur: 0.15, type: 'triangle', gain: 0.07 });
    tone(c, { freq: 349.23, start: 0.22, dur: 0.15, type: 'triangle', gain: 0.07 });
  },
  alert: (c) => {
    tone(c, { freq: 587.33, dur: 0.12, type: 'square', gain: 0.035 });
    tone(c, { freq: 440, start: 0.14, dur: 0.14, type: 'square', gain: 0.035 });
  },
  day: (c) => arp(c, [392, 523.25], { step: 0.12, dur: 0.3, type: 'sine', gain: 0.06, rev: 0.4 }),
  end: (c) => {
    tone(c, { freq: 392, dur: 0.3, type: 'triangle', gain: 0.06, rev: 0.4 });
    tone(c, { freq: 349.23, start: 0.25, dur: 0.3, type: 'triangle', gain: 0.06, rev: 0.4 });
    tone(c, { freq: 293.66, start: 0.5, dur: 0.6, type: 'triangle', gain: 0.06, rev: 0.5 });
  },
};

export function playSound(name, opts = {}) {
  if (!enabled) return;
  const c = getContext();
  if (!c) return;
  const now = performance.now();
  // Per-sound rate limit
  if (now - (lastPlayed[name] || 0) < (MIN_GAP[name] || DEFAULT_GAP)) return;
  // Global cap: never more than 8 sounds in 100 ms (that is what piles up into a buzz)
  while (recent.length && now - recent[0] > 100) recent.shift();
  if (recent.length >= 8) return;
  lastPlayed[name] = now;
  recent.push(now);
  try {
    if (c.state === 'suspended') resumeAudio();
    (SOUNDS[name] || SOUNDS.click)(c, opts);
    duckMusic(DUCK[name] ?? 0.6, name === 'rocket' ? (opts.duration || 2) * 0.6 : 0.22);
  } catch {
    /* sound is optional – ignore any audio errors */
  }
}

let uiBound = false;
/** Soft tick on every button / link. Add `data-nosound` to an element to skip it. */
export function initUiSounds() {
  if (uiBound || typeof document === 'undefined') return;
  uiBound = true;
  document.addEventListener(
    'click',
    (e) => {
      const el = e.target instanceof Element ? e.target.closest('button, a, [role="tab"], [role="button"]') : null;
      if (!el || el.closest('[data-nosound]') || el.disabled) return;
      playSound('tick');
    },
    true,
  );
}
