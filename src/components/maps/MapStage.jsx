import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Rocket from './Rocket.jsx';
import MapInfoPanel from './MapInfoPanel.jsx';
import { armPoint, drawGalaxy, drawStarfield } from './galaxyDraw.js';
import { MILKY_WAY_ARMS } from '../../data/spaceMapData.js';
import { playSound } from '../../services/soundService.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const RESET = { s: 1, tx: 0, ty: 0 };

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function GalaxySprite({ item, selected, onPick }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    drawGalaxy(ctx, c.width, c.height, item.spec, hashSeed(item.id), { density: 1, radius: 0.47 });
  }, [item]);
  return (
    <button
      type="button"
      className={`sm-gal ${selected ? 'is-selected' : ''}`}
      style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.size}%` }}
      onClick={() => onPick(item)}
      aria-label={`${item.name}, ${item.distance}`}
    >
      <canvas ref={ref} width={384} height={384} aria-hidden="true" />
      <span className="sm-gal-label">
        <b className={`sm-tone-text-${item.tone}`}>{item.label || item.name}</b>
        <small>{item.distance}</small>
      </span>
    </button>
  );
}

function Marker({ item, selected, onPick }) {
  return (
    <div className="sm-marker" style={{ left: `${item.x}%`, top: `${item.y}%` }}>
      <button
        type="button"
        className={`sm-marker-btn sm-tone-${item.tone} ${selected ? 'is-selected' : ''}`}
        onClick={() => onPick(item)}
        aria-label={`${item.name}, ${item.type}`}
      >
        <span className="sm-ring" aria-hidden="true" />
        <span className="sm-dot" aria-hidden="true" />
        <span className={`sm-label sm-side-${item.side || 'bottom'}`}>{item.name}</span>
      </button>
    </div>
  );
}

/**
 * One interactive map: objects you can tap, a rocket that flies to them, a camera that zooms in,
 * and an info panel that slides in from the right with a real NASA photo.
 *
 * Props
 *   objects    items with x / y (percent). `spec` + `size` makes them galaxy sprites, otherwise glowing markers
 *   mode       'square' (a galaxy picture, objects placed on it) | 'wide' (free layout of galaxies)
 *   bg         { spec, density, radius } → paints a big galaxy behind the markers
 *   showArms   label the Milky Way's spiral arms
 *   home       where the rocket waits at the start { x, y }
 *   onEnter    (item) => void   – "Enter this galaxy" button for galaxy sprites
 *   emptyText  message shown when there is nothing on the map
 */
export default function MapStage({ objects, mode = 'square', bg = null, showArms = false, home, onEnter, emptyText }) {
  const stageRef = useRef(null);
  const worldRef = useRef(null);
  const starRef = useRef(null);
  const galRef = useRef(null);
  const rocketRef = useRef(null);
  const tokenRef = useRef(0);
  const camRef = useRef(RESET);
  const posRef = useRef(home);
  const angRef = useRef(0);

  const [cam, setCam] = useState(RESET);
  const [selected, setSelected] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [flying, setFlying] = useState(false);
  const [narrow, setNarrow] = useState(false);

  const applyCam = useCallback((next) => {
    camRef.current = next;
    setCam(next);
  }, []);

  /* phone layout switch */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  /* starry backdrop + painted galaxy */
  useEffect(() => {
    const c = starRef.current;
    if (c) drawStarfield(c.getContext('2d'), c.width, c.height, 11, 420);
  }, []);
  useEffect(() => {
    const c = galRef.current;
    if (!c || !bg) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    drawGalaxy(ctx, c.width, c.height, bg.spec, 42, { density: bg.density ?? 3, radius: bg.radius ?? 0.46 });
  }, [bg]);

  /* park the rocket */
  useLayoutEffect(() => {
    const r = rocketRef.current;
    if (!r || !home) return;
    r.style.left = `${home.x}%`;
    r.style.top = `${home.y}%`;
    r.style.setProperty('--rot', '0deg');
  }, [home]);

  /* where to zoom so the object sits in the free part of the stage */
  const computeZoom = useCallback(
    (item) => {
      const stage = stageRef.current;
      const world = worldRef.current;
      const W = world.offsetWidth;
      const H = world.offsetHeight;
      const SW = stage.clientWidth;
      const SH = stage.clientHeight;
      const panelW = Math.min(380, SW * 0.92);
      const freeW = narrow ? SW : SW - panelW;
      const spriteW = item.size ? (item.size / 100) * W : 0;
      const s = spriteW ? clamp((0.36 * freeW) / spriteW, 2, 6) : narrow ? 2.1 : 2.6;
      const px = (item.x / 100) * W;
      const py = (item.y / 100) * H;
      const cx = narrow ? SW / 2 : freeW / 2;
      const cy = narrow ? SH * 0.25 : SH / 2;
      return { s, tx: cx - world.offsetLeft - s * px, ty: cy - world.offsetTop - s * py };
    },
    [narrow],
  );

  /* the rocket turns toward the target, then flies there */
  const fly = useCallback(async (item, token) => {
    const world = worldRef.current;
    const rocket = rocketRef.current;
    if (!world || !rocket) return;
    const W = world.offsetWidth;
    const H = world.offsetHeight;
    const from = { ...posRef.current };
    const off = item.size ? { x: item.size * 0.3, y: item.size * 0.34 * (W / H) } : { x: 2.4, y: 3.6 };
    const to = { x: clamp(item.x + off.x, 3, 97), y: clamp(item.y + off.y, 4, 96) };
    const dx = ((to.x - from.x) / 100) * W;
    const dy = ((to.y - from.y) / 100) * H;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) return;

    // turn (always the short way round)
    const target = (Math.atan2(dx, -dy) * 180) / Math.PI;
    const diff = ((target - angRef.current + 540) % 360) - 180;
    angRef.current += diff;
    rocket.style.setProperty('--rot', `${angRef.current}deg`);
    await sleep(420);
    if (token !== tokenRef.current) return;

    const dur = clamp((dist / W) * 2200 + 800, 950, 2400);
    playSound('rocket', { duration: dur / 1000 });
    setFlying(true);
    await new Promise((resolve) => {
      const t0 = performance.now();
      const frame = (now) => {
        if (token !== tokenRef.current) {
          resolve();
          return;
        }
        const k = clamp((now - t0) / dur, 0, 1);
        const e = easeInOut(k);
        const x = from.x + (to.x - from.x) * e;
        const y = from.y + (to.y - from.y) * e;
        rocket.style.left = `${x}%`;
        rocket.style.top = `${y}%`;
        posRef.current = { x, y };
        if (k < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    setFlying(false);
    if (token !== tokenRef.current) return;
    // settle upright
    angRef.current = Math.round(angRef.current / 360) * 360;
    rocket.style.setProperty('--rot', `${angRef.current}deg`);
  }, []);

  const pick = useCallback(
    async (item) => {
      const token = (tokenRef.current += 1);
      setPanelOpen(false);
      if (camRef.current.s !== 1) {
        applyCam(RESET);
        await sleep(700);
        if (token !== tokenRef.current) return;
      }
      setSelected(item);
      await fly(item, token);
      if (token !== tokenRef.current) return;
      playSound('arrive');
      await sleep(250);
      if (token !== tokenRef.current) return;
      playSound('zoom');
      applyCam(computeZoom(item));
      await sleep(900);
      if (token !== tokenRef.current) return;
      setPanelOpen(true);
      playSound('panel');
    },
    [applyCam, computeZoom, fly],
  );

  const close = useCallback(() => {
    tokenRef.current += 1;
    setPanelOpen(false);
    setFlying(false);
    if (camRef.current.s !== 1) {
      playSound('whoosh');
      applyCam(RESET);
    }
  }, [applyCam]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  useEffect(
    () => () => {
      tokenRef.current += 1; // stop any flight when the map is left
    },
    [],
  );

  const arms = showArms
    ? MILKY_WAY_ARMS.map((a) => ({ ...a, ...armPoint(100, 100, a.k, a.t, 4, 0.55, 46) }))
    : [];

  return (
    <div ref={stageRef} className={`sm-stage ${narrow ? 'is-narrow' : ''} ${cam.s !== 1 ? 'is-zoomed' : ''}`}>
      <canvas ref={starRef} className="sm-stars" width={1200} height={800} aria-hidden="true" />
      <div className="sm-world-box">
        <div
          ref={worldRef}
          className={`sm-world ${mode === 'square' ? 'is-square' : 'is-wide'}`}
          style={{ '--s': cam.s, transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})` }}
        >
          {bg && <canvas ref={galRef} className="sm-bg-gal" width={1000} height={1000} aria-hidden="true" />}
          {arms.map((a) => (
            <span key={a.name} className="sm-arm" style={{ left: `${a.x}%`, top: `${a.y}%` }} aria-hidden="true">
              {a.name}
            </span>
          ))}
          {objects.map((o) =>
            o.spec ? (
              <GalaxySprite key={o.id} item={o} selected={selected?.id === o.id} onPick={pick} />
            ) : (
              <Marker key={o.id} item={o} selected={selected?.id === o.id} onPick={pick} />
            ),
          )}
          <div ref={rocketRef} className="sm-rocket">
            <Rocket flying={flying} />
          </div>
        </div>
      </div>

      {objects.length === 0 && (
        <div className="sm-empty" role="status">
          <span aria-hidden="true" className="sm-photo-icon">🛰️</span>
          <p>{emptyText || 'No information yet.'}</p>
        </div>
      )}

      <MapInfoPanel item={selected} open={panelOpen} onClose={close} onEnter={onEnter} narrow={narrow} />
    </div>
  );
}
