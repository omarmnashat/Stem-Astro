import * as THREE from 'three';
import { playSound } from '../../services/soundService.js';
import { getAudio, resumeAudio, duckMusic, setMusicBed } from '../../services/audioEngine.js';

/* ==================== Procedural Space Audio Engine (Web Audio API) ==================== */
class SpaceAudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.ambientRunning = false;
    this.ambientGain = null;
    this.ambientNodes = [];
  }

  ensureContext() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      // shared engine: same context, limiter and music ducking as the rest of the game
      const a = getAudio();
      if (a) {
        this.ctx = a.ctx;
        this.sfxBus = a.sfx;
        this.ambientBus = a.ambient;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') resumeAudio();
    return this.ctx;
  }

  startAmbient() {
    const ctx = this.ensureContext();
    if (!ctx || this.ambientRunning) return;
    this.ambientRunning = true;

    const master = ctx.createGain();
    master.gain.setValueAtTime(this.muted ? 0 : 0.055, ctx.currentTime);
    master.connect(this.ambientBus);
    this.ambientGain = master;
    setMusicBed(true);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, ctx.currentTime);
    filter.Q.setValueAtTime(1.8, ctx.currentTime);
    filter.connect(master);

    // Slow cosmic filter sweep LFO
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(0.08, ctx.currentTime);
    lfoGain.gain.setValueAtTime(140, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    this.ambientNodes.push(lfo);

    // Deep space harmonic pad (D2, A2, E3, A3)
    const freqs = [73.42, 110.0, 164.81, 220.0];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, ctx.currentTime);
      oscGain.gain.setValueAtTime(idx === 0 ? 0.42 : 0.2, ctx.currentTime);
      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start();
      this.ambientNodes.push(osc);
    });
  }

  stopAmbient() {
    this.ambientNodes.forEach((n) => {
      try {
        n.stop();
        n.disconnect();
      } catch {
        // ignore already stopped
      }
    });
    this.ambientNodes = [];
    try {
      this.ambientGain?.disconnect();
    } catch {
      // ignore
    }
    this.ambientGain = null;
    this.ambientRunning = false;
    setMusicBed(false);
  }

  setMuted(nextMuted) {
    this.muted = Boolean(nextMuted);
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(this.muted ? 0 : 0.055, this.ctx.currentTime, 0.08);
    }
    return this.muted;
  }

  toggleMute() {
    this.ensureContext();
    if (!this.ambientRunning) this.startAmbient();
    return this.setMuted(!this.muted);
  }

  playCountdownBeep(step) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    duckMusic(0.75, 0.25);

    if (step > 0) {
      // Crisp NASA telemetry beep for 3, 2, 1
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.14, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.sfxBus);
      osc.start(now);
      osc.stop(now + 0.24);
    } else {
      // Touchdown double confirmation tone
      [880, 1174.66].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.11);
        gain.gain.setValueAtTime(0.001, now + i * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.16, now + i * 0.11 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.36);
        osc.connect(gain);
        gain.connect(this.sfxBus);
        osc.start(now + i * 0.11);
        osc.stop(now + i * 0.11 + 0.38);
      });
    }
  }

  playDiscoveryFanfare() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    // if another effect (e.g. the build sound) just started, wait for it to finish instead of
    // playing on top of it
    const recent = this.lastFxAt && performance.now() - this.lastFxAt < 500;
    const now = ctx.currentTime + (recent ? 0.45 : 0);
    duckMusic(0.55, 0.7 + (recent ? 0.45 : 0));

    // Bright ascending discovery chord (C5 F5 A5 C6 D6 – all in the soundtrack's D-minor key)
    const notes = [523.25, 698.46, 880, 1046.5, 1174.66];
    notes.forEach((freq, i) => {
      const start = now + i * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === notes.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.65);

      osc.connect(gain);
      gain.connect(this.sfxBus);
      osc.start(start);
      osc.stop(start + 0.68);
    });
  }

  /* ---- Movement & action sound effects (shared sound library, muted with the sim mute button) ---- */
  _fx(name) {
    if (this.muted) return;
    this.lastFxAt = performance.now();
    playSound(name);
  }

  playJump() {
    this._fx('jump');
  }

  playLand() {
    this._fx('land');
  }

  playFootstep() {
    this._fx('footstep');
  }

  playEat() {
    this._fx('eat');
  }

  playHeal() {
    this._fx('heal');
  }

  playBuild() {
    this._fx('build');
  }

  playError() {
    this._fx('error');
  }

  playDigSound() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * 0.18);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.45));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, now);
    filter.Q.setValueAtTime(1.2, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    noise.start(now);
  }
}

export const spaceAudio = new SpaceAudioEngine();

