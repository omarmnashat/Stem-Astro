import { useState } from 'react';
import {
  Rocket,
  User,
  Lock,
  KeyRound,
  PlusCircle,
  LogIn,
  Copy,
  Check,
  RefreshCw,
  Radio,
  ArrowRight,
} from 'lucide-react';

const USERS_STORAGE_KEY = 'astra_registered_users_v1';

function generateServerCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'AST-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function readUsers() {
  try {
    const raw = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function saveUsers(users) {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch {
    // تجاهل في حال تقييد التخزين
  }
}

export default function AuthClassroomGate({ onAuthenticated }) {
  const [authMode, setAuthMode] = useState('signup'); // 'signin' | 'signup'
  const [serverMode, setServerMode] = useState('create'); // 'create' | 'join'

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [createdCode, setCreatedCode] = useState(generateServerCode);
  const [serverName, setServerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // تجاهل لو المتصفح لا يدعم الحافظة
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanUser = username.trim();
    const userKey = cleanUser.toLowerCase();

    if (cleanUser.length < 2) {
      setError('Username must be at least 2 characters.');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    const users = readUsers();

    if (authMode === 'signup') {
      if (users[userKey]) {
        setError('This username is already registered. Switch to Sign In or choose another name.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Password and Confirm Password do not match.');
        return;
      }
      users[userKey] = {
        username: cleanUser,
        password,
        createdAt: Date.now(),
      };
      saveUsers(users);
    } else {
      const existing = users[userKey];
      if (!existing) {
        setError('Account not found. Please create an account first.');
        return;
      }
      if (existing.password !== password) {
        setError('Incorrect password for this account.');
        return;
      }
    }

    let finalServerCode = '';
    let finalServerName = '';

    if (serverMode === 'create') {
      finalServerCode = createdCode;
      finalServerName = serverName.trim() || `${cleanUser}'s Expedition`;
    } else {
      const cleanedJoin = joinCode.trim().toUpperCase();
      if (cleanedJoin.length < 4) {
        setError('Enter a valid Server Code to join an existing mission.');
        return;
      }
      finalServerCode = cleanedJoin;
      finalServerName = `Server ${cleanedJoin}`;
    }

    const session = {
      username: users[userKey]?.username || cleanUser,
      serverCode: finalServerCode,
      classTeam: finalServerCode,
      serverName: finalServerName,
      isHost: serverMode === 'create',
      joinedAt: Date.now(),
    };

    try {
      localStorage.setItem('astra_edu_session', JSON.stringify(session));
      window.dispatchEvent(new Event('astra_session_change'));
    } catch {
      // متابعة الجلسة في الذاكرة
    }

    onAuthenticated(session);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#070a10] p-4">
      {/* شبكة هندسية خفيفة في الخلفية */}
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative my-auto w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d121c] p-6 shadow-2xl sm:p-7">
        {/* الهيدر */}
        <div className="mb-5 flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-sky-400">
              <Rocket size={20} />
            </div>
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                EXOLIFE TELEMETRY SYSTEM
              </p>
              <h1 className="font-display text-lg font-bold text-white">Crew Access & Server</h1>
            </div>
          </div>
          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
            ONLINE
          </span>
        </div>

        <div className="mb-4 flex items-start gap-3 rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-3 text-sm text-cyan-100">
          <span className="text-xl" aria-hidden="true">👥</span>
          <p>
            <b className="text-white">Play with your friends!</b> Use the same server code as them and you will all
            appear in one crew and share the same base.
          </p>
        </div>

        {/* التبديل بين Sign In و Create Account */}
        <div className="mb-4 grid grid-cols-2 rounded-xl border border-slate-800 bg-[#080b12] p-1">
          <button
            type="button"
            onClick={() => {
              setAuthMode('signup');
              setError('');
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
              authMode === 'signup'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PlusCircle size={14} />
            Create Account
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('signin');
              setError('');
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
              authMode === 'signin'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn size={14} />
            Sign In
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Username */}
          <div>
            <label htmlFor="auth-username" className="mb-1 block text-xs font-medium text-slate-300">
              Username
            </label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="auth-username"
                type="text"
                autoFocus
                maxLength={18}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Enter your astronaut username"
                className="w-full rounded-xl border border-slate-800 bg-[#080b12] py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-600 transition focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="auth-password" className="mb-1 block text-xs font-medium text-slate-300">
              Password
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Enter account password"
                className="w-full rounded-xl border border-slate-800 bg-[#080b12] py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-600 transition focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Confirm Password (يظهر عند إنشاء حساب جديد فقط) */}
          {authMode === 'signup' && (
            <div>
              <label htmlFor="auth-confirm" className="mb-1 block text-xs font-medium text-slate-300">
                Confirm Password
              </label>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="auth-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Re-enter password"
                  className="w-full rounded-xl border border-slate-800 bg-[#080b12] py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-600 transition focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* قسم السيرفر: Create New Server أو Join Server */}
          <div className="pt-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <Radio size={14} className="text-sky-400" />
                Mission Server
              </span>
              <div className="flex gap-1 rounded-lg border border-slate-800 bg-[#080b12] p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setServerMode('create');
                    setError('');
                  }}
                  className={`rounded-md px-2.5 py-1 font-medium transition ${
                    serverMode === 'create' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Create Server
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setServerMode('join');
                    setError('');
                  }}
                  className={`rounded-md px-2.5 py-1 font-medium transition ${
                    serverMode === 'join' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Join by Code
                </button>
              </div>
            </div>

            {serverMode === 'create' ? (
              <div className="space-y-2.5 rounded-xl border border-slate-800 bg-[#080b12] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-slate-500">
                      Shareable Server Code
                    </span>
                    <span className="font-mono text-base font-bold tracking-wider text-sky-300">{createdCode}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCreatedCode(generateServerCode())}
                      title="Generate new code"
                      className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
                    >
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  maxLength={24}
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="Optional server title (e.g. Artemis Alpha)"
                  className="w-full rounded-lg border border-slate-800 bg-[#0d121c] px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-[#080b12] p-3">
                <label htmlFor="join-server-code" className="mb-1 block text-[11px] text-slate-400">
                  Enter teammate&apos;s Server Code
                </label>
                <input
                  id="join-server-code"
                  type="text"
                  maxLength={12}
                  value={joinCode}
                  onChange={(e) => {
                    setJoinCode(e.target.value.toUpperCase());
                    if (error) setError('');
                  }}
                  placeholder="e.g. AST-4829"
                  className="w-full rounded-lg border border-slate-700 bg-[#0d121c] px-3 py-2 font-mono text-sm font-bold uppercase tracking-wider text-sky-300 placeholder-slate-600 focus:border-sky-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-sky-400"
          >
            <span>{authMode === 'signup' ? 'Create Account & Launch' : 'Sign In & Launch'}</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}