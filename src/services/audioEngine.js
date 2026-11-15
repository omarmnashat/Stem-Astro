/**
 * One shared Web Audio engine for the whole game.
 *
 * Why this exists: music, sound effects and the planet ambience used to each create their
 * own AudioContext and plug straight into the speakers. Nothing limited the SUM of them, so
 * when several sounds overlapped the output clipped (a harsh buzz) and low notes that were
 * almost the same pitch beat against each other (a wobbling hum).
 *
 * Now everything goes through one graph:
 *
 *   music  ─► musicDuck ──────────┐
 *   sfx    ─► high-pass ─► low-pass ┼─► mix ─► limiter ─► soft clip ─► out
 *   ambient ─────────────────────┘
 *
 *  • musicDuck : the music dips for a moment whenever a real sound effect plays, so the
 *                two never fight over the same frequencies.
 *  • high-pass : removes inaudible sub-bass rumble that only eats headroom.
 *  • limiter   : fast compressor that catches peaks before they reach the speakers.
 *  • soft clip : last safety net – can never hard-clip (that is what sounds like a buzz).
 */

let ctx = null;
let nodes = null;
let bedLevel = 1; // music level while ambience is running (1 = no extra dip)

function softClipCurve() {
  const n = 2048;
  const curve = new Float32Array(n);
  const knee = 0.7;
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a < knee ? a : knee + (1 - knee) * Math.tanh((a - knee) / (1 - knee));
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

/** Shared AudioContext + buses, or null when Web Audio isn't available. */
export function getAudio() {
  if (nodes) return nodes;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    try {
      ctx = new AC({ latencyHint: 'balanced' });
    } catch {
      ctx = new AC();
    }

    // ----- output chain -----
    const mix = ctx.createGain();
    mix.gain.value = 1;

    const hp = ctx.createBiquadFilter(); // drop DC / sub-sonic energy
    hp.type = 'highpass';
    hp.frequency.value = 45;
    hp.Q.value = 0.5;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -7;
    limiter.knee.value = 5;
    limiter.ratio.value = 14;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.16;

    const clip = ctx.createWaveShaper();
    clip.curve = softClipCurve();
    clip.oversample = '2x';

    const final = ctx.createGain();
    final.gain.value = 0.85;

    mix.connect(hp).connect(limiter).connect(clip).connect(final).connect(ctx.destination);

    // ----- buses -----
    const musicDuck = ctx.createGain();
    musicDuck.gain.value = bedLevel;
    musicDuck.connect(mix);

    const sfx = ctx.createGain();
    sfx.gain.value = 1;
    const sfxHp = ctx.createBiquadFilter(); // thuds below ~70 Hz just muddy the music
    sfxHp.type = 'highpass';
    sfxHp.frequency.value = 80;
    sfxHp.Q.value = 0.6;
    const sfxLp = ctx.createBiquadFilter(); // tame harsh square/saw fizz
    sfxLp.type = 'lowpass';
    sfxLp.frequency.value = 11000;
    sfxLp.Q.value = 0.5;
    sfx.connect(sfxHp).connect(sfxLp).connect(mix);

    const ambient = ctx.createGain();
    ambient.gain.value = 1;
    ambient.connect(mix);

    nodes = { ctx, music: musicDuck, musicDuck, sfx, ambient };
  } catch {
    ctx = null;
    nodes = null;
  }
  return nodes;
}

export function resumeAudio() {
  const a = getAudio();
  if (a && a.ctx.state === 'suspended') a.ctx.resume().catch(() => {});
  return a;
}

/** Dip the music briefly so a sound effect cuts through cleanly. */
export function duckMusic(depth = 0.6, hold = 0.2) {
  if (!nodes) return;
  const p = nodes.musicDuck.gain;
  const t = ctx.currentTime;
  p.cancelScheduledValues(t);
  p.setValueAtTime(p.value, t);
  p.setTargetAtTime(bedLevel * depth, t, 0.02);
  p.setTargetAtTime(bedLevel, t + hold, 0.28);
}

/** Keep the music a little lower while the planet ambience drone is playing. */
export function setMusicBed(on) {
  bedLevel = on ? 0.65 : 1;
  if (!nodes) return;
  const p = nodes.musicDuck.gain;
  p.cancelScheduledValues(ctx.currentTime);
  p.setTargetAtTime(bedLevel, ctx.currentTime, 0.4);
}

/** Smooth (low-passed) noise impulse – a reverb tail without the harsh, ringing hiss. */
export function makeImpulse(c, seconds, decay) {
  const rate = c.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = c.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch += 1) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i += 1) {
      const n = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      lp += (n - lp) * 0.4;
      d[i] = lp;
    }
  }
  return buf;
}