/* ==================== Terrain & Collision Math ==================== */
export function hash2D(ix, iz) {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

export function getTerrainHeight(x, z, isMars, digPits = []) {
  const distFromBase = Math.hypot(x, z);
  const flatFactor = Math.min(1, Math.max(0, (distFromBase - 12) / 22));
  const macroHills =
    Math.sin(x * 0.045) * Math.cos(z * 0.045) * (isMars ? 3.2 : 2.3) +
    Math.sin(x * 0.11 + z * 0.09) * 1.1;
  const microUndulation = Math.cos(x * 0.28 - z * 0.24) * 0.28;
  let h = (macroHills + microUndulation) * flatFactor;

  for (let i = 0; i < digPits.length; i++) {
    const pit = digPits[i];
    const d = Math.hypot(x - pit.x, z - pit.z);
    if (d < pit.radius * 1.55) {
      if (d < pit.radius) {
        const bowl = Math.cos((d / pit.radius) * (Math.PI / 2));
        h -= pit.depth * bowl;
      } else {
        const rimT = 1 - (d - pit.radius) / (pit.radius * 0.55);
        h += pit.depth * 0.25 * Math.sin(rimT * Math.PI);
      }
    }
  }
  return h;
}

export function resolveCollisions(pos, playerRadius, colliders) {
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const minDist = playerRadius + c.radius;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const overlap = minDist - dist;
          pos.x += (dx / dist) * overlap;
          pos.z += (dz / dist) * overlap;
        } else {
          pos.z += minDist;
        }
      }
    }
  }
}

