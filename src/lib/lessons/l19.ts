// Lesson 19 (Get Ahead, BETA): introduction to simple linear regression.
// Not taught yet in Fall 2026: built from the Spring 2026 "Final announcement" (which lists exactly what was
// examinable on simple linear regression), the Spring 2026 Final and its solutions (Regression sheet), the
// Fall 2025 Final (Regression and Residual Analysis sheets), Lesson 3's notes on dependent/independent variables
// and the textbook. Anything that is our anticipation rather than his words says so in `source`.
//
// This file also holds the small regression toolkit (least squares, t and F tails, a Toolpak-style report)
// that l20.ts and l21.ts import.
import { Sheet, int, pick, round, gauss, col, colNum, tolFor, TOP, type BlockMaker, type Block, type Part, type Rng } from "./kit.ts";
import type { Lesson } from "./types.ts";

// =====================================================================================================
// Regression toolkit (independent of the site's Excel engine, so the answers are computed separately
// from the formula strings).
// =====================================================================================================

function lgamma(x: number): number {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  const z = x - 1;
  let a = c[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}
function betacf(a: number, b: number, x: number): number {
  const FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 500; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return h;
}
/** Regularised incomplete beta I_x(a, b). */
export function ibeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}
/** Left-tail t probability, what T.DIST(t, df, TRUE) gives. */
export function tcdf(t: number, df: number): number {
  const tail = 0.5 * ibeta(df / 2, 0.5, df / (df + t * t));
  return t >= 0 ? 1 - tail : tail;
}
/** Inverse of tcdf, what T.INV(p, df) gives. */
export function tinv(p: number, df: number): number {
  let lo = -1000, hi = 1000;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (tcdf(mid, df) < p) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
/** Two-tailed p-value in the class convention (2·T.DIST(t) if t < 0, 2·(1 − T.DIST(t)) if t > 0). */
export const pTwo = (t: number, df: number) => (t < 0 ? 2 * tcdf(t, df) : 2 * (1 - tcdf(t, df)));
/** Right tail of the F distribution (the Toolpak's Significance F). */
export const fsf = (F: number, d1: number, d2: number) => ibeta(d2 / 2, d1 / 2, d2 / (d2 + d1 * F));

const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
export const meanOf = (a: number[]) => sum(a) / a.length;
export const devsq = (a: number[]) => { const m = meanOf(a); return sum(a.map((v) => (v - m) ** 2)); };
export function correl(x: number[], y: number[]): number {
  const mx = meanOf(x), my = meanOf(y);
  const sxy = sum(x.map((v, i) => (v - mx) * (y[i] - my)));
  return sxy / Math.sqrt(devsq(x) * devsq(y));
}

/** Invert a small square matrix (Gauss–Jordan with partial pivoting). */
function invert(A: number[][]): number[][] {
  const n = A.length;
  const M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c];
    if (Math.abs(d) < 1e-12) throw new Error("singular X'X");
    for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map((r) => r.slice(n));
}

/** Everything the Toolpak's Regression report shows, by least squares (normal equations). */
export type Ols = {
  n: number; k: number;
  b: number[]; se: number[]; t: number[]; p: number[]; lo: number[]; hi: number[];
  r2: number; adj: number; multR: number; s: number;
  sst: number; ssr: number; sse: number; msr: number; mse: number; F: number; sigF: number;
  dfR: number; dfE: number; dfT: number;
  fitted: number[]; resid: number[]; inv: number[][];
};
/** Least squares of y on the columns xs (an intercept is added). */
export function ols(xs: number[][], y: number[]): Ols {
  const n = y.length, k = xs.length;
  const row = (i: number) => [1, ...xs.map((c) => c[i])];
  const XtX = Array.from({ length: k + 1 }, () => Array(k + 1).fill(0) as number[]);
  const Xty = Array(k + 1).fill(0) as number[];
  for (let i = 0; i < n; i++) {
    const r = row(i);
    for (let a = 0; a <= k; a++) { Xty[a] += r[a] * y[i]; for (let c = 0; c <= k; c++) XtX[a][c] += r[a] * r[c]; }
  }
  const inv = invert(XtX);
  const b = inv.map((r) => sum(r.map((v, j) => v * Xty[j])));
  const fitted = Array.from({ length: n }, (_, i) => sum(row(i).map((v, j) => v * b[j])));
  const resid = y.map((v, i) => v - fitted[i]);
  const sse = sum(resid.map((e) => e * e));
  const sst = devsq(y);
  const ssr = sst - sse;
  const dfR = k, dfE = n - k - 1, dfT = n - 1;
  const mse = sse / dfE, msr = ssr / dfR;
  const s = Math.sqrt(mse);
  const se = inv.map((r, j) => Math.sqrt(mse * r[j]));
  const t = b.map((v, j) => v / se[j]);
  const p = t.map((v) => pTwo(v, dfE));
  const tc = tinv(0.975, dfE);
  const r2 = ssr / sst;
  const F = msr / mse;
  return {
    n, k, b, se, t, p, lo: b.map((v, j) => v - tc * se[j]), hi: b.map((v, j) => v + tc * se[j]),
    r2, adj: 1 - ((1 - r2) * dfT) / dfE, multR: Math.sqrt(r2), s, sst, ssr, sse, msr, mse, F, sigF: fsf(F, dfR, dfE),
    dfR, dfE, dfT, fitted, resid, inv,
  };
}

