import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Coins, Copy, Check, LogOut, Menu, Play, Music, Radio, Rocket, Volume2, VolumeX, X } from 'lucide-react';
import { useApp } from '../hooks/useApp.jsx';
import { getCoins } from '../utils/coinsManager.js';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/how-to-play', label: 'How to Play' },
  { to: '/science', label: 'Space Science' },
  { to: '/about', label: 'About' },
];

function getEduSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem('astra_edu_session') || 'null');
    return parsed && parsed.username ? parsed : null;
  } catch {
    return null;
  }
}

export default function Navbar() {
  const { game, profile, settings, updateSettings } = useApp();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(getEduSession);
  const [coins, setCoinsState] = useState(getCoins);
  const [copied, setCopied] = useState(false);

  const resumable = game && game.status === 'playing';
  const astronautName = session?.username || profile?.nickname || 'Commander';
  const serverCode = session?.serverCode || session?.classTeam || 'SOLO';

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const syncSession = () => {
      setSession(getEduSession());
      setCoinsState(getCoins());
    };
    const syncCoins = () => setCoinsState(getCoins());

    window.addEventListener('storage', syncSession);
    window.addEventListener('astra_session_change', syncSession);
    window.addEventListener('astra_coins_change', syncCoins);
    return () => {
      window.removeEventListener('storage', syncSession);
      window.removeEventListener('astra_session_change', syncSession);
      window.removeEventListener('astra_coins_change', syncCoins);
    };
  }, []);

  const handleCopyServer = async () => {
    try {
      await navigator.clipboard.writeText(serverCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // تجاهل
    }
  };

  const handleLogout = () => {
    if (!window.confirm('Sign out and return to Crew Login?')) return;
    setOpen(false);
    try {
      localStorage.removeItem('astra_edu_session');
      window.dispatchEvent(new Event('astra_session_change'));
    } catch {
      window.location.reload();
    }
  };

  const linkClass = ({ isActive }) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
      isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-900 hover:text-white'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/90 bg-[#090d16]/95">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6" aria-label="Main">
        <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-white">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-slate-700 bg-slate-900 text-sky-400">
            <Rocket size={17} aria-hidden="true" />
          </span>
          <span>ExoLife</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* كود السيرفر القابل للنسخ */}
          <button
            type="button"
            onClick={handleCopyServer}
            title="Click to copy Server Code for teammates"
            className="hidden items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1.5 font-mono text-xs text-slate-200 transition hover:border-slate-700 sm:flex"
          >
            <Radio size={13} className="text-emerald-400" />
            <span className="font-bold text-sky-300">{serverCode}</span>
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-slate-400" />}
          </button>

          {/* رصيد الكوينز */}
          <div
            title="Astro Coins Balance"
            className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 font-mono text-xs font-bold text-amber-300"
          >
            <Coins size={14} className="text-amber-400" aria-hidden="true" />
            <span className="tabular-nums">{coins}</span>
          </div>

          <Link
            to="/profile"
            title="Astronaut Profile"
            className="hidden items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-700 hover:text-white lg:flex"
          >
            <span className="max-w-[100px] truncate">{astronautName}</span>
          </Link>

          {resumable && (
            <Link
              to="/mission"
              className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-amber-300"
            >
              <Play size={14} aria-hidden="true" />
              <span className="hidden sm:inline">Resume</span>
            </Link>
          )}

          <button
            type="button"
            className="rounded-lg border border-slate-800 bg-slate-900/80 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
            onClick={() => updateSettings({ sound: !settings.sound })}
            aria-pressed={settings.sound}
            aria-label={settings.sound ? 'Mute sound effects' : 'Turn on sound effects'}
          >
            {settings.sound ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
          </button>

          <button
            type="button"
            className={`rounded-lg border border-slate-800 bg-slate-900/80 p-2 transition hover:bg-slate-800 hover:text-white ${
              settings.music !== false ? 'text-cyan-300' : 'text-slate-500 line-through'
            }`}
            onClick={() => updateSettings({ music: settings.music === false })}
            aria-pressed={settings.music !== false}
            aria-label={settings.music !== false ? 'Turn background music off' : 'Turn background music on'}
            title="Background music"
          >
            <Music size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="rounded-lg border border-slate-800 bg-slate-900/80 p-2 text-slate-400 transition hover:border-rose-500/40 hover:bg-rose-950/30 hover:text-rose-300"
            onClick={handleLogout}
            title="Sign Out"
            aria-label="Sign out"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="rounded-lg border border-slate-800 bg-slate-900/80 p-2 text-slate-300 md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-menu" className="border-t border-slate-800 bg-[#090d16] px-4 pb-3 md:hidden">
          <div className="mt-2 flex flex-col gap-1">
            <div className="mb-1 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs">
              <span className="font-semibold text-white">{astronautName}</span>
              <button
                type="button"
                onClick={handleCopyServer}
                className="flex items-center gap-1 font-mono font-bold text-sky-300"
              >
                <span>{serverCode}</span>
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </div>

            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass} onClick={() => setOpen(false)}>
                {l.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}