/* ==================== Procedural NASA Textures ==================== */
export function createPlanetTextures(isMars) {
  const size = 1024;
  const diffCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  diffCanvas.width = bumpCanvas.width = size;
  diffCanvas.height = bumpCanvas.height = size;

  const dCtx = diffCanvas.getContext('2d');
  const bCtx = bumpCanvas.getContext('2d');

  dCtx.fillStyle = isMars ? '#8c381b' : '#585c63';
  dCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 45; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const pr = 60 + Math.random() * 140;
    const g = dCtx.createRadialGradient(px, py, pr * 0.1, px, py, pr);
    g.addColorStop(
      0,
      isMars
        ? i % 2 === 0 ? 'rgba(64, 22, 10, 0.25)' : 'rgba(186, 94, 48, 0.22)'
        : i % 2 === 0 ? 'rgba(38, 41, 46, 0.28)' : 'rgba(130, 136, 145, 0.22)'
    );
    g.addColorStop(1, 'rgba(0,0,0,0)');
    dCtx.fillStyle = g;
    dCtx.beginPath();
    dCtx.arc(px, py, pr, 0, Math.PI * 2);
    dCtx.fill();
  }

  for (let i = 0; i < 40000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 2.0 + 0.4;
    const shade = Math.random();
    dCtx.fillStyle = isMars
      ? shade > 0.5 ? 'rgba(212, 112, 58, 0.28)' : 'rgba(48, 15, 6, 0.32)'
      : shade > 0.5 ? 'rgba(205, 212, 220, 0.25)' : 'rgba(18, 20, 24, 0.32)';
    dCtx.fillRect(x, y, r, r);

    bCtx.fillStyle = shade > 0.5 ? 'rgba(245,245,245,0.34)' : 'rgba(20,20,20,0.34)';
    bCtx.fillRect(x, y, r, r);
  }

  const craterCount = isMars ? 55 : 110;
  for (let i = 0; i < craterCount; i++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const cr = Math.random() * 42 + 6;

    const grad = dCtx.createRadialGradient(cx, cy, cr * 0.08, cx, cy, cr);
    grad.addColorStop(0, isMars ? 'rgba(40, 12, 4, 0.58)' : 'rgba(18, 20, 25, 0.62)');
    grad.addColorStop(0.72, isMars ? 'rgba(110, 40, 16, 0.28)' : 'rgba(65, 70, 78, 0.28)');
    grad.addColorStop(0.9, isMars ? 'rgba(225, 136, 82, 0.44)' : 'rgba(210, 216, 224, 0.45)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    dCtx.fillStyle = grad;
    dCtx.beginPath();
    dCtx.arc(cx, cy, cr, 0, Math.PI * 2);
    dCtx.fill();

    const bGrad = bCtx.createRadialGradient(cx, cy, cr * 0.08, cx, cy, cr);
    bGrad.addColorStop(0, 'rgba(8,8,8,0.85)');
    bGrad.addColorStop(0.85, 'rgba(255,255,255,0.8)');
    bGrad.addColorStop(1, 'rgba(128,128,128,0)');
    bCtx.fillStyle = bGrad;
    bCtx.beginPath();
    bCtx.arc(cx, cy, cr, 0, Math.PI * 2);
    bCtx.fill();
  }

  const map = new THREE.CanvasTexture(diffCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  map.wrapS = map.wrapT = bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  map.repeat.set(20, 20);
  bumpMap.repeat.set(20, 20);
  return { map, bumpMap };
}

export function createEarthTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = '#15803d';
  ctx.beginPath();
  ctx.ellipse(95, 105, 38, 26, 0.3, 0, Math.PI * 2);
  ctx.ellipse(165, 130, 32, 42, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ca8a04';
  ctx.beginPath();
  ctx.ellipse(162, 118, 20, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(248, 250, 252, 0.65)';
  for (let i = 0; i < 24; i++) {
    ctx.beginPath();
    ctx.ellipse(Math.random() * size, Math.random() * size, 24 + Math.random() * 35, 6 + Math.random() * 8, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

export function createEnvironmentMaterials(isMars) {
  const kSize = 256;
  const kDiff = document.createElement('canvas');
  const kBump = document.createElement('canvas');
  kDiff.width = kBump.width = kSize;
  kDiff.height = kBump.height = kSize;
  const kd = kDiff.getContext('2d');
  const kb = kBump.getContext('2d');
  kd.fillStyle = '#d97706';
  kd.fillRect(0, 0, kSize, kSize);
  kb.fillStyle = '#808080';
  kb.fillRect(0, 0, kSize, kSize);
  for (let i = 0; i < 380; i++) {
    const x = Math.random() * kSize;
    const y = Math.random() * kSize;
    const w = 10 + Math.random() * 22;
    const h = 6 + Math.random() * 16;
    const bright = Math.random() > 0.5;
    kd.fillStyle = bright ? 'rgba(253, 224, 71, 0.35)' : 'rgba(146, 64, 14, 0.4)';
    kd.fillRect(x, y, w, h);
    kb.fillStyle = bright ? 'rgba(240,240,240,0.45)' : 'rgba(20,20,20,0.45)';
    kb.fillRect(x, y, w * 0.6, h * 0.6);
  }
  const kaptonMap = new THREE.CanvasTexture(kDiff);
  const kaptonBump = new THREE.CanvasTexture(kBump);
  kaptonMap.wrapS = kaptonMap.wrapT = kaptonBump.wrapS = kaptonBump.wrapT = THREE.RepeatWrapping;

  const hSize = 512;
  const hDiff = document.createElement('canvas');
  const hBump = document.createElement('canvas');
  hDiff.width = hBump.width = hSize;
  hDiff.height = hBump.height = hSize;
  const hd = hDiff.getContext('2d');
  const hb = hBump.getContext('2d');
  hd.fillStyle = '#e2e8f0';
  hd.fillRect(0, 0, hSize, hSize);
  hb.fillStyle = '#808080';
  hb.fillRect(0, 0, hSize, hSize);
  hd.strokeStyle = 'rgba(71, 85, 105, 0.55)';
  hb.strokeStyle = '#202020';
  hd.lineWidth = 2;
  hb.lineWidth = 3;
  for (let p = 0; p <= hSize; p += 128) {
    hd.beginPath(); hd.moveTo(p, 0); hd.lineTo(p, hSize); hd.stroke();
    hd.beginPath(); hd.moveTo(0, p); hd.lineTo(hSize, p); hd.stroke();
    hb.beginPath(); hb.moveTo(p, 0); hb.lineTo(p, hSize); hb.stroke();
    hb.beginPath(); hb.moveTo(0, p); hb.lineTo(hSize, p); hb.stroke();
  }
  hd.fillStyle = '#1d4ed8';
  hd.beginPath();
  hd.arc(256, 256, 36, 0, Math.PI * 2);
  hd.fill();
  hd.fillStyle = '#ffffff';
  hd.font = 'bold 20px sans-serif';
  hd.textAlign = 'center';
  hd.textBaseline = 'middle';
  hd.fillText('NASA', 256, 256);

  const hullMap = new THREE.CanvasTexture(hDiff);
  const hullBump = new THREE.CanvasTexture(hBump);
  hullMap.wrapS = hullMap.wrapT = hullBump.wrapS = hullBump.wrapT = THREE.RepeatWrapping;
  hullMap.repeat.set(3, 2);
  hullBump.repeat.set(3, 2);

  const sCanvas = document.createElement('canvas');
  sCanvas.width = 512;
  sCanvas.height = 256;
  const sd = sCanvas.getContext('2d');
  sd.fillStyle = '#09152b';
  sd.fillRect(0, 0, 512, 256);
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 12; c++) {
      sd.fillStyle = (r + c) % 2 === 0 ? '#0f254a' : '#132d59';
      sd.fillRect(c * (512 / 12) + 2, r * (256 / 6) + 2, 512 / 12 - 4, 256 / 6 - 4);
    }
  }
  const solarTex = new THREE.CanvasTexture(sCanvas);

  const rCanvas = document.createElement('canvas');
  rCanvas.width = rCanvas.height = 256;
  const rd = rCanvas.getContext('2d');
  rd.fillStyle = isMars ? '#7c3219' : '#4b5058';
  rd.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    rd.fillStyle = Math.random() > 0.5 ? 'rgba(225,140,95,0.28)' : 'rgba(20,20,25,0.36)';
    rd.fillRect(Math.random() * 256, Math.random() * 256, 2.5, 2.5);
  }
  const rockTex = new THREE.CanvasTexture(rCanvas);

  const fCanvas = document.createElement('canvas');
  fCanvas.width = 256;
  fCanvas.height = 160;
  const fd = fCanvas.getContext('2d');
  if (isMars) {
    fd.fillStyle = '#0f172a';
    fd.fillRect(0, 0, 256, 160);
    fd.fillStyle = '#dc2626';
    fd.fillRect(0, 0, 256, 24);
    fd.fillStyle = '#ea580c';
    fd.fillRect(0, 136, 256, 24);
    fd.fillStyle = '#f8fafc';
    fd.font = 'bold 24px monospace';
    fd.textAlign = 'center';
    fd.fillText('NASA MARS 2020', 128, 72);
    fd.font = 'bold 17px monospace';
    fd.fillStyle = '#38bdf8';
    fd.fillText('JEZERO STATION', 128, 104);
  } else {
    const sh = 160 / 13;
    for (let i = 0; i < 13; i++) {
      fd.fillStyle = i % 2 === 0 ? '#b91c1c' : '#f8fafc';
      fd.fillRect(0, i * sh, 256, sh);
    }
    fd.fillStyle = '#1e3a8a';
    fd.fillRect(0, 0, 108, sh * 7);
    fd.fillStyle = '#f8fafc';
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 6; c++) {
        fd.beginPath();
        fd.arc(10 + c * 16, 10 + r * 15, 1.8, 0, Math.PI * 2);
        fd.fill();
      }
    }
  }
  const flagTex = new THREE.CanvasTexture(fCanvas);

  const materials = {
    kaptonMat: new THREE.MeshStandardMaterial({ map: kaptonMap, bumpMap: kaptonBump, bumpScale: 0.08, metalness: 0.92, roughness: 0.22 }),
    hullMat: new THREE.MeshStandardMaterial({ map: hullMap, bumpMap: hullBump, bumpScale: 0.04, metalness: 0.35, roughness: 0.42 }),
    solarMat: new THREE.MeshStandardMaterial({ map: solarTex, metalness: 0.85, roughness: 0.16 }),
    darkSteelMat: new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.82, roughness: 0.32 }),
    rockMat: new THREE.MeshStandardMaterial({ map: rockTex, bumpMap: rockTex, bumpScale: 0.14, roughness: 0.92, metalness: 0.04 }),
    flagMat: new THREE.MeshStandardMaterial({ map: flagTex, roughness: 0.65 }),
  };

  const disposeMaterials = () => {
    [kaptonMap, kaptonBump, hullMap, hullBump, solarTex, rockTex, flagTex].forEach((t) => t.dispose());
    Object.values(materials).forEach((m) => m.dispose());
  };

  return { materials, disposeMaterials };
}

