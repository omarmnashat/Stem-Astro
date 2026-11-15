import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Moon,
  PanelRightOpen,
  PanelRightClose,
  ExternalLink,
  X,
  Satellite,
  Coins,
  Loader2,
  CheckCircle2,
  Calculator,
} from 'lucide-react';
import PlanetaryEnvironment from './PlanetaryEnvironment.jsx';
import SimulationHUD, { ViewportOverlays, buildSimulationAlerts } from './SimulationHUD.jsx';
import ScenarioCard from '../ScenarioCard.jsx';
import OutcomeCard from '../OutcomeCard.jsx';
import ActionPanel from '../ActionPanel.jsx';
import SpaceCalculator from '../SpaceCalculator.jsx';
import { CrewPanel, LogPanel, TimelinePanel } from '../DashboardPanels.jsx';
import { DIFFICULTIES } from '../../engine/missionConfig.js';
import { getScenarioView } from '../../engine/scenarioEngine.js';
import { resolveModuleMedia, FALLBACK_NASA_IMAGE } from '../../data/nasaMediaCatalog.js';
import { addCoins, getCoins, spendCoins } from '../../utils/coinsManager.js';
import { MISSION_EVENT } from '../../utils/missionEvents.js';
import { DAY_CLEAR_BONUS, TASK_REWARD, getDailyMission } from '../../data/dailyMissions.js';

const loadMissionStore = (missionId) => {
  try {
    const raw = JSON.parse(localStorage.getItem(`exolife_daily_${missionId}`) || 'null');
    if (raw && typeof raw === 'object') return { counts: raw.counts || {}, rewarded: raw.rewarded || {} };
  } catch {
    // ignore corrupted / unavailable storage
  }
  return { counts: {}, rewarded: {} };
};

