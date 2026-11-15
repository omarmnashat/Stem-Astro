import { useRef, useState } from 'react';
import { Lightbulb, Send } from 'lucide-react';
import { ADVISOR_NAME, QUICK_QUESTIONS, askAdvisor, getHint } from '../services/advisorService.js';
import NovaAvatar from './NovaAvatar.jsx';
import NovaMessage from './NovaMessage.jsx';

/** Nova – the AI assistant. Works offline, answers in simple English. */
export default function AdvisorPanel({ game, compact = false }) {
  const [messages, setMessages] = useState([
    { from: 'ai', text: 'Hi Commander! I’m Nova, your AI assistant! 🚀 Ask me how to do anything in the game, or tap a question below.' },
  ]);
  const [text, setText] = useState('');
  const listRef = useRef(null);

  const push = (question, answer) => {
    setMessages((m) => [...m, { from: 'me', text: question }, { from: 'ai', text: answer }].slice(-24));
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  };

  const ask = (q) => {
    const question = q.trim();
    if (!question) return;
    push(question, askAdvisor(question, game));
    setText('');
  };

  return (
    <section className="panel" aria-labelledby="advisor-title">
      <h2 id="advisor-title" className="panel-title">
        <NovaAvatar size={34} label="Nova" />
        {ADVISOR_NAME}{' '}
        <span className="rounded-full border border-cyan-300/50 bg-cyan-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-200">AI assistant</span>
      </h2>

      <div
        ref={listRef}
        className={`thin-scroll space-y-2 overflow-y-auto rounded-2xl bg-space-900/60 p-3 ${compact ? 'max-h-44' : 'max-h-64'}`}
        role="log"
        aria-live="polite"
        aria-label="Conversation with Nova, the AI assistant"
      >
        {messages.map((m, i) =>
          m.from === 'ai' ? (
            <NovaMessage key={i} size={36} compact mood={i === 0 ? 'wave' : 'happy'}>
              <span className="sr-only">Nova says: </span>
              {m.text}
            </NovaMessage>
          ) : (
            <p key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-violet-500/30 px-3 py-2 text-sm leading-snug text-white">
              <span className="sr-only">You say: </span>
              {m.text}
            </p>
          ),
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {game && (
          <button
            type="button"
            className="chip border-amber-300/50 bg-amber-300/15 text-amber-100 hover:bg-amber-300/25"
            onClick={() => push('Give me a hint', getHint(game))}
          >
            <Lightbulb size={12} aria-hidden="true" /> Give me a hint
          </button>
        )}
        {QUICK_QUESTIONS.map((q) => (
          <button key={q} type="button" className="chip hover:bg-white/20" onClick={() => ask(q)}>
            {q}
          </button>
        ))}
      </div>

      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <label htmlFor="advisor-input" className="sr-only">Ask Nova a question</label>
        <input
          id="advisor-input"
          className="input !py-2"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask about oxygen, power, radiation…"
          maxLength={120}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary !px-4" aria-label="Send question">
          <Send size={18} aria-hidden="true" />
        </button>
      </form>
      <p className="mt-1 text-[11px] text-slate-400">
        Nova runs on your device. Please never type personal information.
      </p>
    </section>
  );
}