function createNameplateSprite(text, badgeColor = '#38bdf8') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 112;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(9, 13, 22, 0.88)';
  ctx.beginPath();
  ctx.roundRect(48, 18, 416, 76, 16);
  ctx.fill();

  ctx.strokeStyle = badgeColor;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.font = 'bold 30px sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 56);

  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(3.2, 0.72, 1);
  return { sprite, texture };
}

export function buildRealisticRockMesh(seed, scale, rockMat, speckleHex = '#facc15') {
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const pos = geo.attributes.position;

  const computeRadiusFactor = (vx, vy, vz) =>
    0.78 +
    0.26 * Math.sin(vx * 3.7 + seed * 11.3) * Math.cos(vz * 3.3 + seed * 7.1) +
    0.13 * Math.cos(vy * 4.5 + seed * 5.7);

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const n = computeRadiusFactor(vx, vy, vz);
    pos.setXYZ(i, vx * n, vy * n * 0.74, vz * n);
  }
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, rockMat);
  mesh.scale.set(scale * 1.15, scale * 0.85, scale);
  mesh.rotation.y = seed * Math.PI * 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  // Subtle crystalline mineral glints embedded flush inside the rock face
  const speckleMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(speckleHex),
    emissive: new THREE.Color(speckleHex),
    emissiveIntensity: 0.28,
    roughness: 0.2,
    metalness: 0.88,
  });

  const speckleCount = 8;
  for (let s = 0; s < speckleCount; s++) {
    const theta = hash2D(Math.round(seed * 997) + s, 13) * Math.PI * 2;
    const phi = 0.35 + hash2D(Math.round(seed * 997) + s, 29) * 1.05;
    const dx = Math.sin(phi) * Math.cos(theta);
    const dy = Math.cos(phi);
    const dz = Math.sin(phi) * Math.sin(theta);
    const n = computeRadiusFactor(dx, dy, dz);

    const glintSize = 0.02 + hash2D(s, 71) * 0.012;
    const glint = new THREE.Mesh(new THREE.OctahedronGeometry(glintSize, 0), speckleMat);
    glint.position.set(dx * n * 0.99, dy * n * 0.74 * 0.99, dz * n * 0.99);
    glint.lookAt(0, 0, 0);
    glint.scale.set(1.15, 1.15, 0.24);
    mesh.add(glint);
  }

  return group;
}

