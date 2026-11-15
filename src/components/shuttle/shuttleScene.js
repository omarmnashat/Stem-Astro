/**
 * Canvas "windshield" view for the shuttle cockpit: stars, Earth, Moon, Mars,
 * and the autopilot flight. The landing itself is shown in the 3D mission simulation.
 * Pure JS (no React) – the page feeds it inputs every frame.
 */

import { renderSphere } from './planetTextures.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (t) => t * t * (3 - 2 * t);

// The Moon is our close neighbour (about 384,400 km), so it looks big and sits near Earth.
// Mars is hundreds of times farther away, so it is only a tiny reddish dot far off to the side:
// you have to turn the shuttle a long way to find it.
export const TARGETS = { moon: { x: -0.3, y: 0.14 }, mars: { x: 1.12, y: -0.22 } };
export const TRIP = {
  moon: { seconds: 26, km: 384400, name: 'Moon', far: '384,400 km', size: 0.078 },
  mars: { seconds: 32, km: 225000000, name: 'Mars', far: '~225 million km', size: 0.02 },
};
const YAW_LIMIT = 1.4;
const EARTH = { x: -0.55, y: -0.38 };

function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function makeTexture(kind) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  const r = rng(kind === 'moon' ? 7 : kind === 'mars' ? 21 : 55);
  const blob = (x, y, rad, color, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, color);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = a;
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, rad, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
  };
  if (kind === 'moon') {
    g.fillStyle = '#b9b9b4';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 10; i += 1) blob(r() * 512, r() * 512, 50 + r() * 90, '#6f6f6c', 0.55);
    for (let i = 0; i < 24; i += 1) blob(r() * 512, r() * 512, 30 + r() * 60, '#d8d8d2', 0.35);
    for (let i = 0; i < 160; i += 1) {
      const x = r() * 512;
      const y = r() * 512;
      const rad = 3 + r() * r() * 26;
      g.fillStyle = 'rgba(40,40,40,0.28)';
      g.beginPath();
      g.arc(x, y, rad, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y, rad, Math.PI * 0.9, Math.PI * 1.9);
      g.stroke();
    }
  } else if (kind === 'mars') {
    g.fillStyle = '#b4532b';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 14; i += 1) blob(r() * 512, r() * 512, 40 + r() * 90, '#5e2815', 0.6);
    for (let i = 0; i < 18; i += 1) blob(r() * 512, r() * 512, 30 + r() * 70, '#e49a62', 0.4);
    for (let i = 0; i < 40; i += 1) {
      const x = r() * 512;
      const y = r() * 512;
      const rad = 3 + r() * 14;
      g.fillStyle = 'rgba(60,20,10,0.25)';
      g.beginPath();
      g.arc(x, y, rad, 0, TAU);
      g.fill();
    }
    blob(256, 6, 70, '#ffffff', 0.9);
    blob(256, 506, 60, '#ffffff', 0.8);
  } else {
    g.fillStyle = '#1b4f9e';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9; i += 1) blob(r() * 512, 90 + r() * 330, 40 + r() * 70, i % 3 ? '#3f8f4a' : '#a58a55', 0.95);
    for (let i = 0; i < 34; i += 1) blob(r() * 512, r() * 512, 18 + r() * 50, '#ffffff', 0.5);
  }
  return c;
}

