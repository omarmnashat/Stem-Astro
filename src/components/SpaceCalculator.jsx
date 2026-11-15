import { useEffect, useMemo, useState } from 'react';
import { Calculator, MessageCircle, X, Delete } from 'lucide-react';
import AdvisorPanel from './AdvisorPanel.jsx';
import { BODIES, FORMULAS } from '../data/spaceFormulas.js';
import { CONSTANTS, evaluate, fmt } from '../utils/safeMath.js';
import { emitMissionEvent } from '../utils/missionEvents.js';

const KEYPAD = [
  ['7', '8', '9', '÷', 'C'],
  ['4', '5', '6', '×', '⌫'],
  ['1', '2', '3', '-', '('],
  ['0', '.', '^', '+', ')'],
];

const CONST_CHIPS = [
  ['g_moon', 'Moon gravity'],
  ['g_mars', 'Mars gravity'],
  ['g_earth', 'Earth gravity'],
  ['G', 'Gravity constant G'],
  ['c', 'Speed of light'],
  ['pi', 'π'],
];

/** Free calculator: type any maths, use space constants. */
function FreeCalculator() {
  const [expr, setExpr] = useState('70 * g_moon');
  const [out, setOut] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  const run = () => {
    try {
      const value = evaluate(expr, out ? { ans: out.value } : {});
      setOut({ value });
      setError('');
      setHistory((h) => [{ q: expr, a: fmt(value) }, ...h].slice(0, 5));
      emitMissionEvent('calc');
    } catch (e) {
      setError(e.message || 'I could not calculate that');
      setOut(null);
    }
  };

  const press = (k) => {
    if (k === 'C') {
      setExpr('');
      setOut(null);
      setError('');
    } else if (k === '⌫') setExpr((x) => x.slice(0, -1));
    else setExpr((x) => x + k);
  };

  return (
    <div>
      <p className="text-xs text-slate-300">
        Type any calculation. You can use + − × ÷ ^ ( ), functions like sqrt(), and space constants.
      </p>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <label htmlFor="calc-expr" className="sr-only">Calculation</label>
        <input
          id="calc-expr"
          className="input !py-2 font-mono"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          placeholder="e.g. 70 * g_moon"
          maxLength={120}
          autoComplete="off"
          inputMode="text"
        />
        <button type="submit" className="btn btn-primary !px-4">=</button>
      </form>

      <div
        className="mt-2 min-h-[3.25rem] rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-right font-mono"
        role="status"
        aria-live="polite"
      >
        {error ? (
          <span className="text-sm text-rose-300">{error}</span>
        ) : out ? (
          <span className="text-2xl font-bold text-emerald-300">{fmt(out.value)}</span>
        ) : (
          <span className="text-sm text-slate-500">Result appears here</span>
        )}
      </div>

      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {KEYPAD.flat().map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            aria-label={k === '⌫' ? 'Backspace' : k === 'C' ? 'Clear' : k}
            className={`rounded-lg border py-2 font-mono text-sm font-bold transition ${
              /[÷×\-+^]/.test(k)
                ? 'border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20'
                : k === 'C'
                  ? 'border-rose-400/40 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20'
                  : 'border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800'
            }`}
          >
            {k === '⌫' ? <Delete size={15} className="mx-auto" /> : k}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {CONST_CHIPS.map(([name, label]) => (
          <button
            key={name}
            type="button"
            className="chip hover:bg-white/20"
            title={`${label} = ${fmt(CONSTANTS[name])}`}
            onClick={() => setExpr((x) => x + name)}
          >
            {name} <span className="text-slate-400">({fmt(CONSTANTS[name])})</span>
          </button>
        ))}
        {['sqrt(', 'ln(', 'sin(', 'cos('].map((fn) => (
          <button key={fn} type="button" className="chip hover:bg-white/20" onClick={() => setExpr((x) => x + fn)}>
            {fn}
          </button>
        ))}
      </div>

      {history.length > 0 && (
        <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-slate-400">
          {history.map((h, i) => (
            <li key={`${h.q}-${i}`}>
              {h.q} = <span className="text-slate-200">{h.a}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One law / formula card with its own inputs. */
function FormulaCalculator({ defaultBody }) {
  const [id, setId] = useState(FORMULAS[0].id);
  const formula = FORMULAS.find((f) => f.id === id) || FORMULAS[0];
  const [values, setValues] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Reset inputs whenever another formula is chosen.
  useEffect(() => {
    const init = {};
    for (const f of formula.fields) init[f.key] = f.type === 'body' ? defaultBody : String(f.def);
    setValues(init);
    setResult(null);
    setError('');
  }, [formula, defaultBody]);

  const calculate = () => {
    const parsed = {};
    for (const f of formula.fields) {
      if (f.type === 'body') {
        parsed[f.key] = values[f.key] || defaultBody;
      } else {
        let n;
        try {
          n = evaluate(String(values[f.key] ?? '')); // allows 1e3, 2*5, g_moon …
        } catch {
          setError(`Please enter a number for “${f.label}”.`);
          setResult(null);
          return;
        }
        if (n < 0 || (n === 0 && f.key !== 'alt')) {
          setError(`“${f.label}” must be bigger than zero.`);
          setResult(null);
          return;
        }
        parsed[f.key] = n;
      }
    }
    const problem = formula.validate?.(parsed);
    if (problem) {
      setError(problem);
      setResult(null);
      return;
    }
    setError('');
    setResult(formula.compute(parsed));
    emitMissionEvent('calc');
  };

  return (
    <div>
      <label htmlFor="formula-pick" className="text-xs font-semibold text-slate-300">Choose a law or formula</label>
      <select
        id="formula-pick"
        className="input mt-1 !py-2"
        value={id}
        onChange={(e) => setId(e.target.value)}
      >
        {FORMULAS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.icon} {f.title}
          </option>
        ))}
      </select>

      <div className="mt-2 rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-2.5">
        <div className="font-mono text-sm font-bold text-cyan-200">{formula.formula}</div>
        <p className="mt-0.5 text-xs text-slate-300">{formula.explain}</p>
      </div>

      <form
        className="mt-2 grid gap-2 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          calculate();
        }}
      >
        {formula.fields.map((f) => (
          <div key={f.key}>
            <label htmlFor={`f-${f.key}`} className="text-[11px] font-semibold text-slate-300">
              {f.label} {f.unit && <span className="text-slate-500">({f.unit})</span>}
            </label>
            {f.type === 'body' ? (
              <select
                id={`f-${f.key}`}
                className="input mt-0.5 !py-1.5"
                value={values[f.key] || defaultBody}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              >
                {Object.entries(BODIES).map(([k, b]) => (
                  <option key={k} value={k}>{b.name}</option>
                ))}
              </select>
            ) : (
              <input
                id={`f-${f.key}`}
                className="input mt-0.5 !py-1.5 font-mono"
                value={values[f.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                inputMode="decimal"
                maxLength={24}
                autoComplete="off"
              />
            )}
          </div>
        ))}
        <div className="sm:col-span-2">
          <button type="submit" className="btn btn-primary w-full !py-2">Calculate</button>
        </div>
      </form>

      <div className="mt-2" role="status" aria-live="polite">
        {error && <p className="text-sm text-rose-300">{error}</p>}
        {result && (
          <ul className="space-y-1 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-2.5">
            {result.map((r) => (
              <li key={r.label} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-slate-200">{r.label}</span>
                <span className="font-mono font-bold text-emerald-300">
                  {fmt(r.value)} <span className="text-xs font-normal text-slate-400">{r.unit}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Nova (AI assistant) button window: space calculator + the question helper. */
export default function SpaceCalculator({ game, onClose }) {
  const [tab, setTab] = useState('laws');
  const defaultBody = useMemo(() => (game?.planet === 'mars' ? 'mars' : 'moon'), [game?.planet]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tabs = [
    ['laws', 'Space Laws', Calculator],
    ['calc', 'Calculator', Calculator],
    ['ask', 'Ask Nova', MessageCircle],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Nova, the AI assistant"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0c111d] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-400">Nova · AI assistant</div>
            <h2 className="font-display text-base font-bold text-white">Space Calculator & Helper</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Nova"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-800 px-3 pt-2" role="tablist">
          {tabs.map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold transition ${
                tab === key
                  ? 'border-cyan-400 bg-cyan-400/10 text-cyan-200'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={13} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        <div className="thin-scroll overflow-y-auto p-4">
          {tab === 'laws' && <FormulaCalculator defaultBody={defaultBody} />}
          {tab === 'calc' && <FreeCalculator />}
          {tab === 'ask' && <AdvisorPanel game={game} />}
        </div>
      </div>
    </div>
  );
}
