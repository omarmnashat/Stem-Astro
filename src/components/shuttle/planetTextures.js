/**
 * Procedural, realistic-looking planet maps (Earth, Moon, Mars) + a tiny software sphere renderer.
 * Pure JS (no DOM) so it can be tested in Node. Maps are equirectangular (W x H) and wrap in X.
 */
 
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
 
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
 
/** Fractal value noise, periodic in X so the map wraps around the planet without a seam. */
function makeFbm(seed, baseX, baseY, octaves, gain = 0.5) {
  const rnd = mulberry(seed);
  const layers = [];
  let norm = 0;
  let amp = 1;
  for (let o = 0; o < octaves; o += 1) {
    const cx = baseX * 2 ** o;
    const cy = baseY * 2 ** o + 1;
    const grid = new Float32Array(cx * cy);
    for (let i = 0; i < grid.length; i += 1) grid[i] = rnd();
    layers.push({ cx, cy, grid, amp });
    norm += amp;
    amp *= gain;
  }
  return (u, v) => {
    let sum = 0;
    for (let o = 0; o < layers.length; o += 1) {
      const { cx, cy, grid, amp: a } = layers[o];
      const x = u * cx;
      const y = v * (cy - 1);
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const xf = x - xi;
      const yf = y - yi;
      const sx = xf * xf * (3 - 2 * xf);
      const sy = yf * yf * (3 - 2 * yf);
      const x0 = ((xi % cx) + cx) % cx;
      const x1 = (x0 + 1) % cx;
      const y0 = clamp(yi, 0, cy - 1);
      const y1 = Math.min(y0 + 1, cy - 1);
      const top = grid[y0 * cx + x0] + (grid[y0 * cx + x1] - grid[y0 * cx + x0]) * sx;
      const bot = grid[y1 * cx + x0] + (grid[y1 * cx + x1] - grid[y1 * cx + x0]) * sx;
      sum += (top + (bot - top) * sy) * a;
    }
    return sum / norm;
  };
}
 
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
function mix3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
 
/** Stamp impact craters into a height field (and an albedo-darkening field). */
function stampCraters(H, W, Hh, count, seed, minR, maxR, depth) {
  const rnd = mulberry(seed);
  for (let n = 0; n < count; n += 1) {
    const cu = rnd();
    const cv = 0.12 + rnd() * 0.76;
    // power-law: many small craters, a few big ones (in pixels)
    const R = minR + (maxR - minR) * rnd() ** 4;
    const lat = (0.5 - cv) * Math.PI;
    const stretch = 1 / Math.max(0.25, Math.cos(lat)); // map stretching toward the poles
    const rx = Math.ceil(R * stretch * 1.9);
    const ry = Math.ceil(R * 1.9);
    const cx = cu * W;
    const cy = cv * Hh;
    for (let dy = -ry; dy <= ry; dy += 1) {
      const y = Math.round(cy + dy);
      if (y < 0 || y >= Hh) continue;
      for (let dx = -rx; dx <= rx; dx += 1) {
        const x = (((Math.round(cx + dx)) % W) + W) % W;
        const d = Math.hypot(dx / stretch, dy) / R;
        if (d > 1.9) continue;
        let h = 0;
        if (d < 1) {
          const bowl = (1 - d * d) * 0.9 + 0.1;
          h = -depth * bowl * (0.45 + 0.55 * smooth(0, 0.5, 1 - d));
        }
        // raised rim + soft ejecta blanket
        h += depth * 0.55 * Math.exp(-(((d - 1.02) / 0.2) ** 2));
        h += depth * 0.12 * Math.exp(-(((d - 1.5) / 0.4) ** 2));
        H[y * W + x] += h;
      }
    }
  }
}
 
/** Emboss-shade a height field: returns per-pixel brightness multiplier (light from upper-left). */
function relief(H, W, Hh, strength) {
  const out = new Float32Array(W * Hh);
  for (let y = 0; y < Hh; y += 1) {
    const ym = Math.max(0, y - 1);
    const yp = Math.min(Hh - 1, y + 1);
    for (let x = 0; x < W; x += 1) {
      const xm = (x - 1 + W) % W;
      const xp = (x + 1) % W;
      const dx = H[y * W + xp] - H[y * W + xm];
      const dy = H[yp * W + x] - H[ym * W + x];
      out[y * W + x] = clamp(1 + (-dx - dy) * strength, 0.45, 1.6);
    }
  }
  return out;
}
 
