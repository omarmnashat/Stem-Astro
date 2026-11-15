import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Music, Volume2, VolumeX } from 'lucide-react';
import { useApp } from '../hooks/useApp.jsx';
import { playSound } from '../services/soundService.js';
import { setMusicLevel, setRumble } from '../services/musicService.js';
import { createScene, TRIP } from '../components/shuttle/shuttleScene.js';
import DestinationBriefing from '../components/shuttle/DestinationBriefing.jsx';
import NovaMessage from '../components/NovaMessage.jsx';
import {
  DestinationKnob,
  HandController,
  IgnitionButton,
  Plate,
  ShuttleIcon,
  ThrottleLever,
  ToggleSwitch,
} from '../components/shuttle/Controls.jsx';

// Nova's flight-school tutorial runs on EVERY boarding (nothing is remembered between visits).

function getEduSession() {
  try {
    return JSON.parse(localStorage.getItem('astra_edu_session') || '{}') || {};
  } catch {
    return {};
  }
}

const STEPS = [
  { id: 'power', title: 'Main Power', text: 'Flip the MAIN POWER switch UP to wake up the shuttle’s computers.', done: (s) => s.power },
  { id: 'nav', title: 'Navigation Computer', text: 'Now switch ON the NAV COMPUTER. It puts a tracking marker on your target in the window.', done: (s) => s.nav },
  { id: 'dest', title: 'Choose a Destination', text: 'Turn the DESTINATION knob (or tap MOON / MARS) to pick where you want to go. A mission briefing about that world opens.', done: (s) => !!s.dest },
  { id: 'steer', title: 'Aim the Shuttle', text: 'Hold and drag the HAND CONTROLLER (or use the arrow keys) until the crosshair sits on your target. The Moon is close, but Mars is a tiny dot far away: follow the arrow! Hold it there until it says TARGET LOCKED.', done: (s) => s.locked },
  { id: 'throttle', title: 'Main Engine Throttle', text: 'Slide the THROTTLE lever up past the green line (70%), or press W.', done: (s) => s.throttle >= 0.7 },
  { id: 'arm', title: 'Arm the Engines', text: 'Lift the yellow safety cover on the ENGINE START button.', done: (s) => s.armed },
  { id: 'ignite', title: 'Ignition!', text: 'Press IGNITION. Then the autopilot flies you all the way to the surface.', done: (s) => s.phase !== 'cockpit' },
];

const CONTROL_HELP = [
  ['MAIN POWER', 'Switch UP to power the shuttle. Nothing works without it.'],
  ['NAV COMPUTER', 'Shows a tracking marker on your destination and checks your aim.'],
  ['DESTINATION KNOB', 'Click the knob or tap MOON / MARS to choose where you are going. A mission briefing opens.'],
  ['MISSION BRIEFING', 'Reopen the facts, resources and rules for your chosen world any time.'],
  ['HAND CONTROLLER', 'Drag the red ball (or use the arrow keys) to turn the shuttle. Aim the crosshair at the target until it says TARGET LOCKED.'],
  ['THROTTLE', 'Slide up to add engine power (keys W / S). You need at least 70% to launch.'],
  ['ENGINE START', 'Lift the safety cover, then press IGNITION. It only works when everything above is ready.'],
];