export default function MissionSimulation({
  game,
  act,
  choose,
  nextDay,
  dismissOutcome,
  pause,
  onTutorial,
  dayNote,
  settings,
}) {
  const [sideOpen, setSideOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [missionStore, setMissionStore] = useState(() => loadMissionStore(game.id));
  const [nasaCollapsed, setNasaCollapsed] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [lastAction, setLastAction] = useState(null);
  const [landingTrigger, setLandingTrigger] = useState(0);
  const [realImageModal, setRealImageModal] = useState(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [apiAttempt, setApiAttempt] = useState(0);
  const [coins, setCoinsState] = useState(getCoins);
  const [coinToast, setCoinToast] = useState('');

  const prevDayRef = useRef(game.day);
  const coinToastTimerRef = useRef(null);

  const userSession = useMemo(() => {
    const fallbackName = game.nickname || game.profile?.nickname || 'Commander';
    const fallbackCode = game.classTeam || 'SOLO';
    try {
      const saved = JSON.parse(localStorage.getItem('astra_edu_session') || 'null');
      if (saved && saved.username) {
        return {
          username: saved.username,
          serverCode: saved.serverCode || saved.classTeam || fallbackCode,
          classTeam: saved.serverCode || saved.classTeam || fallbackCode,
        };
      }
      return { username: fallbackName, serverCode: fallbackCode, classTeam: fallbackCode };
    } catch {
      return { username: fallbackName, serverCode: fallbackCode, classTeam: fallbackCode };
    }
  }, [game.nickname, game.profile?.nickname, game.classTeam]);

  // ---- Daily missions: count what the player does each sol ----
  useEffect(() => {
    setMissionStore(loadMissionStore(game.id));
  }, [game.id]);

  useEffect(() => {
    try {
      localStorage.setItem(`exolife_daily_${game.id}`, JSON.stringify(missionStore));
    } catch {
      // storage full / blocked – progress simply stays in memory
    }
  }, [game.id, missionStore]);

  useEffect(() => {
    if (game.status !== 'playing') return undefined;
    const onMissionEvent = (e) => {
      const { kind, amount = 1 } = e.detail || {};
      if (!kind) return;
      setMissionStore((prev) => {
        const dayCounts = { ...(prev.counts[game.day] || {}) };
        dayCounts[kind] = (dayCounts[kind] || 0) + amount;
        return { ...prev, counts: { ...prev.counts, [game.day]: dayCounts } };
      });
    };
    window.addEventListener(MISSION_EVENT, onMissionEvent);
    return () => window.removeEventListener(MISSION_EVENT, onMissionEvent);
  }, [game.day, game.status]);

  const dailyMission = useMemo(() => {
    const plan = getDailyMission(game.day);
    const counts = missionStore.counts[game.day] || {};
    const tasks = plan.tasks.map((t) => {
      const progress = counts[t.kind] || 0;
      return { ...t, progress, done: progress >= t.target };
    });
    const doneCount = tasks.filter((t) => t.done).length;
    return {
      day: game.day,
      title: plan.title,
      brief: plan.brief,
      tasks,
      doneCount,
      total: tasks.length,
      allDone: doneCount === tasks.length,
    };
  }, [game.day, missionStore]);

  const triggerCoinReward = (amount, label, eventId = null) => {
    const res = addCoins(amount, eventId);
    if (res.ok) {
      setCoinsState(res.balance);
      setCoinToast(`+${res.added} Coins · ${label}`);
      if (coinToastTimerRef.current) clearTimeout(coinToastTimerRef.current);
      coinToastTimerRef.current = setTimeout(() => setCoinToast(''), 3400);
    }
  };

  useEffect(() => {
    const syncCoins = () => setCoinsState(getCoins());
    window.addEventListener('astra_coins_change', syncCoins);
    return () => {
      window.removeEventListener('astra_coins_change', syncCoins);
      if (coinToastTimerRef.current) clearTimeout(coinToastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!game.lastOutcome) return;
    const outcomeKey = `outcome_${game.planet}_d${game.day}_${game.lastOutcome.title || game.lastOutcome.id || 'task'}`;
    const isGreat = game.lastOutcome.good !== false && game.lastOutcome.tone !== 'bad';
    triggerCoinReward(isGreat ? 40 : 15, isGreat ? 'Task Completed' : 'Mission Logged', outcomeKey);
  }, [game.lastOutcome, game.planet, game.day]);

  useEffect(() => {
    if (game.day > prevDayRef.current && game.status === 'playing') {
      const dayKey = `day_complete_${game.planet}_d${game.day}`;
      triggerCoinReward(25, `Sol ${prevDayRef.current} Survived`, dayKey);
    }
    prevDayRef.current = game.day;
  }, [game.day, game.planet, game.status]);

  useEffect(() => {
    if (game.status !== 'playing') return;
    const fresh = dailyMission.tasks.filter((t) => t.done && !missionStore.rewarded[`${game.day}:${t.id}`]);
    if (fresh.length === 0) return;
    const marks = Object.fromEntries(fresh.map((t) => [`${game.day}:${t.id}`, true]));
    const bonusDue = dailyMission.allDone && !missionStore.rewarded[`${game.day}:all`];
    if (bonusDue) marks[`${game.day}:all`] = true;
    setMissionStore((prev) => ({ ...prev, rewarded: { ...prev.rewarded, ...marks } }));
    const total = fresh.length * TASK_REWARD + (bonusDue ? DAY_CLEAR_BONUS : 0);
    triggerCoinReward(
      total,
      bonusDue ? `All Day ${game.day} Missions Complete!` : fresh.length === 1 ? 'Mission Task Complete' : 'Mission Tasks Complete',
      `tasks_${game.id}_${game.day}_${Object.keys(marks).join('_')}`
    );
  }, [dailyMission, missionStore.rewarded, game.day, game.id, game.status]);

  useEffect(() => {
    if (game.status && game.status !== 'playing' && game.status !== 'lost' && game.status !== 'failed') {
      const victoryKey = `expedition_won_${game.planet}_d${game.day}`;
      triggerCoinReward(150, 'Expedition Complete', victoryKey);
    }
  }, [game.status, game.planet, game.day]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && realImageModal) {
        setRealImageModal(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [realImageModal]);

  const scenario = game.pendingScenarioId ? getScenarioView(game.pendingScenarioId, game) : null;
  const deltas = useMemo(() => game.lastDaySummary?.changes || {}, [game.lastDaySummary]);
  const alerts = useMemo(() => buildSimulationAlerts(game), [game]);
  const blocked = game.status !== 'playing' || game.paused || Boolean(game.pendingScenarioId);

  // ربط موارد اللعبة ومعدلات التغير وبيانات ناسا مع البار الموحد داخل PlanetaryEnvironment
  const mappedResources = useMemo(
    () => ({
      ...game.resources,
      power: game.resources?.electricity ?? game.resources?.power ?? 94,
      shield: game.resources?.radiation ?? game.resources?.shield ?? 55,
    }),
    [game.resources]
  );

  const mappedRates = useMemo(
    () => ({
      oxygen: deltas.oxygen,
      water: deltas.water,
      food: deltas.food,
      power: deltas.electricity ?? deltas.power,
      shield: deltas.radiation ?? deltas.shield,
      health: deltas.health,
    }),
    [deltas]
  );

  const nasaTelemetrySource = useMemo(
    () => game.nasaData || game.spaceWeather || game.conditions || game,
    [game]
  );

  const handleAct = (id) => {
    const r = act(id);
    setActionMsg(r.message);
    if (r.ok) {
      setLastAction({ id, ts: Date.now() });
      window.dispatchEvent(new CustomEvent(MISSION_EVENT, { detail: { kind: id, amount: 1 } }));
    }
    return r;
  };

  const handleEndDay = () => {
    setActionMsg('');
    nextDay();
  };

  const handleSpendCoins = (amount) => {
    const res = spendCoins(amount);
    setCoinsState(res.balance);
    return res.ok;
  };

  const handleRefundCoins = (amount) => {
    const res = addCoins(amount);
    setCoinsState(res.balance);
  };

  const handleViewRealImage = (actionId, customLabel) => {
    const resolved = resolveModuleMedia(actionId, game.planet);
    setApiAttempt(0);
    setImgLoading(true);
    setRealImageModal({
      ...resolved,
      customLabel,
    });
  };

  const handleImageError = async () => {
    if (!realImageModal) return;

    if (apiAttempt === 0 && realImageModal.nasaId) {
      setApiAttempt(1);
      try {
        const res = await fetch(
          `https://images-api.nasa.gov/search?nasa_id=${encodeURIComponent(realImageModal.nasaId)}&media_type=image`
        );
        const data = await res.json();
        const item = data?.collection?.items?.[0];
        const href = item?.links?.[0]?.href;
        if (href) {
          setRealImageModal((prev) => (prev ? { ...prev, imgUrl: href } : null));
          return;
        }
      } catch {
        // Proceed to keyword search
      }
    }

    if (apiAttempt <= 1 && realImageModal.fallbackApiQuery) {
      setApiAttempt(2);
      try {
        const res = await fetch(
          `https://images-api.nasa.gov/search?q=${encodeURIComponent(realImageModal.fallbackApiQuery)}&media_type=image`
        );
        const data = await res.json();
        const item = data?.collection?.items?.[0];
        const href = item?.links?.[0]?.href;
        const foundNasaId = item?.data?.[0]?.nasa_id;
        if (href) {
          setRealImageModal((prev) =>
            prev
              ? {
                  ...prev,
                  imgUrl: href,
                  nasaId: foundNasaId || prev.nasaId,
                  nasaDetailsUrl: foundNasaId ? `https://images.nasa.gov/details/${foundNasaId}` : prev.nasaDetailsUrl,
                }
              : null
          );
          return;
        }
      } catch {
        // Fall back to verified SVG badge
      }
    }

    setImgLoading(false);
    setRealImageModal((prev) => (prev ? { ...prev, imgUrl: FALLBACK_NASA_IMAGE } : null));
  };

  return (
    <div className="flex min-h-[calc(100vh-4.5rem)] w-full flex-col overflow-hidden rounded-none sm:rounded-2xl sm:border sm:border-slate-800 bg-[#080c14]">
      <SimulationHUD
        game={game}
        onPause={() => pause(true)}
        onTutorial={onTutorial}
        onReplayLanding={() => setLandingTrigger((t) => t + 1)}
      />

      {/* 3D Planetary Viewport (Includes Unified NASA Telemetry & Life Support Bar) */}
      <div className="relative flex min-h-[560px] flex-1 flex-col justify-between p-3 sm:p-4">
        <AnimatePresence>
          {coinToast && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="pointer-events-none absolute right-4 top-3 z-30 flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-[#14110a]/95 px-3 py-1.5 font-mono text-xs font-bold text-amber-300 shadow-lg"
            >
              <Coins size={14} className="text-amber-400" />
              <span>{coinToast}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <PlanetaryEnvironment
          planet={game.planet}
          day={game.day}
          resources={mappedResources}
          rates={mappedRates}
          nasaData={nasaTelemetrySource}
          lastAction={lastAction}
          canAct={!blocked && game.ap > 0}
          onQuickAct={handleAct}
          onViewRealImage={handleViewRealImage}
          onRewardCoins={triggerCoinReward}
          landingTrigger={landingTrigger}
          userSession={userSession}
          coins={coins}
          onSpendCoins={handleSpendCoins}
          onRefundCoins={handleRefundCoins}
          dailyMission={dailyMission}
        />

        <ViewportOverlays
          planet={game.planet}
          alerts={alerts}
          collapsedNasa={nasaCollapsed}
          onToggleNasa={() => setNasaCollapsed((c) => !c)}
        />

        <div className="relative z-20 my-auto flex flex-col items-center pt-10">
          {dayNote && game.status === 'playing' && (
            <p
              className="mb-2 rounded-lg border border-emerald-500/30 bg-emerald-950/80 px-3 py-1.5 text-xs font-semibold text-emerald-200"
              role="status"
            >
              {dayNote}
            </p>
          )}

          <AnimatePresence mode="wait">
            {game.lastOutcome ? (
              <motion.div
                key="outcome"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full max-w-2xl"
              >
                <OutcomeCard outcome={game.lastOutcome} onContinue={dismissOutcome} />
              </motion.div>
            ) : scenario ? (
              <motion.div
                key="scenario"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full max-w-2xl"
              >
                <ScenarioCard
                  scenario={scenario}
                  onChoose={choose}
                  showHint={DIFFICULTIES[game.difficulty]?.hints}
                  teacherMode={settings?.teacherMode}
                  disabled={game.paused}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Bottom Status Bar */}
        <div className="relative z-20 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#0b101b]/95 px-3 py-2">
          <p className="min-h-[1.25rem] flex-1 text-xs font-medium text-slate-300">
            {actionMsg || `Today: ${dailyMission.title} (${dailyMission.doneCount}/${dailyMission.total} tasks). Dig [F], scan rocks [E], build in the Store, return samples at the Lander.`}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-950/50 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-900/60"
              onClick={() => setCalcOpen(true)}
              aria-haspopup="dialog"
            >
              <Calculator size={15} />
              <span>Nova AI</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
              onClick={() => setSideOpen((o) => !o)}
            >
              {sideOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
              <span className="hidden sm:inline">{sideOpen ? 'Hide Log' : 'Ops & Log'}</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-300 disabled:opacity-45"
              onClick={handleEndDay}
              disabled={blocked}
            >
              <Moon size={15} />
              <span>End Sol {game.day}</span>
            </button>
          </div>
        </div>

        <AnimatePresence>
          {sideOpen && (
            <motion.aside
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="relative z-20 mt-3 overflow-hidden"
            >
              <div className="grid gap-3 rounded-xl border border-slate-800 bg-[#0b101b] p-3 lg:grid-cols-2">
                <ActionPanel game={game} onAct={handleAct} onEndDay={handleEndDay} />
                <div className="space-y-3">
                  <CrewPanel game={game} />
                  <TimelinePanel game={game} />
                  <LogPanel game={game} />
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {calcOpen && <SpaceCalculator game={game} onClose={() => setCalcOpen(false)} />}

      {/* Verified NASA Archive Photo & Science Modal */}
      {realImageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRealImageModal(null);
          }}
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-[#0c111d] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <Satellite size={17} className="text-sky-400" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-sky-400">
                      {realImageModal.mission}
                    </span>
                    {realImageModal.nasaId && (
                      <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                        <CheckCircle2 size={10} />
                        NASA ID: {realImageModal.nasaId}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-0.5 font-display text-sm font-bold text-white sm:text-base">
                    {realImageModal.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close NASA image preview"
                onClick={() => setRealImageModal(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={17} />
              </button>
            </div>

            <div className="p-5">
              <div className="relative flex h-64 w-full items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-[#060910] sm:h-80">
                {imgLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
                    <Loader2 size={22} className="animate-spin text-sky-400" />
                    <span>Loading Verified {game.planet === 'mars' ? 'Mars' : 'Lunar'} NASA Archive Photo...</span>
                  </div>
                )}
                <img
                  src={realImageModal.imgUrl}
                  alt={realImageModal.title}
                  onLoad={() => setImgLoading(false)}
                  onError={handleImageError}
                  className={`h-full w-full object-contain transition-opacity duration-300 ${
                    imgLoading ? 'opacity-0' : 'opacity-100'
                  }`}
                />
              </div>

              <p className="mt-4 text-sm leading-relaxed text-slate-200">{realImageModal.fact}</p>

              {realImageModal.source && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-xs">
                  <div>
                    <span className="font-semibold text-slate-400">Official Resource: </span>
                    <span className="font-medium text-slate-200">{realImageModal.source.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {realImageModal.nasaDetailsUrl && (
                      <a
                        href={realImageModal.nasaDetailsUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 font-semibold text-emerald-400 hover:text-emerald-300"
                      >
                        <span>Verify Photo Record</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                    <a
                      href={realImageModal.source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 font-semibold text-sky-400 hover:text-sky-300"
                    >
                      <span>{realImageModal.source.name.split(' ')[1] || 'NASA'} Portal</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}