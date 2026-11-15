import { useEffect, useState } from 'react';
import {
  Eye,
  Hammer,
  Trash2,
  Check,
  X,
  Zap,
  Coins,
  Microscope,
  ShoppingBag,
  Backpack,
  Rocket,
  Lock,
  Crosshair,
  Package,
  Sparkles,
  Award,
  Heart,
  Utensils,
  Wind,
  Droplets,
  Sprout,
  CheckCircle2,
  Circle,
  Volume2,
  VolumeX,
  Gem,
  Shield,
  ChevronDown,
  Radio,
  Gamepad2,
} from 'lucide-react';
import DriveGuide from './DriveGuide.jsx';
import { ACTIONS } from '../../engine/missionConfig.js';
import { MODULE_SPECS, STORE_HARDWARE, PROGRESSION_UPGRADES } from './planetaryData.js';

function ShovelIcon({ size = 14, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 22v-5l5-5 5 5-5 5z" />
      <path d="M9.5 14.5 16 8" />
      <path d="m17 2 5 5-.5.5a3.53 3.53 0 0 1-5 0 3.53 3.53 0 0 1 0-5L17 2" />
    </svg>
  );
}

export function SpecimenArtwork({ category = 'rock', accent = '#38bdf8', isMars = false, size = 'md' }) {
  const boxCls = size === 'sm' ? 'h-14 w-14 rounded-lg' : 'h-20 w-20 rounded-xl';
  const svgCls = size === 'sm' ? 'h-11 w-11' : 'h-16 w-16';
  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-white/15 bg-slate-950 shadow-inner ${boxCls}`}>
      <div
        className="absolute inset-0 opacity-35"
        style={{ background: `radial-gradient(circle at 35% 30%, ${accent}, transparent 72%)` }}
      />
      <svg viewBox="0 0 80 80" className={`relative z-10 ${svgCls}`}>
        <circle cx="40" cy="40" r="34" fill="none" stroke={accent} strokeOpacity="0.28" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="40" cy="40" r="24" fill="none" stroke={accent} strokeOpacity="0.45" strokeWidth="1" />
        {category === 'rock' ? (
          <g>
            <ellipse cx="40" cy="43" rx="22" ry="16" fill="#334155" stroke={accent} strokeWidth="2" />
            <circle cx="33" cy="39" r="3" fill={accent} />
            <circle cx="46" cy="37" r="2.5" fill={accent} />
            <circle cx="41" cy="47" r="3.2" fill={accent} />
            <circle cx="29" cy="46" r="2" fill={accent} />
          </g>
        ) : category === 'soil' ? (
          <g>
            <rect x="24" y="14" width="32" height="52" rx="6" fill="none" stroke={accent} strokeWidth="2" />
            <rect x="27" y="48" width="26" height="15" rx="3" fill={isMars ? '#9a3412' : '#475569'} />
            <rect x="27" y="34" width="26" height="14" fill={isMars ? '#c2410c' : '#64748b'} />
            <rect x="27" y="22" width="26" height="12" fill={accent} fillOpacity="0.55" />
          </g>
        ) : (
          <g>
            <path d="M20,56 A20,20 0 0,1 60,56 Z" fill={accent} fillOpacity="0.3" stroke={accent} strokeWidth="2" />
            <rect x="16" y="56" width="48" height="6" rx="2" fill="#f59e0b" />
            <line x1="40" y1="22" x2="40" y2="36" stroke="#ffffff" strokeWidth="2" />
            <circle cx="40" cy="20" r="3" fill="#38bdf8" />
          </g>
        )}
      </svg>
    </div>
  );
}

function formatDelta(val) {
  if (typeof val !== 'number' || Number.isNaN(val) || Math.abs(val) < 0.05) return null;
  const fixed = Math.abs(val) >= 10 ? val.toFixed(1) : val.toFixed(2);
  return val > 0 ? `+${fixed}` : `${fixed}`;
}

export default function PlanetaryHUD({
  isMars,
  day,
  coins,
  userSession,
  serverCode,
  onlineCrewCount,
  phase,
  countdownStep,
  landerAltitude,
  audioMuted,
  onToggleAudio,
  buildMode,
  setBuildMode,
  health,
  hunger,
  oxygen,
  water,
  power,
  shield,
  telemetryRates = {},
  nasaTelemetryInfo = {},
  greenhouseCount,
  rationsCount,
  medkitsCount,
  onEatRation,
  onUseMedkit,
  discoveredCount,
  discoveryToast,
  onDismissDiscovery,
  hasDugFirstSample,
  hasProducedPlantOxygen,
  greenhouseDeployed,
  waterStationDeployed,
  statusBanner,
  nearbyTarget,
  canAct,
  eMenuOpen,
  setEMenuOpen,
  inventoryOpen,
  setInventoryOpen,
  inventory,
  sampledRocks,
  storeOpen,
  setStoreOpen,
  storeTab,
  setStoreTab,
  upgrades,
  selectedInvModuleType,
  setSelectedInvModuleType,
  movingModuleId,
  setMovingModuleId,
  onTriggerDig,
  onEnterBuildEdit,
  onRecenterTopView,
  onClearGhost,
  onLaunchSampleReturn,
  onSampleRock,
  onHarvestBioDome,
  onRunModuleAction,
  onOpenRealImage,
  onRemoveModule,
  onBuyStoreItem,
  onPurchaseUpgrade,
  onEquipScoopAndDig,
  onViewRealImage,
  dailyMission = null,
}) {
  const [invTab, setInvTab] = useState('samples');
  const [guideOpen, setGuideOpen] = useState(false);

  // Show the driving guide automatically the first time the player lands.
  useEffect(() => {
    if (phase !== 'explore') return;
    try {
      if (localStorage.getItem('exolife_drive_guide_seen') !== '1') {
        setGuideOpen(true);
        localStorage.setItem('exolife_drive_guide_seen', '1');
      }
    } catch {
      // storage unavailable: the Controls button still works
    }
  }, [phase]);
  const [selectedMetric, setSelectedMetric] = useState(null);

  /* Store: count what was bought this session and show a short confirmation message. */
  const [buyCounts, setBuyCounts] = useState({});
  const [buyNotice, setBuyNotice] = useState(null); // { id, name, count, n }
  // The purchase message stays visible while you keep shopping (no auto-hide, so the list
  // never jumps under your cursor). It is cleared when the store is closed.
  useEffect(() => {
    if (!storeOpen) setBuyNotice(null);
  }, [storeOpen]);
  const recordPurchase = (id, name, isModule = false) => {
    const count = (buyCounts[id] || 0) + 1;
    setBuyCounts({ ...buyCounts, [id]: count });
    setBuyNotice({ id, name, count, isModule, n: Date.now() });
  };
  const handleStoreBuy = (item) => {
    // Only record the purchase if it really went through (coins were enough, item unlocked).
    const ok = onBuyStoreItem(item);
    if (ok !== false) recordPurchase(item.id, item.name, item.kind === 'module');
  };
  const handleUpgradeBuy = (upg, tier) => {
    const ok = onPurchaseUpgrade(upg, tier);
    if (ok !== false) recordPurchase(`${upg.key}-${tier.tier}`, `${upg.name} · ${tier.label}`);
  };

  const activeActionId =
    nearbyTarget?.kind === 'module' ? nearbyTarget.item.actionId : nearbyTarget?.item?.linkedAction;
  const nearbyActionDef = activeActionId ? ACTIONS?.[activeActionId] : null;
  const inventoryModuleEntries = Object.entries(inventory.modules || {}).filter(([, qty]) => qty > 0);
  const totalInventoryModules = inventoryModuleEntries.reduce((sum, [, qty]) => sum + qty, 0);
  const sampleList = Array.isArray(inventory.samples) ? inventory.samples : [];
  const sampleCount = sampleList.length;

  const healthPct = Math.round((health / 20) * 100);
  const foodPct = Math.round((hunger / 20) * 100);

  const unifiedMetrics = [
    {
      key: 'oxygen',
      label: 'O₂',
      title: 'Oxygen Atmosphere (ECLSS + Bio-Domes)',
      valuePct: Math.round(oxygen),
      delta: telemetryRates.oxygen,
      barColor: oxygen <= 25 ? 'bg-rose-500' : 'bg-sky-400',
      textColor: 'text-sky-300',
      icon: <Wind size={12} className="shrink-0 text-sky-400" />,
      nasaSource: nasaTelemetryInfo.oxygen || 'ISS ECLSS Sabatier & NASA Veggie Photosynthesis',
    },
    {
      key: 'water',
      label: 'H₂O',
      title: 'Closed-Loop Water Recovery System',
      valuePct: Math.round(water),
      delta: telemetryRates.water,
      barColor: water <= 25 ? 'bg-rose-500' : 'bg-cyan-400',
      textColor: 'text-cyan-300',
      icon: <Droplets size={12} className="shrink-0 text-cyan-400" />,
      nasaSource: nasaTelemetryInfo.water || (isMars ? 'Mars Subsurface Ice & Regolith Brine Extractor' : 'LCROSS Polar Ice & ISS WPA 98% Loop'),
    },
    {
      key: 'power',
      label: 'Power',
      title: 'Solar Array & MMRTG Electrical Grid',
      valuePct: Math.round(power),
      delta: telemetryRates.power,
      barColor: power <= 25 ? 'bg-rose-500' : 'bg-amber-400',
      textColor: 'text-amber-300',
      icon: <Zap size={12} className="shrink-0 text-amber-400" />,
      nasaSource: nasaTelemetryInfo.power || (isMars ? 'NASA Mars Solar Flux (590 W/m²) + Perseverance MMRTG' : 'NASA Lunar Solar Flux (1,361 W/m²) + Kilopower'),
    },
    {
      key: 'food',
      label: 'Food',
      title: 'Crew Caloric Stores & Hydroponic Crops',
      valuePct: foodPct,
      delta: telemetryRates.food,
      barColor: foodPct <= 25 ? 'bg-rose-500' : 'bg-emerald-400',
      textColor: 'text-emerald-300',
      icon: <Utensils size={12} className="shrink-0 text-emerald-400" />,
      nasaSource: nasaTelemetryInfo.food || 'NASA Advanced Plant Habitat (APH) & Crew Rations',
      extraBadge: `+${rationsCount}`,
    },
    {
      key: 'shield',
      label: 'Shield',
      title: 'Radiation & Micrometeorite Hull Shielding',
      valuePct: Math.round(shield),
      delta: telemetryRates.shield,
      barColor: shield <= 30 ? 'bg-rose-500' : 'bg-indigo-400',
      textColor: 'text-indigo-300',
      icon: <Shield size={12} className="shrink-0 text-indigo-400" />,
      nasaSource: nasaTelemetryInfo.shield || 'NASA DONKI Space Weather CME Flux & Regolith Shielding',
    },
    {
      key: 'health',
      label: 'Health',
      title: 'Crew Biomedical & EVA Suit Telemetry',
      valuePct: healthPct,
      delta: telemetryRates.health,
      barColor: healthPct <= 30 ? 'bg-rose-500' : 'bg-rose-400',
      textColor: 'text-rose-300',
      icon: <Heart size={12} className="shrink-0 fill-rose-500 text-rose-500" />,
      nasaSource: nasaTelemetryInfo.health || 'NASA Human Research Program (HRP) EVA Biomedical Telemetry',
    },
  ];

  const activeMetricObj = unifiedMetrics.find((m) => m.key === selectedMetric) || null;

  return (
    <div dir="ltr" translate="no" className="notranslate pointer-events-none absolute inset-0 z-20">
      {/* LANDING DESCENT COUNTDOWN OVERLAY (3 - 2 - 1 - TOUCHDOWN) */}
      {phase === 'landing' && (
        <div className="pointer-events-none absolute inset-x-0 top-28 z-30 flex flex-col items-center justify-center">
          <div className="rounded-2xl border border-sky-400/45 bg-[#080d18]/88 px-6 py-3.5 text-center shadow-[0_0_40px_rgba(56,189,248,0.28)]">
            <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-sky-400">
              {isMars ? 'EDL RETRO-DESCENT TELEMETRY' : 'POWERED LUNAR DESCENT'}
            </div>
            <div className="mt-1 font-display text-4xl font-black tracking-wider text-white sm:text-5xl">
              {countdownStep > 0 ? `T - ${countdownStep}` : 'TOUCHDOWN'}
            </div>
            <div className="mt-1 flex items-center justify-center gap-3 font-mono text-xs text-amber-300">
              <span>ALT: {Math.max(0, landerAltitude).toFixed(1)} m</span>
              <span>·</span>
              <span>{countdownStep > 0 ? 'RETRO-THRUSTERS ACTIVE' : 'SURFACE CONTACT CONFIRMED'}</span>
            </div>
          </div>
        </div>
      )}

      {/* TOP-LEFT STACKED DOCK:
          Row 1: Server + Commander Name + Coins
          Row 2: Inventory + Store + Audio (Directly beneath Name & Coins)
          Row 3: Life Support & Plant Tasks Card */}
      <div className="pointer-events-none absolute left-3 top-2.5 z-20 flex w-64 flex-col items-start gap-1.5 sm:w-[268px]">
        {/* Row 1: Identity & Coins */}
        <div className="pointer-events-auto flex w-full items-center justify-between gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0b101b]/92 px-2.5 py-1.5 font-mono text-xs shadow">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
            <span className="shrink-0 font-bold text-sky-300">{serverCode}</span>
            <span className="text-slate-600">|</span>
            <span className="truncate font-sans font-semibold text-white">{userSession.username}</span>
            <span className="shrink-0 text-[11px] text-slate-400">({onlineCrewCount})</span>
          </div>

          <div className="flex shrink-0 items-center gap-1 rounded-lg border border-amber-500/40 bg-[#0b101b]/92 px-2.5 py-1.5 font-mono text-xs font-bold text-amber-300 shadow">
            <Coins size={13} className="text-amber-400" />
            <span className="tabular-nums">{coins}</span>
          </div>
        </div>

        {/* Row 2: Inventory, Store & Audio Toggle (Positioned neatly under Name & Coins) */}
        <div className="pointer-events-auto flex w-full items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setStoreOpen(false);
              setEMenuOpen(false);
              setInventoryOpen((o) => !o);
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-500/45 bg-[#0b101b]/92 px-2.5 py-1.5 text-xs font-semibold text-sky-200 shadow transition hover:border-sky-400 hover:bg-sky-950/60"
          >
            <Backpack size={13} className="shrink-0 text-sky-400" />
            <span>Inventory</span>
            {(sampleCount > 0 || totalInventoryModules > 0) && (
              <span className="rounded-full bg-sky-400 px-1.5 py-0.2 font-mono text-[10px] font-bold text-slate-950">
                {sampleCount + totalInventoryModules}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setInventoryOpen(false);
              setEMenuOpen(false);
              setStoreOpen((o) => !o);
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-500/45 bg-[#0b101b]/92 px-2.5 py-1.5 text-xs font-semibold text-amber-200 shadow transition hover:border-amber-400 hover:bg-amber-950/50"
          >
            <ShoppingBag size={13} className="shrink-0 text-amber-400" />
            <span>Store</span>
          </button>

          <button
            type="button"
            onClick={onToggleAudio}
            title={audioMuted ? 'Unmute Space Soundtrack & SFX' : 'Mute Space Soundtrack & SFX'}
            className="flex shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-[#0b101b]/92 px-2.5 py-1.5 text-xs font-semibold text-slate-200 shadow transition hover:border-sky-400 hover:text-sky-300"
          >
            {audioMuted ? <VolumeX size={14} className="text-rose-400" /> : <Volume2 size={14} className="text-emerald-400" />}
          </button>

          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            title="How to drive & controls"
            className="flex shrink-0 items-center justify-center gap-1 rounded-lg border border-emerald-500/45 bg-[#0b101b]/92 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 shadow transition hover:border-emerald-400 hover:bg-emerald-950/50"
          >
            <Gamepad2 size={14} className="text-emerald-400" />
            <span className="hidden sm:inline">Drive</span>
          </button>
        </div>

        {/* Row 3: Daily missions for today's sol (falls back to the basic tutorial tasks) */}
        {phase === 'explore' && !buildMode && dailyMission && (
          <div className="pointer-events-auto mt-1 w-full rounded-xl border border-emerald-500/35 bg-[#0b101b]/92 p-2.5 text-[11px] shadow-xl">
            <div className="mb-1 flex items-center justify-between border-b border-slate-800 pb-1">
              <span className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                <Sprout size={12} /> {isMars ? 'Sol' : 'Day'} {dailyMission.day} Missions
              </span>
              <span className="font-mono text-[10px] text-sky-300">
                {dailyMission.doneCount}/{dailyMission.total} done
              </span>
            </div>
            <div className="mb-1.5 text-[11px] font-semibold text-white">{dailyMission.title}</div>
            <ul className="space-y-1.5 text-slate-200">
              {dailyMission.tasks.map((t) => (
                <li key={t.id} className="flex items-start gap-1.5">
                  {t.done ? (
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-400" />
                  ) : (
                    <Circle size={13} className="mt-0.5 shrink-0 text-amber-400" />
                  )}
                  <span className={t.done ? 'text-slate-400 line-through' : ''}>
                    {t.text}
                    {!t.done && t.target > 1 && (
                      <span className="ml-1 font-mono text-[10px] text-sky-300">
                        ({Math.min(t.progress, t.target)}/{t.target})
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {dailyMission.allDone && (
              <div className="mt-1.5 rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-300">
                All missions complete! Press “End {isMars ? 'Sol' : 'Day'}” when you are ready.
              </div>
            )}
          </div>
        )}
        {phase === 'explore' && !buildMode && !dailyMission && (
          <div className="pointer-events-auto mt-1 w-full rounded-xl border border-emerald-500/35 bg-[#0b101b]/92 p-2.5 text-[11px] shadow-xl">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              Dig soil [F] or scan rocks [E] to collect samples.
            </span>
          </div>
        )}
      </div>

      {/* UNIFIED TOP-CENTER NASA TELEMETRY & LIFE SUPPORT BAR (Zero Overlap with Left Dock or Right NASA Button) */}
      <div className="pointer-events-auto absolute left-1/2 top-[5.15rem] z-20 w-[94vw] max-w-[490px] -translate-x-1/2 lg:top-2.5 lg:w-[465px] xl:max-w-[530px] xl:w-[530px]">
        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-800/95 bg-[#0b101b]/94 p-1.5 shadow-xl">
          {unifiedMetrics.map((m) => {
            const deltaStr = formatDelta(m.delta);
            const isSelected = selectedMetric === m.key;
            return (
              <div
                key={m.key}
                onClick={() => setSelectedMetric((prev) => (prev === m.key ? null : m.key))}
                title={`${m.title} — Click for NASA Telemetry`}
                className={`cursor-pointer rounded-lg border px-2 py-1 transition ${
                  isSelected
                    ? 'border-sky-400/70 bg-sky-950/40'
                    : 'border-slate-800/90 bg-slate-950/75 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    {m.icon}
                    <span className={`font-sans text-[11px] font-bold ${m.textColor}`}>{m.label}</span>
                  </div>

                  <div className="flex items-center gap-1 font-mono text-[10px] font-bold tabular-nums">
                    {deltaStr && (
                      <span className={m.delta > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {deltaStr}
                      </span>
                    )}
                    <span className="text-white">{m.valuePct}%</span>
                    {m.key === 'food' && (
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onEatRation();
                        }}
                        title="Use Food & Water Pack"
                        className="rounded bg-emerald-500/20 px-1 text-[9px] font-extrabold text-emerald-300 hover:bg-emerald-500/40"
                      >
                        {m.extraBadge}
                      </button>
                    )}
                    <ChevronDown
                      size={10}
                      className={`text-slate-400 transition-transform ${isSelected ? 'rotate-180 text-sky-300' : ''}`}
                    />
                  </div>
                </div>

                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all ${m.barColor}`}
                    style={{ width: `${Math.max(0, Math.min(100, m.valuePct))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* NASA Live Data Link Inspector Popover when clicking any metric */}
        {activeMetricObj && (
          <div className="mt-1.5 flex items-center justify-between gap-3 rounded-xl border border-sky-500/40 bg-[#0b101b]/96 px-3 py-2 text-xs shadow-2xl">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-sky-400">
                <Radio size={11} className="animate-pulse text-emerald-400" />
                <span>NASA TELEMETRY LINK · {activeMetricObj.title}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-200">
                Driver: <strong className="text-amber-300">{activeMetricObj.nasaSource}</strong> · Net Rate:{' '}
                <span className={`font-mono font-bold ${(activeMetricObj.delta ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatDelta(activeMetricObj.delta) || '0.00'}/tick
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedMetric(null)}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>

      {/* RPG-Style "NEW DISCOVERY UNLOCKED" Achievement Toast */}
      {discoveryToast && (
        <div
          onClick={onDismissDiscovery}
          className="pointer-events-auto animate-fade-in absolute left-1/2 top-28 z-40 flex w-[92%] max-w-md -translate-x-1/2 cursor-pointer items-center gap-3.5 rounded-2xl border-2 border-amber-400/75 bg-gradient-to-r from-[#090e1a]/95 via-[#111b33]/95 to-[#090e1a]/95 p-3.5 shadow-[0_0_40px_rgba(251,191,36,0.35)]"
        >
          <SpecimenArtwork
            category={discoveryToast.category}
            accent={discoveryToast.accent}
            isMars={isMars}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-400" />
              <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-amber-300">
                NEW DISCOVERY UNLOCKED
              </span>
              <span className="ml-auto rounded bg-amber-400/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-300">
                {discoveryToast.rarity}
              </span>
            </div>
            <h4 className="truncate font-display text-sm font-extrabold text-white">
              {discoveryToast.title}
            </h4>
            {discoveryToast.formula && (
              <div className="font-mono text-[11px] font-semibold text-sky-300">
                {discoveryToast.formula} · +{discoveryToast.coins} Coins
              </div>
            )}
            <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-300">{discoveryToast.subtitle}</p>
            <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-emerald-300">
              <Award size={11} /> {discoveryToast.nasaMission}
            </p>
          </div>
        </div>
      )}

      {/* Bottom Right Quick Actions */}
      {phase === 'explore' && !buildMode && (
        <div className="pointer-events-auto absolute bottom-3 right-3 z-20 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onTriggerDig}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/45 bg-[#0b101b]/95 px-3 py-2 text-xs font-semibold text-emerald-200 shadow-lg transition hover:border-emerald-400 hover:bg-emerald-950/50"
          >
            <ShovelIcon size={14} className="text-emerald-400" />
            <span>Dig Soil</span>
            <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 font-mono text-[10px] text-slate-300">F</kbd>
          </button>

          <button
            type="button"
            onClick={onEnterBuildEdit}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0b101b]/95 px-3 py-2 text-xs font-semibold text-slate-100 shadow-lg transition hover:border-slate-500"
          >
            <Hammer size={14} className="text-amber-400" />
            <span>Deploy / Edit Base</span>
          </button>
        </div>
      )}

      {statusBanner && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-slate-700 bg-[#0b101b]/95 px-3.5 py-1.5 text-center text-xs font-medium text-slate-100 shadow-xl">
          {statusBanner}
        </div>
      )}

      {nearbyTarget && !eMenuOpen && !buildMode && !inventoryOpen && !storeOpen && phase === 'explore' && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-sky-500/40 bg-[#0b101b]/95 px-3.5 py-1.5 text-xs font-medium text-slate-200 shadow-xl">
          Press <kbd className="mx-1 rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-bold text-sky-300">E</kbd> ·{' '}
          <span className="font-semibold text-white">{nearbyTarget.item.label}</span>
        </div>
      )}

      {/* [E] Proximity Interaction Modal */}
      {eMenuOpen && nearbyTarget && (
        <div className="pointer-events-auto absolute left-1/2 top-1/2 z-30 w-80 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-700 bg-[#0c111d]/95 p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-sky-400">
                {nearbyTarget.kind === 'lander'
                  ? 'Earth Return Vehicle'
                  : nearbyTarget.kind === 'rock'
                    ? `${nearbyTarget.item.rarity || 'GEOLOGICAL'} SPECIMEN · ${nearbyTarget.item.formula || ''}`
                    : 'Base Subsystem'}
              </p>
              <h4 className="font-display text-sm font-bold text-white">{nearbyTarget.item.label}</h4>
              {nearbyTarget.kind === 'rock' && (
                <p className="mt-0.5 text-[11px] text-slate-400">{nearbyTarget.item.mineral}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEMenuOpen(false)}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X size={15} />
            </button>
          </div>

          <div className="space-y-2">
            {nearbyTarget.kind === 'lander' && (
              <button
                type="button"
                onClick={onLaunchSampleReturn}
                className="flex w-full items-center gap-2.5 rounded-lg border border-amber-500/45 bg-amber-500/15 px-3 py-2.5 text-left text-xs font-semibold text-amber-200 transition hover:bg-amber-500/25"
              >
                <Rocket size={16} className="shrink-0 text-amber-400" />
                <div>
                  <div>Launch Sample Capsule to Earth ({sampleCount} Stored)</div>
                  <div className="text-[10px] font-normal text-amber-300/80">
                    {sampleCount > 0
                      ? 'Transmit soil & mineral cores for Coins + Science'
                      : 'Dig soil [F] or sample rocks [E] first to load capsule'}
                  </div>
                </div>
              </button>
            )}

            {nearbyTarget.kind === 'rock' && (
              <button
                type="button"
                disabled={Boolean(sampledRocks[nearbyTarget.item.id])}
                onClick={onSampleRock}
                className="flex w-full items-center gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-left text-xs font-semibold text-amber-200 transition hover:bg-amber-500/25 disabled:opacity-45"
              >
                <Microscope size={15} className="shrink-0 text-amber-400" />
                <div>
                  <div>
                    {sampledRocks[nearbyTarget.item.id]
                      ? 'Mineral Core Already Extracted'
                      : 'Extract Mineral Core into Inventory'}
                  </div>
                  <div className="text-[10px] font-normal text-amber-300/75">
                    {sampledRocks[nearbyTarget.item.id] ? 'Sampled site marked' : 'Store in cargo & return at Lander for Coins'}
                  </div>
                </div>
              </button>
            )}

            {nearbyTarget.kind === 'module' && nearbyTarget.item.type === 'greenhouse' && (
              <button
                type="button"
                onClick={onHarvestBioDome}
                className="flex w-full items-center gap-2.5 rounded-lg border border-emerald-500/45 bg-emerald-500/15 px-3 py-2.5 text-left text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25"
              >
                <Sprout size={16} className="shrink-0 text-emerald-400" />
                <div>
                  <div>Produce Oxygen (O₂) &amp; Harvest Plants</div>
                  <div className="text-[10px] font-normal text-emerald-300/80">
                    Generates +35% Oxygen (O₂), +4 Food &amp; +2 Rations
                  </div>
                </div>
              </button>
            )}

            {nearbyActionDef && (
              <button
                type="button"
                disabled={!canAct}
                onClick={onRunModuleAction}
                className="flex w-full items-center gap-2.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-left text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-45"
              >
                <Zap size={15} className="shrink-0 text-emerald-400" />
                <div>
                  <div>{nearbyActionDef.label}</div>
                  <div className="text-[10px] font-normal text-emerald-300/70">
                    {canAct ? 'Execute operation (-1 AP)' : 'Insufficient AP or paused'}
                  </div>
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenRealImage}
              className="flex w-full items-center gap-2.5 rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-left text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20"
            >
              <Eye size={15} className="shrink-0 text-sky-400" />
              <div>
                <div>View Real NASA {isMars ? 'Mars' : 'Lunar'} Photo</div>
                <div className="text-[10px] font-normal text-sky-300/70">Verified archival photo &amp; mission science</div>
              </div>
            </button>

            {nearbyTarget.kind === 'module' && (
              <>
                <button
                  type="button"
                  onClick={onEnterBuildEdit}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-left text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
                >
                  <Hammer size={15} className="shrink-0 text-amber-400" />
                  <div>
                    <div>Move / Relocate (Top View)</div>
                    <div className="text-[10px] font-normal text-slate-400">Reposition module on the surface</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={onRemoveModule}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-left text-xs font-semibold text-rose-300 transition hover:bg-rose-950/50"
                >
                  <Trash2 size={15} className="shrink-0 text-rose-400" />
                  <div>
                    <div>Pack into Inventory</div>
                    <div className="text-[10px] font-normal text-rose-300/70">Store module in Inventory to redeploy later</div>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Enhanced Tabbed Inventory Modal with Rich NASA Specimen Cards */}
      {inventoryOpen && (
        <div className="pointer-events-auto absolute left-1/2 top-1/2 z-30 max-h-[84%] w-[95%] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-700 bg-[#0c111d]/96 p-4 shadow-2xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Backpack size={18} className="text-sky-400" />
              <div>
                <h3 className="font-display text-sm font-bold text-white">Astronaut Field Inventory</h3>
                <p className="text-[11px] text-slate-400">
                  Cargo Samples: <span className="font-mono font-bold text-sky-300">{sampleCount}</span> ·{' '}
                  Discovered Types: <span className="font-mono font-bold text-amber-300">{discoveredCount}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setInvTab('samples')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  invTab === 'samples'
                    ? 'bg-sky-400 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Gem size={12} />
                <span>Specimens ({sampleCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setInvTab('modules')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  invTab === 'modules'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Package size={12} />
                <span>Modules ({totalInventoryModules})</span>
              </button>
              <button
                type="button"
                onClick={() => setInvTab('gear')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  invTab === 'gear'
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Heart size={12} />
                <span>Supplies &amp; Gear</span>
              </button>
              <button
                type="button"
                onClick={() => setInventoryOpen(false)}
                className="ml-1 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {invTab === 'samples' && (
            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-sky-400">
                  Collected Rocks &amp; Soil Cores ({sampleCount})
                </h4>
                {sampleCount > 0 && (
                  <span className="text-[11px] text-emerald-300">
                    Walk to Lander &amp; press <strong>[E]</strong> to launch to Earth for Coins
                  </span>
                )}
              </div>

              {sampleCount === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-center">
                  <p className="text-xs font-semibold text-slate-200">No geological specimens collected yet.</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Use <strong className="text-emerald-300">Dig Soil [F]</strong> to find mineral deposits (each spot has its own kind; dig a spot up to 6 times) or approach rocks and press <strong className="text-sky-300">[E]</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={onEquipScoopAndDig}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                  >
                    <ShovelIcon size={13} /> Dig First Soil Core Now
                  </button>
                </div>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {sampleList.map((smp, idx) => (
                    <div
                      key={smp.uid || `${smp.name}_${idx}`}
                      className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/95 p-2.5 shadow transition hover:border-sky-500/45"
                    >
                      <SpecimenArtwork
                        category={smp.category || 'rock'}
                        accent={smp.accent || '#38bdf8'}
                        isMars={isMars}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-amber-400/15 px-1.5 py-0.2 font-mono text-[9px] font-bold text-amber-300">
                            {smp.rarity || 'SPECIMEN'}
                          </span>
                          {smp.formula && (
                            <span className="font-mono text-[10px] font-semibold text-sky-300">
                              {smp.formula}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-xs font-bold text-white">{smp.name}</div>
                        <div className="truncate text-[10px] text-slate-400">{smp.mineral}</div>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-bold text-amber-300">
                            +{smp.value} Coins
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setInventoryOpen(false);
                              onViewRealImage?.(smp.mediaKey, smp.name);
                            }}
                            className="flex items-center gap-1 rounded-md border border-sky-500/40 bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-200 transition hover:bg-sky-500/30"
                          >
                            <Eye size={11} /> Real NASA Photo
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {invTab === 'modules' && (
            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Deployable NASA Modules ({totalInventoryModules})
                </h4>
                {totalInventoryModules > 0 && (
                  <button
                    type="button"
                    onClick={onEnterBuildEdit}
                    className="text-[11px] font-semibold text-sky-400 hover:text-sky-300"
                  >
                    Open Top View to Place →
                  </button>
                )}
              </div>

              {inventoryModuleEntries.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center text-xs text-slate-400">
                  No unplaced modules in Inventory. Visit the <strong className="text-amber-300">Store</strong> to acquire NASA hardware.
                </div>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {inventoryModuleEntries.map(([mType, qty]) => {
                    const spec = MODULE_SPECS[mType];
                    return (
                      <div
                        key={mType}
                        className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/95 p-3"
                      >
                        <div>
                          <div className="text-xs font-bold text-white">{spec?.label || mType}</div>
                          <div className="font-mono text-[10px] text-amber-300">Stored: x{qty}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInvModuleType(mType);
                            onEnterBuildEdit();
                          }}
                          className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/25"
                        >
                          Deploy
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {invTab === 'gear' && (
            <div className="space-y-4">
              <div>
                <h4 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-rose-400">
                  Life Support Supplies &amp; Medical Kit
                </h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-xl border border-amber-500/35 bg-amber-950/20 p-2.5">
                    <div>
                      <div className="text-xs font-bold text-white">Food &amp; Water Pack (x{rationsCount})</div>
                      <div className="text-[10px] text-slate-400">+6 Food, +35% Water, +25% O₂</div>
                    </div>
                    <button
                      type="button"
                      disabled={rationsCount <= 0}
                      onClick={onEatRation}
                      className="rounded-lg bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-500"
                    >
                      Use
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-rose-500/35 bg-rose-950/20 p-2.5">
                    <div>
                      <div className="text-xs font-bold text-white">EVA Trauma Medkit (x{medkitsCount})</div>
                      <div className="text-[10px] text-slate-400">Restores +8 Health immediately</div>
                    </div>
                    <button
                      type="button"
                      disabled={medkitsCount <= 0}
                      onClick={onUseMedkit}
                      className="rounded-lg bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-400 disabled:bg-slate-800 disabled:text-slate-500"
                    >
                      Heal
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Geological Excavation Tools
                </h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-2.5">
                    <div>
                      <div className="text-xs font-bold text-white">Multi-Layer Trenching Scoop</div>
                      <div className="text-[10px] text-slate-400">Dig a spot up to 6x, or move on to find new deposits [F]</div>
                    </div>
                    <button
                      type="button"
                      onClick={onEquipScoopAndDig}
                      className="rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-emerald-400"
                    >
                      Dig Now
                    </button>
                  </div>

                  {(inventory.tools || []).includes('core_drill') && (
                    <div className="flex items-center justify-between rounded-xl border border-sky-500/40 bg-sky-950/20 p-2.5">
                      <div>
                        <div className="text-xs font-bold text-white">Apollo Deep Core Drill</div>
                        <div className="text-[10px] text-sky-300">+50% Core Value &amp; Deeper Strata</div>
                      </div>
                      <span className="rounded bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-300">ACTIVE</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Store Modal */}
      {storeOpen && (
        <div className="pointer-events-auto absolute left-1/2 top-1/2 z-30 max-h-[84%] w-[95%] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-700 bg-[#0c111d]/95 p-4 shadow-2xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <ShoppingBag size={17} className="text-amber-400" />
              <div>
                <h3 className="font-display text-sm font-bold text-white">NASA Logistics &amp; Plant Bio-Dome Store</h3>
                <p className="text-[11px] text-slate-400">
                  Sol {day} Progress · Balance: <span className="font-mono font-bold text-amber-300">{coins} Coins</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setStoreTab('hardware')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  storeTab === 'hardware'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Plant Domes &amp; Hardware
              </button>
              <button
                type="button"
                onClick={() => setStoreTab('upgrades')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  storeTab === 'upgrades'
                    ? 'bg-sky-400 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Facility Upgrades
              </button>
              <button
                type="button"
                onClick={() => setStoreOpen(false)}
                className="ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {buyNotice && (
            <div
              key={buyNotice.n}
              role="status"
              aria-live="polite"
              className="sticky top-0 z-10 mb-3 flex items-center gap-2 rounded-lg border border-emerald-400/70 bg-emerald-950/95 px-3 py-2 text-xs font-bold text-emerald-200 shadow-[0_0_18px_rgba(52,211,153,0.45)]"
            >
              <Check size={14} className="shrink-0 text-emerald-300" />
              <span>
                {buyNotice.count === 1 ? '1 purchased' : `${buyNotice.count} purchased so far`}: {buyNotice.name}
                {buyNotice.count > 1 && <span className="ml-1 font-mono text-emerald-400">(+1 just now)</span>}
              </span>
              {buyNotice.isModule && (
                <button
                  type="button"
                  onClick={() => {
                    setStoreOpen(false);
                    setInvTab('modules');
                    setInventoryOpen(true);
                  }}
                  className="ml-auto shrink-0 rounded-md bg-emerald-400 px-2 py-0.5 text-[11px] font-bold text-slate-950 hover:bg-emerald-300"
                >
                  Open Modules →
                </button>
              )}
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setBuyNotice(null)}
                className={`${buyNotice.isModule ? '' : 'ml-auto'} shrink-0 rounded p-0.5 text-emerald-300/80 hover:bg-emerald-900 hover:text-white`}
              >
                <X size={13} />
              </button>
            </div>
          )}

          {storeTab === 'hardware' ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {STORE_HARDWARE.map((item) => {
                const locked = day < item.unlockDay;
                const alreadyOwnedTool = item.kind === 'tool' && (inventory.tools || []).includes(item.toolId);
                const canAfford = coins >= item.cost;
                const ownedQty = item.kind === 'module' ? inventory.modules?.[item.moduleType] || 0 : 0;
                const buyable = !locked && !alreadyOwnedTool && canAfford;

                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={buyable ? 0 : -1}
                    aria-disabled={!buyable}
                    title={buyable ? `Click to buy for ${item.cost} Coins` : undefined}
                    onClick={() => buyable && handleStoreBuy(item)}
                    onKeyDown={(e) => {
                      if (buyable && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        handleStoreBuy(item);
                      }
                    }}
                    className={`flex flex-col justify-between rounded-xl border p-3 transition duration-200 ${
                      locked
                        ? 'border-slate-800/80 bg-slate-950/60 opacity-65'
                        : alreadyOwnedTool
                          ? 'border-slate-800 bg-slate-900/90'
                          : buyable
                            ? 'cursor-pointer border-slate-800 bg-slate-900/90 hover:border-emerald-400 hover:bg-emerald-950/30 hover:shadow-[0_0_18px_rgba(52,211,153,0.6)] active:scale-[0.98]'
                            : 'cursor-not-allowed border-slate-800 bg-slate-900/90 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-[10px] font-semibold text-sky-400">{item.nasaRef}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStoreOpen(false);
                            onViewRealImage?.(item.mediaKey, item.name);
                          }}
                          className="text-[10px] font-semibold text-slate-400 underline hover:text-sky-300"
                        >
                          NASA Photo
                        </button>
                      </div>
                      <h4 className="mt-0.5 text-xs font-bold text-white">{item.name}</h4>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{item.desc}</p>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2">
                      {locked ? (
                        <span className="flex items-center gap-1 font-mono text-[11px] font-semibold text-rose-400">
                          <Lock size={12} /> Unlocks Sol {item.unlockDay}
                        </span>
                      ) : alreadyOwnedTool ? (
                        <span className="font-mono text-[11px] font-bold text-emerald-400">Owned &amp; Equipped</span>
                      ) : (
                        <>
                          <span className="font-mono text-xs font-bold text-amber-300">
                            {item.cost} Coins {ownedQty > 0 && <span className="text-slate-400">(In Bag: {ownedQty})</span>}
                          </span>
                          {!canAfford && <span className="font-mono text-[10px] text-rose-400">Not enough coins</span>}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {PROGRESSION_UPGRADES.map((upg) => {
                const currentTier = upgrades[upg.key] || 1;
                return (
                  <div key={upg.key} className="rounded-xl border border-slate-800 bg-slate-900/90 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-[10px] font-semibold text-sky-400">{upg.nasaRef}</span>
                        <h4 className="text-xs font-bold text-white">
                          {upg.name}{' '}
                          <span className="ml-1 rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
                            Tier {currentTier}
                          </span>
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setStoreOpen(false);
                          onViewRealImage?.(upg.mediaKey, upg.name);
                        }}
                        className="text-[11px] font-semibold text-sky-400 hover:text-sky-300"
                      >
                        Inspect Tech →
                      </button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {upg.tiers.map((t) => {
                        const completed = currentTier >= t.tier;
                        const unlocked = day >= t.unlockDay;
                        const prevTierMet = currentTier >= t.tier - 1;
                        const canBuy = !completed && unlocked && prevTierMet && coins >= t.cost;

                        return (
                          <div
                            key={t.tier}
                            role="button"
                            tabIndex={canBuy ? 0 : -1}
                            aria-disabled={!canBuy}
                            title={canBuy ? `Click to upgrade for ${t.cost} Coins` : undefined}
                            onClick={() => canBuy && handleUpgradeBuy(upg, t)}
                            onKeyDown={(e) => {
                              if (canBuy && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                handleUpgradeBuy(upg, t);
                              }
                            }}
                            className={`rounded-lg border p-2.5 ${
                              completed
                                ? 'border-emerald-500/40 bg-emerald-950/20'
                                : !unlocked
                                  ? 'border-slate-800 bg-slate-950/70 opacity-65'
                                  : canBuy
                                    ? 'cursor-pointer border-slate-700 bg-slate-950 transition duration-200 hover:border-emerald-400 hover:bg-emerald-950/30 hover:shadow-[0_0_18px_rgba(52,211,153,0.6)] active:scale-[0.98]'
                                    : 'border-slate-700 bg-slate-950 opacity-60'
                            }`}
                          >
                            <div className="text-[11px] font-bold text-white">{t.label}</div>
                            <div className="mt-0.5 text-[10px] text-slate-400">{t.bonus}</div>

                            <div className="mt-2 flex items-center justify-between">
                              {completed ? (
                                <span className="flex items-center gap-1 font-mono text-[10px] font-bold text-emerald-400">
                                  <Check size={12} /> Installed
                                </span>
                              ) : !unlocked ? (
                                <span className="flex items-center gap-1 font-mono text-[10px] font-semibold text-rose-400">
                                  <Lock size={11} /> Reach Sol {t.unlockDay}
                                </span>
                              ) : !prevTierMet ? (
                                <span className="font-mono text-[10px] text-slate-400">Requires Tier {t.tier - 1}</span>
                              ) : (
                                <>
                                  <span className="font-mono text-[11px] font-bold text-amber-300">{t.cost} Coins</span>
                                  {coins < t.cost && <span className="font-mono text-[10px] text-rose-400">Not enough coins</span>}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Top View Editor Toolbar */}
      {buildMode && (
        <div className="pointer-events-auto absolute left-1/2 top-28 z-30 flex w-[96%] max-w-4xl -translate-x-1/2 flex-col gap-2 rounded-xl border border-slate-700 bg-[#0b101b]/95 px-3.5 py-2.5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs font-bold text-slate-200">
              <span className="text-sky-400">TOP VIEW DEPLOYMENT</span>
              <span className="hidden font-sans text-[11px] font-normal text-slate-400 sm:inline">
                · Pan: <strong className="text-slate-200">WASD / Drag</strong> · Zoom: <strong className="text-slate-200">Scroll</strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onRecenterTopView}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              >
                <Crosshair size={13} className="text-sky-400" /> Center
              </button>
              <button
                type="button"
                onClick={() => {
                  setBuildMode(false);
                  setSelectedInvModuleType(null);
                  setMovingModuleId(null);
                  onClearGhost?.();
                }}
                className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-emerald-400"
              >
                <Check size={14} /> Done
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-2">
            <span className="flex items-center gap-1 font-mono text-[11px] font-semibold text-amber-300">
              <Package size={13} /> Inventory Modules:
            </span>

            {inventoryModuleEntries.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>No unplaced modules in Inventory.</span>
                <button
                  type="button"
                  onClick={() => {
                    setBuildMode(false);
                    setStoreOpen(true);
                  }}
                  className="rounded border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/25"
                >
                  Open Store
                </button>
              </div>
            ) : (
              inventoryModuleEntries.map(([mType, qty]) => {
                const spec = MODULE_SPECS[mType];
                const active = selectedInvModuleType === mType;
                return (
                  <button
                    key={mType}
                    type="button"
                    onClick={() => {
                      setMovingModuleId(null);
                      setSelectedInvModuleType((prev) => (prev === mType ? null : mType));
                    }}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                      active
                        ? 'border-emerald-400 bg-emerald-500/20 text-white'
                        : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
                    }`}
                  >
                    <span>+ {spec?.label || mType}</span>
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                      x{qty}
                    </span>
                  </button>
                );
              })
            )}

            <span className="ml-auto text-[11px] text-slate-400">
              {movingModuleId
                ? 'Click clear ground to move selected module'
                : selectedInvModuleType
                  ? 'Click clear ground to deploy from Inventory'
                  : 'Select a module above or click an existing module to move it'}
            </span>
          </div>
        </div>
      )}

      {guideOpen && <DriveGuide isMars={isMars} onClose={() => setGuideOpen(false)} />}

      {/* Bottom Left Control Hint */}
      {phase === 'explore' && !buildMode && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 hidden rounded-lg border border-slate-800 bg-[#0b101b]/85 px-3 py-1.5 font-mono text-[11px] text-slate-400 sm:block">
          <span className="font-bold text-slate-200">WASD</span> Move ·{' '}
          <span className="font-bold text-emerald-300">[F]</span> Dig Soil ·{' '}
          <span className="font-bold text-sky-300">[E]</span> Scan Rocks / Bio-Dome ·{' '}
          <span className="font-bold text-amber-300">[I]</span> Inventory
        </div>
      )}
    </div>
  );
}