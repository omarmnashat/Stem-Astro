import { useState } from 'react';
import { Check, Radio, Rocket } from 'lucide-react';
import AstronautAvatar from './AstronautAvatar.jsx';
import { ROLES } from '../data/astronautRoles.js';
import { useCrew } from '../hooks/useCrew.jsx';
import { playSound } from '../services/soundService.js';

/**
 * Shown once when an astronaut enters the game: pick a job.
 * The jobs are real NASA crew positions (Commander, Pilot, Flight Engineer, ...).
 */
export default function RoleSelect({ session, avatar, onConfirm }) {
  const { crew, takenBy, serverCode } = useCrew();
  const [role, setRole] = useState(session?.role || '');

  const isTaken = (r) => r.unique && Boolean(takenBy[r.id]);
  const chosen = ROLES.find((r) => r.id === role && !isTaken(r));

  const confirm = () => {
    if (!chosen) return;
    playSound('success');
    onConfirm(chosen.id);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#070a10] p-4 text-slate-100">
      <div className="mx-auto max-w-5xl py-4 sm:py-8">
        <div className="flex flex-wrap items-center gap-4">
          <AstronautAvatar avatar={avatar} size={64} float />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-300">Crew assignment</p>
            <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">Choose your astronaut role</h1>
            <p className="mt-1 text-slate-300">
              Welcome, <b className="text-white">{session?.username}</b>! Real NASA crews give every astronaut a job.
              Pick the one you want to do on this mission.
            </p>
          </div>
        </div>

        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-200">
          <Radio size={14} aria-hidden="true" /> Server {serverCode || 'SOLO'} · {Math.max(crew.length, 0)} astronaut
          {crew.length === 1 ? '' : 's'} with a role so far
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Astronaut role">
          {ROLES.map((r) => {
            const taken = isTaken(r);
            const selected = role === r.id && !taken;
            return (
              <label key={r.id} className={taken ? 'cursor-not-allowed' : 'cursor-pointer'}>
                <input
                  type="radio"
                  name="role"
                  value={r.id}
                  checked={selected}
                  disabled={taken}
                  onChange={() => {
                    playSound('click');
                    setRole(r.id);
                  }}
                  className="peer sr-only"
                />
                <span
                  className={`flex h-full flex-col rounded-2xl border-2 p-4 transition peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-amber-300 ${
                    taken
                      ? 'border-white/5 bg-white/[0.02] opacity-50'
                      : selected
                        ? 'border-cyan-300 bg-cyan-400/15 shadow-glow'
                        : 'border-white/10 bg-white/[0.04] hover:border-white/30'
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-3xl" aria-hidden="true">{r.emoji}</span>
                    {selected && <Check size={20} className="text-cyan-300" aria-hidden="true" />}
                  </span>
                  <span className="mt-2 font-display text-xl font-bold text-white">{r.label}</span>
                  <span className="mt-1 text-sm text-slate-200">{r.duty}</span>
                  <span className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Real NASA crews
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {r.missions.map((m) => (
                      <span key={m} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-200">
                        {m}
                      </span>
                    ))}
                  </span>
                  {taken && (
                    <span className="mt-3 text-xs font-bold text-amber-200">Already taken by {takenBy[r.id]}</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Commander and Pilot can only belong to one astronaut per server, like on a real flight. Other jobs can be shared.
          The roles come from real crews on Apollo, the Space Shuttle, the International Space Station, Artemis II and NASA’s
          CHAPEA Mars-habitat study. The game duties are simplified.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary btn-lg" onClick={confirm} disabled={!chosen}>
            <Rocket size={20} aria-hidden="true" /> {chosen ? `Enter as ${chosen.label}` : 'Pick a role to continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