export function createScene(canvas) {
  const g = canvas.getContext('2d');
  const tex = { moon: makeTexture('moon'), mars: makeTexture('mars'), earth: makeTexture('earth') };
  // Realistic lit spheres are rendered one at a time in the background (keeps the page responsive);
  // until a sprite is ready the simple blob texture above is used.
  const sprites = {};
  const SPRITE = { earth: [512, 0.18, 0.04], moon: [512, 0.5, 0], mars: [512, 0.3, 0] };
  let alive = true;
  ['earth', 'moon', 'mars'].forEach((kind, i) => {
    setTimeout(() => {
      if (!alive) return;
      try {
        const [size, rot, cloud] = SPRITE[kind];
        const px = renderSphere(kind, size, rot, cloud);
        const cv = document.createElement('canvas');
        cv.width = size;
        cv.height = size;
        cv.getContext('2d').putImageData(new ImageData(px, size, size), 0, 0);
        sprites[kind] = cv;
      } catch {
        /* keep the fallback texture */
      }
    }, 150 + i * 400);
  });
  const rand = rng(99);
  const stars = Array.from({ length: 260 }, () => ({
    x: rand() * 2 - 1,
    y: rand() * 2 - 1,
    z: rand() * 0.98 + 0.02,
    s: rand() * 1.3 + 0.4,
    tw: rand() * TAU,
  }));

  const S = {
    W: 1, H: 1, dpr: 1, t: 0, rot: 0,
    phase: 'cockpit', // cockpit | flight | landed (= arrived)
    yaw: 0, pitch: 0, lockTime: 0, locked: false,
    p: 0, warp: 0, shake: 0,
    power: false, nav: false, dest: null, throttle: 0,
    events: [],
  };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    S.W = w;
    S.H = h;
    S.dpr = dpr;
  }

  function start() {
    S.phase = 'flight';
    S.p = 0;
  }

  function update(dt, inp) {
    S.t += dt;
    S.rot += dt * 0.006;
    S.power = inp.power;
    S.nav = inp.nav;
    S.dest = inp.dest;
    S.throttle = inp.throttle;
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 0.9);

    if (S.phase === 'cockpit') {
      if (inp.power) {
        S.yaw = clamp(S.yaw + inp.stick.x * dt * 0.5, -YAW_LIMIT, YAW_LIMIT);
        S.pitch = clamp(S.pitch + inp.stick.y * dt * 0.5, -0.7, 0.7);
      }
      if (inp.dest && inp.power && inp.nav) {
        const T = TARGETS[inp.dest];
        const d = Math.hypot(T.x - S.yaw, T.y - S.pitch);
        S.lockTime = d < 0.05 ? S.lockTime + dt : Math.max(0, S.lockTime - dt * 2);
      } else S.lockTime = 0;
      S.locked = S.lockTime > 0.6;
      S.warp = 0;
    } else if (S.phase === 'flight') {
      const trip = TRIP[S.dest];
      const T = TARGETS[S.dest];
      S.p = clamp(S.p + dt / trip.seconds, 0, 1);
      const k = 1 - Math.exp(-dt * 2.2);
      S.yaw += (T.x - S.yaw) * k;
      S.pitch += (T.y - S.pitch) * k;
      S.warp = ease(clamp(S.p / 0.08, 0, 1)) * (1 - ease(clamp((S.p - 0.82) / 0.18, 0, 1)) * 0.85);
      if (S.p >= 1) {
        S.phase = 'landed';
        S.warp = 0;
        S.events.push('touchdown');
      }
    }
  }

  const proj = (wx, wy, K) => ({ x: S.W / 2 + (wx - S.yaw) * K, y: S.H / 2 - (wy - S.pitch) * K });

  function drawStars(dt) {
    const { W, H } = S;
    const cx = W / 2;
    const cy = H / 2;
    g.fillStyle = '#fff';
    if (S.warp > 0.02) {
      const speed = S.warp * 0.9 * dt;
      g.lineCap = 'round';
      stars.forEach((s) => {
        const prevZ = s.z;
        s.z -= speed * (0.4 + s.s * 0.4);
        if (s.z < 0.03) {
          s.z = 1;
          s.x = Math.random() * 2 - 1;
          s.y = Math.random() * 2 - 1;
          return;
        }
        const x1 = cx + (s.x / s.z) * W * 0.28;
        const y1 = cy + (s.y / s.z) * H * 0.5;
        const x0 = cx + (s.x / prevZ) * W * 0.28;
        const y0 = cy + (s.y / prevZ) * H * 0.5;
        g.strokeStyle = `rgba(190,225,255,${clamp(0.25 + (1 - s.z) * 0.9, 0, 1)})`;
        g.lineWidth = s.s * (1.2 - s.z);
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
      });
    } else {
      stars.forEach((s) => {
        const par = 0.15 + s.z * 0.5;
        let x = ((s.x - S.yaw * par + 3) % 2) - 1;
        let y = ((s.y + S.pitch * par + 3) % 2) - 1;
        x = cx + x * W * 0.5;
        y = cy + y * H * 0.5;
        g.globalAlpha = 0.45 + 0.55 * Math.sin(S.t * 1.3 + s.tw) ** 2;
        g.fillRect(x, y, s.s, s.s);
      });
      g.globalAlpha = 1;
    }
  }

  function drawPlanet(kind, x, y, r) {
    if (r < 1) return;
    const { W, H } = S;
    if (x + r < -20 || x - r > W + 20 || y + r < -20 || y - r > H + 20) return;
    const t = tex[kind];
    // soft atmosphere glow
    if (kind !== 'moon') {
      const glow = g.createRadialGradient(x, y, r * 0.96, x, y, r * 1.14);
      const col = kind === 'earth' ? '90,170,255' : '255,150,90';
      glow.addColorStop(0, `rgba(${col},0.45)`);
      glow.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = glow;
      g.beginPath();
      g.arc(x, y, r * 1.14, 0, TAU);
      g.fill();
    }
    if (sprites[kind]) {
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(sprites[kind], x - r, y - r, 2 * r, 2 * r);
      return;
    }
    g.save();
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.clip();
    const off = (S.rot * (kind === 'earth' ? 2 : 1) * 2 * r) % (2 * r);
    g.drawImage(t, x - r - off, y - r, 2 * r, 2 * r);
    g.drawImage(t, x - r - off + 2 * r, y - r, 2 * r, 2 * r);
    const shade = g.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r * 1.05);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(0.6, 'rgba(0,0,8,0.25)');
    shade.addColorStop(1, 'rgba(0,0,12,0.88)');
    g.fillStyle = shade;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
    g.restore();
  }

  function bracket(x, y, r, color, label) {
    const s = Math.max(r + 14, 26);
    g.strokeStyle = color;
    g.lineWidth = 2;
    const l = 12;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
      g.beginPath();
      g.moveTo(x + sx * s, y + sy * (s - l));
      g.lineTo(x + sx * s, y + sy * s);
      g.lineTo(x + sx * (s - l), y + sy * s);
      g.stroke();
    });
    g.fillStyle = color;
    g.font = 'bold 12px ui-monospace, Menlo, monospace';
    g.textAlign = 'center';
    g.fillText(label, x, y - s - 8);
  }

  function crosshair(color) {
    const cx = S.W / 2;
    const cy = S.H / 2;
    g.strokeStyle = color;
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(cx, cy, 20, 0, TAU);
    g.moveTo(cx - 34, cy);
    g.lineTo(cx - 12, cy);
    g.moveTo(cx + 12, cy);
    g.lineTo(cx + 34, cy);
    g.moveTo(cx, cy - 34);
    g.lineTo(cx, cy - 12);
    g.moveTo(cx, cy + 12);
    g.lineTo(cx, cy + 34);
    g.stroke();
  }

  function draw(dt) {
    const { W, H } = S;
    g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    g.save();
    if (S.shake > 0) g.translate((Math.random() - 0.5) * S.shake * 16, (Math.random() - 0.5) * S.shake * 16);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#01030a');
    bg.addColorStop(1, '#060c22');
    g.fillStyle = bg;
    g.fillRect(-20, -20, W + 40, H + 40);

    const inSpace = true;
    if (inSpace) {
      drawStars(dt);
      const K = Math.min(H * 1.9, W * 0.9);
      const cx = W / 2;
      const cy = H / 2;
      const pf = S.phase === 'cockpit' ? 0 : S.phase === 'flight' ? S.p : 1;
      // Earth shrinks away after launch
      const eFade = 1 - ease(clamp(pf / 0.3, 0, 1));
      if (eFade > 0.01) {
        const e = proj(EARTH.x, EARTH.y, K);
        drawPlanet('earth', e.x, e.y - ease(clamp(pf / 0.3, 0, 1)) * H * 0.4, K * 0.2 * eFade);
      }
      ['moon', 'mars'].forEach((kind) => {
        const T = TARGETS[kind];
        const isTarget = kind === S.dest && S.phase !== 'cockpit';
        const pos = proj(T.x, T.y, K);
        const rBase = K * TRIP[kind].size;
        let r = rBase;
        let x = pos.x;
        let y = pos.y;
        if (S.phase !== 'cockpit') {
          if (isTarget) {
            const R1 = Math.max(W, H) * 1.15;
            const q = ease(Math.pow(pf, 1.6));
            r = rBase + (R1 - rBase) * q;
          } else {
            r = rBase * (1 - ease(clamp(pf * 3, 0, 1)));
          }
        }
        drawPlanet(kind, x, y, r);
        // small distance tag so the player sees how far each world really is
        if (S.phase === 'cockpit' && S.power && !(S.nav && S.dest === kind) && x > 40 && x < W - 40 && y > 20 && y < H - 20) {
          g.fillStyle = 'rgba(190,225,255,0.55)';
          g.font = '11px ui-monospace, Menlo, monospace';
          g.textAlign = 'center';
          g.fillText(`${TRIP[kind].name.toUpperCase()} · ${TRIP[kind].far}`, x, y + r + 18);
        }
        if (S.phase === 'cockpit' && S.nav && S.dest === kind) {
          const col = S.locked ? '#4ade80' : '#22d3ee';
          if (x > 30 && x < W - 30 && y > 30 && y < H - 30) {
            bracket(x, y, r, col, `${TRIP[kind].name.toUpperCase()} · ${TRIP[kind].far} · ${S.locked ? 'TARGET LOCKED' : 'TRACKING'}`);
          } else {
            const ang = Math.atan2(y - cy, x - cx);
            const ax = clamp(cx + Math.cos(ang) * (W / 2 - 28), 28, W - 28);
            const ay = clamp(cy + Math.sin(ang) * (H / 2 - 28), 28, H - 28);
            g.save();
            g.translate(ax, ay);
            g.rotate(ang);
            g.fillStyle = col;
            g.beginPath();
            g.moveTo(14, 0);
            g.lineTo(-8, -9);
            g.lineTo(-8, 9);
            g.closePath();
            g.fill();
            g.restore();
          }
        }
      });
    }
    if (S.power && (S.phase === 'cockpit' || S.phase === 'flight')) crosshair(S.locked ? '#4ade80' : 'rgba(34,211,238,0.85)');
    g.restore();
  }

  function telemetry() {
    const trip = S.dest ? TRIP[S.dest] : null;
    if (S.phase === 'flight' && trip) {
      const km = Math.round(trip.km * (1 - S.p));
      return { km, speed: (11.2 * Math.sin(Math.PI * clamp(S.p, 0.02, 0.98)) ** 0.5).toFixed(1), p: S.p };
    }
    return { p: 0 };
  }

  const destroy = () => {
    alive = false;
  };

  return { S, resize, update, draw, start, telemetry, destroy };
}