export const MAP_W = 1024;
export const MAP_H = 512;
 
// ---------------------------------------------------------------------------------------------
// EARTH
// ---------------------------------------------------------------------------------------------
function genEarth() {
  const W = MAP_W;
  const Hh = MAP_H;
  const land = makeFbm(11, 3, 2, 6, 0.52);
  const warp = makeFbm(12, 4, 2, 3, 0.5);
  const moist = makeFbm(13, 5, 3, 4, 0.5);
  const detail = makeFbm(14, 32, 16, 3, 0.55);
  const cloudA = makeFbm(15, 5, 3, 6, 0.55);
  const cloudB = makeFbm(16, 12, 6, 3, 0.5);
  const iceN = makeFbm(17, 8, 4, 3, 0.55);
  const cityN = makeFbm(18, 16, 8, 3, 0.5);
 
  const color = new Uint8ClampedArray(W * Hh * 4);
  const cloud = new Uint8ClampedArray(W * Hh);
  const lights = new Uint8ClampedArray(W * Hh);
  const water = new Uint8ClampedArray(W * Hh); // 255 = ocean (for sun glint)
  const SEA = 0.545;
 
  const deep = hex(0x041a42);
  const mid = hex(0x0b4a8c);
  const shallow = hex(0x2a8fb8);
  const beach = hex(0xcdbf8e);
  const grassLo = hex(0x4c8a3a);
  const forest = hex(0x1f5a2a);
  const savanna = hex(0x9a9a4a);
  const desert = hex(0xcaa468);
  const rock = hex(0x6f6252);
  const snow = hex(0xf2f6fa);
  const tundra = hex(0x8c9a82);
 
  for (let y = 0; y < Hh; y += 1) {
    const v = y / (Hh - 1);
    const lat = Math.abs(v - 0.5) * 2; // 0 equator .. 1 pole
    for (let x = 0; x < W; x += 1) {
      const u = x / W;
      const wu = u + (warp(u, v) - 0.5) * 0.07;
      const wv = clamp(v + (warp(u + 0.31, v) - 0.5) * 0.05, 0, 1);
      let h = land(wu, wv);
      // keep the poles a bit more land-y (Antarctica) and the very top slightly icy
      h += smooth(0.86, 1, lat) * 0.18;
      const i = y * W + x;
      let c;
      if (h < SEA) {
        const depth = clamp((SEA - h) / 0.2, 0, 1);
        c = depth < 0.35 ? mix3(shallow, mid, depth / 0.35) : mix3(mid, deep, (depth - 0.35) / 0.65);
        water[i] = 255;
      } else {
        const e = clamp((h - SEA) / (1 - SEA), 0, 1);
        const m = moist(u, v);
        const dry = clamp((0.52 - m) * 4 + -0.4 * smooth(0.26, 0.36, lat), 0, 1); // deserts in the dry subtropics
        const subtropics = smooth(0.12, 0.3, lat) * (1 - smooth(0.4, 0.55, lat));
        c = mix3(grassLo, forest, smooth(0.35, 0.65, m));
        c = mix3(c, savanna, smooth(0.5, 0.7, 1 - m) * 0.7);
        c = mix3(c, desert, clamp(dry * (0.4 + subtropics), 0, 1));
        c = mix3(c, tundra, smooth(0.62, 0.82, lat));
        c = mix3(c, beach, 1 - smooth(0, 0.035, e));
        c = mix3(c, rock, smooth(0.35, 0.55, e));
        c = mix3(c, snow, smooth(0.58, 0.75, e));
        const d = detail(u, v);
        c = [c[0] * (0.82 + d * 0.36), c[1] * (0.82 + d * 0.36), c[2] * (0.82 + d * 0.36)];
        // city lights: mostly on temperate lowlands
        const cityNoise = cityN(u, v);
        if (e < 0.4 && lat < 0.7 && cityNoise > 0.58) lights[i] = clamp((cityNoise - 0.58) * 900, 0, 255);
      }
      // polar ice caps (both poles) with a ragged edge
      const edge = 0.86 + (iceN(u, v) - 0.5) * 0.14;
      const ice = smooth(edge, edge + 0.07, lat);
      if (ice > 0) {
        c = mix3(c, snow, ice);
        water[i] = water[i] * (1 - ice);
        lights[i] = 0;
      }
      color[i * 4] = c[0];
      color[i * 4 + 1] = c[1];
      color[i * 4 + 2] = c[2];
      color[i * 4 + 3] = 255;
      // clouds: swirly bands, thicker in the tropics and storm belts
      let cl = cloudA(u + (cloudB(u, v) - 0.5) * 0.08, v) * 0.8 + cloudB(u, v) * 0.2;
      cl = (cl - 0.5) * 1.7 + 0.5 + Math.cos(lat * 9) * 0.04;
      cloud[i] = smooth(0.47, 0.68, cl) * 240;
    }
  }
  return { w: W, h: Hh, color, cloud, lights, water };
}
 
