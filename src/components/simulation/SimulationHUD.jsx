import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Pause,
  HelpCircle,
  Satellite,
  ExternalLink,
  Gauge,
  Radio,
  Rocket,
} from 'lucide-react';
import { useNasaData } from '../../hooks/useNasaData.js';
import { getSpaceWeather, getMarsPhotos } from '../../services/nasaService.js';
import { PLANETS, DIFFICULTIES, MISSION_LENGTH } from '../../engine/missionConfig.js';
import { getEnvironment } from '../../engine/resourceManager.js';

function sourceChip(source) {
  if (source === 'live') return <span className="chip tag-live">Live NASA data</span>;
  if (source === 'cache') return <span className="chip tag-cache">Saved NASA data</span>;
  return <span className="chip tag-archived">Archived sample (not live)</span>;
}

export function NasaWeatherStrip({ planet }) {
  const { loading, result, retry } = useNasaData(getSpaceWeather, []);
  const items = (result?.items || []).slice(0, 2);

  return (
    <div className="rounded-xl border border-white/15 bg-space-950/90 p-2.5 shadow-xl">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <Satellite size={14} className="text-cyan-300" aria-hidden />
        <span className="text-xs font-bold text-white">NASA Space Weather</span>
        {result && sourceChip(result.source)}
      </div>
      <p className="mb-1.5 text-[10px] leading-snug text-slate-400">
        Real solar observations from NASA DONKI. They do <strong className="text-slate-300">not</strong> measure radiation at your habitat.
      </p>
      {loading && <p className="text-xs text-slate-400">Contacting NASA…</p>}
      {!loading && items.length === 0 && (
        <p className="text-xs text-slate-300">Quiet Sun — no major events recently.</p>
      )}
      <ul className="space-y-1">
        {items.map((e) => (
          <li key={e.id} className="rounded-lg bg-white/5 px-2 py-1 text-[11px]">
            <strong className="text-white">{e.name}</strong>
            <span className="ml-1 text-slate-400">{String(e.date).slice(0, 10)}</span>
            {e.link && (
              <a
                href={e.link}
                target="_blank"
                rel="noreferrer noopener"
                className="ml-1 inline-flex text-cyan-300"
                aria-label="Open NASA source"
              >
                <ExternalLink size={10} />
              </a>
            )}
          </li>
        ))}
      </ul>
      {result?.error && (
        <button type="button" className="mt-1 text-[11px] font-semibold text-amber-300 underline" onClick={retry}>
          Try again
        </button>
      )}
      {planet === 'mars' && <MarsPhotoHint />}
    </div>
  );
}

