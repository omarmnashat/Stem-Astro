import NovaAvatar from './NovaAvatar.jsx';

/** A chat-style message from Nova, the AI assistant. Use it for every tip, hint and how-to. */
export default function NovaMessage({
  children,
  mood = 'happy',
  size = 56,
  compact = false,
  title,
  className = '',
}) {
  return (
    <div className={`flex items-end gap-2 ${className}`}>
      <div className="shrink-0">
        <NovaAvatar size={size} mood={mood} float={!compact} />
      </div>
      <div className="relative min-w-0 flex-1 rounded-2xl rounded-bl-sm border border-fuchsia-300/30 bg-indigo-950/85 px-3 py-2 text-left shadow-lg">
        <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
          <span className="font-display text-sm font-bold text-pink-300">Nova</span>
          <span className="rounded-full border border-cyan-300/50 bg-cyan-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-200">
            AI assistant
          </span>
        </div>
        {title && <p className="font-display text-base font-bold leading-tight text-white">{title}</p>}
        <div className="text-sm leading-snug text-slate-100">{children}</div>
      </div>
    </div>
  );
}
