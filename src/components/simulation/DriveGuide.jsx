import { useEffect } from 'react';
import { X } from 'lucide-react';
import NovaMessage from '../NovaMessage.jsx';

const KEYS = [
  { keys: ['W', '↑'], text: 'Drive forward', color: 'text-emerald-300' },
  { keys: ['S', '↓'], text: 'Drive backward', color: 'text-emerald-300' },
  { keys: ['A', '←'], text: 'Turn / strafe left', color: 'text-emerald-300' },
  { keys: ['D', '→'], text: 'Turn / strafe right', color: 'text-emerald-300' },
  { keys: ['Space'], text: 'Jump (Moon only – low gravity!)', color: 'text-sky-300' },
  { keys: ['Mouse drag'], text: 'Rotate the camera around your rover', color: 'text-amber-300' },
  { keys: ['Scroll'], text: 'Zoom the camera in and out', color: 'text-amber-300' },
  { keys: ['F'], text: 'Dig soil in front of you (2 Coins + a mineral sample)', color: 'text-emerald-300' },
  { keys: ['E'], text: 'Interact: scan rocks, use modules, return samples at the Lander', color: 'text-sky-300' },
  { keys: ['I'], text: 'Open / close Inventory', color: 'text-sky-300' },
  { keys: ['Esc'], text: 'Close any open window or leave Build mode', color: 'text-slate-300' },
];

const TIPS = [
  'Movement is relative to the camera: whichever way the camera looks is “forward”.',
  'Each digging spot can be dug up to 6 times. Walk to a fresh patch to find new minerals.',
  'You cannot dig on the Lander or on top of buildings.',
  'Walk close to the Lander and press [E] to send samples to Earth and get paid.',
  'In Build mode the camera looks from above: drag to pan, scroll to zoom, click to place.',
];

/** “How to drive your rover” help window. */
export default function DriveGuide({ isMars, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/65 p-3"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="How to drive"
    >
      <div className="max-h-[92%] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-[#0c111d]/97 p-4 shadow-2xl">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-sky-400">
              {isMars ? 'Mars rover' : 'Lunar rover'} · Driving guide
            </div>
            <h3 className="font-display text-lg font-bold text-white">How to drive</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close driving guide"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X size={17} />
          </button>
        </div>

        <NovaMessage className="mb-2" size={44} compact mood="wave">
          Hi Commander! I’m Nova. Here is how to drive your rover. Try the keys below!
        </NovaMessage>

        <ul className="space-y-1.5">
          {KEYS.map((k) => (
            <li key={k.text} className="flex items-center gap-2 text-xs text-slate-200">
              <span className="flex min-w-[84px] shrink-0 flex-wrap gap-1">
                {k.keys.map((key) => (
                  <kbd
                    key={key}
                    className={`rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-bold ${k.color}`}
                  >
                    {key}
                  </kbd>
                ))}
              </span>
              <span>{k.text}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-sky-400"
        >
          Got it – let’s explore!
        </button>

        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300">Nova’s pro tips</div>
          <ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-300">
            {TIPS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}
