// A small, safe evaluator for the Excel formulas used in AQM 1000.
// No eval(): a recursive-descent parser over a fixed function table.
import { normCdf, normDist, normInv, normInvGeneral, normPdf, tCdf, tPdf, tInv, mean, stdevS, chisqCdf, chisqPdf, chisqInv } from "./stats.ts";

// A range (D5:D12) evaluates to a Grid: every cell in it (numbers, text, logicals, blanks) with its shape.
// Number functions (AVERAGE, STDEV.S…) read only its numeric cells, as Excel does; COUNTIF, VLOOKUP and
// friends see the text too.
type Scalar = number | boolean | string;
type Grid = { grid: true; cells: (number | string | boolean | null)[]; rows: number; cols: number };
type Val = Scalar | Grid;
type Fn = (args: Val[]) => Val;

/** Lets formulas read other cells: returns a cell's computed value, or null when it is empty. */
export type CellContext = { get: (addr: string) => number | string | null };

const isGrid = (v: Val | undefined): v is Grid => typeof v === "object" && v !== null && (v as Grid).grid === true;
const num = (v: Val | undefined, name: string): number => {
  if (typeof v === "boolean") return v ? 1 : 0;
  if (isGrid(v)) {
    if (v.cells.length === 1) return num(v.cells[0] ?? 0, name);
    throw new Error(`#VALUE! a range can't be used in ${name === "result" ? "a single cell" : name}: wrap it in AVERAGE(), SUM()…`);
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (t !== "" && Number.isFinite(Number(t))) return Number(t);
    throw new Error(`#VALUE! "${v}" is text, not a number`);
  }
  if (v === undefined || Number.isNaN(v)) throw new Error(`${name}: missing argument`);
  return v;
};
const str = (v: Val | undefined): string => (isGrid(v) ? str(v.cells[0] ?? "") : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : v === undefined || v === null ? "" : typeof v === "number" ? String(Number(v.toPrecision(15))) : v);
const flag = (v: Val | undefined) => (v === undefined ? true : typeof v === "boolean" ? v : isGrid(v) ? v.cells.length > 0 : typeof v === "string" ? v.toUpperCase() === "TRUE" : v !== 0);
/** Numbers in the arguments: a range's numeric cells (text and blanks skipped), plus any scalar numbers. */
const nums = (args: Val[]) => args.flatMap((a) => (isGrid(a) ? (a.cells.filter((c) => typeof c === "number") as number[]) : [num(a, "list")]));
const cellsOf = (v: Val): (number | string | boolean | null)[] => (isGrid(v) ? v.cells : [v]);
const need = (args: Val[], n: number, name: string) => {
  if (args.length < n) throw new Error(`${name} needs ${n} arguments`);
};
const sorted = (x: number[]) => [...x].sort((a, b) => a - b);
/** Excel's .INC rule: rank p·(n − 1), interpolated. */
function percentileInc(x: number[], p: number, name: string): number {
  if (!x.length) throw new Error(`#NUM! ${name} of no numbers`);
  if (p < 0 || p > 1) throw new Error(`#NUM! ${name} needs k between 0 and 1`);
  const s = sorted(x), h = p * (s.length - 1), lo = Math.floor(h);
  return lo + 1 >= s.length ? s[lo] : s[lo] + (h - lo) * (s[lo + 1] - s[lo]);
}
/** Excel's .EXC rule: rank p·(n + 1), interpolated; #NUM! outside 1/(n+1) … n/(n+1). */
function percentileExc(x: number[], p: number, name: string): number {
  const s = sorted(x), n = s.length, h = p * (n + 1);
  if (!n || h < 1 || h > n) throw new Error(`#NUM! ${name}: k is outside what .EXC allows for ${n} numbers`);
  const lo = Math.floor(h);
  return lo >= n ? s[n - 1] : s[lo - 1] + (h - lo) * (s[lo] - s[lo - 1]);
}
function median(x: number[]): number {
  if (!x.length) throw new Error("#NUM! MEDIAN of no numbers");
  return percentileInc(x, 0.5, "MEDIAN");
}
function pairs(a: Val, b: Val, name: string): [number[], number[]] {
  const A = cellsOf(a), B = cellsOf(b);
  if (A.length !== B.length) throw new Error(`#N/A ${name}: the two ranges must be the same size`);
  const xs: number[] = [], ys: number[] = [];
  A.forEach((v, i) => { const w = B[i]; if (typeof v === "number" && typeof w === "number") { xs.push(v); ys.push(w); } });
  if (xs.length < 2) throw new Error(`#DIV/0! ${name} needs at least two pairs of numbers`);
  return [xs, ys];
}
function regress(yv: Val, xv: Val, name: string) {
  const [ys, xs] = pairs(yv, xv, name);
  const mx = mean(xs), my = mean(ys);
  let sxx = 0, sxy = 0, syy = 0;
  xs.forEach((x, i) => { sxx += (x - mx) ** 2; sxy += (x - mx) * (ys[i] - my); syy += (ys[i] - my) ** 2; });
  if (sxx === 0) throw new Error(`#DIV/0! ${name}: the x values are all the same`);
  const slope = sxy / sxx;
  return { n: xs.length, slope, intercept: my - slope * mx, sxx, sxy, syy, r: syy === 0 ? NaN : sxy / Math.sqrt(sxx * syy) };
}