function useNasaReference(active) {
  const [ref, setRef] = useState(null);
  useEffect(() => {
    if (!active || ref) return undefined;
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    fetch('https://images-api.nasa.gov/search?q=space%20shuttle%20flight%20deck&media_type=image', { signal: ctrl.signal })
      .then((r) => r.json())
      .then((json) => {
        const item = (json?.collection?.items || []).find((i) => i.links?.[0]?.href && i.data?.[0]);
        if (!cancelled && item) {
          setRef({ img: item.links[0].href, title: item.data[0].title, id: item.data[0].nasa_id });
        }
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [active, ref]);
  return ref;
}

export default function ShuttleCockpit() {
  const { game, profile, settings, updateSettings, updateProfile, abandonMission, startMission } = useApp();
  const navigate = useNavigate();

  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const inputsRef = useRef({});

  const [doors, setDoors] = useState('closed'); // closed | opening | open
  const [phase, setPhase] = useState('cockpit');
  const [power, setPower] = useState(false);
  const [nav, setNav] = useState(false);
  const [dest, setDest] = useState(null);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const [throttle, setThrottle] = useState(0);
  const [armed, setArmed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [tele, setTele] = useState({});
  const [warn, setWarn] = useState('');
  const [step, setStep] = useState(0);
  const [tutorialOn, setTutorialOn] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const briefSeen = useRef({});
  const [landed, setLanded] = useState(false);
  const nasaRef = useNasaReference(helpOpen);

  const unfinished = game?.status === 'playing';
  // Once the trip reaches 100 % we leave the cockpit; the landing is shown in the 3D mission.
  const exterior = phase === 'landed';
  const entered = doors !== 'closed';
  const hl = tutorialOn && entered && phase === 'cockpit' ? STEPS[step]?.id : null;

  inputsRef.current = { power, nav, dest, stick, throttle };

  // ---------- music ducking + engine rumble ----------
  useEffect(() => {
    setMusicLevel(0.55);
    return () => {
      setMusicLevel(1);
      setRumble(0);
    };
  }, []);
  useEffect(() => {
    if (phase === 'cockpit') setRumble(power ? 0.08 + throttle * 0.35 : 0);
    else if (phase === 'flight') setRumble(0.75);
    else setRumble(0);
  }, [phase, throttle, power]);

  // ---------- scene + main loop ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = createScene(canvas);
    sceneRef.current = scene;
    const ro = new ResizeObserver(() => scene.resize());
    ro.observe(canvas);
    scene.resize();

    let raf;
    let last = performance.now();
    let teleClock = 0;
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      scene.update(dt, inputsRef.current);
      scene.draw(dt);
      const S = scene.S;
      setLocked((v) => (v === S.locked ? v : S.locked));
      while (S.events.length) {
        const ev = S.events.shift();
        if (ev === 'touchdown') {
          setPhase('landed');
          setLanded(true);
          playSound('success');
        }
      }
      teleClock += dt;
      if (teleClock > 0.1) {
        teleClock = 0;
        setTele(scene.telemetry());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.destroy();
    };
  }, []);

  // ---------- keyboard ----------
  useEffect(() => {
    const keys = new Set();
    const sync = () =>
      setStick({
        x: (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0),
        y: (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0),
      });
    const down = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (e.target?.getAttribute?.('role') === 'slider') return;
        e.preventDefault();
        keys.add(e.key);
        sync();
      } else if (e.key === 'w' || e.key === 'W') setThrottle((t) => Math.min(1, t + 0.05));
      else if (e.key === 's' || e.key === 'S') setThrottle((t) => Math.max(0, t - 0.05));
      else if (e.key === 'Escape') {
        setHelpOpen(false);
        setBriefOpen(false);
      }
    };
    const up = (e) => {
      if (keys.delete(e.key)) sync();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // ---------- tutorial progress ----------
  useEffect(() => {
    if (!tutorialOn || !entered) return;
    const cur = STEPS[step];
    if (cur && cur.done({ power, nav, dest, locked, throttle, armed, phase })) {
      playSound('click');
      if (step + 1 >= STEPS.length) {
        setTutorialOn(false);
      } else setStep(step + 1);
    }
  }, [tutorialOn, entered, step, power, nav, dest, locked, throttle, armed, phase]);

  // ---------- warnings ----------
  useEffect(() => {
    if (!warn) return undefined;
    const t = setTimeout(() => setWarn(''), 3200);
    return () => clearTimeout(t);
  }, [warn]);

  // ---------- finish: land on the surface = start the mission ----------
  const finishRef = useRef(null);
  finishRef.current = () => {
    const session = getEduSession();
    const nickname = (session.username || profile?.nickname || '').trim() || 'Commander';
    const classTeam = session.classTeam || '4-A';
    if (unfinished) abandonMission();
    updateProfile({ planet: dest, nickname, classTeam });
    startMission(dest, { nickname, classTeam });
    navigate('/mission');
  };
  useEffect(() => {
    if (!landed) return undefined;
    const t = setTimeout(() => finishRef.current(), 3200);
    return () => clearTimeout(t);
  }, [landed]);

  // ---------- handlers ----------
  const flip = (setter, name) => (v) => {
    playSound('switch');
    setter(v);
    if (name === 'power' && !v) {
      setNav(false);
      setArmed(false);
    }
  };
  const onNav = (v) => {
    if (!power && v) {
      playSound('warning');
      setWarn('NAV COMPUTER: NO POWER. Switch MAIN POWER on first.');
      return;
    }
    flip(setNav)(v);
  };
  const onDest = (d) => {
    if (!power) {
      playSound('warning');
      setWarn('DESTINATION: NO POWER. Switch MAIN POWER on first.');
      return;
    }
    playSound('switch');
    setDest(d);
    // First time a world is picked: open its mission briefing (what the old planet pages showed).
    if (d && !briefSeen.current[d]) {
      briefSeen.current[d] = true;
      setBriefOpen(true);
    }
  };
  const onStick = (v) => setStick(v);
  const onArm = () => {
    playSound('switch');
    setArmed((a) => !a);
  };
  const onIgnite = () => {
    const problem = !power
      ? 'MAIN POWER is OFF.'
      : !nav
        ? 'NAV COMPUTER is OFF.'
        : !dest
          ? 'No DESTINATION selected.'
          : !locked
            ? 'Target not locked. Aim the crosshair at the planet with the hand controller.'
            : throttle < 0.7
              ? 'Throttle too low. Push it above the green line (70%).'
              : !armed
                ? 'Lift the safety cover first.'
                : '';
    if (problem) {
      playSound('warning');
      setWarn(`IGNITION INHIBIT: ${problem}`);
      return;
    }
    playSound('ignite');
    setPhase('flight');
    sceneRef.current.start();
    setTutorialOn(false);
  };

  const enter = () => {
    playSound('success');
    setStep(0);
    setTutorialOn(true);
    setDoors('opening');
    setTimeout(() => setDoors('open'), 1100);
  };

  const replayTutorial = () => {
    setHelpOpen(false);
    setStep(0);
    setTutorialOn(true);
  };
  const skipTutorial = () => setTutorialOn(false);

  // ---------- display text ----------
  const destName = dest ? TRIP[dest].name.toUpperCase() : '--';
  const pct = Math.round(throttle * 100);
  const km = tele.km != null ? tele.km.toLocaleString('en-US') : '';
  let rows;
  if (phase === 'flight') {
    const stage = tele.p < 0.1 ? 'ENGINE BURN' : tele.p > 0.85 ? 'BRAKING BURN' : 'CRUISE';
    rows = [
      ['PHASE', `${stage}`],
      ['TARGET', destName],
      ['DISTANCE', `${km} km`],
      ['VELOCITY', `${tele.speed ?? 0} km/s`],
      ['AUTOPILOT', 'ENGAGED'],
      ['PROGRESS', `${Math.round((tele.p || 0) * 100)}%`],
    ];
  } else if (phase === 'landed') {
    rows = [
      ['PHASE', 'ARRIVED'],
      ['TARGET', destName],
      ['NEXT', 'LANDING SEQUENCE'],
    ];
  } else {
    rows = [
      ['POWER', power ? 'ON' : 'OFF'],
      ['NAV COMPUTER', nav ? 'ONLINE' : 'OFFLINE'],
      ['DESTINATION', destName],
      ['TARGET LOCK', locked ? 'LOCKED' : nav && dest ? 'SEARCHING…' : '--'],
      ['THROTTLE', `${pct}%`],
      ['ENGINES', armed ? 'ARMED' : 'SAFE'],
    ];
  }
  const statusLine = warn || (phase === 'cockpit' ? (!power ? 'SHUTTLE ASLEEP. START WITH MAIN POWER.' : 'READY FOR LAUNCH CHECKLIST') : '');

  const step_ = STEPS[step];

  return (
    <div className="cp-root fixed inset-0 z-[60] flex select-none flex-col bg-black text-slate-100">
      {/* top bar */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-700 bg-[#14161b] px-3 py-2">
        <Link to="/" className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs font-bold tracking-wider text-slate-200 hover:bg-slate-800">
          <ArrowLeft size={14} aria-hidden="true" /> EXIT
        </Link>
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.25em] text-amber-300">
          <ShuttleIcon size={20} /> SPACE SHUTTLE · FLIGHT DECK
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`cp-alarm ${warn ? 'on' : ''}`} title="Master alarm" />
          <button
            type="button"
            className="rounded-lg border border-slate-600 p-1.5 text-slate-200 hover:bg-slate-800"
            onClick={() => updateSettings({ music: settings.music === false })}
            aria-label="Toggle background music"
          >
            <Music size={15} className={settings.music === false ? 'opacity-40' : 'text-cyan-300'} />
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-600 p-1.5 text-slate-200 hover:bg-slate-800"
            onClick={() => updateSettings({ sound: !settings.sound })}
            aria-label="Toggle sound effects"
          >
            {settings.sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
        </div>
      </div>

      {/* windshield */}
      <div
        className={`relative min-h-[170px] overflow-hidden bg-black ${
          exterior ? 'flex-1 border-0' : 'flex-[1.1] border-y-[6px] border-[#2a2e36]'
        }`}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="Shuttle windshield view" />
        {!exterior && <span className="cp-frame-strut" style={{ left: '33%' }} />}
        {!exterior && <span className="cp-frame-strut" style={{ left: '66%' }} />}
        <div
          className={`pointer-events-none absolute inset-0 ${
            exterior ? 'shadow-[inset_0_0_90px_rgba(0,0,0,0.55)]' : 'shadow-[inset_0_0_60px_rgba(0,0,0,0.85)]'
          }`}
        />

        {/* tutorial coach */}
        {tutorialOn && entered && phase === 'cockpit' && step_ && (
          <div className="absolute bottom-2 left-1/2 z-10 w-[min(94%,620px)] -translate-x-1/2 rounded-xl border border-amber-300/60 bg-black/80 p-3">
            <div className="flex items-center justify-between text-[10px] font-bold tracking-[0.2em] text-amber-300">
              <span>FLIGHT SCHOOL · STEP {step + 1} / {STEPS.length}</span>
              <button type="button" onClick={skipTutorial} className="rounded border border-slate-500 px-2 py-0.5 text-slate-300 hover:bg-slate-800">
                SKIP
              </button>
            </div>
            <NovaMessage className="mt-1.5" size={54} compact mood={step === 0 ? 'wave' : 'happy'} title={step_.title}>
              {step_.text}
            </NovaMessage>
          </div>
        )}
        {phase === 'flight' && (
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-lg border border-cyan-300/50 bg-black/60 px-4 py-1.5 text-xs font-bold tracking-[0.2em] text-cyan-200">
            AUTOPILOT ENGAGED · SIT BACK AND ENJOY THE TRIP TO THE {destName}
          </div>
        )}
        {landed && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/55 text-center">
            <div>
              <p className="font-display text-4xl font-bold tracking-wide text-white sm:text-6xl">ARRIVED!</p>
              <p className="mt-2 text-lg text-cyan-200">The {TRIP[dest]?.name} is right below us, Commander.</p>
              <p className="mt-1 text-sm text-slate-300">Get ready to land… starting your mission.</p>
            </div>
          </div>
        )}
      </div>

      {/* console */}
      {!exterior && (
      <div className="cp-console thin-scroll min-h-0 flex-1 overflow-y-auto p-2.5 sm:p-3">
        <div className="mx-auto grid max-w-6xl gap-2.5 md:grid-cols-[1.1fr_1.2fr_1fr]">
          <Plate title="SYSTEMS">
            <div className="flex flex-wrap items-start justify-center gap-1">
              <ToggleSwitch label="MAIN POWER" sub={power ? 'ON' : 'OFF'} on={power} onChange={flip(setPower, 'power')} hl={hl === 'power'} />
              <ToggleSwitch label="NAV COMPUTER" sub={nav ? 'ONLINE' : 'OFFLINE'} on={nav} onChange={onNav} hl={hl === 'nav'} ledColor="#22d3ee" />
              <DestinationKnob dest={dest} onChange={onDest} hl={hl === 'dest'} />
            </div>
          </Plate>

          <Plate title="FLIGHT DISPLAY / CONTROL">
            <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto]">
              <div className="cp-screen" aria-live="polite">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <span className="opacity-70">{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
                {statusLine && <div className={`mt-1.5 border-t border-emerald-900 pt-1.5 ${warn ? 'bad' : 'warn'}`}>▶ {statusLine}</div>}
              </div>
              <HandController value={stick} onChange={onStick} hl={hl === 'steer'} />
            </div>
          </Plate>

          <Plate title="PROPULSION">
            <div className="flex flex-wrap items-start justify-center gap-3">
              <ThrottleLever value={throttle} onChange={setThrottle} hl={hl === 'throttle'} />
              <IgnitionButton armed={armed} onArm={onArm} onPress={onIgnite} hlArm={hl === 'arm'} hlPress={hl === 'ignite'} />
              <div className="flex flex-col items-center gap-1 self-center p-1">
                <button type="button" className="cp-btn-ctl" onClick={() => setHelpOpen(true)}>
                  CONTROLS
                </button>
                <span className="cp-sub">how to fly</span>
                <button
                  type="button"
                  className="cp-btn-ctl mt-1.5"
                  onClick={() => (dest ? setBriefOpen(true) : (playSound('warning'), setWarn('MISSION BRIEFING: choose a DESTINATION first.')))}
                >
                  MISSION BRIEFING
                </button>
                <span className="cp-sub">{dest ? `about the ${TRIP[dest].name}` : 'pick a destination'}</span>
              </div>
            </div>
          </Plate>
        </div>
      </div>
      )}

      {/* boarding doors */}
      {doors !== 'open' && (
        <div className="absolute inset-0 z-20">
          <div className={`cp-door l ${doors === 'opening' ? 'opening' : ''}`} />
          <div className={`cp-door r ${doors === 'opening' ? 'opening' : ''}`} />
          <div
            className={`absolute inset-0 z-[4] grid place-items-center bg-transparent p-4 text-center transition-opacity duration-500 ${
              doors === 'opening' ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
          >
            <div className="max-w-md">
              <ShuttleIcon size={110} className="mx-auto text-slate-200" />
              <h1 className="mt-3 font-display text-3xl font-bold tracking-wide text-white sm:text-4xl">SPACE SHUTTLE</h1>
              <p className="mt-1 text-sm tracking-[0.25em] text-amber-300">BOARDING COMPLETE</p>
              <p className="mt-4 text-slate-200">
                Welcome aboard, Commander! You will learn to fly the shuttle to the <b>Moon</b> or <b>Mars</b>, then land on the surface to begin your mission.
              </p>
              {unfinished && (
                <p className="mt-3 rounded-lg border border-amber-300/50 bg-amber-300/10 p-2 text-xs text-amber-100">
                  You have an unfinished mission. Landing here starts a NEW mission and replaces it.{' '}
                  <Link to="/mission" className="font-bold underline">
                    Resume it instead
                  </Link>
                </p>
              )}
              <button type="button" onClick={enter} className="btn btn-primary btn-lg mt-6">
                ENTER THE COCKPIT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* destination briefing (opens when a destination is selected) */}
      {briefOpen && dest && <DestinationBriefing dest={dest} onClose={() => setBriefOpen(false)} />}

      {/* controls help */}
      {helpOpen && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/80 p-3" role="dialog" aria-modal="true" aria-label="Shuttle controls">
          <div className="thin-scroll max-h-full w-full max-w-3xl overflow-y-auto rounded-2xl border border-cyan-300/40 bg-[#10131a] p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-white">Shuttle Controls</h2>
              <button type="button" className="btn btn-ghost !min-h-[38px] !px-3 !py-1 text-sm" onClick={() => setHelpOpen(false)}>
                Close ✕
              </button>
            </div>
            <ol className="mt-3 space-y-2 text-sm">
              {CONTROL_HELP.map(([k, v], i) => (
                <li key={k} className="flex gap-3 rounded-lg bg-white/5 p-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-300 text-xs font-bold text-black">{i + 1}</span>
                  <span>
                    <b className="tracking-wider text-amber-200">{k}</b> — <span className="text-slate-200">{v}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-3 rounded-lg bg-cyan-400/10 p-2.5 text-sm text-cyan-100">
              <b>Keyboard:</b> Arrow keys = hand controller · W / S = throttle up / down · Esc = close this window.
            </p>
            <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-2.5">
              <p className="text-xs font-bold tracking-[0.15em] text-slate-300">NASA REFERENCE · SPACE SHUTTLE FLIGHT DECK</p>
              {nasaRef ? (
                <figure className="mt-2">
                  <img src={nasaRef.img} alt={nasaRef.title} className="max-h-60 w-full rounded-lg object-cover" loading="lazy" />
                  <figcaption className="mt-1 text-xs text-slate-300">
                    {nasaRef.title} · Image: NASA ({nasaRef.id}) via NASA Image and Video Library
                  </figcaption>
                </figure>
              ) : (
                <p className="mt-1 text-xs text-slate-400">Loading a real NASA photo of the flight deck… (needs internet). Our cockpit is a simplified, game-friendly version of it.</p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn btn-gold !min-h-[42px]" onClick={replayTutorial}>
                Replay the tutorial
              </button>
              <button type="button" className="btn btn-ghost !min-h-[42px]" onClick={() => setHelpOpen(false)}>
                Back to the cockpit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
