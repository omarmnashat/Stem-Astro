/**
 * ExoLife – epic cinematic score, generated live with the Web Audio API
 * (no audio files, no licensing worries).
 *
 * Think "space-blockbuster trailer": a slow-building D-minor theme with
 *   • warm string / brass pads and a deep sub drone
 *   • a driving synth-pluck ostinato
 *   • taiko-style war drums, snare, hats and cymbal crashes
 *   • a heroic brass melody that returns bigger every time
 * The arrangement grows through sections (intro → build → full → climax) and then
 * loops forever, so it never feels like a short repeating clip.
 *
 * Browsers only allow audio after a click/tap, so `initMusic()` waits for the
 * first user gesture. Music can be toggled from the top bar.
 *
 * Public API (unchanged): initMusic, setMusicEnabled, setMusicLevel, setRumble, stopMusicTimers
 */

import { getAudio, resumeAudio, makeImpulse } from './audioEngine.js';

let enabled = true;
let ctx = null;
let master = null;
let rumble = null;
let started = false;
let schedulerTimer = null;
let held = false; // true = music paused on purpose (e.g. while the player is building)
let level = 1; // 0..1 duck level (lower inside the cockpit so engines are heard)

let dryBus = null;
let wetBus = null;
let noiseBuf = null;

const MASTER_GAIN = 0.42;
const BPM = 94;
const BEAT = 60 / BPM;
const STEP = BEAT / 4; // 16th note
const BAR_STEPS = 16;
const LOOKAHEAD = 1.4; // seconds scheduled ahead (bigger = safer when the 3D scene is busy)
const TICK_MS = 50;

/* ---------- Music theory helpers ---------- */
const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// One chord per bar, 8-bar cycle in D minor: Dm  Bb  F  C  |  Dm  Bb  Gm  A
const PROGRESSION = [
  { root: 38, tones: [50, 53, 57, 62, 65] }, // Dm
  { root: 34, tones: [46, 50, 53, 58, 62] }, // Bb
  { root: 41, tones: [48, 53, 57, 60, 65] }, // F
  { root: 36, tones: [48, 52, 55, 60, 64] }, // C
  { root: 38, tones: [50, 53, 57, 62, 65] }, // Dm
  { root: 34, tones: [46, 50, 53, 58, 62] }, // Bb
  { root: 43, tones: [50, 55, 58, 62, 67] }, // Gm
  { root: 33, tones: [49, 52, 57, 61, 64] }, // A (dominant, builds tension)
];

// Heroic brass theme: [midi note, start beat in bar, length in beats]
const THEME = [
  [[69, 0, 2], [74, 2, 2]],
  [[70, 0, 1.5], [72, 1.5, 0.5], [74, 2, 2]],
  [[77, 0, 2], [76, 2, 1], [74, 3, 1]],
  [[72, 0, 2], [67, 2, 2]],
  [[69, 0, 1], [74, 1, 1], [77, 2, 2]],
  [[77, 0, 1.5], [74, 1.5, 0.5], [82, 2, 2]],
  [[74, 0, 2], [72, 2, 1], [70, 3, 1]],
  [[73, 0, 3], [69, 3, 1]],
];

// Section order, each 8 bars: 0 intro · 1 build · 2 full · 3 climax
const SECTIONS = [0, 1, 2, 3, 1, 2, 3, 3];

// Arpeggio pattern (index into the chord tones) for the 16th-note pluck ostinato
const PLUCK = [0, 2, 3, 2, 1, 3, 4, 3, 0, 2, 3, 2, 1, 3, 4, 3];

/* ---------- Audio plumbing ---------- */
function getCtx() {
  if (ctx) return ctx;
  const a = getAudio();
  ctx = a ? a.ctx : null;
  return ctx;
}

function makeReverb(c, seconds = 2.0, decay = 2.4) {
  const conv = c.createConvolver();
  conv.buffer = makeImpulse(c, seconds, decay);
  return conv;
}