export function buildNasaAstronaut(nametagText, badgeColor = '#38bdf8') {
  const group = new THREE.Group();
  const suitWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45, metalness: 0.08 });
  const jointGray = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
  const chromeMetal = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.88, roughness: 0.2 });
  const goldVisor = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.96, roughness: 0.05 });
  const bluePatch = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 });
  const redStripe = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.45, 8, 16), suitWhite);
  torso.position.y = 1.08;
  torso.castShadow = true;

  const dcmBox = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.14), suitWhite);
  dcmBox.position.set(0, 1.15, 0.28);
  const nasaLogo = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16), bluePatch);
  nasaLogo.position.set(-0.16, 1.26, 0.31);

  const plss = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.3), suitWhite);
  plss.position.set(0, 1.14, -0.32);
  plss.castShadow = true;
  const opsTop = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.24), suitWhite);
  opsTop.position.set(0, 1.56, -0.32);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.58, 8), chromeMetal);
  antenna.position.set(0.18, 1.82, -0.35);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 24), suitWhite);
  helmet.position.y = 1.74;
  helmet.castShadow = true;

  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.295, 20, 20), goldVisor);
  visor.position.set(0, 1.74, 0.12);

  const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.46, 6, 12), suitWhite);
  leftLeg.position.set(-0.18, 0.42, 0);
  leftLeg.castShadow = true;

  const rightLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.46, 6, 12), suitWhite);
  rightLeg.position.set(0.18, 0.42, 0);
  rightLeg.castShadow = true;

  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.42, 6, 12), suitWhite);
  leftArm.position.set(-0.44, 1.08, 0);
  const leftStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.099, 0.099, 0.06, 12), redStripe);
  leftStripe.position.set(-0.44, 1.18, 0);

  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0.44, 1.28, 0);
  const rightArmMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.42, 6, 12), suitWhite);
  rightArmMesh.position.set(0, -0.2, 0);

  const shovelGroup = new THREE.Group();
  shovelGroup.position.set(0, -0.44, 0.14);
  shovelGroup.rotation.x = 0.55;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.15, 8), chromeMetal);
  shaft.position.set(0, -0.25, 0.25);
  shaft.rotation.x = 0.85;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 8), jointGray);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0, 0.12, -0.15);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.24), chromeMetal);
  blade.position.set(0, -0.66, 0.68);
  blade.rotation.x = 0.55;
  shovelGroup.add(shaft, handle, blade);
  rightArmGroup.add(rightArmMesh, shovelGroup);

  const { sprite, texture } = createNameplateSprite(nametagText, badgeColor);
  sprite.position.set(0, 2.48, 0);

  group.add(torso, dcmBox, nasaLogo, plss, opsTop, antenna, helmet, visor, leftLeg, rightLeg, leftArm, leftStripe, rightArmGroup, sprite);
  return { group, leftLeg, rightLeg, leftArm, rightArm: rightArmGroup, shovelGroup, nameTexture: texture };
}

export function buildMarsRover(nametagText, badgeColor = '#f97316', kaptonMat) {
  const group = new THREE.Group();
  const bodyWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.34, metalness: 0.32 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.68, metalness: 0.6 });
  const chromeMetal = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.88, roughness: 0.22 });
  const goldDeck = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.25 });
  const lensCyan = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.9 });
  const redLaser = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.85 });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.54, 2.05), bodyWhite);
  chassis.position.y = 0.86;
  chassis.castShadow = true;

  const topDeck = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.06, 1.96), goldDeck);
  topDeck.position.y = 1.15;

  const rtg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.88, 16), bodyWhite);
  rtg.rotation.x = Math.PI / 3.2;
  rtg.position.set(0, 1.18, -1.18);

  const uhf = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.45, 14), chromeMetal);
  uhf.position.set(-0.48, 1.38, -0.65);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 1.12, 12), bodyWhite);
  mast.position.set(0.36, 1.56, 0.66);

  const camHead = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.32), bodyWhite);
  camHead.position.set(0.36, 2.14, 0.68);
  camHead.castShadow = true;

  const laserEye = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 16), lensCyan);
  laserEye.rotation.x = Math.PI / 2;
  laserEye.position.set(0.36, 2.15, 0.85);

  const navCamL = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12), redLaser);
  navCamL.rotation.x = Math.PI / 2;
  navCamL.position.set(0.22, 2.05, 0.85);

  const armPivot = new THREE.Group();
  armPivot.position.set(-0.22, 0.85, 1.02);
  const armBoom = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.88), kaptonMat);
  armBoom.position.set(0, 0, 0.44);
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.24, 16), chromeMetal);
  turret.rotation.z = Math.PI / 2;
  turret.position.set(0, -0.05, 0.9);
  const drillBit = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28, 12), darkMetal);
  drillBit.rotation.x = Math.PI;
  drillBit.position.set(0, -0.24, 0.96);
  armPivot.add(armBoom, turret, drillBit);

  const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.27, 20);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  [
    [-0.94, 0.33, 0.86],
    [0.94, 0.33, 0.86],
    [-0.98, 0.33, 0],
    [0.98, 0.33, 0],
    [-0.94, 0.33, -0.86],
    [0.94, 0.33, -0.86],
  ].forEach(([wx, wy, wz]) => {
    const w = new THREE.Mesh(wheelGeo, darkMetal);
    w.position.set(wx, wy, wz);
    w.castShadow = true;
    group.add(w);
    wheels.push(w);

    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.72, 8), chromeMetal);
    strut.position.set(wx * 0.85, 0.56, wz);
    strut.rotation.z = wx > 0 ? 0.36 : -0.36;
    group.add(strut);
  });

  const { sprite, texture } = createNameplateSprite(nametagText, badgeColor);
  sprite.position.set(0, 2.88, 0);

  group.add(chassis, topDeck, rtg, uhf, mast, camHead, laserEye, navCamL, armPivot, sprite);
  return { group, wheels, armPivot, nameTexture: texture };
}