/** Where each number of a written Toolpak report sits. */
export type Rep = {
  multR: string; r2: string; adj: string; se: string; obs: string;
  dfR: string; dfE: string; dfT: string; ssR: string; ssE: string; ssT: string; msR: string; msE: string; F: string; sigF: string;
  coef: string[]; seC: string[]; tC: string[]; pC: string[]; bottom: number;
};
/**
 * Writes a Toolpak-style "SUMMARY OUTPUT" (as given values) with its top-left label at (c, top), laid out like the
 * Toolpak's own output (and like the Spring 2026 Final solutions, Regression!K23:S40). `names` are the X headers.
 */
export function writeReport(S: Sheet, c: string, top: number, names: string[], o: Ols): Rep {
  const c0 = colNum(c);
  const C = (j: number) => col(c0 + j);
  const A = (j: number, r: number) => `${C(j)}${r}`;
  S.header(A(0, top), "SUMMARY OUTPUT");
  S.header(A(0, top + 2), "Regression Statistics");
  const stats: [string, number][] = [["Multiple R", o.multR], ["R Square", o.r2], ["Adjusted R Square", o.adj], ["Standard Error", o.s], ["Observations", o.n]];
  stats.forEach(([l, v], i) => { S.label(A(0, top + 3 + i), l).given(A(1, top + 3 + i), v); });
  S.header(A(0, top + 9), "ANOVA");
  ["df", "SS", "MS", "F", "Significance F"].forEach((h, j) => S.header(A(j + 1, top + 10), h));
  const ra = top + 11;
  S.label(A(0, ra), "Regression").given(A(1, ra), o.dfR).given(A(2, ra), o.ssr).given(A(3, ra), o.msr).given(A(4, ra), o.F).given(A(5, ra), o.sigF);
  S.label(A(0, ra + 1), "Residual").given(A(1, ra + 1), o.dfE).given(A(2, ra + 1), o.sse).given(A(3, ra + 1), o.mse);
  S.label(A(0, ra + 2), "Total").given(A(1, ra + 2), o.dfT).given(A(2, ra + 2), o.sst);
  const rc = top + 15;
  ["Coefficients", "Standard Error", "t Stat", "P-value", "Lower 95%", "Upper 95%"].forEach((h, j) => S.header(A(j + 1, rc), h));
  const rows = ["Intercept", ...names];
  rows.forEach((nm, i) => {
    const r = rc + 1 + i;
    S.label(A(0, r), nm).given(A(1, r), o.b[i]).given(A(2, r), o.se[i]).given(A(3, r), o.t[i]).given(A(4, r), o.p[i]).given(A(5, r), o.lo[i]).given(A(6, r), o.hi[i]);
  });
  const rr = (i: number) => rc + 1 + i;
  return {
    multR: A(1, top + 3), r2: A(1, top + 4), adj: A(1, top + 5), se: A(1, top + 6), obs: A(1, top + 7),
    dfR: A(1, ra), dfE: A(1, ra + 1), dfT: A(1, ra + 2), ssR: A(2, ra), ssE: A(2, ra + 1), ssT: A(2, ra + 2),
    msR: A(3, ra), msE: A(3, ra + 1), F: A(4, ra), sigF: A(5, ra),
    coef: rows.map((_, i) => A(1, rr(i))), seC: rows.map((_, i) => A(2, rr(i))), tC: rows.map((_, i) => A(3, rr(i))), pC: rows.map((_, i) => A(4, rr(i))),
    bottom: rr(rows.length - 1),
  };
}

/** Adds a part, dropping any trap that sits too close to the right answer (or is not a number). */
export function put(S: Sheet, labelAt: string | null, p: Part) {
  const tol = tolFor(p);
  const traps = (p.traps ?? []).filter((t) => Number.isFinite(t.value) && Math.abs(t.value - Number(p.answer)) > tol * 1.5 + 1e-12);
  const q: Part = { ...p };
  if (traps.length) q.traps = traps; else delete q.traps;
  if (labelAt) S.ask(labelAt, q); else S.parts.push(q);
}
/** A formula's literal choice answer: "\"Yes\"". */
export const lit = (s: string) => `"${s}"`;
/** Short number for question text. */
export const fmt = (v: number) => String(Number(v.toPrecision(10)));

// ---------- simple-regression contexts and data ----------
export type SCtx = {
  who: string; x: string; y: string; xs: string; ys: string;
  gen: (rng: Rng, n: number) => number[]; xd: number; b0: number; sign: 1 | -1; sigma: number; yd: number; ymax?: number;
};
const U = (lo: number, hi: number, d: number) => (rng: Rng, n: number) => Array.from({ length: n }, () => round(lo + (hi - lo) * rng(), d));
const I = (lo: number, hi: number) => (rng: Rng, n: number) => Array.from({ length: n }, () => int(rng, lo, hi));
export const SIMPLE: SCtx[] = [
  { who: "A retailer records its advertising spend and its sales in each of", x: "Advertising ($000)", xs: "Advertising", y: "Sales ($000)", ys: "Sales", gen: U(5, 50, 1), xd: 1, b0: 150, sign: 1, sigma: 25, yd: 1 },
  { who: "A tutor records the hours studied and the exam score of each of", x: "Hours studied", xs: "Hours", y: "Exam score", ys: "Score", gen: U(0, 20, 1), xd: 1, b0: 40, sign: 1, sigma: 6, yd: 0, ymax: 100 },
  { who: "An estate agent records the bedrooms and the sale price of each of", x: "Bedrooms", xs: "Bedrooms", y: "Price ($)", ys: "Price", gen: I(1, 6), xd: 0, b0: 200000, sign: 1, sigma: 60000, yd: 0 },
  { who: "A café records the high temperature and the number of iced drinks sold on each of", x: "Temperature (F)", xs: "Temperature", y: "Iced drinks sold", ys: "Drinks", gen: I(55, 95), xd: 0, b0: 60, sign: 1, sigma: 15, yd: 0 },
  { who: "A courier records the distance and the delivery time of each of", x: "Distance (miles)", xs: "Distance", y: "Delivery time (min)", ys: "Time", gen: U(1, 15, 1), xd: 1, b0: 20, sign: 1, sigma: 5, yd: 0 },
  { who: "A car magazine records the engine size and the fuel economy of each of", x: "Engine size (litres)", xs: "Engine", y: "Fuel economy (mpg)", ys: "Economy", gen: U(1, 5, 1), xd: 1, b0: 45, sign: -1, sigma: 3, yd: 1 },
  { who: "A shop tries a different price for a snack in each of", x: "Price ($)", xs: "Price", y: "Units sold", ys: "Units", gen: U(2, 10, 2), xd: 2, b0: 400, sign: -1, sigma: 30, yd: 0 },
  { who: "A dealer records the age and the resale value of each of", x: "Age (years)", xs: "Age", y: "Resale value ($)", ys: "Value", gen: I(1, 12), xd: 0, b0: 30000, sign: -1, sigma: 2500, yd: 0 },
];
/** What the n items are called in the question text. */
export const UNITS: Record<string, string> = {
  Advertising: "months", Hours: "students", Bedrooms: "houses", Temperature: "days", Distance: "deliveries", Engine: "cars", Price: "weeks", Age: "cars",
};