// ---------------------------------------------------------------------------------------------
// MOON
// ---------------------------------------------------------------------------------------------
function genMoon() {
  const W = MAP_W;
  const Hh = MAP_H;
  const maria = makeFbm(21, 2, 2, 4, 0.5);
  const grain = makeFbm(22, 64, 32, 3, 0.6);
  const hl = makeFbm(23, 8, 4, 5, 0.55);
  const H = new Float32Array(W * Hh);
  for (let y = 0; y < Hh; y += 1) {
    for (let x = 0; x < W; x += 1) H[y * W + x] = hl(x / W, y / Hh) * 3.2;
  }
  stampCraters(H, W, Hh, 900, 31, 1.5, 14, 1.7);
  stampCraters(H, W, Hh, 14, 32, 16, 40, 2.6);
  const shade = relief(H, W, Hh, 0.15);
 
  const color = new Uint8ClampedArray(W * Hh * 4);
  const mare = hex(0x3d3d41);
  const high = hex(0x9b9a94);
  const bright = hex(0xc4c2ba);
  for (let y = 0; y < Hh; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const u = x / W;
      const v = y / Hh;
      const i = y * W + x;
      const m = smooth(0.43, 0.5, maria(u, v)); // dark basalt seas
      const g = grain(u, v);
      let c = mix3(high, bright, smooth(0.45, 0.7, hl(u + 0.4, v)));
      c = mix3(c, mare, m * 0.9);
      c = mix3(c, high, smooth(0.72, 0.95, Math.abs(v - 0.5) * 2) * 0.55); // hide pole stretching
      const k = (0.84 + g * 0.3) * shade[i];
      color[i * 4] = c[0] * k;
      color[i * 4 + 1] = c[1] * k;
      color[i * 4 + 2] = c[2] * k * 0.99;
      color[i * 4 + 3] = 255;
    }
  }
  return { w: W, h: Hh, color };
}
 
// ---------------------------------------------------------------------------------------------
// MARS
// ---------------------------------------------------------------------------------------------
function genMars() {
  const W = MAP_W;
  const Hh = MAP_H;
  const albedo = makeFbm(41, 4, 2, 6, 0.55);
  const dust = makeFbm(42, 6, 3, 4, 0.5);
  const grain = makeFbm(43, 48, 24, 3, 0.6);
  const elev = makeFbm(44, 5, 3, 6, 0.55);
  const capN = makeFbm(45, 8, 4, 3, 0.55);
  const H = new Float32Array(W * Hh);
  for (let y = 0; y < Hh; y += 1) {
    for (let x = 0; x < W; x += 1) H[y * W + x] = elev(x / W, y / Hh) * 3.6;
  }
  // Valles Marineris-style canyon, a long winding scar just south of the equator
  for (let x = Math.floor(W * 0.18); x < W * 0.5; x += 1) {
    const t = (x - W * 0.18) / (W * 0.32);
    const cy = Hh * (0.54 + Math.sin(t * 5) * 0.012);
    const wid = 4 + 3 * Math.sin(t * Math.PI);
    for (let dy = -9; dy <= 9; dy += 1) {
      const y = Math.round(cy + dy);
      const f = Math.max(0, 1 - Math.abs(dy) / wid);
      if (y >= 0 && y < Hh) H[y * W + x] -= f * 5.5 * Math.sin(t * Math.PI) ** 0.5;
    }
  }
  stampCraters(H, W, Hh, 320, 51, 1.5, 12, 1.5);
  stampCraters(H, W, Hh, 7, 52, 14, 32, 2.4);
  // shield volcano (Olympus Mons-ish): a broad raised dome with a caldera
  const vx = W * 0.14;
  const vy = Hh * 0.42;
  for (let dy = -34; dy <= 34; dy += 1) {
    for (let dx = -50; dx <= 50; dx += 1) {
      const d = Math.hypot(dx / 1.3, dy) / 30;
      if (d < 1) {
        const x = Math.round(vx + dx);
        const y = Math.round(vy + dy);
        if (x >= 0 && x < W && y >= 0 && y < Hh) H[y * W + x] += (1 - d * d) * 6 - (d < 0.18 ? 1.5 : 0);
      }
    }
  }
  const shade = relief(H, W, Hh, 0.14);
 
  const color = new Uint8ClampedArray(W * Hh * 4);
  const rust = hex(0xb4562e);
  const ochre = hex(0xd18a55);
  const pale = hex(0xe4b98a);
  const basalt = hex(0x4a2a22);
  const cap = hex(0xf4f1ee);
  for (let y = 0; y < Hh; y += 1) {
    const v = y / Hh;
    const lat = Math.abs(v - 0.5) * 2;
    for (let x = 0; x < W; x += 1) {
      const u = x / W;
      const i = y * W + x;
      const a = albedo(u, v);
      const d = dust(u, v);
      let c = mix3(rust, ochre, smooth(0.35, 0.65, d));
      c = mix3(c, pale, smooth(0.62, 0.78, d) * 0.55);
      c = mix3(c, basalt, smooth(0.46, 0.6, a) * 0.8 * (1 - smooth(0.6, 0.85, lat)));
      c = mix3(c, ochre, smooth(0.7, 0.94, lat) * 0.6);
      const edge = 0.9 + (capN(u, v) - 0.5) * 0.12;
      c = mix3(c, cap, smooth(edge, edge + 0.04, lat));
      const k = (0.86 + grain(u, v) * 0.28) * shade[i];
      color[i * 4] = c[0] * k;
      color[i * 4 + 1] = c[1] * k;
      color[i * 4 + 2] = c[2] * k;
      color[i * 4 + 3] = 255;
    }
  }
  return { w: W, h: Hh, color };
}
 