/** The NASA "meatball" logo drawn on a canvas (blue globe, stars, white orbit, red chevron, NASA letters). */
function makeNasaLogoTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  const cx = 256;
  const cy = 256;
  const R = 246;

  // white rim + blue globe
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(cx, cy, R + 6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#0b3d91';
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();

  g.save();
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.clip();

  // stars
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 70; i += 1) {
    const x = cx + (rnd() * 2 - 1) * R;
    const y = cy + (rnd() * 2 - 1) * R;
    g.beginPath();
    g.arc(x, y, 1.2 + rnd() * 2.4, 0, Math.PI * 2);
    g.fill();
  }

  // white orbit ring
  g.strokeStyle = '#ffffff';
  g.lineWidth = 7;
  g.beginPath();
  g.ellipse(cx, cy + 6, R * 0.98, R * 0.3, -0.5, 0, Math.PI * 2);
  g.stroke();

  // red chevron (the "wing")
  g.fillStyle = '#fc3d21';
  g.beginPath();
  g.moveTo(cx - 215, cy + 120);
  g.bezierCurveTo(cx - 130, cy + 20, cx + 20, cy - 120, cx + 215, cy - 150);
  g.bezierCurveTo(cx + 90, cy - 60, cx - 20, cy + 40, cx - 120, cy + 135);
  g.bezierCurveTo(cx - 150, cy + 150, cx - 185, cy + 150, cx - 215, cy + 120);
  g.closePath();
  g.fill();
  g.restore();

  // NASA letters
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '900 150px "Arial Black", Arial, Helvetica, sans-serif';
  g.fillText('NASA', cx, cy + 6);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A cylinder-hugging patch that carries the NASA logo (so it bends with the rocket body). */
function logoPatch(radius, size, centerAngle, y, tex) {
  const len = size / radius;
  const geo = new THREE.CylinderGeometry(radius, radius, size, 40, 1, true, centerAngle - len / 2, len);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    roughness: 0.5,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y;
  return m;
}

/** A thin strut from point a to point b. */
function strut(a, b, radius, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 10), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  return m;
}

/**
 * The landing rocket: a tall, realistic NASA-style rocket – white body, black bands,
 * a nose capsule with a launch-escape tower, landing legs, four engines and a big NASA logo.
 * Keeps the same return values as the old lander so the rest of the simulation keeps working.
 */