/** Residualise e against the columns (an intercept is included) and scale so √(Σe²/(n − k − 1)) = sigma. */
export function noise(rng: Rng, cols: number[][], sigma: number): number[] {
  const n = cols[0].length;
  const e0 = Array.from({ length: n }, () => gauss(rng));
  const e = ols(cols, e0).resid;
  const s = Math.sqrt(sum(e.map((v) => v * v)) / (n - cols.length - 1));
  return e.map((v) => (v * sigma) / s);
}
/**
 * x and y for a context, built so the fitted slope's t statistic is (before rounding y) exactly tTarget in size,
 * with the context's sign. A small |t| gives a weak, not significant relationship; a large one a strong one.
 */
export function simpleData(rng: Rng, ctx: SCtx, n: number, tTarget: number): { x: number[]; y: number[] } {
  let out = { x: [] as number[], y: [] as number[] };
  for (let attempt = 0; attempt < 60; attempt++) {
    let x = ctx.gen(rng, n);
    for (let k = 0; k < 50 && new Set(x).size < 3; k++) x = ctx.gen(rng, n);
    // Vary the intercept and the scatter a little so versions of the same context don't share a "nice" intercept.
    const b0 = ctx.b0 * (0.85 + 0.3 * rng());
    const sigma = ctx.sigma * (0.8 + 0.45 * rng());
    const e = noise(rng, [x], sigma);
    const b1 = (ctx.sign * tTarget * sigma) / Math.sqrt(devsq(x));
    const y = x.map((v, i) => round(b0 + b1 * v + e[i], ctx.yd));
    out = { x, y };
    if (plausible(ctx, y)) break;
  }
  return out;
}
/** Y values that make sense in the context: positive, and not above the context's cap (100 for a score). */
export const plausible = (ctx: SCtx, y: number[]) => y.every((v) => v > 0 && (ctx.ymax === undefined || v <= ctx.ymax));
/** A value of X inside the data's range to predict at. */
export function pickX0(rng: Rng, x: number[], d: number): number {
  const lo = Math.min(...x), hi = Math.max(...x);
  return round(lo + (hi - lo) * (0.25 + 0.5 * rng()), d);
}

// =====================================================================================================
// Practice tabs
// =====================================================================================================