/** Excel's criteria for COUNTIF/SUMIF/AVERAGEIF(S): 5, ">5", "<>x", "=x", "x", wildcards * and ?. */
function matcher(crit: Val): (c: number | string | boolean | null) => boolean {
  if (typeof crit === "number") return (c) => typeof c === "number" && Math.abs(c - crit) < 1e-12;
  if (typeof crit === "boolean") return (c) => c === crit;
  const s = str(crit);
  const m = /^(<=|>=|<>|<|>|=)?(.*)$/s.exec(s)!;
  const op = m[1] ?? "", rhs = m[2];
  const n = rhs.trim() !== "" && Number.isFinite(Number(rhs)) ? Number(rhs) : null;
  const wild = (t: string) => new RegExp("^" + t.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/~\*/g, "\u0001").replace(/~\?/g, "\u0002").replace(/\*/g, ".*").replace(/\?/g, ".").replace(/\u0001/g, "\\*").replace(/\u0002/g, "\\?") + "$", "is");
  const eqText = (c: number | string | boolean | null) => typeof c === "string" ? wild(rhs).test(c) : c === null ? rhs === "" : false;
  const eq = (c: number | string | boolean | null) => (n !== null ? typeof c === "number" && Math.abs(c - n) < 1e-12 || (typeof c === "string" && c.trim() !== "" && Number(c) === n) : eqText(c));
  switch (op) {
    case "": case "=": return eq;
    case "<>": return (c) => !eq(c);
    default: {
      if (n !== null) return (c) => typeof c === "number" && (op === "<" ? c < n : op === ">" ? c > n : op === "<=" ? c <= n : c >= n);
      const cmp = (c: number | string | boolean | null) => typeof c === "string" ? c.toLowerCase().localeCompare(rhs.toLowerCase()) : null;
      return (c) => { const k = cmp(c); return k !== null && (op === "<" ? k < 0 : op === ">" ? k > 0 : op === "<=" ? k <= 0 : k >= 0); };
    }
  }
}
/** Rows of the criteria ranges where every criterion holds. */
function ifsMask(args: Val[], from: number, name: string): boolean[] {
  if ((args.length - from) % 2 !== 0 || args.length - from < 2) throw new Error(`${name} needs range, criteria pairs`);
  let mask: boolean[] | null = null;
  for (let k = from; k < args.length; k += 2) {
    const cells = cellsOf(args[k]), test = matcher(args[k + 1]);
    if (mask && mask.length !== cells.length) throw new Error(`#VALUE! ${name}: every range must be the same size`);
    const m = cells.map((c) => test(c));
    mask = mask ? mask.map((x, i) => x && m[i]) : m;
  }
  return mask!;
}
const pick = (v: Val, mask: boolean[], name: string) => {
  const cells = cellsOf(v);
  if (cells.length !== mask.length) throw new Error(`#VALUE! ${name}: the ranges must be the same size`);
  return cells.filter((c, i) => mask[i] && typeof c === "number") as number[];
};
function mode(x: number[]): number {
  const seen = new Map<number, number>();
  let bestN = 1;
  for (const v of x) { const k = (seen.get(v) ?? 0) + 1; seen.set(v, k); if (k > bestN) bestN = k; }
  // Ties: Excel returns the value that appears first in the data among those with the top count.
  if (bestN > 1) for (const v of x) if (seen.get(v) === bestN) return v;
  throw new Error("#N/A MODE: no value repeats");
}
const sameText = (a: number | string | boolean | null, b: Scalar) => typeof b === "string" ? typeof a === "string" && a.toLowerCase() === b.toLowerCase() : typeof b === "number" ? typeof a === "number" && Math.abs(a - b) < 1e-12 : a === b;

