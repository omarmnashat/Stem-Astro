import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Lock } from 'lucide-react';
import AstronautAvatar from '../components/AstronautAvatar.jsx';
import { AVATARS, DIFFICULTIES } from '../engine/missionConfig.js';
import { roleLabel } from '../data/astronautRoles.js';
import { useCrew } from '../hooks/useCrew.jsx';
import { useApp } from '../hooks/useApp.jsx';
import { playSound } from '../services/soundService.js';

/** Keep nicknames simple and safe: letters, numbers, spaces, - and _ only. */
export const cleanNickname = (value) => value.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 16);

export default function Profile() {
  const { profile, updateProfile } = useApp();
  const { me, serverCode } = useCrew();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState(profile.nickname);

  const submit = (e) => {
    e.preventDefault();
    updateProfile({ nickname: cleanNickname(nickname).trim() || 'Commander' });
    playSound('click');
    navigate('/shuttle');
  };

  // Clearing the role sends the astronaut back to the role menu.
  const changeRole = () => {
    try {
      const session = JSON.parse(localStorage.getItem('astra_edu_session') || 'null');
      if (session) {
        delete session.role;
        localStorage.setItem('astra_edu_session', JSON.stringify(session));
        window.dispatchEvent(new Event('astra_session_change'));
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="page max-w-3xl">
      <h1 className="font-display text-4xl font-bold">Create Your Astronaut</h1>
      <p className="mt-1 text-slate-300">Choose how you want to appear in Mission Control.</p>

      <form onSubmit={submit} className="mt-6 space-y-6">
        <div className="panel">
          <label htmlFor="nick" className="font-display text-lg font-bold">1. Astronaut nickname</label>
          <input
            id="nick"
            className="input mt-2"
            value={nickname}
            maxLength={16}
            onChange={(e) => setNickname(cleanNickname(e.target.value))}
            placeholder="Commander"
            autoComplete="off"
            aria-describedby="nick-help"
          />
          <p id="nick-help" className="mt-2 flex items-start gap-1.5 text-sm text-slate-300">
            <Lock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            Use a made-up nickname, not your real name. We never ask for emails or personal details, and everything stays on your device.
          </p>
        </div>

        <fieldset className="panel">
          <legend className="px-1 font-display text-lg font-bold">2. Choose your astronaut</legend>
          <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-6" role="radiogroup" aria-label="Astronaut avatar">
            {AVATARS.map((a) => (
              <label key={a.id} className="cursor-pointer">
                <input
                  type="radio"
                  name="avatar"
                  value={a.id}
                  checked={profile.avatar === a.id}
                  onChange={() => updateProfile({ avatar: a.id })}
                  className="peer sr-only"
                />
                <span className="flex flex-col items-center rounded-2xl border-2 border-white/10 bg-space-900/60 p-2 transition peer-checked:border-cyan-300 peer-checked:bg-cyan-400/15 peer-checked:shadow-glow peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-amber-300">
                  <AstronautAvatar avatar={a.id} size={56} label={`${a.name} astronaut`} />
                  <span className="mt-1 text-sm font-bold">{a.name}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="panel">
          <legend className="px-1 font-display text-lg font-bold">3. Select difficulty</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {Object.values(DIFFICULTIES).map((d) => (
              <label key={d.id} className="cursor-pointer">
                <input
                  type="radio"
                  name="difficulty"
                  value={d.id}
                  checked={profile.difficulty === d.id}
                  onChange={() => updateProfile({ difficulty: d.id })}
                  className="peer sr-only"
                />
                <span className="block h-full rounded-2xl border-2 border-white/10 bg-space-900/60 p-3 transition peer-checked:border-cyan-300 peer-checked:bg-cyan-400/15 peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-amber-300">
                  <span className="font-display text-lg font-bold">{d.label}</span>
                  <span className="block text-xs font-bold uppercase tracking-wide text-cyan-300">{d.ages}</span>
                  <span className="mt-1 block text-sm text-slate-300">{d.blurb}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="panel flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">4. Your astronaut role</h2>
            <p className="text-sm text-slate-300">
              You are the <b className="text-white">{me ? roleLabel(me.role) : 'Astronaut'}</b> on server {serverCode || 'SOLO'}.
            </p>
          </div>
          <button type="button" className="btn btn-ghost !min-h-[40px]" onClick={changeRole}>
            Change role
          </button>
        </div>

        <button type="submit" className="btn btn-primary btn-lg w-full sm:w-auto">
          Board the Space Shuttle <ChevronRight size={22} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