function MarsPhotoHint() {
  const { loading, result } = useNasaData(getMarsPhotos, []);
  const photo = result?.items?.[0];
  if (loading || !photo) return null;
  const img = photo.img || photo.img_src;
  const date = photo.earthDate || photo.earth_date || '';
  return (
    <div className="mt-2 flex items-center gap-2 border-t border-white/10 pt-2">
      {img && (
        <img
          src={img}
          alt="Mars rover surface photo from NASA"
          className="h-12 w-16 rounded object-cover"
          loading="lazy"
        />
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-orange-200">NASA Mars rover photo</p>
        <p className="truncate text-[10px] text-slate-400">
          {photo.rover || 'Curiosity'} · {String(date).slice(0, 10)}
        </p>
        {result && sourceChip(result.source)}
      </div>
    </div>
  );
}

/**
 * Top Telemetry Bar: شريط الإحصائيات العلوي للرحلة
 */
export default function SimulationHUD({ game, onPause, onTutorial, onReplayLanding }) {
  const env = getEnvironment(game.planet, game.day);
  const planetMeta = PLANETS[game.planet] || PLANETS.moon;
  const diff = DIFFICULTIES[game.difficulty];
  const isMars = game.planet === 'mars';

  return (
    <header className="relative z-30 flex flex-wrap items-center justify-between gap-2 border-b border-white/15 bg-space-950/90 px-3 py-2.5 sm:px-4">
      {/* 1. الكوكب واليوم */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-lg font-bold text-white">
          {isMars ? 'Sol' : 'Day'} {game.day}
          <span className="text-slate-400"> / {MISSION_LENGTH}</span>
        </span>
        <span className="chip">{planetMeta.name}</span>
        <span className="chip hidden md:inline">{diff?.label || game.difficulty}</span>
        <span className="hidden text-xs text-slate-300 xl:inline">
          · {game.profile?.nickname || 'Commander'} · {env?.label || 'Nominal conditions'}
        </span>
      </div>

      {/* 2. مؤشرات الفيزياء الحية + نقاط الأكشن + أزرار التحكم */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
        <div className="hidden items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-200 lg:flex">
          <span className="flex items-center gap-1" title="Surface Gravity">
            <Gauge size={13} className="text-cyan-300" />
            <strong>{isMars ? '3.71 m/s²' : '1.62 m/s²'}</strong>
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1" title="One-way radio delay to Earth">
            <Radio size={13} className="text-emerald-300" />
            Delay: <strong>{isMars ? '~12m' : '1.3s'}</strong>
          </span>
        </div>

        {/* مؤشر نقاط الأكشن المتبقية */}
        <div className="flex items-center gap-1.5 rounded-xl border border-cyan-400/25 bg-cyan-950/40 px-2.5 py-1 text-xs">
          <span className="font-semibold text-cyan-200">AP</span>
          <span className="flex gap-1" aria-label={`${game.ap} actions left`}>
            {Array.from({ length: Math.max(game.ap, 3) }, (_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full border ${
                  i < game.ap ? 'border-cyan-300 bg-cyan-300 shadow-glow' : 'border-white/25'
                }`}
              />
            ))}
          </span>
        </div>

        {/* زرار إعادة تشغيل مشهد هبوط الصاروخ */}
        {onReplayLanding && (
          <button
            type="button"
            className="btn btn-ghost !min-h-[38px] !rounded-xl !px-2.5 text-xs font-bold text-amber-300"
            onClick={onReplayLanding}
            title="Replay Rocket Landing"
          >
            <Rocket size={15} className="mr-1 inline" />
            <span className="hidden sm:inline">Landing</span>
          </button>
        )}

        <button
          type="button"
          className="btn btn-ghost !min-h-[38px] !rounded-xl !px-2.5"
          onClick={onTutorial}
          aria-label="Show tutorial"
        >
          <HelpCircle size={17} />
        </button>
        <button
          type="button"
          className="btn btn-ghost !min-h-[38px] !rounded-xl !px-2.5"
          onClick={onPause}
          aria-label="Pause mission"
        >
          <Pause size={17} />
        </button>
      </div>
    </header>
  );
}

/** Floating Alerts + Collapsible NASA Console inside the Simulation Viewport */
export function ViewportOverlays({ planet, alerts = [], collapsedNasa, onToggleNasa }) {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-20 flex max-w-xs flex-col items-end gap-2">
      {/* كونسول بيانات ناسا القابل للطي */}
      <div className="pointer-events-auto w-full">
        <button
          type="button"
          onClick={onToggleNasa}
          className="ml-auto mb-1 flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-space-950/85 px-3 py-1 text-[11px] font-bold text-cyan-200 shadow hover:bg-space-900"
        >
          <Satellite size={12} className="text-cyan-300" />
          <span>NASA Live Data</span>
          {collapsedNasa ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>
        {!collapsedNasa && <NasaWeatherStrip planet={planet} />}
      </div>

      {/* التنبيهات الحية */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto w-full space-y-1.5"
          >
            {alerts.slice(0, 3).map((a, i) => (
              <div
                key={`${a.text}-${i}`}
                className={`flex items-start gap-2 rounded-xl border px-2.5 py-2 text-xs ${
                  a.level === 'critical'
                    ? 'border-rose-400/50 bg-rose-950/85 text-rose-100'
                    : a.level === 'warn'
                      ? 'border-amber-400/40 bg-amber-950/80 text-amber-100'
                      : 'border-cyan-400/30 bg-space-950/85 text-slate-100'
                }`}
                role="status"
              >
                <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                <span>{a.text}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function buildSimulationAlerts(game) {
  const list = [];
  const { resources, effects, pendingScenarioId, lastDaySummary } = game;

  for (const key of ['oxygen', 'water', 'food', 'electricity', 'health']) {
    const v = resources[key];
    if (v < 25) list.push({ level: 'critical', text: `${key} critically low (${Math.round(v)}%)` });
    else if (v < 45) list.push({ level: 'warn', text: `${key} running low (${Math.round(v)}%)` });
  }
  if (resources.radiation < 40) {
    list.push({ level: 'warn', text: `Shield strength weak (${Math.round(resources.radiation)}%)` });
  }
  for (const e of effects || []) {
    list.push({ level: 'warn', text: `Active: ${e.id.replace(/-/g, ' ')} (${e.daysLeft}d left)` });
  }
  if (pendingScenarioId) {
    list.push({ level: 'critical', text: 'Mission decision required today' });
  }
  if (lastDaySummary?.note) {
    list.push({ level: 'info', text: lastDaySummary.note });
  }
  return list;
}