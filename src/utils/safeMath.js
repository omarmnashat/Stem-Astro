/**
 * Safe expression evaluator for the in-game space calculator.
 * No eval(): a small recursive-descent parser that understands + - * / ^ ( ),
 * numbers (incl. 1e3), constants and a few functions.
 */
export const CONSTANTS = {
  pi: Math.PI,
  e: Math.E,
  g_earth: 9.81,
  g_moon: 1.62,
  g_mars: 3.71,
  G: 6.674e-11,
  c: 299792458,
};

const FUNCTIONS = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: (x) => Math.sin(x),
  cos: (x) => Math.cos(x),
  tan: (x) => Math.tan(x),
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  round: Math.round,
};

function tokenize(src) {
  const tokens = [];
  const re = /\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-z_][A-Za-z_0-9]*)|(\*\*|[-+*/^(),%×÷]))/gy;
  let m;
  let last = 0;
  while (last < src.length && (m = re.exec(src)) !== null) {
    last = re.lastIndex;
    if (m[1] !== undefined) tokens.push({ t: 'num', v: parseFloat(m[1]) });
    else if (m[2] !== undefined) tokens.push({ t: 'id', v: m[2] });
    else tokens.push({ t: 'op', v: m[3] === '×' ? '*' : m[3] === '÷' ? '/' : m[3] === '**' ? '^' : m[3] });
    if (/^\s*$/.test(src.slice(last))) break;
  }
  if (!/^\s*$/.test(src.slice(last))) throw new Error('Unexpected character');
  return tokens;
}

export function evaluate(src, extra = {}) {
  const text = String(src || '').trim();
  if (!text) throw new Error('Type a calculation first');
  if (text.length > 120) throw new Error('That is too long');
  const tokens = tokenize(text);
  const vars = { ...CONSTANTS, ...extra };
  let i = 0;
  const peek = () => tokens[i];
  const eat = (v) => {
    if (peek() && peek().t === 'op' && peek().v === v) {
      i += 1;
      return true;
    }
    return false;
  };

  function primary() {
    const tok = peek();
    if (!tok) throw new Error('The calculation ended too early');
    if (tok.t === 'num') {
      i += 1;
      return tok.v;
    }
    if (tok.t === 'id') {
      i += 1;
      if (eat('(')) {
        const fn = FUNCTIONS[tok.v.toLowerCase()];
        if (!fn) throw new Error(`Unknown function “${tok.v}”`);
        const arg = expr();
        if (!eat(')')) throw new Error('Missing )');
        return fn(arg);
      }
      if (!(tok.v in vars)) throw new Error(`Unknown name “${tok.v}”`);
      return vars[tok.v];
    }
    if (eat('(')) {
      const v = expr();
      if (!eat(')')) throw new Error('Missing )');
      return v;
    }
    throw new Error('Unexpected symbol');
  }
  function unary() {
    if (eat('-')) return -unary();
    if (eat('+')) return unary();
    return power();
  }
  function power() {
    const base = primary();
    let v = base;
    if (eat('^')) v = Math.pow(base, unary()); // right-associative
    if (peek() && peek().t === 'op' && peek().v === '%') {
      i += 1;
      v /= 100;
    }
    return v;
  }
  function term() {
    let v = unary();
    for (;;) {
      if (eat('*')) v *= unary();
      else if (eat('/')) v /= unary();
      else return v;
    }
  }
  function expr() {
    let v = term();
    for (;;) {
      if (eat('+')) v += term();
      else if (eat('-')) v -= term();
      else return v;
    }
  }

  const result = expr();
  if (i < tokens.length) throw new Error('Unexpected symbol');
  if (!Number.isFinite(result)) throw new Error('That result is not a real number');
  return result;
}

/** Friendly number formatting (4 significant digits, scientific for very big / small). */
export function fmt(n) {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e7 || abs < 1e-3) {
    const [m, e] = n.toExponential(3).split('e');
    return `${parseFloat(m)} × 10^${parseInt(e, 10)}`;
  }
  if (abs >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  return String(parseFloat(n.toPrecision(4)));
}