function makeNoise(c, seconds = 2) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** Send a node to the dry bus and (optionally) to the reverb. */
function route(node, wet = 0.3) {
  node.connect(dryBus);
  if (wet > 0) {
    const s = ctx.createGain();
    s.gain.value = wet;
    node.connect(s);
    s.connect(wetBus);
  }
}

/** Two slightly detuned oscillators → low-pass → ADSR-ish gain → buses. */
function voice({ freq, t, dur, type = 'sawtooth', gain = 0.1, attack = 0.02, release = 0.2, cut = 2400, cutTo, detune = 7, wet = 0.3 }) {
  const c = ctx;
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 0.7;
  f.frequency.setValueAtTime(cut, t);
  if (cutTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, cutTo), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.setValueAtTime(gain, t + Math.max(attack, dur - release));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
  (detune ? [-detune, detune] : [0]).forEach((d) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = d;
    o.connect(f);
    o.start(t);
    o.stop(t + dur + release + 0.05);
  });
  f.connect(g);
  route(g, wet);
}

function noiseHit({ t, dur = 0.2, type = 'highpass', freq = 6000, gain = 0.1, to, q = 0.7, wet = 0.15 }) {
  const c = ctx;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g);
  route(g, wet);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.05);
}

/* ---------- Instruments ---------- */
function taiko(t, power = 1) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(62, t + 0.3);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.85 * power, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  o.connect(g);
  route(g, 0.35);
  o.start(t);
  o.stop(t + 0.75);
  noiseHit({ t, dur: 0.12, type: 'lowpass', freq: 900, to: 200, gain: 0.35 * power, wet: 0.3 });
}

function snare(t, power = 1) {
  noiseHit({ t, dur: 0.22, type: 'bandpass', freq: 1900, gain: 0.3 * power, q: 0.9, wet: 0.35 });
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(140, t + 0.1);
  g.gain.setValueAtTime(0.25 * power, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
  o.connect(g);
  route(g, 0.2);
  o.start(t);
  o.stop(t + 0.15);
}

const hat = (t, accent = false) => noiseHit({ t, dur: accent ? 0.09 : 0.045, type: 'highpass', freq: 8500, gain: accent ? 0.1 : 0.055, wet: 0.08 });
const crash = (t) => noiseHit({ t, dur: 3.2, type: 'highpass', freq: 4200, to: 2500, gain: 0.22, wet: 0.5 });

function riser(t, dur) {
  // gain ramps UP for a riser (noiseHit decays), so build it by hand
  const c = ctx;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.4;
  f.frequency.setValueAtTime(500, t);
  f.frequency.exponentialRampToValueAtTime(8000, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + dur);
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.06);
  src.connect(f).connect(g);
  route(g, 0.4);
  src.start(t);
  src.stop(t + dur + 0.1);
}

function brass(t, freq, dur, gain) {
  voice({ freq, t, dur, type: 'sawtooth', gain, attack: 0.09, release: 0.28, cut: 500, cutTo: 3200, detune: 9, wet: 0.45 });
  voice({ freq: freq * 2, t, dur, type: 'square', gain: gain * 0.22, attack: 0.1, release: 0.25, cut: 900, cutTo: 2600, detune: 5, wet: 0.45 });
}

/* ---------- Arrangement ---------- */
let bar = 0;
let step = 0;
let nextTime = 0;