const cache = {};
export function getMaps(kind) {
  if (!cache[kind]) cache[kind] = kind === 'earth' ? genEarth() : kind === 'moon' ? genMoon() : genMars();
  return cache[kind];
}
 
// ---------------------------------------------------------------------------------------------
// SPHERE RENDERER
// ---------------------------------------------------------------------------------------------
const LIGHT = (() => {
  const l = [-0.58, 0.42, 0.7];
  const n = Math.hypot(...l);
  return l.map((v) => v / n);
})();
const TILT = { earth: 0.41, moon: 0.1, mars: 0.44 };
const geoCache = {};
 
/** Per-size geometry (texture coordinates + lighting terms); independent of rotation. */
function getGeo(kind, size) {
  const key = `${kind}:${size}`;
  if (geoCache[key]) return geoCache[key];
  const n = size * size;
  const u0 = new Float32Array(n);
  const vv = new Float32Array(n);
  const lam = new Float32Array(n);
  const rim = new Float32Array(n);
  const glint = new Float32Array(n);
  const alpha = new Uint8ClampedArray(n);
  const tilt = TILT[kind];
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const half = size / 2;
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const i = py * size + px;
      const nx = (px + 0.5 - half) / half;
      const ny = -(py + 0.5 - half) / half;
      const rr = nx * nx + ny * ny;
      const r = Math.sqrt(rr);
      alpha[i] = clamp((1 - r) * half + 0.5, 0, 1) * 255;
      if (rr >= 1.02) continue;
      const nz = Math.sqrt(Math.max(0, 1 - rr));
      lam[i] = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
      rim[i] = (1 - nz) ** 3;
      // sun glint (blinn-style) for oceans
      const hx = LIGHT[0];
      const hy = LIGHT[1];
      const hz = LIGHT[2] + 1;
      const hl = Math.hypot(hx, hy, hz);
      glint[i] = Math.max(0, (nx * hx + ny * hy + nz * hz) / hl) ** 70;
      // tilt the globe so the poles show, then derive lon/lat
      const y1 = ny * ct + nz * st;
      const z1 = -ny * st + nz * ct;
      const lat = Math.asin(clamp(y1, -1, 1));
      const lon = Math.atan2(nx, z1);
      u0[i] = lon / TAU + 0.5;
      vv[i] = 0.5 - lat / Math.PI;
    }
  }
  geoCache[key] = { n, u0, vv, lam, rim, glint, alpha };
  return geoCache[key];
}
 