const FUNCS: Record<string, Fn> = {
  "NORM.DIST": (a) => { need(a, 4, "NORM.DIST"); const [x, m, s] = [num(a[0], "x"), num(a[1], "mean"), num(a[2], "sd")]; if (s <= 0) throw new Error("#NUM! sd must be > 0"); return flag(a[3]) ? normDist(x, m, s) : normPdf(x, m, s); },
  "NORM.S.DIST": (a) => { need(a, 2, "NORM.S.DIST"); const z = num(a[0], "z"); return flag(a[1]) ? normCdf(z) : normPdf(z); },
  "NORM.INV": (a) => { need(a, 3, "NORM.INV"); const p = num(a[0], "p"); if (p <= 0 || p >= 1) throw new Error("#NUM! probability must be between 0 and 1"); return normInvGeneral(p, num(a[1], "mean"), num(a[2], "sd")); },
  "NORM.S.INV": (a) => { need(a, 1, "NORM.S.INV"); const p = num(a[0], "p"); if (p <= 0 || p >= 1) throw new Error("#NUM! probability must be between 0 and 1"); return normInv(p); },
  STANDARDIZE: (a) => { need(a, 3, "STANDARDIZE"); const s = num(a[2], "sd"); if (s <= 0) throw new Error("#NUM! sd must be > 0"); return (num(a[0], "x") - num(a[1], "mean")) / s; },
  "T.DIST": (a) => { need(a, 3, "T.DIST"); const df = num(a[1], "df"); if (df < 1) throw new Error("#NUM! df must be >= 1"); return flag(a[2]) ? tCdf(num(a[0], "t"), df) : tPdf(num(a[0], "t"), df); },
  "T.DIST.RT": (a) => { need(a, 2, "T.DIST.RT"); return 1 - tCdf(num(a[0], "t"), num(a[1], "df")); },
  "T.DIST.2T": (a) => { need(a, 2, "T.DIST.2T"); const t = num(a[0], "t"); if (t < 0) throw new Error("#NUM! T.DIST.2T needs a non-negative t: use ABS()"); return 2 * (1 - tCdf(t, num(a[1], "df"))); },
  "T.INV": (a) => { need(a, 2, "T.INV"); const p = num(a[0], "p"); if (p <= 0 || p >= 1) throw new Error("#NUM! probability must be between 0 and 1"); return tInv(p, num(a[1], "df")); },
  "T.INV.2T": (a) => { need(a, 2, "T.INV.2T"); const p = num(a[0], "p"); if (p <= 0 || p > 1) throw new Error("#NUM! probability must be between 0 and 1"); return tInv(1 - p / 2, num(a[1], "df")); },
  "CHISQ.DIST": (a) => { need(a, 3, "CHISQ.DIST"); const x = num(a[0], "x"), df = num(a[1], "df"); if (x < 0) throw new Error("#NUM! x must be >= 0"); if (df < 1) throw new Error("#NUM! df must be >= 1"); return flag(a[2]) ? chisqCdf(x, df) : chisqPdf(x, df); },
  "CHISQ.DIST.RT": (a) => { need(a, 2, "CHISQ.DIST.RT"); const x = num(a[0], "x"); if (x < 0) throw new Error("#NUM! x must be >= 0"); return 1 - chisqCdf(x, num(a[1], "df")); },
  "CHISQ.INV": (a) => { need(a, 2, "CHISQ.INV"); const p = num(a[0], "p"); if (p < 0 || p >= 1) throw new Error("#NUM! probability must be between 0 and 1"); return chisqInv(p, num(a[1], "df")); },
  "CHISQ.INV.RT": (a) => { need(a, 2, "CHISQ.INV.RT"); const p = num(a[0], "p"); if (p <= 0 || p > 1) throw new Error("#NUM! probability must be between 0 and 1"); return chisqInv(1 - p, num(a[1], "df")); },
  SQRT: (a) => { const x = num(a[0], "SQRT"); if (x < 0) throw new Error("#NUM! SQRT of a negative"); return Math.sqrt(x); },
  ABS: (a) => Math.abs(num(a[0], "ABS")),
  EXP: (a) => Math.exp(num(a[0], "EXP")),
  LN: (a) => { const x = num(a[0], "LN"); if (x <= 0) throw new Error("#NUM! LN needs a positive number"); return Math.log(x); },
  POWER: (a) => Math.pow(num(a[0], "base"), num(a[1], "power")),
  ROUND: (a) => { const d = num(a[1] ?? 0, "digits"); const f = 10 ** d; const x = num(a[0], "ROUND"); return Math.sign(x) * Math.round(Math.abs(x) * f + 1e-9) / f; },
  ROUNDUP: (a) => { const d = num(a[1] ?? 0, "digits"); const f = 10 ** d; const x = num(a[0], "ROUNDUP"); return Math.sign(x) * Math.ceil(Math.abs(x) * f - 1e-9) / f; },
  ROUNDDOWN: (a) => { const d = num(a[1] ?? 0, "digits"); const f = 10 ** d; const x = num(a[0], "ROUNDDOWN"); return Math.sign(x) * Math.floor(Math.abs(x) * f + 1e-9) / f; },
  INT: (a) => Math.floor(num(a[0], "INT")),
  MOD: (a) => { const n = num(a[0], "number"), d = num(a[1], "divisor"); if (d === 0) throw new Error("#DIV/0!"); return n - d * Math.floor(n / d); },
  AVERAGE: (a) => { const x = nums(a); if (!x.length) throw new Error("#DIV/0! AVERAGE of no numbers"); return mean(x); },
  MEDIAN: (a) => median(nums(a)),
  "MODE.SNGL": (a) => mode(nums(a)),
  "STDEV.S": (a) => { const x = nums(a); if (x.length < 2) throw new Error("#DIV/0! STDEV.S needs at least two numbers"); return stdevS(x); },
  "STDEV.P": (a) => { const x = nums(a); const m = mean(x); return Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / x.length); },
  "VAR.S": (a) => { const x = nums(a); if (x.length < 2) throw new Error("#DIV/0! VAR.S needs at least two numbers"); return stdevS(x) ** 2; },
  "VAR.P": (a) => { const x = nums(a); const m = mean(x); return x.reduce((s, v) => s + (v - m) ** 2, 0) / x.length; },
  DEVSQ: (a) => { const x = nums(a); const m = mean(x); return x.reduce((s, v) => s + (v - m) ** 2, 0); },
  "QUARTILE.INC": (a) => { need(a, 2, "QUARTILE.INC"); const q = Math.floor(num(a[1], "quart")); if (q < 0 || q > 4) throw new Error("#NUM! quart must be 0–4"); return percentileInc(nums([a[0]]), q / 4, "QUARTILE.INC"); },
  "QUARTILE.EXC": (a) => { need(a, 2, "QUARTILE.EXC"); const q = Math.floor(num(a[1], "quart")); if (q < 1 || q > 3) throw new Error("#NUM! QUARTILE.EXC quart must be 1–3"); return percentileExc(nums([a[0]]), q / 4, "QUARTILE.EXC"); },
  "PERCENTILE.EXC": (a) => { need(a, 2, "PERCENTILE.EXC"); return percentileExc(nums([a[0]]), num(a[1], "k"), "PERCENTILE.EXC"); },
  "PERCENTILE.INC": (a) => { need(a, 2, "PERCENTILE.INC"); return percentileInc(nums([a[0]]), num(a[1], "k"), "PERCENTILE.INC"); },
  LARGE: (a) => { need(a, 2, "LARGE"); const s = sorted(nums([a[0]])).reverse(), k = Math.floor(num(a[1], "k")); if (k < 1 || k > s.length) throw new Error("#NUM! LARGE: k out of range"); return s[k - 1]; },
  SMALL: (a) => { need(a, 2, "SMALL"); const s = sorted(nums([a[0]])), k = Math.floor(num(a[1], "k")); if (k < 1 || k > s.length) throw new Error("#NUM! SMALL: k out of range"); return s[k - 1]; },
  COUNT: (a) => nums(a).length,
  COUNTA: (a) => a.reduce((s: number, v) => s + (isGrid(v) ? v.cells.filter((c) => c !== null && c !== "").length : 1), 0),
  COUNTBLANK: (a) => cellsOf(a[0]).filter((c) => c === null || c === "").length,
  SUM: (a) => nums(a).reduce((s, v) => s + v, 0),
  SUMSQ: (a) => nums(a).reduce((s, v) => s + v * v, 0),
  SUMPRODUCT: (a) => {
    if (!a.length) throw new Error("SUMPRODUCT needs a range");
    const cols = a.map((v) => cellsOf(v));
    const n = cols[0].length;
    if (cols.some((c) => c.length !== n)) throw new Error("#VALUE! SUMPRODUCT: the ranges must be the same size");
    let s = 0;
    for (let i = 0; i < n; i++) s += cols.reduce((p, c) => p * (typeof c[i] === "number" ? (c[i] as number) : 0), 1);
    return s;
  },
  MIN: (a) => { const x = nums(a); return x.length ? Math.min(...x) : 0; },
  MAX: (a) => { const x = nums(a); return x.length ? Math.max(...x) : 0; },
  COUNTIF: (a) => { need(a, 2, "COUNTIF"); const t = matcher(a[1]); return cellsOf(a[0]).filter((c) => t(c)).length; },
  COUNTIFS: (a) => ifsMask(a, 0, "COUNTIFS").filter(Boolean).length,
  SUMIF: (a) => { need(a, 2, "SUMIF"); const t = matcher(a[1]); const mask = cellsOf(a[0]).map((c) => t(c)); return pick(a[2] ?? a[0], mask, "SUMIF").reduce((s, v) => s + v, 0); },
  SUMIFS: (a) => { need(a, 3, "SUMIFS"); return pick(a[0], ifsMask(a, 1, "SUMIFS"), "SUMIFS").reduce((s, v) => s + v, 0); },
  AVERAGEIF: (a) => { need(a, 2, "AVERAGEIF"); const t = matcher(a[1]); const mask = cellsOf(a[0]).map((c) => t(c)); const x = pick(a[2] ?? a[0], mask, "AVERAGEIF"); if (!x.length) throw new Error("#DIV/0! AVERAGEIF: nothing matched"); return mean(x); },
  AVERAGEIFS: (a) => { need(a, 3, "AVERAGEIFS"); const x = pick(a[0], ifsMask(a, 1, "AVERAGEIFS"), "AVERAGEIFS"); if (!x.length) throw new Error("#DIV/0! AVERAGEIFS: nothing matched"); return mean(x); },
  IF: (a) => { need(a, 2, "IF"); return flag(a[0]) ? a[1] : (a[2] ?? false); },
  AND: (a) => a.every((v) => cellsOf(v).every((c) => c === null || flag(c as Val))),
  OR: (a) => a.some((v) => cellsOf(v).some((c) => c !== null && flag(c as Val))),
  NOT: (a) => !flag(a[0]),
  CORREL: (a) => { need(a, 2, "CORREL"); const r = regress(a[0], a[1], "CORREL").r; if (!Number.isFinite(r)) throw new Error("#DIV/0! CORREL"); return r; },
  SLOPE: (a) => { need(a, 2, "SLOPE"); return regress(a[0], a[1], "SLOPE").slope; },
  INTERCEPT: (a) => { need(a, 2, "INTERCEPT"); return regress(a[0], a[1], "INTERCEPT").intercept; },
  RSQ: (a) => { need(a, 2, "RSQ"); const r = regress(a[0], a[1], "RSQ").r; if (!Number.isFinite(r)) throw new Error("#DIV/0! RSQ"); return r * r; },
  STEYX: (a) => { need(a, 2, "STEYX"); const g = regress(a[0], a[1], "STEYX"); if (g.n < 3) throw new Error("#DIV/0! STEYX needs at least three pairs"); return Math.sqrt((g.syy - g.sxy ** 2 / g.sxx) / (g.n - 2)); },
  "FORECAST.LINEAR": (a) => { need(a, 3, "FORECAST.LINEAR"); const g = regress(a[1], a[2], "FORECAST.LINEAR"); return g.intercept + g.slope * num(a[0], "x"); },
  VLOOKUP: (a) => {
    need(a, 3, "VLOOKUP");
    const t = a[1];
    if (!isGrid(t)) throw new Error("#VALUE! VLOOKUP needs a table range");
    const col = Math.floor(num(a[2], "col_index_num"));
    if (col < 1 || col > t.cols) throw new Error("#REF! VLOOKUP: col_index_num is outside the table");
    const key = isGrid(a[0]) ? (a[0].cells[0] ?? "") as Scalar : a[0];
    const approx = a[3] === undefined ? true : flag(a[3]);
    let hit = -1;
    for (let r = 0; r < t.rows; r++) {
      const c = t.cells[r * t.cols];
      if (approx) {
        if (typeof key === "number" ? typeof c === "number" && c <= key + 1e-12 : typeof c === "string" && c.toLowerCase() <= str(key).toLowerCase()) hit = r;
        else if (c !== null && typeof c === typeof key) break;
      } else if (sameText(c, key)) { hit = r; break; }
    }
    if (hit < 0) throw new Error(`#N/A VLOOKUP: ${str(key)} not found`);
    const out = t.cells[hit * t.cols + col - 1];
    return out === null ? 0 : out;
  },
};
// Excel 2007-era aliases that students still type.
FUNCS["NORMSDIST"] = (a) => normCdf(num(a[0], "z"));
FUNCS["NORMSINV"] = (a) => FUNCS["NORM.S.INV"](a);
FUNCS["STDEV"] = FUNCS["STDEV.S"];
FUNCS["VAR"] = FUNCS["VAR.S"];
FUNCS["MODE"] = FUNCS["MODE.SNGL"];
FUNCS["QUARTILE"] = FUNCS["QUARTILE.INC"];
FUNCS["PERCENTILE"] = FUNCS["PERCENTILE.INC"];
FUNCS["FORECAST"] = FUNCS["FORECAST.LINEAR"];
FUNCS["PEARSON"] = FUNCS["CORREL"];