function scheduleBar(b, t0) {
  const chord = PROGRESSION[b % PROGRESSION.length];
  const section = SECTIONS[Math.floor(b / 8) % SECTIONS.length];
  const barLen = BEAT * 4;
  const barInSection = b % 8;
  const lastBar = barInSection === 7;

  // Pad (strings) + sub drone – always present
  chord.tones.forEach((m, i) => {
    voice({ freq: midiToHz(m), t: t0, dur: barLen - 0.05, type: 'sawtooth', gain: (section === 0 ? 0.03 : 0.04) - i * 0.003, attack: 0.9, release: 1.2, cut: 700 + section * 380, detune: 8, wet: 0.5 });
  });
  // Bass: kept at/above ~55 Hz. Below that, laptop/phone speakers can't play it – they rattle
  // and buzz instead, and each chord change makes the 27-46 Hz notes beat against each other.
  voice({ freq: midiToHz(chord.root), t: t0, dur: barLen, type: 'triangle', gain: 0.1, attack: 0.05, release: 0.4, cut: 500, detune: 0, wet: 0.05 });

  // Heroic brass melody
  if (section >= 2) {
    const g = section === 3 ? 0.085 : 0.07;
    THEME[b % 8].forEach(([m, beat, len]) => {
      brass(t0 + beat * BEAT, midiToHz(m), len * BEAT, g);
      if (section === 3) brass(t0 + beat * BEAT, midiToHz(m - 12), len * BEAT, g * 0.8);
    });
  }

  // Big hits at the start of a loud section
  if (barInSection === 0 && section >= 2) crash(t0);
  if (barInSection === 0 && section === 1) taiko(t0, 1.2);
  if (lastBar) riser(t0 + BEAT * 2, BEAT * 2);

}

/**
 * One 16th-note step. Scheduled step by step (not a whole bar at once) so the main thread
 * never has to create 100+ audio nodes in a single burst – that burst was the periodic
 * freeze every ~2.5 s while the 3D scene was running.
 */
function scheduleStep(b, s, t) {
  const chord = PROGRESSION[b % PROGRESSION.length];
  const section = SECTIONS[Math.floor(b / 8) % SECTIONS.length];
  const barInSection = b % 8;
  const lastBar = barInSection === 7;
  {
    if (section >= 1) {
      const on8th = s % 2 === 0;
      if (section === 1 ? on8th : true) {
        const m = chord.tones[PLUCK[s] % chord.tones.length] + 12;
        // single oscillator (was a detuned pair) – half the nodes for the busiest layer
        voice({ freq: midiToHz(m), t, dur: STEP * 0.8, type: 'sawtooth', gain: section === 1 ? 0.04 : 0.05, attack: 0.004, release: 0.1, cut: 3800, cutTo: 500, detune: 0, wet: 0.25 });
      }
    }

    // Drums
    if (section === 0) {
      if (s === 0 && b % 2 === 0) taiko(t, 0.8);
    } else if (section === 1) {
      if (s === 0 || s === 8) taiko(t, 1);
      if (s % 4 === 2) hat(t);
    } else {
      if (s === 0 || s === 8 || (section === 3 && (s === 6 || s === 10 || s === 14))) taiko(t, section === 3 ? 1.15 : 1);
      if (s === 4 || s === 12) snare(t, section === 3 ? 1.1 : 0.9);
      if (s % 2 === 0) hat(t, s % 4 === 0);
      if (section === 3 && s % 4 === 3) hat(t, true);
    }
    // Drum fill on the last beat of a section
    if (lastBar && section >= 1 && s >= 12) snare(t, 0.55 + (s - 12) * 0.12);
  }
}

let tickWorker = null;
function startTicker() {
  if (tickWorker || typeof Worker === 'undefined') return false;
  try {
    const url = URL.createObjectURL(
      new Blob([`let t=null;onmessage=(e)=>{clearInterval(t);if(e.data>0)t=setInterval(()=>postMessage(0),e.data);};`], { type: 'text/javascript' }),
    );
    tickWorker = new Worker(url);
    tickWorker.onmessage = () => scheduler();
    tickWorker.postMessage(TICK_MS);
    return true;
  } catch {
    tickWorker = null;
    return false;
  }
}

function scheduler() {
  if (!ctx) return;
  if (held) {
    // paused on purpose: schedule nothing, keep the clock moving
    if (ctx) nextTime = ctx.currentTime + 0.1;
  } else if (enabled && ctx.state === 'running') {
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      // If the tab was in the background (timers throttled) we may be late. Never schedule
      // notes in the past – they would all fire at once as a loud burst. Skip that bar.
      const fresh = nextTime >= ctx.currentTime - 0.4; // tolerate jank; only drop truly stale steps
      if (fresh) {
        if (step === 0) scheduleBar(bar, nextTime);
        scheduleStep(bar, step, nextTime);
      }
      step += 1;
      nextTime += STEP;
      if (step >= BAR_STEPS) {
        step = 0;
        bar += 1;
      }
    }
  } else if (nextTime < ctx.currentTime) {
    // paused / muted: don't build a backlog of notes
    nextTime = ctx.currentTime + 0.1;
  }
  if (!tickWorker) schedulerTimer = setTimeout(scheduler, TICK_MS);
}

