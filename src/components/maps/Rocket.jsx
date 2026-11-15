import { forwardRef } from 'react';

/**
 * A NASA-style heavy-lift rocket (inspired by the Space Launch System that flies the
 * Artemis missions): orange core stage, two white side boosters with dark nose cones,
 * the Orion capsule on top with its slim launch-abort tower, and a glowing exhaust plume.
 * Original vector drawing, no logos. It points UP; the map rotates it toward its target.
 */
const Rocket = forwardRef(function Rocket({ flying = false, className = '' }, ref) {
  return (
    <svg
      ref={ref}
      className={`sm-rocket-svg ${flying ? 'is-flying' : ''} ${className}`}
      viewBox="0 0 60 200"
      role="img"
      aria-label="A NASA-style rocket"
    >
      <defs>
        <linearGradient id="smrk-white" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#8d96a6" />
          <stop offset="0.3" stopColor="#f3f5f8" />
          <stop offset="0.55" stopColor="#ffffff" />
          <stop offset="0.82" stopColor="#c3cad6" />
          <stop offset="1" stopColor="#7e8797" />
        </linearGradient>
        <linearGradient id="smrk-orange" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#7d3209" />
          <stop offset="0.28" stopColor="#d4611a" />
          <stop offset="0.5" stopColor="#f28d3d" />
          <stop offset="0.8" stopColor="#c0500f" />
          <stop offset="1" stopColor="#6e2a07" />
        </linearGradient>
        <linearGradient id="smrk-dark" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#101319" />
          <stop offset="0.45" stopColor="#555c69" />
          <stop offset="1" stopColor="#14171d" />
        </linearGradient>
        <linearGradient id="smrk-gold" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#6d5a22" />
          <stop offset="0.4" stopColor="#e8c964" />
          <stop offset="1" stopColor="#5e4c1b" />
        </linearGradient>
        <linearGradient id="smrk-flame" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.12" stopColor="#fff6c2" />
          <stop offset="0.38" stopColor="#ffb347" />
          <stop offset="0.72" stopColor="#ff5a1f" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ff3d00" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="smrk-glass" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#bfe6ff" />
          <stop offset="1" stopColor="#1b4f7a" />
        </radialGradient>
      </defs>

      {/* ---------- exhaust ---------- */}
      <g className="sm-flame">
        <path d="M23 150 Q30 205 37 150 Z" fill="url(#smrk-flame)" />
        <path d="M11 154 Q16 196 21 154 Z" fill="url(#smrk-flame)" opacity="0.9" />
        <path d="M39 154 Q44 196 49 154 Z" fill="url(#smrk-flame)" opacity="0.9" />
        <path d="M27 150 Q30 180 33 150 Z" fill="#ffffff" opacity="0.85" />
      </g>

      {/* ---------- side boosters ---------- */}
      {[16, 44].map((cx) => (
        <g key={cx}>
          {/* nose cone */}
          <path d={`M${cx - 5} 58 C${cx - 5} 48 ${cx - 2.2} 43 ${cx} 43 C${cx + 2.2} 43 ${cx + 5} 48 ${cx + 5} 58 Z`} fill="url(#smrk-dark)" />
          {/* body */}
          <rect x={cx - 5} y="58" width="10" height="82" fill="url(#smrk-white)" />
          {[70, 84, 98, 112, 126].map((y) => (
            <line key={y} x1={cx - 5} x2={cx + 5} y1={y} y2={y} stroke="#6f7888" strokeWidth="0.5" opacity="0.7" />
          ))}
          <rect x={cx - 5} y="58" width="10" height="2.4" fill="#2b303a" opacity="0.85" />
          {/* skirt + nozzle */}
          <path d={`M${cx - 5} 134 L${cx - 6.5} 142 H${cx + 6.5} L${cx + 5} 134 Z`} fill="url(#smrk-dark)" />
          <path d={`M${cx - 3.5} 142 L${cx - 5} 152 H${cx + 5} L${cx + 3.5} 142 Z`} fill="#2a2f39" />
        </g>
      ))}

      {/* ---------- orange core stage ---------- */}
      <rect x="23" y="52" width="14" height="98" rx="1.5" fill="url(#smrk-orange)" />
      <rect x="23" y="52" width="14" height="2.2" fill="#3b1a06" opacity="0.7" />
      <rect x="23" y="104" width="14" height="1.2" fill="#3b1a06" opacity="0.5" />
      {/* core engines */}
      {[25.5, 28.5, 31.5, 34.5].map((x) => (
        <path key={x} d={`M${x - 1.1} 150 L${x - 1.8} 157 H${x + 1.8} L${x + 1.1} 150 Z`} fill="#2a2f39" />
      ))}

      {/* ---------- upper stage + Orion ---------- */}
      <rect x="25" y="44" width="10" height="9" fill="url(#smrk-white)" />
      <rect x="25.6" y="36" width="8.8" height="8.5" fill="url(#smrk-gold)" />
      <path d="M26 36 L28 22 H32 L34 36 Z" fill="url(#smrk-white)" />
      <ellipse cx="30" cy="29.5" rx="1.6" ry="2" fill="url(#smrk-glass)" />
      {/* launch abort tower */}
      <path d="M28 22 L29.4 8 H30.6 L32 22 Z" fill="#dde2ea" />
      <rect x="29.5" y="8" width="1" height="12" fill="#9aa3b2" />
      <path d="M29.3 8 L30 1.5 L30.7 8 Z" fill="#e8ebf0" />
    </svg>
  );
});

export default Rocket;