export function buildNasaLander(isMars, materials) {
  const landerGroup = new THREE.Group();
  landerGroup.position.set(6.5, 36, -2);

  const white = new THREE.MeshStandardMaterial({ color: 0xf3f5f7, roughness: 0.4, metalness: 0.18 });
  const black = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.55, metalness: 0.3 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.5, metalness: 0.1 });
  const steel = materials.darkSteelMat;
  const nozzleMat = steel.clone();
  nozzleMat.side = THREE.DoubleSide;

  const R = 1.7; // body radius

  // ---- engines (1 centre + 3 outer) ----
  const engine = (x, z, rTop, rBot, h) => {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 20, 1, true), nozzleMat);
    n.position.set(x, 0.4 + h / 2, z);
    return n;
  };
  landerGroup.add(engine(0, 0, 0.32, 0.72, 1.0));
  for (let i = 0; i < 3; i += 1) {
    const a = (i * Math.PI * 2) / 3 + Math.PI / 6;
    landerGroup.add(engine(Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0.22, 0.48, 0.85));
  }

  // ---- body ----
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.03, R + 0.03, 1.1, 48), black);
  skirt.position.y = 1.95;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 8.2, 48), white);
  body.position.y = 6.6;
  const bandBlack = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.6, 48), black);
  bandBlack.position.y = 9.4;
  const bandRed = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.14, 48), red);
  bandRed.position.y = 9.78;
  const taper = new THREE.Mesh(new THREE.CylinderGeometry(1.25, R, 1.5, 48), white);
  taper.position.y = 10.85;
  [skirt, body, bandBlack, bandRed, taper].forEach((m) => {
    m.castShadow = true;
    landerGroup.add(m);
  });

  // thin vertical seams and little windows for a realistic look
  for (let i = 0; i < 6; i += 1) {
    const a = (i * Math.PI) / 3;
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.025, 7.4, 0.025), steel);
    seam.position.set(Math.cos(a) * (R + 0.01), 6.6, Math.sin(a) * (R + 0.01));
    landerGroup.add(seam);
  }

  // ---- BIG NASA logos (3 around the body, one faces the starting camera) ----
  const logoTex = makeNasaLogoTexture();
  const facing = 0.7; // angle (rad) that faces the landing camera
  for (let i = 0; i < 3; i += 1) {
    landerGroup.add(logoPatch(R + 0.02, 3.1, facing + (i * Math.PI * 2) / 3, 6.4, logoTex));
  }

  // ---- landing legs ----
  for (let i = 0; i < 4; i += 1) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const top = new THREE.Vector3(c * R, 3.4, s * R);
    const foot = new THREE.Vector3(c * 2.75, 0.12, s * 2.75);
    const brace = new THREE.Vector3(c * R, 2.0, s * R);
    const mid = new THREE.Vector3(c * 2.3, 0.9, s * 2.3);
    landerGroup.add(strut(top, foot, 0.09, black), strut(brace, mid, 0.05, steel));
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.1, 16), black);
    pad.position.set(c * 2.75, 0.05, s * 2.75);
    landerGroup.add(pad);
  }

  // ---- nose capsule + escape tower: this is the part that launches the samples to Earth ----
  const ascentStage = new THREE.Group();
  const restY = 11.6;
  ascentStage.position.y = restY;
  ascentStage.userData.restY = restY;
  ascentStage.userData.flameDrop = 1.3;
  const pts = [];
  for (let i = 0; i <= 20; i += 1) {
    const y = (i / 20) * 2.7;
    pts.push(new THREE.Vector2(1.25 * Math.pow(1 - Math.pow(y / 2.7, 1.8), 0.7), y));
  }
  const nose = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), white);
  nose.castShadow = true;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 10), steel);
  tower.position.y = 3.3;
  const towerTip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 12), red);
  towerTip.position.y = 4.15;
  const hatch = new THREE.Mesh(new THREE.CircleGeometry(0.26, 20), new THREE.MeshBasicMaterial({ color: 0x0f172a }));
  hatch.position.set(Math.sin(facing) * 1.16, 0.9, Math.cos(facing) * 1.16);
  hatch.rotation.y = facing; // CircleGeometry faces +Z; turn it toward the camera side
  ascentStage.add(nose, tower, towerTip, hatch);
  landerGroup.add(ascentStage);

  // flame of the launching capsule
  const capsuleFlame = new THREE.Mesh(
    new THREE.ConeGeometry(1.0, 2.6, 16),
    new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.9 })
  );
  capsuleFlame.rotation.x = Math.PI;
  capsuleFlame.position.y = restY - 1.3;
  capsuleFlame.visible = false;
  landerGroup.add(capsuleFlame);

  // ---- landing burn flame (orange outside, hot white core) ----
  const flameMesh = new THREE.Mesh(
    new THREE.ConeGeometry(1.15, 4.6, 18),
    new THREE.MeshBasicMaterial({ color: 0xff9a2e, transparent: true, opacity: 0.8 })
  );
  flameMesh.rotation.x = Math.PI;
  flameMesh.position.y = -0.9;
  const core = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 3.2, 14),
    new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.9 })
  );
  core.position.y = -0.3;
  flameMesh.add(core);

  // ---- Mars: drag parachute above the nose ----
  const parachuteGroup = new THREE.Group();
  if (isMars) {
    const chute = new THREE.Mesh(
      new THREE.SphereGeometry(3.8, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xea580c, side: THREE.DoubleSide, roughness: 0.8 })
    );
    chute.position.y = 20;
    parachuteGroup.add(chute);
  }

  landerGroup.add(flameMesh, parachuteGroup);
  return { landerGroup, ascentStage, capsuleFlame, flameMesh, parachuteGroup };
}