const line: BlockMaker = {
  key: "l19.line",
  title: "Line of best fit, correlation and a prediction",
  make(rng): Block {
    const ctx = pick(rng, SIMPLE);
    const n = int(rng, 10, 16);
    const { x, y } = simpleData(rng, ctx, n, 2 + 6 * rng());
    const yFirst = rng() < 0.5;
    const S = new Sheet();
    const top = TOP + 1;
    const T = S.table("B", top, yFirst ? ["Obs", ctx.y, ctx.x] : ["Obs", ctx.x, ctx.y], x.map((v, i) => (yFirst ? [i + 1, y[i], v] : [i + 1, v, y[i]])));
    const xr = T.cols[ctx.x].range, yr = T.cols[ctx.y].range;
    const o = ols([x], y);
    const [b0, b1] = o.b;
    const r = correl(x, y);
    const swapSlope = r * Math.sqrt(devsq(x) / devsq(y)); // SLOPE with the ranges swapped regresses X on Y
    const swapInt = meanOf(x) - swapSlope * meanOf(y);
    const x0 = pickX0(rng, x, ctx.xd);
    const L = "F", A = "I";
    S.header(`${L}${top}`, "Question").header(`${A}${top}`, "Your answer");
    const rY = top + 1, rB0 = top + 2, rB1 = top + 3, rR = top + 4, rDir = top + 5, rX0 = top + 7, rP = top + 8;
    put(S, `${L}${rY}`, {
      label: `Dependent variable (Y): type ${ctx.xs} or ${ctx.ys}`, cell: `${A}${rY}`, answer: ctx.ys, options: [ctx.xs, ctx.ys], formula: lit(ctx.ys),
      explain: `${ctx.ys} depends on ${ctx.xs.toLowerCase()}, not the other way round, so ${ctx.ys} is Y (vertical axis) and ${ctx.xs} is X (horizontal axis).`,
    });
    put(S, `${L}${rB0}`, {
      label: "y-intercept of the line of best fit", cell: `${A}${rB0}`, answer: b0, formula: `=INTERCEPT(${yr},${xr})`,
      explain: "INTERCEPT(known_y's, known_x's): the Y column goes first. Same number as the trendline equation and the Toolpak's Intercept coefficient.",
      traps: [{ value: swapInt, why: "Put the X column first: INTERCEPT wants the Y values first." }],
    });
    put(S, `${L}${rB1}`, {
      label: "slope of the line of best fit", cell: `${A}${rB1}`, answer: b1, formula: `=SLOPE(${yr},${xr})`,
      explain: "SLOPE(known_y's, known_x's): the change in predicted Y for each extra unit of X.",
      traps: [{ value: swapSlope, why: "Put the X column first: SLOPE wants the Y values first." }],
    });
    put(S, `${L}${rR}`, {
      label: "correlation coefficient r", cell: `${A}${rR}`, answer: r, formula: `=CORREL(${xr},${yr})`,
      explain: "CORREL gives r between −1 and 1; its sign is the sign of the slope. (The order of the two ranges does not matter for CORREL.)",
      traps: [{ value: r * r, why: "That is R² (r squared), not r." }],
    });
    put(S, `${L}${rDir}`, {
      label: "Direction of the relationship: Positive or Negative", cell: `${A}${rDir}`, answer: b1 > 0 ? "Positive" : "Negative", options: ["Positive", "Negative"],
      formula: `=IF(${A}${rB1}>0,"Positive","Negative")`,
      explain: "A positive slope (and r) means Y tends to go up as X goes up; a negative one means Y tends to go down.",
    });
    S.label(`${L}${rX0}`, `${ctx.xs} to predict at`).given(`${A}${rX0}`, x0);
    put(S, `${L}${rP}`, {
      label: `Predicted ${ctx.ys.toLowerCase()} at that ${ctx.xs.toLowerCase()}`, cell: `${A}${rP}`, answer: b0 + b1 * x0, formula: `=${A}${rB0}+${A}${rX0}*${A}${rB1}`,
      explain: "Prediction = y-intercept + X × slope, the way the Spring 2026 Final solution did it (=E26+6*E28). FORECAST.LINEAR(x, known_y's, known_x's) gives the same.",
      traps: [{ value: b1 * x0, why: "Forgot to add the y-intercept." }, { value: swapInt + swapSlope * x0, why: "Used the line with X and Y swapped." }],
    });
    return {
      tab: "Line of best fit", title: "Line of best fit and predictions",
      text: [
        `${ctx.who} ${n} ${UNITS[ctx.xs]}. The data are in B${top}:D${T.last}.`,
        "First decide from the context which variable is the dependent variable (Y): the one that depends on the other. Careful: the table does not always list X first (the Spring 2026 Final put Value before Bedrooms).",
        "Fill the yellow cells with formulas that point at the data. Do not round.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        "Insert a scatter chart with the independent variable (X) on the horizontal axis and Y on the vertical axis. Add a linear trendline and tick 'Display Equation on chart'. Self-check: the equation's slope and intercept match your cells.",
        "Type =FORECAST.LINEAR(x, Y range, X range) next to your prediction. Self-check: it gives the same number.",
      ],
    };
  },
};

const BANDS = ["Under 25%", "25% to 50%", "50% to 75%", "Over 75%"];
const sums: BlockMaker = {
  key: "l19.sums",
  title: "Sums of squares and R²",
  make(rng): Block {
    const ctx = pick(rng, SIMPLE);
    const n = int(rng, 12, 20);
    const band = int(rng, 0, 3);
    const lo = band * 0.25, hi = lo + 0.25;
    let x: number[] = [], y: number[] = [], r2 = 0;
    for (let k = 0; k < 60; k++) {
      const target = lo + 0.06 + 0.13 * rng();
      ({ x, y } = simpleData(rng, ctx, n, Math.sqrt((target * (n - 2)) / (1 - target))));
      r2 = correl(x, y) ** 2;
      if (r2 > lo + 0.03 && r2 < hi - 0.03) break;
    }
    const S = new Sheet();
    const top = TOP + 1;
    const T = S.table("B", top, ["Obs", ctx.x, ctx.y], x.map((v, i) => [i + 1, v, y[i]]));
    const xr = T.cols[ctx.x].range, yr = T.cols[ctx.y].range;
    const tss = devsq(y), reg = r2 * tss, res = tss - reg;
    const L = "F", A = "I";
    S.header(`${L}${top}`, "Question").header(`${A}${top}`, "Your answer");
    const rT = top + 1, rR = top + 2, rE = top + 3, rQ = top + 4, rU = top + 5, rB = top + 6;
    put(S, `${L}${rT}`, {
      label: "Total sum of squares (Toolpak: Total SS)", cell: `${A}${rT}`, answer: tss, formula: `=DEVSQ(${yr})`,
      explain: "Total SS = Σ(y − ȳ)², the squared distances of each Y from the mean of Y. DEVSQ does exactly that; the Toolpak shows it in the ANOVA table's Total row.",
      traps: [{ value: tss / (n - 1), why: "That is the sample variance VAR.S, not the sum of squares." }],
    });
    put(S, `${L}${rR}`, {
      label: "Regression (explained) sum of squares", cell: `${A}${rR}`, answer: reg, formula: `=RSQ(${yr},${xr})*${A}${rT}`,
      explain: "The part of the Total SS the line explains: Σ(ŷ − ȳ)². The Toolpak shows it in the ANOVA Regression row; with functions it is R² × Total SS (or SLOPE² × DEVSQ of X).",
      traps: [{ value: res, why: "That is the residual (unexplained) part." }],
    });
    put(S, `${L}${rE}`, {
      label: "Residual (unexplained) sum of squares", cell: `${A}${rE}`, answer: res, formula: `=${A}${rT}-${A}${rR}`,
      explain: "Total SS = Regression SS + Residual SS, so the residual SS is what is left over: Σ(y − ŷ)², the squared residuals. Toolpak: ANOVA Residual row.",
    });
    put(S, `${L}${rQ}`, {
      label: "R² = Regression SS ÷ Total SS", cell: `${A}${rQ}`, answer: r2, formula: `=${A}${rR}/${A}${rT}`, format: "prob",
      explain: "R² is the proportion of the variation in Y explained by the linear model. It matches RSQ and the Toolpak's R Square.",
      traps: [{ value: res / tss, why: "Residual ÷ Total is the unexplained share (1 − R²)." }],
    });
    put(S, `${L}${rU}`, {
      label: "Share of the variation in Y NOT explained", cell: `${A}${rU}`, answer: res / tss, formula: `=${A}${rE}/${A}${rT}`, format: "prob",
      explain: "Residual SS ÷ Total SS = 1 − R²: the variation left to other things (and chance).",
    });
    put(S, `${L}${rB}`, {
      label: `How much of the variation does the line explain? (${BANDS.join(" / ")})`, cell: `${A}${rB}`, answer: BANDS[band], options: BANDS,
      formula: `=IF(${A}${rQ}<0.25,"${BANDS[0]}",IF(${A}${rQ}<0.5,"${BANDS[1]}",IF(${A}${rQ}<0.75,"${BANDS[2]}","${BANDS[3]}")))`,
      explain: "Read R² as a percentage of the variation in Y explained by X. Close to 1: the line fits the data well; close to 0: X tells you little about Y.",
    });
    return {
      tab: "Sums of squares", title: "Sums of squares and R²",
      text: [
        `${ctx.who} ${n} ${UNITS[ctx.xs]}: ${ctx.x} (X) and ${ctx.y} (Y), in B${top}:D${T.last}.`,
        "Split the variation in Y into the part the line of best fit explains and the part it leaves over, then find R² and say what it means.",
        "Fill the yellow cells with formulas. Do not round.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        "Run Data > Data Analysis > Regression: Input Y Range = the Y column with its header, Input X Range = the X column with its header, tick Labels, output to an empty cell. Self-check: the ANOVA table's SS column (Regression, Residual, Total) and R Square match your cells.",
      ],
    };
  },
};

