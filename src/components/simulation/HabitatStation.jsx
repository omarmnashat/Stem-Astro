import { motion } from 'framer-motion';
import Icon from '../Icon.jsx';
import { RESOURCE_META } from '../../engine/missionConfig.js';
import { statusOf } from '../../engine/resourceManager.js';

const STATUS_RING = {
  good: 'ring-emerald-400/50 shadow-[0_0_16px_rgba(52,211,153,0.2)]',
  warning: 'ring-amber-400/65 shadow-[0_0_16px_rgba(251,191,36,0.25)]',
  critical: 'ring-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.35)]',
};

const STATION_STYLES = {
  oxygen: { accent: 'from-sky-500/20 to-cyan-600/5', border: 'border-sky-400/35', iconBg: 'bg-sky-500/20 text-sky-200' },
  water: { accent: 'from-cyan-500/20 to-teal-600/5', border: 'border-cyan-400/35', iconBg: 'bg-cyan-500/20 text-cyan-200' },
  food: { accent: 'from-amber-500/20 to-yellow-600/5', border: 'border-amber-400/35', iconBg: 'bg-amber-500/20 text-amber-100' },
  electricity: { accent: 'from-violet-500/20 to-purple-600/5', border: 'border-violet-400/35', iconBg: 'bg-violet-500/20 text-violet-200' },
  radiation: { accent: 'from-fuchsia-500/20 to-pink-600/5', border: 'border-fuchsia-400/35', iconBg: 'bg-fuchsia-500/20 text-fuchsia-200' },
  health: { accent: 'from-emerald-500/20 to-green-600/5', border: 'border-emerald-400/35', iconBg: 'bg-emerald-500/20 text-emerald-200' },
};

/**
 * Compact expandable habitat resource panel.
 */
export default function HabitatStation({
  resourceKey,
  value = 0,
  delta = 0,
  actionId,
  actionLabel,
  actionOk,
  actionReason,
  onAct,
  disabled,
  style = {},
  compact = false,
}) {
  const meta = RESOURCE_META[resourceKey] || { label: resourceKey, icon: 'Activity', color: '#38bdf8', explain: '' };
  const status = statusOf(value);
  const look = STATION_STYLES[resourceKey] || STATION_STYLES.oxygen;
  const pct = Math.max(0, Math.min(100, Math.round(value)));

  const statusText = status === 'good' ? 'Stable' : status === 'warning' ? 'Low' : 'Critical';
  const statusColor =
    status === 'good' ? 'text-emerald-300' : status === 'warning' ? 'text-amber-300' : 'text-rose-400';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-xl border bg-gradient-to-br ring-1 ${look.accent} ${look.border} ${STATUS_RING[status]} ${
        compact ? 'p-2.5' : 'p-3'
      }`}
      style={style}
      aria-label={`${meta.label}: ${pct} percent`}
    >
      {/* الصف العلوي: الأيقونة + الاسم + الحالة + النسبة المئوية */}
      <div className="flex items-center gap-2.5">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${look.iconBg}`}>
          <Icon name={meta.icon} size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="font-display text-sm font-bold text-white">{meta.label}</h3>
              <span className={`text-[10px] font-bold uppercase tracking-wide ${statusColor}`}>
                • {statusText}
              </span>
              <span className="rounded bg-fuchsia-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-fuchsia-300">
                Simulated
              </span>
            </div>

            <div className="flex items-baseline gap-1.5 shrink-0">
              {delta !== 0 && (
                <span
                  className={`text-[11px] font-bold ${delta > 0 ? 'text-emerald-300' : 'text-rose-300'}`}
                  aria-live="polite"
                >
                  {delta > 0 ? `+${Math.round(delta * 10) / 10}` : Math.round(delta * 10) / 10}
                </span>
              )}
              <span className="font-display text-base font-extrabold tabular-nums text-white">{pct}%</span>
            </div>
          </div>

          {/* شريط التقدم */}
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/45">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: meta.color }}
              initial={false}
              animate={{ width: `${Math.max(2, pct)}%` }}
              transition={{ type: 'spring', stiffness: 140, damping: 20 }}
            />
          </div>
        </div>
      </div>

      {/* الصف السفلي: الشرح المختصر + زر التشغيل */}
      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] leading-snug text-slate-300/90 sm:flex-1">{meta.explain}</p>

        {actionId && (
          <button
            type="button"
            disabled={disabled || !actionOk}
            onClick={() => onAct?.(actionId)}
            title={actionOk ? actionLabel : actionReason}
            className="shrink-0 rounded-lg border border-cyan-400/35 bg-cyan-500/15 px-3 py-1.5 text-left text-xs font-bold text-cyan-100 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400"
          >
            <span className="flex items-center gap-1.5">
              <span className="text-cyan-300">▶</span>
              <span>{actionLabel || 'Operate'}</span>
            </span>
            {!actionOk && actionReason && (
              <span className="mt-0.5 block text-[10px] font-normal text-rose-300">{actionReason}</span>
            )}
          </button>
        )}
      </div>
    </motion.article>
  );
}