export function createStationMesh(mod, mats, upgrades = {}) {
  const group = new THREE.Group();
  group.position.set(mod.x, 0, mod.z);
  let hitMesh = null;

  if (mod.type === 'flag_station') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 2.65, 12), mats.darkSteelMat);
    pole.position.y = 1.32;
    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.25, 8), mats.darkSteelMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0.62, 2.6, 0);
    const flagCloth = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.75, 0.025), mats.flagMat);
    flagCloth.position.set(0.62, 2.22, 0);
    flagCloth.castShadow = true;
    const retroPanel = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.35), mats.hullMat);
    retroPanel.position.set(-0.55, 0.25, 0.2);
    retroPanel.rotation.x = -0.35;
    group.add(pole, crossbar, flagCloth, retroPanel);
    hitMesh = flagCloth;
  } else if (mod.type === 'alsep') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.52, 1.15), mats.kaptonMat);
    base.position.y = 0.26;
    const dish = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.38, 20, 1, true), mats.hullMat);
    dish.position.set(0, 0.88, 0);
    dish.rotation.x = Math.PI + 0.42;
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    beacon.position.y = 1.25;
    group.add(base, dish, beacon);
    hitMesh = base;
  } else if (mod.type === 'habitat') {
    const tier = upgrades.habitat || 1;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.6, 36, 24, 0, Math.PI * 2, 0, Math.PI / 2), mats.hullMat);
    dome.castShadow = true;
    const baseSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(3.68, 3.82, tier >= 2 ? 1.15 : 0.65, 32),
      mats.kaptonMat
    );
    baseSkirt.position.y = tier >= 2 ? 0.57 : 0.32;
    const airlockHatch = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.2, 20), mats.hullMat);
    airlockHatch.rotation.x = Math.PI / 2;
    airlockHatch.position.set(0, 1.0, 3.55);
    group.add(dome, baseSkirt, airlockHatch);
    hitMesh = dome;
  } else if (mod.type === 'o2' || mod.type === 'h2o') {
    const vessel = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.88, 1.7, 12, 24),
      mod.type === 'o2' ? mats.hullMat : mats.kaptonMat
    );
    vessel.position.y = 1.85;
    const cage = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 3.4, 2.1),
      new THREE.MeshStandardMaterial({ color: 0x475569, wireframe: true })
    );
    cage.position.y = 1.7;
    group.add(vessel, cage);
    hitMesh = vessel;
  } else if (mod.type === 'greenhouse') {
    const baseWall = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 2.75, 0.7, 28), mats.hullMat);
    baseWall.position.y = 0.35;
    const glass = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshPhysicalMaterial({ color: 0xa7f3d0, transparent: true, opacity: 0.34, roughness: 0.1 })
    );
    glass.position.y = 0.55;
    const bed = new THREE.Mesh(
      new THREE.CylinderGeometry(2.15, 2.15, 0.45, 24),
      new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.85 })
    );
    bed.position.y = 0.75;
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x15803d, emissiveIntensity: 0.25, roughness: 0.6 });
    for (let p = 0; p < 12; p++) {
      const a = (p / 12) * Math.PI * 2;
      const r = 0.7 + (p % 3) * 0.45;
      const plant = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), leafMat);
      plant.position.set(Math.cos(a) * r, 1.12, Math.sin(a) * r);
      plant.scale.set(1.1, 0.8, 1.1);
      group.add(plant);
    }
    const o2Tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 1.1, 14),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.45 })
    );
    o2Tank.position.set(2.55, 0.8, 0);
    group.add(baseWall, glass, bed, o2Tank);
    hitMesh = glass;
  } else if (mod.type === 'solar') {
    const tier = upgrades.solar || 1;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.3, 12), mats.darkSteelMat);
    mast.position.y = 1.2;
    const span = tier >= 2 ? 6.4 : 4.8;
    const cells = new THREE.Mesh(new THREE.BoxGeometry(span, 0.14, 2.35), mats.solarMat);
    cells.position.y = 2.45;
    cells.rotation.x = 0.38;
    group.add(mast, cells);
    hitMesh = cells;
  } else if (mod.type === 'rtg') {
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.55, 16), mats.kaptonMat);
    core.position.y = 1.15;
    for (let i = 0; i < 6; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.3, 0.06), mats.hullMat);
      fin.position.y = 1.15;
      fin.rotation.y = (i * Math.PI) / 3;
      group.add(fin);
    }
    group.add(core);
    hitMesh = core;
  } else if (mod.type === 'comm') {
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 1.4, 16), mats.hullMat);
    pedestal.position.y = 0.7;
    const dish = new THREE.Mesh(new THREE.ConeGeometry(1.45, 0.65, 24, 1, true), mats.hullMat);
    dish.position.set(0, 2.1, 0);
    dish.rotation.x = Math.PI + 0.55;
    group.add(pedestal, dish);
    hitMesh = dish;
  } else {
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.8), mats.kaptonMat);
    chassis.position.y = 0.75;
    group.add(chassis);
    hitMesh = chassis;
  }

  hitMesh.userData = { moduleId: mod.id, actionId: mod.actionId, label: mod.label };
  return { group, hitMesh };
}