const report: BlockMaker = {
  key: "l19.report",
  title: "Reading the Toolpak Regression report",
  make(rng): Block {
    const ctx = pick(rng, SIMPLE);
    const n = int(rng, 12, 20);
    const strong = rng() < 0.5;
    let x: number[] = [], y: number[] = [];
    for (let k = 0; k < 60; k++) {
      const target = strong ? 0.62 + 0.3 * rng() : 0.1 + 0.28 * rng();
      ({ x, y } = simpleData(rng, ctx, n, Math.sqrt((target * (n - 2)) / (1 - target))));
      const r2 = correl(x, y) ** 2;
      if (strong ? r2 > 0.55 : r2 < 0.45) break;
    }
    const o = ols([x], y);
    const S = new Sheet();
    const top = TOP + 1;
    const T = S.table("B", top, ["Obs", ctx.x, ctx.y], x.map((v, i) => [i + 1, v, y[i]]));
    const yr = T.cols[ctx.y].range;
    const R = writeReport(S, "F", top, [ctx.x], o);
    const q = Math.max(T.last, R.bottom) + 2;
    const A = "H";
    const x0 = pickX0(rng, x, ctx.xd);
    S.header(`B${q}`, "Question").header(`${A}${q}`, "Your answer");
    S.label(`B${q + 1}`, `${ctx.xs} to predict at`).given(`${A}${q + 1}`, x0);
    const [b0, b1] = o.b;
    const rP = q + 2, rQ = q + 3, rU = q + 4, rR = q + 5, rT = q + 6, rM = q + 7;
    put(S, `B${rP}`, {
      label: `Predicted ${ctx.ys.toLowerCase()} at that ${ctx.xs.toLowerCase()} (use the Coefficients column)`, cell: `${A}${rP}`, answer: b0 + b1 * x0,
      formula: `=${R.coef[0]}+${A}${q + 1}*${R.coef[1]}`,
      explain: "The Intercept and X coefficients are the y-intercept and slope of the line of best fit: prediction = intercept + X × slope.",
      traps: [{ value: b1 + b0 * x0, why: "Swapped the intercept and the slope." }, { value: o.se[0] + o.se[1] * x0, why: "Used the Standard Error column, not the Coefficients." }],
    });
    put(S, `B${rQ}`, {
      label: "R² from the ANOVA table (Regression SS ÷ Total SS)", cell: `${A}${rQ}`, answer: o.r2, formula: `=${R.ssR}/${R.ssT}`, format: "prob",
      explain: "Regression SS ÷ Total SS is R², the same number the report prints as R Square.",
      traps: [{ value: o.multR, why: "Multiple R is r (in size), not R²." }, { value: o.sse / o.sst, why: "Residual ÷ Total is the unexplained share." }],
    });
    put(S, `B${rU}`, {
      label: "Share of the variation in Y the line does NOT explain", cell: `${A}${rU}`, answer: o.sse / o.sst, formula: `=${R.ssE}/${R.ssT}`, format: "prob",
      explain: "Residual SS ÷ Total SS = 1 − R².",
    });
    const r = b1 < 0 ? -o.multR : o.multR;
    put(S, `B${rR}`, {
      label: "Correlation coefficient r, with its sign", cell: `${A}${rR}`, answer: r, formula: `=IF(${R.coef[1]}<0,-SQRT(${R.r2}),SQRT(${R.r2}))`,
      explain: "In simple regression Multiple R = √R² = the size of r; r takes the sign of the slope. CORREL(X range, Y range) gives the same.",
      traps: [{ value: -r, why: "Multiple R is never negative; r has the sign of the slope." }, { value: o.r2, why: "That is R², not r." }],
    });
    put(S, `B${rT}`, {
      label: "Total SS straight from the data (DEVSQ), to check the report", cell: `${A}${rT}`, answer: o.sst, formula: `=DEVSQ(${yr})`,
      explain: "The Total SS is Σ(y − ȳ)², which DEVSQ computes from the Y column.",
    });
    put(S, `B${rM}`, {
      label: "Does the line explain most (over half) of the variation in Y? Yes or No", cell: `${A}${rM}`, answer: o.r2 > 0.5 ? "Yes" : "No", options: ["Yes", "No"],
      formula: `=IF(${A}${rQ}>0.5,"Yes","No")`,
      explain: o.r2 > 0.5
        ? "R² is above 0.5: X explains most of the variation in Y, so the linear model is fairly effective."
        : "R² is below 0.5: most of the variation in Y comes from other things, so the linear model is not very effective on its own.",
    });
    return {
      tab: "Toolpak report", title: "Reading a Regression report",
      text: [
        `${ctx.who} ${n} ${UNITS[ctx.xs]}: ${ctx.x} (X) and ${ctx.y} (Y), in B${top}:D${T.last}.`,
        `The Toolpak's Regression report for these data is in F${top}:L${R.bottom}. Answer the questions using cells of the report.`,
        "Fill the yellow cells with formulas. Do not round.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        "Produce the report yourself: Data > Data Analysis > Regression, Input Y Range = the Y column (with header), Input X Range = the X column (with header), tick Labels, output to an empty cell. Self-check: every number matches the report in the sheet.",
      ],
    };
  },
};

