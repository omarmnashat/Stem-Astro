import { useId } from 'react';

/**
 * Nova – the game's cartoon AI assistant (an original character):
 * a round little space-robot with big eyes, an antenna and a pink suit.
 * mood: happy | wave | think | wow
 */
export default function NovaAvatar({ size = 64, mood = 'happy', float = false, label = 'Nova, the AI assistant' }) {
  // unique gradient ids, so many Novas can be on screen at once
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const head = `nova-head-${uid}`;
  const suit = `nova-suit-${uid}`;
  const visor = `nova-visor-${uid}`;
  const mouth = mood === 'think' ? 'M43 63 Q50 61 57 64' : 'M41 61 Q50 70 59 61';

  return (
    <svg
      viewBox="0 0 100 110"
      width={size}
      height={size * 1.1}
      className={float ? 'animate-float' : ''}
      role="img"
      aria-label={label}
    >
      <defs>
        <radialGradient id={head} cx="35%" cy="28%" r="80%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.65" stopColor="#e6defc" />
          <stop offset="1" stopColor="#b9a8f0" />
        </radialGradient>
        <linearGradient id={suit} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f9a8d4" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id={visor} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e3a8a" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      {/* antenna */}
      <line x1="50" y1="14" x2="50" y2="24" stroke="#b9a8f0" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="10" r="5" fill="#fde047">
        <animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite" />
      </circle>

      {/* body */}
      <rect x="30" y="76" width="40" height="28" rx="14" fill={`url(#${suit})`} />
      <circle cx="50" cy="90" r="4" fill="#fde047" />

      {/* arms */}
      <rect x="16" y="80" width="16" height="11" rx="5.5" fill={`url(#${suit})`} />
      {mood === 'wave' ? (
        <rect x="68" y="66" width="11" height="18" rx="5.5" fill={`url(#${suit})`}>
          <animateTransform attributeName="transform" type="rotate" values="-12 73 82;14 73 82;-12 73 82" dur="0.9s" repeatCount="indefinite" />
        </rect>
      ) : (
        <rect x="68" y="80" width="16" height="11" rx="5.5" fill={`url(#${suit})`} />
      )}

      {/* feet */}
      <ellipse cx="41" cy="106" rx="8" ry="4" fill="#e6defc" />
      <ellipse cx="59" cy="106" rx="8" ry="4" fill="#e6defc" />

      {/* head + ears */}
      <circle cx="15" cy="50" r="5" fill="#f9a8d4" />
      <circle cx="85" cy="50" r="5" fill="#f9a8d4" />
      <circle cx="50" cy="50" r="34" fill={`url(#${head})`} />
      <circle cx="50" cy="50" r="34" fill="none" stroke="#a78bfa" strokeWidth="2.5" />

      {/* visor */}
      <ellipse cx="50" cy="48" rx="26" ry="20" fill={`url(#${visor})`} />
      <ellipse cx="40" cy="38" rx="8" ry="4" fill="#fff" opacity="0.3" />

      {/* eyes */}
      {mood === 'wow' ? (
        <>
          <circle cx="40" cy="49" r="6" fill="#67e8f9" />
          <circle cx="60" cy="49" r="6" fill="#67e8f9" />
          <circle cx="41" cy="47" r="2" fill="#fff" />
          <circle cx="61" cy="47" r="2" fill="#fff" />
        </>
      ) : (
        <>
          <ellipse cx="40" cy="49" rx="5" ry="6" fill="#67e8f9">
            <animate attributeName="ry" values="6;6;0.6;6;6" keyTimes="0;0.9;0.94;0.98;1" dur="4s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="60" cy="49" rx="5" ry="6" fill="#67e8f9">
            <animate attributeName="ry" values="6;6;0.6;6;6" keyTimes="0;0.9;0.94;0.98;1" dur="4s" repeatCount="indefinite" />
          </ellipse>
          <circle cx="41.5" cy="47" r="1.8" fill="#fff" />
          <circle cx="61.5" cy="47" r="1.8" fill="#fff" />
        </>
      )}

      {/* mouth */}
      {mood === 'wow' ? (
        <ellipse cx="50" cy="63" rx="4" ry="5" fill="#67e8f9" />
      ) : (
        <path d={mouth} stroke="#67e8f9" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      )}

      {/* cheeks */}
      <circle cx="30" cy="60" r="3.5" fill="#f472b6" opacity="0.55" />
      <circle cx="70" cy="60" r="3.5" fill="#f472b6" opacity="0.55" />

      {/* thinking bubbles */}
      {mood === 'think' && (
        <g fill="#fff" opacity="0.9">
          <circle cx="88" cy="22" r="2" />
          <circle cx="93" cy="13" r="3" />
        </g>
      )}
    </svg>
  );
}
