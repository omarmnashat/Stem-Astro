import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AstronautAvatar from '../AstronautAvatar.jsx';
import NovaMessage from '../NovaMessage.jsx';
import Icon from '../Icon.jsx';
import Planet from '../Planet.jsx';
import { BRIEFING_TERMS, GLOSSARY, SURVIVAL_RULES } from '../../data/scienceFacts.js';
import { roleLabel } from '../../data/astronautRoles.js';
import { DIFFICULTIES, MISSION_LENGTH, PLANETS, RESOURCE_META, START_VALUES } from '../../engine/missionConfig.js';
import { useApp } from '../../hooks/useApp.jsx';
import { useCrew } from '../../hooks/useCrew.jsx';
import { TRIP } from './shuttleScene.js';

const TUTORIAL = [
  { e: '📊', t: 'Read the resource cards', d: 'Six cards show how you are doing. Green is healthy. Yellow needs attention. Red is critical.' },
  { e: '🛠️', t: 'Spend your daily actions', d: 'You get three actions a day. Each one costs something, like electricity or water. Choose wisely!' },
  { e: '⚠️', t: 'Handle surprises', d: 'Emergencies appear with three choices. Look at each cost, then decide.' },
  { e: '🌙', t: 'End the day', d: `Ending the day uses up resources. Survive all ${MISSION_LENGTH} days to complete the mission!` },
];

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'resources', label: 'Resources' },
  { id: 'rules', label: 'Rules & words' },
  { id: 'howto', label: 'How to play' },
];

/**
 * Everything the old "Choose Your Mission" and "Mission Briefing" pages used to show.
 * It opens inside the shuttle cockpit as soon as a destination is selected.
 */
