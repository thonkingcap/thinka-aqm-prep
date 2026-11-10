// A small, safe evaluator for the Excel formulas used in AQM 1000.
// No eval(): a recursive-descent parser over a fixed function table.
import { normCdf, normDist, normInv, normInvGeneral, normPdf, tCdf, tPdf, tInv, mean, stdevS } from "./stats.ts";

// A range (D5:D12) evaluates to the list of its numeric cells, as Excel's AVERAGE/STDEV.S see it.
type Val = number | boolean | number[];
type Fn = (args: Val[]) => number;

/** Lets formulas read other cells: returns a cell's computed value, or null when it is empty. */
export type CellContext = { get: (addr: string) => number | string | null };

const num = (v: Val | undefined, name: string): number => {
  if (typeof v === "boolean") return v ? 1 : 0;
  if (Array.isArray(v)) throw new Error(`#VALUE! a range can't be used in ${name === "result" ? "a single cell" : name}: wrap it in AVERAGE(), SUM()…`);
  if (v === undefined || Number.isNaN(v)) throw new Error(`${name}: missing argument`);
  return v;
};
const flag = (v: Val | undefined) => (v === undefined ? true : typeof v === "boolean" ? v : Array.isArray(v) ? v.length > 0 : v !== 0);
const nums = (args: Val[]) => args.flatMap((a) => (Array.isArray(a) ? a : [num(a, "list")]));
const need = (args: Val[], n: number, name: string) => {
  if (args.length < n) throw new Error(`${name} needs ${n} arguments`);
};

const FUNCS: Record<string, Fn> = {
  "NORM.DIST": (a) => { need(a, 4, "NORM.DIST"); const [x, m, s] = [num(a[0], "x"), num(a[1], "mean"), num(a[2], "sd")]; if (s <= 0) throw new Error("#NUM! sd must be > 0"); return flag(a[3]) ? normDist(x, m, s) : normPdf(x, m, s); },
  "NORM.S.DIST": (a) => { need(a, 2, "NORM.S.DIST"); const z = num(a[0], "z"); return flag(a[1]) ? normCdf(z) : normPdf(z); },
  "NORM.INV": (a) => { need(a, 3, "NORM.INV"); const p = num(a[0], "p"); if (p <= 0 || p >= 1) throw new Error("#NUM! probability must be between 0 and 1"); return normInvGeneral(p, num(a[1], "mean"), num(a[2], "sd")); },
  "NORM.S.INV": (a) => { need(a, 1, "NORM.S.INV"); const p = num(a[0], "p"); if (p <= 0 || p >= 1) throw new Error("#NUM! probability must be between 0 and 1"); return normInv(p); },
  "T.DIST": (a) => { need(a, 3, "T.DIST"); const df = num(a[1], "df"); if (df < 1) throw new Error("#NUM! df must be >= 1"); return flag(a[2]) ? tCdf(num(a[0], "t"), df) : tPdf(num(a[0], "t"), df); },
  "T.DIST.RT": (a) => { need(a, 2, "T.DIST.RT"); return 1 - tCdf(num(a[0], "t"), num(a[1], "df")); },
  "T.DIST.2T": (a) => { need(a, 2, "T.DIST.2T"); const t = num(a[0], "t"); if (t < 0) throw new Error("#NUM! T.DIST.2T needs a non-negative t: use ABS()"); return 2 * (1 - tCdf(t, num(a[1], "df"))); },
  "T.INV": (a) => { need(a, 2, "T.INV"); const p = num(a[0], "p"); if (p <= 0 || p >= 1) throw new Error("#NUM! probability must be between 0 and 1"); return tInv(p, num(a[1], "df")); },
  "T.INV.2T": (a) => { need(a, 2, "T.INV.2T"); const p = num(a[0], "p"); if (p <= 0 || p > 1) throw new Error("#NUM! probability must be between 0 and 1"); return tInv(1 - p / 2, num(a[1], "df")); },
  SQRT: (a) => { const x = num(a[0], "SQRT"); if (x < 0) throw new Error("#NUM! SQRT of a negative"); return Math.sqrt(x); },
  ABS: (a) => Math.abs(num(a[0], "ABS")),
  EXP: (a) => Math.exp(num(a[0], "EXP")),
  LN: (a) => Math.log(num(a[0], "LN")),
  POWER: (a) => Math.pow(num(a[0], "base"), num(a[1], "power")),
  ROUND: (a) => { const d = num(a[1] ?? 0, "digits"); const f = 10 ** d; return Math.round(num(a[0], "ROUND") * f) / f; },
  AVERAGE: (a) => mean(nums(a)),
  "STDEV.S": (a) => stdevS(nums(a)),
  "STDEV.P": (a) => { const x = nums(a); const m = mean(x); return Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / x.length); },
  "VAR.S": (a) => stdevS(nums(a)) ** 2,
  COUNT: (a) => nums(a).length,
  SUM: (a) => nums(a).reduce((s, v) => s + v, 0),
  MIN: (a) => Math.min(...nums(a)),
  MAX: (a) => Math.max(...nums(a)),
};
// Excel 2007-era aliases that students still type.
FUNCS["NORMSDIST"] = (a) => normCdf(num(a[0], "z"));
FUNCS["NORMSINV"] = (a) => FUNCS["NORM.S.INV"](a);
FUNCS["STDEV"] = FUNCS["STDEV.S"];

