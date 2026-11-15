import { useRef } from 'react';

/** Metal panel with a stencil-style title, like the labels on the real flight deck. */
export function Plate({ title, children, className = '' }) {
  return (
    <section className={`cp-plate ${className}`} aria-label={title}>
      <h3 className="cp-plate-title">{title}</h3>
      {children}
    </section>
  );
}

export function ToggleSwitch({ label, sub, on, onChange, hl, ledColor = '#4ade80' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`cp-switch ${hl ? 'cp-hl' : ''}`}
    >
      <span className="cp-led" style={{ background: on ? ledColor : '#1f2937', boxShadow: on ? `0 0 10px ${ledColor}` : 'none' }} />
      <span className="cp-slot">
        <span className="cp-lever" style={{ transform: `translateY(${on ? -13 : 13}px)` }} />
      </span>
      <span className="cp-label">{label}</span>
      {sub && <span className="cp-sub">{sub}</span>}
    </button>
  );
}

/** Rotary DESTINATION selector: OFF / MOON / MARS */
export function DestinationKnob({ dest, onChange, hl }) {
  const angle = dest === 'moon' ? -55 : dest === 'mars' ? 55 : 0;
  const next = dest === null ? 'moon' : dest === 'moon' ? 'mars' : null;
  return (
    <div className={`cp-knob-wrap ${hl ? 'cp-hl' : ''}`}>
      <div className="cp-knob-row">
        <button type="button" className={`cp-chip ${dest === 'moon' ? 'on' : ''}`} onClick={() => onChange('moon')}>
          MOON
        </button>
        <button type="button" className={`cp-chip ${dest === 'mars' ? 'on' : ''}`} onClick={() => onChange('mars')}>
          MARS
        </button>
      </div>
      <button
        type="button"
        className="cp-knob"
        aria-label={`Destination knob: ${dest ? dest.toUpperCase() : 'OFF'}. Click to change.`}
        onClick={() => onChange(next)}
      >
        <span className="cp-knob-cap" style={{ transform: `rotate(${angle}deg)` }}>
          <span className="cp-knob-mark" />
        </span>
      </button>
      <span className="cp-label">DESTINATION</span>
      <span className="cp-sub">{dest ? dest.toUpperCase() : 'OFF'}</span>
    </div>
  );
}

/** Hand controller (joystick). Drag it; it springs back to the centre when released. */
export function HandController({ value, onChange, hl }) {
  const pad = useRef(null);
  const dragging = useRef(false);

  const update = (e) => {
    const el = pad.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const max = r.width / 2 - 26;
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const m = Math.hypot(dx, dy);
    if (m > max) {
      dx *= max / m;
      dy *= max / m;
    }
    onChange({ x: dx / max, y: -dy / max });
  };

  return (
    <div className={`cp-stick-wrap ${hl ? 'cp-hl' : ''}`}>
      <div
        ref={pad}
        className="cp-stick-pad"
        role="application"
        aria-label="Hand controller. Drag to steer, or use the arrow keys."
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          update(e);
        }}
        onPointerMove={(e) => dragging.current && update(e)}
        onPointerUp={() => {
          dragging.current = false;
          onChange({ x: 0, y: 0 });
        }}
        onPointerCancel={() => {
          dragging.current = false;
          onChange({ x: 0, y: 0 });
        }}
      >
        <span className="cp-stick-cross h" />
        <span className="cp-stick-cross v" />
        <span
          className="cp-stick-knob"
          style={{
            transform: `translate(${value.x * 46}px, ${-value.y * 46}px)`,
            transition: value.x === 0 && value.y === 0 ? 'transform .22s ease-out' : 'none',
          }}
        />
      </div>
      <span className="cp-label">HAND CONTROLLER</span>
      <span className="cp-sub">drag · or arrow keys</span>
    </div>
  );
}

/** Vertical throttle lever 0–100 %. */
export function ThrottleLever({ value, onChange, hl }) {
  const track = useRef(null);
  const dragging = useRef(false);
  const update = (e) => {
    const r = track.current.getBoundingClientRect();
    onChange(Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)));
  };
  return (
    <div className={`cp-throttle-wrap ${hl ? 'cp-hl' : ''}`}>
      <div
        ref={track}
        className="cp-throttle-track"
        role="slider"
        aria-label="Main engine throttle"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        tabIndex={0}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          update(e);
        }}
        onPointerMove={(e) => dragging.current && update(e)}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') onChange(Math.min(1, value + 0.05));
          if (e.key === 'ArrowDown') onChange(Math.max(0, value - 0.05));
        }}
      >
        <span className="cp-throttle-fill" style={{ height: `${value * 100}%` }} />
        <span className="cp-throttle-handle" style={{ bottom: `calc(${value * 100}% - 14px)` }} />
        <span className="cp-throttle-mark" style={{ bottom: '70%' }} />
      </div>
      <span className="cp-label">THROTTLE</span>
      <span className="cp-sub">{Math.round(value * 100)}% · keys W / S</span>
    </div>
  );
}

/** Red IGNITION button hidden under a flip-up safety cover. */
export function IgnitionButton({ armed, onArm, onPress, hlArm, hlPress }) {
  return (
    <div className="cp-ign-wrap">
      <div className={`cp-ign ${hlPress ? 'cp-hl' : ''} ${hlArm ? 'cp-hl' : ''}`}>
        <button type="button" className="cp-ign-btn" onClick={onPress} aria-label="Ignition">
          IGNITION
        </button>
        <button
          type="button"
          className={`cp-ign-cover ${armed ? 'open' : ''}`}
          onClick={onArm}
          aria-pressed={armed}
          aria-label={armed ? 'Close safety cover' : 'Lift safety cover'}
        >
          {armed ? '' : 'LIFT'}
        </button>
      </div>
      <span className="cp-label">ENGINE START</span>
      <span className="cp-sub">{armed ? 'ARMED' : 'SAFE'}</span>
    </div>
  );
}

export function ShuttleIcon({ size = 24, className = '' }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true" fill="currentColor">
      {/* fuselage + nose */}
      <path d="M6 33c0-3 6-5 20-5h18c9 0 14 2 14 5s-5 5-14 5H26C12 38 6 36 6 33z" />
      {/* delta wing */}
      <path d="M26 36l22 0 6 19H40z" opacity="0.85" />
      <path d="M26 30l22 0 6-19H40z" opacity="0.85" />
      {/* tail fin */}
      <path d="M46 29l8-14h-6l-8 14z" />
      {/* cockpit window */}
      <path d="M12 31c2-1.2 5-1.8 8-1.8l-1 2.4c-2.6 0-5 .5-7 1.3z" fill="#0a1030" />
    </svg>
  );
}