function sampleBilinear(src, w, h, fx, fy, ch, chs, out) {
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const xa = ((x0 % w) + w) % w;
  const xb = (xa + 1) % w;
  const ya = clamp(y0, 0, h - 1);
  const yb = clamp(y0 + 1, 0, h - 1);
  for (let c = 0; c < ch; c += 1) {
    const a = src[(ya * w + xa) * chs + c];
    const b = src[(ya * w + xb) * chs + c];
    const d = src[(yb * w + xa) * chs + c];
    const e = src[(yb * w + xb) * chs + c];
    out[c] = lerp(lerp(a, b, tx), lerp(d, e, tx), ty);
  }
}
 
/**
 * Render a lit, textured sphere into an RGBA buffer.
 * @param {'earth'|'moon'|'mars'} kind
 * @param {number} size   sprite size in px
 * @param {number} rot    rotation in turns (1 = full revolution)
 * @param {number} cloudRot extra cloud drift in turns (Earth only)
 */
export function renderSphere(kind, size, rot = 0, cloudRot = 0) {
  const maps = getMaps(kind);
  const geo = getGeo(kind, size);
  const { w, h, color } = maps;
  const out = new Uint8ClampedArray(size * size * 4);
  const px = [0, 0, 0];
  const cl = [0];
  const lt = [0];
  const wt = [0];
  for (let i = 0; i < geo.n; i += 1) {
    const a = geo.alpha[i];
    if (a === 0) continue;
    const fx = (geo.u0[i] + rot) * w;
    const fy = geo.vv[i] * (h - 1);
    sampleBilinear(color, w, h, fx, fy, 3, 4, px);
    let r = px[0];
    let g = px[1];
    let b = px[2];
    const lam = geo.lam[i];
    const day = smooth(-0.04, 0.3, lam);
    let shadeK;
    let cloudA = 0;
    if (kind === 'earth') {
      sampleBilinear(maps.water, w, h, fx, fy, 1, 1, wt);
      // ocean sun glint
      const gl = geo.glint[i] * (wt[0] / 255) * 0.85;
      r += gl * 255 * 0.9;
      g += gl * 255 * 0.9;
      b += gl * 255 * 0.8;
      // clouds drift slightly faster than the ground
      sampleBilinear(maps.cloud, w, h, (geo.u0[i] + rot + cloudRot) * w, fy, 1, 1, cl);
      cloudA = cl[0] / 255;
      const cloudShade = 0.92 + 0.08 * Math.min(1, cloudA * 1.4);
      r = lerp(r, 252 * cloudShade, cloudA);
      g = lerp(g, 252 * cloudShade, cloudA);
      b = lerp(b, 255 * cloudShade, cloudA);
      shadeK = 0.035 + Math.max(0, lam) ** 0.85 * 1.08;
      r *= shadeK;
      g *= shadeK;
      b *= shadeK;
      // warm band along the terminator (sunrise / sunset)
      const term = Math.exp(-(((lam - 0.06) / 0.09) ** 2)) * 0.22;
      r += term * 90;
      g += term * 42;
      b += term * 14;
      // city lights on the night side (hidden by thick clouds)
      sampleBilinear(maps.lights, w, h, fx, fy, 1, 1, lt);
      const night = 1 - day;
      const city = (lt[0] / 255) * night * (1 - cloudA * 0.8);
      r += city * 255;
      g += city * 190;
      b += city * 95;
      // blue atmospheric limb, strongest on the lit side
      const atm = geo.rim[i] * (0.18 + 0.82 * Math.max(0, lam + 0.25));
      r = lerp(r, 90, Math.min(0.8, atm * 1.15));
      g = lerp(g, 160, Math.min(0.8, atm * 1.15));
      b = lerp(b, 255, Math.min(0.8, atm * 1.15));
    } else if (kind === 'mars') {
      shadeK = 0.03 + Math.max(0, lam) ** 0.8 * 1.1;
      r *= shadeK;
      g *= shadeK;
      b *= shadeK;
      // thin dusty butterscotch haze at the limb
      const atm = geo.rim[i] * (0.15 + 0.85 * Math.max(0, lam + 0.2)) * 0.55;
      r = lerp(r, 235, atm);
      g = lerp(g, 160, atm);
      b = lerp(b, 110, atm);
    } else {
      // Moon: no atmosphere, harsh lighting and a razor-sharp terminator
      shadeK = 0.02 + Math.max(0, lam) ** 0.7 * 1.12;
      r *= shadeK;
      g *= shadeK;
      b *= shadeK;
    }
    const o = i * 4;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = a;
  }
  return out;
}