export const SUPPORTED_FUNCTIONS = Object.keys(FUNCS).filter((k) => !["NORMSDIST", "NORMSINV", "STDEV"].includes(k));

// Column letters <-> index, A = 0.
export const colIndex = (letters: string) => letters.toUpperCase().split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
export const colName = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : colName(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));

export function evaluate(formula: string, ctx?: CellContext): number {
  const src = formula.trim().replace(/^=/, "").replace(/_xlfn\./gi, "");
  if (src.length > 500) throw new Error("Formula too long");
  let i = 0;
  const peek = () => { while (src[i] === " ") i++; return src[i]; };
  const expect = (ch: string) => { if (peek() !== ch) throw new Error(`Expected "${ch}" at position ${i + 1}`); i++; };

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
    if (c === "(") { i++; const v = expr(); expect(")"); return v; }
    const numMatch = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
    if (numMatch) { i += numMatch[0].length; return parseFloat(numMatch[0]); }
    // Cell reference or range: B5, $B$5, D5:D12 (not followed by "(" or ".", which would be a function).
    const ref = /^\$?([A-Za-z]{1,2})\$?(\d{1,4})(?::\$?([A-Za-z]{1,2})\$?(\d{1,4}))?(?![A-Za-z0-9.(])/.exec(src.slice(i));
    if (ref) {
      if (!ctx) throw new Error(`#REF! ${ref[0]}: cell references only work inside the practice sheet`);
      i += ref[0].length;
      const c1 = colIndex(ref[1]), r1 = Number(ref[2]);
      if (!ref[3]) {
        const v = ctx.get(`${colName(c1)}${r1}`);
        if (v === null || v === "") return 0;
        if (typeof v === "string") throw new Error(`#VALUE! ${ref[0]} holds text, not a number`);
        return v;
      }
      const c2 = colIndex(ref[3]), r2 = Number(ref[4]);
      const out: number[] = [];
      for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
        for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
          const v = ctx.get(`${colName(c)}${r}`);
          if (typeof v === "number") out.push(v);
        }
      return out;
    }
    const name = /^[A-Za-z][A-Za-z0-9.]*/.exec(src.slice(i));
    if (name) {
      i += name[0].length;
      const key = name[0].toUpperCase();
      if (key === "TRUE") return true;
      if (key === "FALSE") return false;
      if (key === "PI" && peek() === "(") { i++; expect(")"); return Math.PI; }
      const fn = FUNCS[key];
      if (!fn) throw new Error(`#NAME? ${name[0]} is not a function this calculator knows`);
      expect("(");
      const args: Val[] = [];
      if (peek() !== ")") {
        args.push(expr());
        while (peek() === ",") { i++; args.push(expr()); }
      }
      expect(")");
      const out = fn(args);
      if (!Number.isFinite(out)) throw new Error("#NUM! result is not a finite number");
      return out;
    }
    throw new Error(c === undefined ? "Formula ended early" : `Unexpected "${c}" at position ${i + 1}`);
  }

  const v = expr();
  if (peek() !== undefined) throw new Error(`Unexpected "${src[i]}" at position ${i + 1}`);
  return num(v, "result");
}

/** Evaluate and never throw: for the tutor's tool. */
export function evaluateSafe(formula: string, ctx?: CellContext): { formula: string; value?: number; error?: string } {
  try {
    return { formula, value: evaluate(formula, ctx) };
  } catch (e) {
    return { formula, error: e instanceof Error ? e.message : String(e) };
  }
}
