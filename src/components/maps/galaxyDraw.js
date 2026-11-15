/**
 * Procedural painting of galaxies on a <canvas>.
 * Original artwork generated with maths (log-spiral arms, gaussian bulges, rings…),
 * so there is nothing to download. Deterministic: the same seed gives the same picture.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rnd) {
  // Box–Muller
  const u = Math.max(1e-9, rnd());
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function dot(ctx, x, y, size, rgb, alpha) {
  ctx.fillStyle = `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${alpha})`;
  ctx.fillRect(x - size / 2, y - size / 2, size, size);
}

/** Dark space with a scatter of twinkly stars (used as the stage background). */
export function drawStarfield(ctx, w, h, seed = 7, count = 380) {
  const rnd = mulberry32(seed);
  const g = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
  g.addColorStop(0, '#120f33');
  g.addColorStop(0.55, '#0a0b25');
  g.addColorStop(1, '#05071a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const unit = Math.max(1, Math.min(w, h) / 600);
  for (let i = 0; i < count; i += 1) {
    const x = rnd() * w;
    const y = rnd() * h;
    const bright = rnd();
    const size = (bright > 0.97 ? 2.4 : bright > 0.85 ? 1.6 : 1) * unit;
    const tint = rnd();
    const rgb = tint < 0.2 ? [255, 214, 170] : tint < 0.45 ? [175, 205, 255] : [255, 255, 255];
    dot(ctx, x, y, size, rgb, 0.25 + bright * 0.7);
  }
}

const ARM_B = 0.3;
const ARM_R0 = 0.13;

/** Point on logarithmic spiral arm `k` at parameter t (0 = near centre, 1 = outer edge). Returns px coordinates. */
export function armPoint(w, h, k, t, arms = 4, rot = 0.55, R = Math.min(w, h) * 0.46) {
  const turn = Math.log(1 / ARM_R0) / ARM_B;
  const theta = rot + (k * 2 * Math.PI) / arms + t * turn;
  const r = R * ARM_R0 * Math.exp(ARM_B * t * turn);
  return { x: w / 2 + Math.cos(theta) * r, y: h / 2 + Math.sin(theta) * r };
}

/**
 * Paint a galaxy.
 *   spec.kind   'spiral' | 'irregular' | 'elliptical' | 'sombrero' | 'ring'
 *   spec.arms   number of spiral arms (spiral)
 *   spec.bar    true for a stellar bar
 *   spec.tilt   1 = face-on, 0.3 = nearly edge-on
 *   spec.rot    rotation in radians
 *   spec.core / spec.arm  colours (hex)
 *   opts.density  multiplies the number of stars
 *   opts.radius   outer radius as a fraction of the smaller canvas side
 */
export function drawGalaxy(ctx, w, h, spec, seed = 1, opts = {}) {
  const rnd = mulberry32(seed);
  const density = opts.density ?? 1;
  const R = Math.min(w, h) * (opts.radius ?? 0.46);
  const unit = Math.max(0.7, Math.min(w, h) / 420);
  const tilt = spec.tilt ?? 1;
  const rot = spec.rot ?? 0;
  const cosr = Math.cos(rot);
  const sinr = Math.sin(rot);
  const core = hexToRgb(spec.core || '#ffe3a6');
  const armC = hexToRgb(spec.arm || '#a9c6ff');
  const pink = [255, 150, 190];
  const cx = w / 2;
  const cy = h / 2;

  // galaxy-plane (px, py) → canvas
  const place = (px, py) => {
    const yy = py * tilt;
    return { x: cx + px * cosr - yy * sinr, y: cy + px * sinr + yy * cosr };
  };

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const glow = (radius, rgb, alpha, squashY = tilt) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(1, squashY);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    g.addColorStop(0, `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${alpha})`);
    g.addColorStop(0.4, `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${alpha * 0.28})`);
    g.addColorStop(1, `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const bulge = (n, sigma, squash = 1) => {
    for (let i = 0; i < n * density; i += 1) {
      const p = place(gauss(rnd) * sigma, gauss(rnd) * sigma * squash);
      dot(ctx, p.x, p.y, (0.8 + rnd() * 1.3) * unit, mix(core, [255, 255, 255], rnd() * 0.5), 0.25 + rnd() * 0.6);
    }
  };

  switch (spec.kind) {
    case 'irregular': {
      glow(R * 0.8, armC, 0.1);
      const blobs = Array.from({ length: 6 }, () => ({ x: gauss(rnd) * R * 0.32, y: gauss(rnd) * R * 0.28, s: R * (0.12 + rnd() * 0.14) }));
      blobs.forEach((b) => {
        for (let i = 0; i < 260 * density; i += 1) {
          const p = place(b.x + gauss(rnd) * b.s, b.y + gauss(rnd) * b.s);
          dot(ctx, p.x, p.y, (0.8 + rnd() * 1.4) * unit, mix(armC, rnd() < 0.15 ? pink : core, rnd() * 0.6), 0.22 + rnd() * 0.6);
        }
      });
      glow(R * 0.3, core, 0.35);
      break;
    }
    case 'elliptical': {
      glow(R * 0.9, core, 0.22);
      bulge(1600, R * 0.3, 0.85);
      glow(R * 0.25, core, 0.5);
      break;
    }
    case 'sombrero': {
      glow(R * 0.95, armC, 0.16, tilt * 1.2);
      bulge(1200, R * 0.2, 1);
      // stellar disc: wide and thin
      for (let i = 0; i < 2600 * density; i += 1) {
        const x = gauss(rnd) * R * 0.42;
        const y = gauss(rnd) * R * 0.07;
        const p = place(x, y / Math.max(tilt, 0.2));
        dot(ctx, p.x, p.y, (0.7 + rnd() * 1.1) * unit, mix(core, armC, Math.min(1, Math.abs(x) / (R * 0.7))), 0.2 + rnd() * 0.55);
      }
      glow(R * 0.2, core, 0.55, 1);
      ctx.restore();
      // dark dust lane painted on top
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.fillStyle = 'rgba(8,6,18,0.62)';
      ctx.beginPath();
      ctx.ellipse(0, R * 0.02, R * 0.78, R * 0.035, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    case 'ring': {
      glow(R * 0.2, core, 0.5);
      bulge(200, R * 0.07, 1);
      for (let i = 0; i < 2600 * density; i += 1) {
        const a = rnd() * Math.PI * 2;
        const r = R * (0.7 + gauss(rnd) * 0.045);
        const p = place(Math.cos(a) * r, Math.sin(a) * r);
        const knot = rnd() < 0.12;
        dot(ctx, p.x, p.y, (knot ? 2.2 : 1) * unit * (0.8 + rnd()), mix(armC, knot ? pink : [255, 255, 255], rnd() * 0.5), 0.3 + rnd() * 0.6);
      }
      for (let i = 0; i < 500 * density; i += 1) {
        const a = rnd() * Math.PI * 2;
        const r = R * (0.28 + gauss(rnd) * 0.05);
        const p = place(Math.cos(a) * r, Math.sin(a) * r);
        dot(ctx, p.x, p.y, unit, mix(core, armC, 0.5), 0.2 + rnd() * 0.35);
      }
      // faint spokes between the hub and the ring
      for (let s = 0; s < 6; s += 1) {
        const a0 = (s / 6) * Math.PI * 2 + 0.3;
        for (let i = 0; i < 70 * density; i += 1) {
          const r = R * (0.3 + rnd() * 0.4);
          const p = place(Math.cos(a0) * r + gauss(rnd) * R * 0.02, Math.sin(a0) * r + gauss(rnd) * R * 0.02);
          dot(ctx, p.x, p.y, unit * 0.9, armC, 0.18);
        }
      }
      break;
    }
    default: {
      // spiral (optionally barred)
      const arms = spec.arms || 2;
      const turn = Math.log(1 / ARM_R0) / ARM_B;
      glow(R * 1.0, armC, 0.1);
      bulge(1100, R * 0.13, 0.9);
      if (spec.bar) {
        for (let i = 0; i < 700 * density; i += 1) {
          const p = place(gauss(rnd) * R * 0.2, gauss(rnd) * R * 0.045);
          dot(ctx, p.x, p.y, (0.8 + rnd()) * unit, mix(core, [255, 255, 255], rnd() * 0.4), 0.3 + rnd() * 0.5);
        }
      }
      const perArm = 1300 * density;
      for (let k = 0; k < arms; k += 1) {
        for (let i = 0; i < perArm; i += 1) {
          const t = Math.pow(rnd(), 0.85);
          const theta = (spec.bar ? 0.0 : 0) + (k * 2 * Math.PI) / arms + t * turn;
          const r = R * ARM_R0 * Math.exp(ARM_B * t * turn);
          const spread = r * (0.05 + 0.09 * t) * gauss(rnd);
          const px = Math.cos(theta) * r + Math.cos(theta + Math.PI / 2) * spread;
          const py = Math.sin(theta) * r + Math.sin(theta + Math.PI / 2) * spread;
          const p = place(px, py);
          const hot = rnd() < 0.07 * t;
          const rgb = hot ? pink : mix(core, armC, Math.min(1, t * 1.4));
          dot(ctx, p.x, p.y, (0.7 + rnd() * 1.2) * unit, rgb, (0.18 + rnd() * 0.55) * (1 - t * 0.35));
        }
      }
      // inter-arm haze
      for (let i = 0; i < 900 * density; i += 1) {
        const r = R * (0.15 + rnd() * 0.85);
        const a = rnd() * Math.PI * 2;
        const p = place(Math.cos(a) * r, Math.sin(a) * r);
        dot(ctx, p.x, p.y, unit * 0.8, armC, 0.07 + rnd() * 0.1);
      }
      glow(R * 0.22, core, 0.6);
    }
  }
  ctx.restore();
}