// =====================================================================================================
// The lesson
// =====================================================================================================

const BETA_NOTE = "BETA: this lesson has not been taught yet (Mon 30 Nov). It is built from last spring's final announcement, the Spring 2026 and Fall 2025 finals and the textbook, and will be replaced by Dr Arathoon's own notes once taught.";

export const LESSON_19: Lesson = {
  n: 19,
  title: "Introduction to simple linear regression",
  unit: 3,
  week: "Week 14 · Mon 30 Nov · Introduction to regression",
  beta: true,
  sources: [
    "Final announcement.docx (Spring 2026: the simple linear regression syllabus)",
    "Final.docx and S26_Final.xlsx (Spring 2026 Final, Q39–Q40)",
    "S26_Final, solutions.xlsx (Regression sheet)",
    "F25_Final.xlsx (Residual Analysis sheet, Q1–Q2)",
    "Lesson 3, notes.xlsx (dependent and independent variables, scatter charts)",
    "Copy of Exam 2 Additional Practice Problems.xlsx (CORREL)",
    "Textbook: Berenson, Levine, Szabat, Basic Business Statistics, 14th ed., simple linear regression chapter",
  ],
  summary: "Simple linear regression fits the straight line ŷ = b₀ + b₁x that best describes how a dependent variable Y depends on an independent variable X, and uses it to make predictions. The Toolpak's Regression report gives the line, the sums of squares and R², the share of the variation in Y that the line explains.",
  defs: [
    { term: "Independent and dependent variables", text: "A dependent variable depends on the independent variable. An independent variable doesn't depend on anything. The horizontal axis is X (independent), the vertical axis is Y (dependent). Decide which is which from the context, not from the order of the columns.", source: "Lesson 3, notes › Charts B5–B13; Spring 2026 Final announcement" },
    { term: "Scatter plot with a trendline", text: "To show the relationship between paired sample data, plot the pairs as a scatter chart (X horizontal, Y vertical) and add a linear trendline: the line of best fit drawn through the points.", source: "Spring 2026 Final announcement (regression bullet 1); Spring 2026 Final Q39" },
    { term: "Simple linear regression model", text: "Y = β₀ + β₁X + ε: Y is a straight-line function of X plus a random error ε. β₀ (y-intercept) and β₁ (slope) are the population values; the sample gives the estimates b₀ and b₁.", source: "Anticipated · textbook, simple linear regression chapter" },
    { term: "Line of best fit (least squares)", text: "ŷ = b₀ + b₁x, the line that makes the sum of the squared residuals Σ(y − ŷ)² as small as possible. Excel's trendline, SLOPE/INTERCEPT and the Toolpak's Coefficients all give this same line.", source: "Anticipated · textbook, simple linear regression chapter (least-squares method)" },
    { term: "Slope and y-intercept", text: "The slope b₁ is the change in predicted Y for each one-unit increase in X. The y-intercept b₀ is the predicted Y when X = 0 (only meaningful if X = 0 makes sense in the context).", source: "Anticipated · textbook, simple linear regression chapter" },
    { term: "Prediction", text: "To predict Y for a value of X, plug it into the line: ŷ = b₀ + b₁x. In the Spring 2026 Final the prediction for 6 bedrooms was =E26+6*E28 (intercept + 6 × slope). Predicting far outside the range of the X data (extrapolation) is unreliable.", source: "Spring 2026 Final, solutions › Regression E30; extrapolation: anticipated · textbook" },
    { term: "Toolpak Regression report", text: "Data > Data Analysis > Regression (Input Y Range, Input X Range) prints a SUMMARY OUTPUT with three blocks: Regression Statistics (Multiple R, R Square, Adjusted R Square, Standard Error, Observations), the ANOVA table (df, SS, MS, F, Significance F for the Regression, Residual and Total rows) and the coefficients table (Coefficients, Standard Error, t Stat, P-value, Lower/Upper 95%).", source: "Spring 2026 Final announcement (regression bullet 2); Spring 2026 Final, solutions › Regression K23:S40" },
    { term: "Sums of squares (TSS, RSS, ESS)", text: "The total sum of squares TSS = Σ(y − ȳ)² (Toolpak: Total SS; Excel: DEVSQ of Y) splits into the regression (explained) sum of squares Σ(ŷ − ȳ)² and the residual (unexplained, error) sum of squares Σ(y − ŷ)²: Total = Regression + Residual. His announcement names them TSS/RSS/ESS without spelling them out, and books disagree on which is RSS (residual or regression), so go by the Toolpak's row names.", source: "Spring 2026 Final announcement (regression bullet 2); split: anticipated · textbook" },
    { term: "R² (coefficient of determination)", text: "R² = Regression SS ÷ Total SS = 1 − Residual SS ÷ Total SS, between 0 and 1. It is the proportion of the variation in Y explained by the linear model: close to 1 the line fits well, close to 0 X explains little of Y. In the Spring 2026 Final, R² = 0.366: bedrooms explain about 37% of the variation in price.", source: "Spring 2026 Final announcement (regression bullet 2); Spring 2026 Final, solutions › Regression L27 = M34/M36" },
    { term: "Correlation coefficient r", text: "CORREL(X range, Y range) measures the strength and direction of a linear relationship, from −1 to 1. Positive: Y tends to rise with X; negative: Y tends to fall. In simple regression R² = r², and the Toolpak's Multiple R is the size of r (never negative).", source: "Copy of Exam 2 Additional Practice Problems › Ratings I22 (CORREL, 'positive correlation'); R² = r²: anticipated · textbook" },
  ],
  examples: [
    {
      title: "Property prices and bedrooms (Spring 2026 Final Q39–Q40)",
      setup: "Table 13 shows a sample of 20 properties, their price and number of bedrooms. Produce a chart showing how property price depends on bedrooms with a trendline, find the y-intercept and slope of the line of best fit and predict the price of a 6-bedroom property.",
      table: { head: ["Property", "Value (D)", "Bedrooms (E)"], rows: [[1, 243492, 5], [2, 130794, 3], [3, 461745, 4], [4, 110216, 1], ["…", "…", "…"], [20, 79132, 1]] },
      steps: [
        { say: "Price depends on bedrooms, so Value is Y and Bedrooms is X, even though the table lists Value first. Scatter chart: Bedrooms on the horizontal axis, Value on the vertical, with a linear trendline." },
        { say: "y-intercept (he copied it from the Toolpak report; the function gives the same)", formula: "=INTERCEPT(D4:D23,E4:E23)", result: "27008.0922" },
        { say: "slope", formula: "=SLOPE(D4:D23,E4:E23)", result: "87909.4757" },
        { say: "Predicted price of a 6-bedroom property, as in his solution", formula: "=E26+6*E28", result: "554464.9466" },
      ],
      takeaway: "Y is the variable that depends on the other; the prediction is intercept + x × slope.",
      source: "Spring 2026 Final, solutions › Regression E26:E30",
    },
    {
      title: "Sums of squares and R² from the same report",
      setup: "His Toolpak report for the property data (Spring 2026 Final solutions) shows the ANOVA table. Find R² and say what it means.",
      table: { head: ["ANOVA", "df", "SS"], rows: [["Regression", 1, 318396728019.32], ["Residual", 18, 550922252324.48], ["Total", 19, 869318980343.80]] },
      steps: [
        { say: "Check the split: Regression SS + Residual SS = Total SS", formula: "=M34+M35", result: "869318980343.80 (= M36)" },
        { say: "R² = Regression SS ÷ Total SS (the report prints it as R Square in L27)", formula: "=M34/M36", result: "0.366260" },
        { say: "Total SS straight from the data", formula: "=DEVSQ(D4:D23)", result: "869318980343.80" },
        { say: "Interpretation: about 37% of the variation in property price is explained by the number of bedrooms; the other 63% comes from other things (location, size, condition…), so the line is only a moderately effective model." },
      ],
      takeaway: "R² is the share of the variation in Y the line explains.",
      source: "Spring 2026 Final, solutions › Regression K32:P36 and L27 (the interpretation is ours: that final did not ask for it)",
    },
    {
      title: "Nobel prizes and population (Lesson 3 data)",
      setup: "His Lesson 3 scatter example asks how a country's population affects the number of Nobel prizes awarded (9 countries, population in millions in F11:F19, prizes in G11:G19). Fit the line and predict for a country of 100 million.",
      steps: [
        { say: "His notes: dependent variable = number of Nobel prizes, independent variable = population. So Y = G11:G19, X = F11:F19." },
        { say: "slope", formula: "=SLOPE(G11:G19,F11:F19)", result: "1.0866" },
        { say: "y-intercept", formula: "=INTERCEPT(G11:G19,F11:F19)", result: "−5.5582" },
        { say: "R²", formula: "=RSQ(G11:G19,F11:F19)", result: "0.7389" },
        { say: "Prediction for 100 million people", formula: "=FORECAST.LINEAR(100,G11:G19,F11:F19)", result: "103.11" },
      ],
      takeaway: "Each extra million people goes with about 1.09 more prizes in this sample, but the US (342 million, 425 prizes) pulls the line a lot.",
      source: "Lesson 3, notes › Scatter C5:G19 (the variables and data are his; the regression is our worked addition)",
    },
  ],
  quiz: [
    { q: "The Spring 2026 Final's Table 13 listed Value (price) in the first column and Bedrooms in the second. Which is the dependent variable?", options: ["Value, because price depends on the number of bedrooms", "Bedrooms, because it is in the second column", "Bedrooms, because it is the smaller number", "Either, it makes no difference to the line"], answer: 0, why: "The dependent variable is the one that depends on the other. The column order means nothing, and swapping X and Y gives a different line." },
    { q: "Which formula gives the slope of the line of best fit when Y is in D4:D23 and X is in E4:E23?", options: ["=SLOPE(D4:D23,E4:E23)", "=SLOPE(E4:E23,D4:D23)", "=CORREL(D4:D23,E4:E23)", "=RSQ(D4:D23,E4:E23)"], answer: 0, why: "SLOPE(known_y's, known_x's): the Y range first." },
    { q: "The line of best fit is chosen to…", options: ["make the sum of the squared residuals as small as possible", "pass through the first and last points", "make the residuals all positive", "make R² equal to 1"], answer: 0, why: "Least squares: the best-fit line minimises Σ(y − ŷ)²." },
    { q: "A regression gives R² = 0.37. What does that mean?", options: ["37% of the variation in Y is explained by the linear relationship with X", "37% of the predictions are correct", "The slope is 0.37", "Y increases by 37% when X increases by 1"], answer: 0, why: "R² = Regression SS ÷ Total SS: the proportion of the variation in Y explained by the model." },
    { q: "In the Toolpak's ANOVA table, which identity always holds?", options: ["Total SS = Regression SS + Residual SS", "Regression SS = Total SS + Residual SS", "Residual SS = Total SS × R²", "Total SS = Regression SS × Residual SS"], answer: 0, why: "The total variation splits into the explained (regression) part and the unexplained (residual) part." },
    { q: "Which Excel formula gives the Total SS of Y (in D4:D23) that the Toolpak reports?", options: ["=DEVSQ(D4:D23)", "=VAR.S(D4:D23)", "=SUMSQ(D4:D23)", "=STDEV.S(D4:D23)^2"], answer: 0, why: "Total SS = Σ(y − ȳ)², which is DEVSQ. VAR.S divides it by n − 1; SUMSQ squares the raw values without subtracting the mean." },
    { q: "Fuel economy (mpg) is regressed on engine size (litres) and the slope is −5.2. What does the slope say?", options: ["Each extra litre of engine size goes with about 5.2 fewer predicted mpg", "Cars with bigger engines get 5.2 more mpg", "5.2% of the variation in mpg is explained", "A car with no engine gets −5.2 mpg"], answer: 0, why: "The slope is the change in predicted Y per one-unit increase in X; negative means Y falls as X rises." },
    { q: "In a simple regression with a negative slope, the Toolpak shows Multiple R = 0.8. What is the correlation coefficient r?", options: ["−0.8", "0.8", "0.64", "−0.64"], answer: 0, why: "Multiple R is the size of r and is never negative; r takes the sign of the slope. R² = 0.64." },
    { q: "The bedroom data run from 1 to 5 bedrooms. Why be careful predicting the price of a 12-bedroom house?", options: ["It is far outside the range of the data (extrapolation), so the line may not hold there", "The prediction formula only works for whole numbers", "You must use the Residual SS instead", "Excel cannot predict beyond 10"], answer: 0, why: "A fitted line describes the relationship inside the observed range of X; extrapolating beyond it is unreliable." },
  ],
  excel: [
    { fn: "Scatter chart + trendline", use: "Select the X and Y columns, Insert > Scatter, X on the horizontal axis. Right-click a point > Add Trendline > Linear; tick Display Equation and Display R-squared value." },
    { fn: "SLOPE / INTERCEPT", use: "=SLOPE(Y range, X range) and =INTERCEPT(Y range, X range): the line of best fit. The Y range always goes first." },
    { fn: "FORECAST.LINEAR", use: "=FORECAST.LINEAR(x, Y range, X range) predicts Y at x on the line of best fit; same as intercept + x × slope." },
    { fn: "CORREL / RSQ", use: "=CORREL(X range, Y range) gives r (−1 to 1); =RSQ(Y range, X range) gives R² = r²." },
    { fn: "DEVSQ", use: "=DEVSQ(Y range) is the Total SS, Σ(y − ȳ)²." },
    { fn: "Data Analysis Toolpak > Regression", use: "Input Y Range = the dependent column, Input X Range = the independent column (tick Labels if you include the headers), choose an output cell. The report gives the coefficients, the ANOVA sums of squares and R Square." },
  ],
  watch: [
    BETA_NOTE,
    "Spring 2026 Final Q39–Q40 (6 of the 10 regression points): a scatter chart with a trendline showing how price depends on bedrooms, the y-intercept and slope (marked correct to 3 d.p.) and a prediction for 6 bedrooms. The table listed the dependent variable (Value) before the independent one (Bedrooms).",
    "Fall 2025 Final, Residual Analysis Q1–Q2: a scatter chart with a trendline of exam score against hours studied, the slope and y-intercept (to 3 d.p.) and the R-squared score.",
    "The Spring 2026 announcement says you must find 'the squared sums (TSS/RSS/ESS)' from the Toolpak report and interpret R². The acronyms are not defined in any file we have: answer with the Toolpak's own Total / Regression / Residual rows and say which you mean.",
    "Common slips: putting X first in SLOPE/INTERCEPT; X on the vertical axis; a line chart instead of a scatter chart; typing rounded coefficients (use the cells, he grades the exact value); reading Multiple R as R².",
  ],
  makers: [line, sums, report],
};