const ALIASES = ["NORMSDIST", "NORMSINV", "STDEV", "VAR", "MODE", "QUARTILE", "PERCENTILE", "FORECAST", "PEARSON"];
export const SUPPORTED_FUNCTIONS = Object.keys(FUNCS).filter((k) => !ALIASES.includes(k));

// Column letters <-> index, A = 0.
export const colIndex = (letters: string) => letters.toUpperCase().split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
export const colName = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : colName(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));

/** A number result (what the practice sheet shows). Text or TRUE/FALSE results throw. */
export function evaluate(formula: string, ctx?: CellContext): number {
  return num(evaluateAny(formula, ctx), "result");
}

/** Any result: a number, text (=IF(p<0.05,"R","DR")) or TRUE/FALSE. */
export function evaluateAny(formula: string, ctx?: CellContext): number | string | boolean {
  const src = formula.trim().replace(/^=/, "").replace(/_xlfn\./gi, "");
  if (src.length > 2000) throw new Error("Formula too long");
  let i = 0;
  const peek = () => { while (src[i] === " ") i++; return src[i]; };
  const expect = (ch: string) => { if (peek() !== ch) throw new Error(`Expected "${ch}" at position ${i + 1}`); i++; };

  // Precedence, loosest first: comparison (= <> < > <= >=), & (join text), + −, * /, ^, unary −, %.
  function compare(): Val {
    let v = concat();
    for (;;) {
      peek();
      const op = /^(<=|>=|<>|<|>|=)/.exec(src.slice(i))?.[1];
      if (!op) return v;
      i += op.length;
      const w = concat();
      const a = isGrid(v) ? (v.cells[0] ?? 0) : v, b = isGrid(w) ? (w.cells[0] ?? 0) : w;
      let k: number;
      if (typeof a === "number" && typeof b === "number") k = a === b ? 0 : a < b ? -1 : 1;
      else if (typeof a === "boolean" && typeof b === "boolean") k = a === b ? 0 : a ? 1 : -1;
      else if (typeof a === "string" && typeof b === "string") k = a.toLowerCase().localeCompare(b.toLowerCase());
      else { const rank = (x: unknown) => (typeof x === "number" ? 0 : typeof x === "string" ? 1 : 2); k = rank(a) - rank(b); }
      v = op === "=" ? k === 0 : op === "<>" ? k !== 0 : op === "<" ? k < 0 : op === ">" ? k > 0 : op === "<=" ? k <= 0 : k >= 0;
    }
  }
  function concat(): Val {
    let v = expr();
    while (peek() === "&") { i++; v = str(v) + str(expr()); }
    return v;
  }
  function expr(): Val {
    let v = term();
    for (;;) {
      const c = peek();
      if (c === "+") { i++; v = num(v, "+") + num(term(), "+"); }
      else if (c === "-") { i++; v = num(v, "-") - num(term(), "-"); }
      else return v;
    }
  }
  function term(): Val {
    let v = unary();
    for (;;) {
      const c = peek();
      if (c === "*") { i++; v = num(v, "*") * num(unary(), "*"); }
      else if (c === "/") { i++; const d = num(unary(), "/"); if (d === 0) throw new Error("#DIV/0!"); v = num(v, "/") / d; }
      else return v;
    }
  }
  // Excel precedence: negation binds tighter than ^, so =-2^2 is 4.
  function signed(): Val {
    const c = peek();
    if (c === "-") { i++; return -num(signed(), "-"); }
    if (c === "+") { i++; return signed(); }
    let v = primary();
    if (peek() === "%") { i++; v = num(v, "%") / 100; }
    return v;
  }
  function unary(): Val {
    let v = signed();
    while (peek() === "^") { i++; v = Math.pow(num(v, "^"), num(signed(), "^")); }
    return v;
  }
  function primary(): Val {
    const c = peek();
    if (c === "(") { i++; const v = compare(); expect(")"); return v; }
    if (c === '"') {
      let out = ""; i++;
      for (;;) {
        if (i >= src.length) throw new Error("Text is missing its closing quote");
        if (src[i] === '"') { if (src[i + 1] === '"') { out += '"'; i += 2; continue; } i++; break; }
        out += src[i++];
      }
      return out;
    }
    const numMatch = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
    if (numMatch) { i += numMatch[0].length; return parseFloat(numMatch[0]); }
    // Cell reference or range: B5, $B$5, D5:D12 (not followed by "(" or ".", which would be a function).
    const ref = /^\$?([A-Za-z]{1,2})\$?(\d{1,5})(?::\$?([A-Za-z]{1,2})\$?(\d{1,5}))?(?![A-Za-z0-9.(_])/.exec(src.slice(i));
    if (ref) {
      if (!ctx) throw new Error(`#REF! ${ref[0]}: cell references only work inside the practice sheet`);
      i += ref[0].length;
      const c1 = colIndex(ref[1]), r1 = Number(ref[2]);
      if (!ref[3]) {
        const v = ctx.get(`${colName(c1)}${r1}`);
        if (v === null || v === "") return { grid: true, cells: [null], rows: 1, cols: 1 };
        return v;
      }
      const c2 = colIndex(ref[3]), r2 = Number(ref[4]);
      const out: (number | string | null)[] = [];
      const rs = Math.min(r1, r2), re = Math.max(r1, r2), cs = Math.min(c1, c2), ce = Math.max(c1, c2);
      if ((re - rs + 1) * (ce - cs + 1) > 200_000) throw new Error("#REF! range too large");
      for (let r = rs; r <= re; r++)
        for (let cc = cs; cc <= ce; cc++) {
          const v = ctx.get(`${colName(cc)}${r}`);
          out.push(v === "" ? null : v);
        }
      return { grid: true, cells: out, rows: re - rs + 1, cols: ce - cs + 1 };
    }
    const name = /^[A-Za-z][A-Za-z0-9.]*/.exec(src.slice(i));
    if (name) {
      i += name[0].length;
      const key = name[0].toUpperCase();
      if (key === "TRUE" && peek() !== "(") return true;
      if (key === "FALSE" && peek() !== "(") return false;
      if (key === "PI" && peek() === "(") { i++; expect(")"); return Math.PI; }
      const fn = FUNCS[key];
      if (!fn) throw new Error(`#NAME? ${name[0]} is not a function this calculator knows`);
      expect("(");
      const args: Val[] = [];
      if (peek() !== ")") {
        args.push(compare());
        while (peek() === ",") { i++; args.push(compare()); }
      }
      expect(")");
      const out = fn(args);
      if (typeof out === "number" && !Number.isFinite(out)) throw new Error("#NUM! result is not a finite number");
      return out;
    }
    throw new Error(c === undefined ? "Formula ended early" : `Unexpected "${c}" at position ${i + 1}`);
  }

  const v = compare();
  if (peek() !== undefined) throw new Error(`Unexpected "${src[i]}" at position ${i + 1}`);
  if (isGrid(v)) {
    if (v.cells.length !== 1) throw new Error("#VALUE! a range can't be used in a single cell: wrap it in AVERAGE(), SUM()…");
    return v.cells[0] ?? 0;
  }
  return v;
}

/** Evaluate and never throw: for the tutor's tool. */
export function evaluateSafe(formula: string, ctx?: CellContext): { formula: string; value?: number; error?: string } {
  try {
    return { formula, value: evaluate(formula, ctx) };
  } catch (e) {
    return { formula, error: e instanceof Error ? e.message : String(e) };
  }
}