function buildGraph(c) {
  master = c.createGain();
  master.gain.value = 0.0001;
  // gentle "glue" compressor – slow, so drums don't make the pads pump up and down
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 12;
  comp.ratio.value = 2.5;
  comp.attack.value = 0.02;
  comp.release.value = 0.35;
  master.connect(comp).connect(getAudio().music);

  const reverb = makeReverb(c);
  const wetGain = c.createGain();
  wetGain.gain.value = 0.7;
  reverb.connect(wetGain).connect(master);
  wetBus = reverb;
  dryBus = c.createGain();
  dryBus.gain.value = 0.9;
  dryBus.connect(master);

  noiseBuf = makeNoise(c);

  // Engine rumble (silent until setRumble > 0)
  const n = c.createBufferSource();
  n.buffer = noiseBuf;
  n.loop = true;
  const nf = c.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 220;
  const ng = c.createGain();
  ng.gain.value = 0;
  n.connect(nf).connect(ng).connect(getAudio().ambient);
  n.start();
  rumble = { gain: ng, filter: nf };

  bar = 0;
  step = 0;
  nextTime = c.currentTime + 0.15;
  startTicker();
  scheduler();
}

function applyGain() {
  if (!ctx || !master) return;
  const target = enabled && !held ? MASTER_GAIN * level : 0.0001;
  master.gain.setTargetAtTime(target, ctx.currentTime, held ? 0.2 : 0.8);
}

function startNow() {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') resumeAudio();
  if (!started) {
    try {
      buildGraph(c);
      started = true;
    } catch {
      return;
    }
  }
  applyGain();
}

if (typeof document !== 'undefined') {
  const revive = () => {
    if (started && enabled && ctx && ctx.state !== 'running') resumeAudio();
  };
  document.addEventListener('visibilitychange', revive);
  window.addEventListener('pointerdown', revive, { passive: true });
  window.addEventListener('focus', revive);
}

/** Call once. Starts the music on the player's first click / key / touch. */
export function initMusic() {
  if (typeof window === 'undefined') return;
  const go = () => {
    if (enabled) startNow();
    window.removeEventListener('pointerdown', go);
    window.removeEventListener('keydown', go);
  };
  window.addEventListener('pointerdown', go);
  window.addEventListener('keydown', go);
}

/** Pause / resume the soundtrack (used while building). Resumes cleanly at the next bar. */
export function setMusicHold(value) {
  const next = Boolean(value);
  if (next === held) return;
  held = next;
  if (!held && step !== 0) {
    step = 0;
    bar += 1;
  }
  applyGain();
}

export function setMusicEnabled(value) {
  enabled = Boolean(value);
  if (enabled && ctx) startNow();
  applyGain();
}

/** 0..1 – lowers the music (e.g. 0.5 inside the cockpit). */
export function setMusicLevel(v) {
  level = Math.max(0, Math.min(1, v));
  applyGain();
}

/** 0..1 engine rumble inside the shuttle. */
export function setRumble(v) {
  if (!ctx || !rumble) return;
  const amount = enabled ? Math.max(0, Math.min(1, v)) : 0;
  rumble.gain.gain.setTargetAtTime(amount * 0.28, ctx.currentTime, 0.2);
  rumble.filter.frequency.setTargetAtTime(160 + amount * 500, ctx.currentTime, 0.3);
}

export function stopMusicTimers() {
  if (schedulerTimer) clearTimeout(schedulerTimer);
  schedulerTimer = null;
  if (tickWorker) tickWorker.terminate();
  tickWorker = null;
}