export default function DestinationBriefing({ dest, onClose }) {
  const { profile } = useApp();
  const { crew, serverCode } = useCrew();
  const [tab, setTab] = useState('overview');
  const [step, setStep] = useState(0);
  const planet = PLANETS[dest];
  const trip = TRIP[dest];
  const diff = DIFFICULTIES[profile.difficulty] || DIFFICULTIES.normal;
  if (!planet) return null;

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/80 p-3" role="dialog" aria-modal="true" aria-label={`${planet.name} mission briefing`}>
      <div className="thin-scroll max-h-full w-full max-w-4xl overflow-y-auto rounded-2xl border border-cyan-300/40 bg-[#10131a] p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Planet kind={planet.id} size={92} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">Mission {planet.missionCode} · briefing</p>
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">{planet.missionName}</h2>
            <p className="text-sm text-slate-300">
              <span className="chip mr-1">{planet.difficultyLabel}</span>
              Difficulty: <b className="text-white">{diff.label}</b> ({diff.ages}) · <b className="text-white">{MISSION_LENGTH} days</b>
            </p>
          </div>
          <button type="button" className="btn btn-ghost !min-h-[38px] !px-3 !py-1 text-sm" onClick={onClose}>
            Close ✕
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Briefing sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-xl border px-3 py-1.5 text-sm font-bold transition ${
                tab === t.id ? 'border-cyan-300 bg-cyan-400/15 text-cyan-100' : 'border-white/10 text-slate-300 hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl bg-white/5 p-3">
              <h3 className="panel-title">🎯 Mission objective</h3>
              <p className="text-slate-100">{planet.blurb}</p>
              <p className="mt-2 rounded-xl bg-cyan-400/10 p-2.5 text-sm font-semibold text-cyan-100">
                {planet.objective} Keep your crew safe, and make smart choices when things go wrong.
              </p>
              <p className="mt-2 text-sm text-slate-200">
                📍 Distance from Earth: <b className="text-white">{trip.far}</b>
                {dest === 'mars' && ' (it changes as the planets move)'}
              </p>
            </section>

            <section className="rounded-2xl bg-white/5 p-3">
              <h3 className="panel-title">👩‍🚀 Your crew on server {serverCode || 'SOLO'}</h3>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {crew.map((c) => (
                  <li key={c.id} className="flex flex-col items-center rounded-2xl bg-space-900/60 p-2 text-center">
                    <AstronautAvatar avatar={c.avatar} size={46} />
                    <span className="mt-1 max-w-full truncate text-xs font-bold">{c.name}</span>
                    <span className="text-[11px] text-slate-300">{roleLabel(c.role)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-slate-400">Only astronauts who joined this server are on the crew.</p>
            </section>

            <section className="rounded-2xl bg-white/5 p-3">
              <h3 className="panel-title">🌡️ Environmental challenges</h3>
              <ul className="grid grid-cols-2 gap-2">
                {planet.environment.map((e) => (
                  <li key={e.text} className="flex items-center gap-2 rounded-xl bg-space-900/60 p-2 text-sm">
                    <span aria-hidden="true">{e.emoji}</span> {e.text}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl bg-white/5 p-3">
              <h3 className="panel-title">✨ Fun facts</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
                {planet.facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {tab === 'resources' && (
          <section className="mt-4 rounded-2xl bg-white/5 p-3">
            <h3 className="panel-title">📦 Available resources</h3>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(RESOURCE_META).map(([k, r]) => (
                <li key={k} className="flex items-start gap-2 rounded-xl bg-space-900/60 p-2.5">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${r.color}22`, color: r.color }}>
                    <Icon name={r.icon} size={18} />
                  </span>
                  <div className="text-sm">
                    <b>{r.label}</b>{' '}
                    <span className="text-slate-400">starts at {k === 'radiation' ? diff.startRadiation : START_VALUES[k]}%</span>
                    <p className="text-xs text-slate-300">{r.explain}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-400">These starting numbers are made up for the game. They are not NASA measurements.</p>
          </section>
        )}

        {tab === 'rules' && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl bg-white/5 p-3">
              <h3 className="panel-title">📘 Important survival rules</h3>
              <ul className="space-y-2">
                {SURVIVAL_RULES.map((r) => (
                  <li key={r.text} className="flex gap-2 text-sm text-slate-100">
                    <span aria-hidden="true">{r.emoji}</span> {r.text}
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-2xl bg-white/5 p-3">
              <h3 className="panel-title">🔤 Words to know</h3>
              <dl className="space-y-2">
                {BRIEFING_TERMS.map((t) => (
                  <div key={t} className="rounded-xl bg-space-900/60 p-2.5">
                    <dt className="font-display font-bold text-cyan-300">{t}</dt>
                    <dd className="text-sm text-slate-100">{GLOSSARY.find((g) => g.term === t)?.meaning}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        )}

        {tab === 'howto' && (
          <section className="mt-4 rounded-2xl bg-white/5 p-3">
            <h3 className="panel-title">🎓 Quick tutorial</h3>
            <div className="flex flex-col items-stretch gap-2 rounded-2xl bg-space-900/60 p-4 sm:flex-row sm:items-end">
              <div className="flex-1" aria-live="polite">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-cyan-300">Step {step + 1} of {TUTORIAL.length}</p>
                <NovaMessage size={72} mood={step === 0 ? 'wave' : step === TUTORIAL.length - 1 ? 'wow' : 'happy'} title={`${TUTORIAL[step].e} ${TUTORIAL[step].t}`}>
                  {TUTORIAL[step].d}
                </NovaMessage>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn btn-ghost !min-h-[40px]" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} aria-label="Previous tutorial step">
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <button type="button" className="btn btn-ghost !min-h-[40px]" onClick={() => setStep((s) => Math.min(TUTORIAL.length - 1, s + 1))} disabled={step === TUTORIAL.length - 1} aria-label="Next tutorial step">
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary !min-h-[42px]" onClick={onClose}>
            Back to the cockpit
          </button>
          <p className="text-xs text-slate-400">Reopen this any time with the MISSION BRIEFING button.</p>
        </div>
      </div>
    </div>
  );
}
