// Lesson 4: Numerical descriptive measures (Week 3, Mon 14 Sep and the "…continued" class Wed 16 Sep).
// Built from "Lesson 4, notes" (Sampling, Central Tendency, Dispersion), "Lesson 4, Data" (Computer Repair Times)
// and "Homework 3, solutions" (the same sheet, filled in by the professor).
import { Sheet, gauss, int, pick, round, TOP, type Block, type BlockMaker, type Rng, type Trap } from "./kit.ts";
import type { Lesson } from "./types.ts";

// ---------- local statistics helpers (independent of the formula engine) ----------
const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
const devsq = (x: number[]) => { const m = mean(x); return x.reduce((s, v) => s + (v - m) ** 2, 0); };
const varS = (x: number[]) => devsq(x) / (x.length - 1);
const varP = (x: number[]) => devsq(x) / x.length;
const sorted = (x: number[]) => [...x].sort((a, b) => a - b);
/** Excel's PERCENTILE.INC / QUARTILE.INC rule: position p(n − 1) in the sorted data, interpolated. */
function pctInc(x: number[], p: number) {
  const s = sorted(x), h = p * (s.length - 1), lo = Math.floor(h);
  return lo + 1 >= s.length ? s[lo] : s[lo] + (h - lo) * (s[lo + 1] - s[lo]);
}
/** Excel's PERCENTILE.EXC / QUARTILE.EXC rule: position p(n + 1), interpolated; NaN where Excel gives #NUM!. */
function pctExc(x: number[], p: number) {
  const s = sorted(x), n = s.length, h = p * (n + 1);
  if (h < 1 || h > n) return NaN;
  const lo = Math.floor(h);
  return lo >= n ? s[n - 1] : s[lo - 1] + (h - lo) * (s[lo] - s[lo - 1]);
}
const median = (x: number[]) => pctInc(x, 0.5);
function counts(x: number[]) { const m = new Map<number, number>(); for (const v of x) m.set(v, (m.get(v) ?? 0) + 1); return m; }
/** Make the most common value unique (so MODE.SNGL has one clear answer): give one tied value an extra copy. */
function forceMode(rng: Rng, x: number[]): number[] {
  const c = counts(x);
  const best = Math.max(...c.values());
  const tied = [...c.keys()].filter((v) => c.get(v) === best);
  // Prefer the tied value nearest the median, so the mode sits where the data bunch up.
  const md = median(x);
  const near = Math.min(...tied.map((v) => Math.abs(v - md)));
  const m = pick(rng, tied.filter((v) => Math.abs(v - md) === near));
  const others = x.map((v, i) => (v === m ? -1 : i)).filter((i) => i >= 0);
  const out = [...x];
  out[pick(rng, others)] = m;
  return out;
}
function modeOf(x: number[]) {
  const c = counts(x);
  const best = Math.max(...c.values());
  return x.find((v) => c.get(v) === best)!;
}
/** Keep only traps that are clearly different from the right answer. */
const traps = (answer: number, tol: number, ts: Trap[], alts: number[] = []): Trap[] =>
  ts.filter((t) => Number.isFinite(t.value) && [answer, ...alts].every((a) => Math.abs(t.value - a) > 1.5 * tol + 1e-9));
/** The .EXC value as an accepted alternative, when Excel can compute it and it differs from the .INC key. */
const altsFor = (inc: number, exc: number, tol: number): number[] => (Number.isFinite(exc) && Math.abs(exc - inc) > tol ? [exc] : []);
const EXC_OK = "QUARTILE.EXC/PERCENTILE.EXC also count: he has used both (.EXC on this term's Exam 1 key).";
const defTol = (a: number) => Math.max(0.01, 0.002 * Math.abs(a));

// ---------- Q1: the Homework 3 table of measures ----------
type Ctx = { head: string; story: string; gen: (rng: Rng) => number };
const RIGHT = (lo: number, scale: number) => (rng: Rng) => lo + Math.round(scale * (-Math.log(1 - rng()) - Math.log(1 - rng()) - Math.log(1 - rng())));
const NORMAL = (mu: number, sd: number) => (rng: Rng) => Math.round(mu + sd * gauss(rng));
const LEFT = (hi: number, scale: number) => (rng: Rng) => hi - Math.round(scale * (-Math.log(1 - rng()) - Math.log(1 - rng())));
const MEASURE_CTX: Ctx[] = [
  { head: "Repair time (days)", story: "A computer repair shop recorded how many days each repair took.", gen: RIGHT(4, 3) },
  { head: "Delivery time (minutes)", story: "A pizza shop recorded the delivery time of each order on a Friday night.", gen: RIGHT(15, 4) },
  { head: "Customers per hour", story: "A café counted the customers who came in during each hour it was open over a fortnight.", gen: NORMAL(42, 7) },
  { head: "Quiz score (out of 50)", story: "A professor recorded the scores on a 50-point quiz. Most students did well.", gen: (rng) => Math.min(50, LEFT(50, 4)(rng)) },
  { head: "Call length (minutes)", story: "A help desk recorded the length of each support call, to the nearest minute.", gen: RIGHT(2, 2.5) },
];

const measures: BlockMaker = {
  key: "l4.measures",
  title: "The numerical descriptive measures of a sample (Homework 3 table)",
  make(rng): Block {
    const ctx = pick(rng, MEASURE_CTX);
    const n = int(rng, 30, 42);
    let x = Array.from({ length: n }, () => ctx.gen(rng));
    x = forceMode(rng, x);
    const first = TOP + 1, last = TOP + n, R = `C${first}:C${last}`;
    const S = new Sheet();
    S.header(`B${TOP}`, "Observation ID").header(`C${TOP}`, ctx.head);
    x.forEach((v, i) => { S.set(`B${first + i}`, i + 1, "data"); S.set(`C${first + i}`, v, "data"); });
    S.header(`E${TOP}`, "Measure").header(`F${TOP}`, "Value");
    const mn = Math.min(...x), mx = Math.max(...x), m = mean(x), md = median(x), mo = modeOf(x);
    const v = varS(x), s = Math.sqrt(v), cv = s / m;
    const r = TOP + 1;
    S.ask(`E${r}`, { label: "Min", cell: `F${r}`, answer: mn, formula: `=MIN(${R})`, explain: "The smallest value: MIN of the data column." });
    S.ask(`E${r + 1}`, { label: "Max", cell: `F${r + 1}`, answer: mx, formula: `=MAX(${R})`, explain: "The largest value: MAX of the data column." });
    S.ask(`E${r + 2}`, {
      label: "Mean", cell: `F${r + 2}`, answer: m, formula: `=AVERAGE(${R})`,
      explain: "The mean (average), the 'center of mass' of the data: AVERAGE.",
      traps: traps(m, defTol(m), [{ value: md, why: "That is the median, not the mean." }]),
    });
    S.ask(`E${r + 3}`, {
      label: "Mode", cell: `F${r + 3}`, answer: mo, formula: `=MODE.SNGL(${R})`, tol: 0,
      explain: "The most common value in the sample: MODE.SNGL, as in Homework 3.",
    });
    S.ask(`E${r + 4}`, {
      label: "Median", cell: `F${r + 4}`, answer: md, formula: `=MEDIAN(${R})`,
      explain: "The value with half the data above and half below: MEDIAN (with an even count it averages the middle two).",
      traps: traps(md, defTol(md), [{ value: m, why: "That is the mean, not the median." }]),
    });
    S.ask(`E${r + 5}`, {
      label: "Var (sample variance)", cell: `F${r + 5}`, answer: v, formula: `=VAR.S(${R})`,
      explain: "This is a sample, so use the sample variance (divide by n − 1): VAR.S.",
      traps: traps(v, defTol(v), [{ value: varP(x), why: "VAR.P is the population variance (divides by n). This is a sample: use VAR.S." }, { value: s, why: "That is the standard deviation; the variance is its square." }]),
    });
    S.ask(`E${r + 6}`, {
      label: "Stdev (sample standard deviation)", cell: `F${r + 6}`, answer: s, formula: `=STDEV.S(${R})`,
      explain: "The sample standard deviation S, the square root of the sample variance: STDEV.S.",
      traps: traps(s, defTol(s), [{ value: Math.sqrt(varP(x)), why: "STDEV.P is the population version. This is a sample: use STDEV.S." }, { value: v, why: "That is the variance; the standard deviation is its square root." }]),
    });
    S.ask(`E${r + 7}`, {
      label: "CV (coefficient of variation)", cell: `F${r + 7}`, answer: cv, formula: `=F${r + 6}/F${r + 2}`, tol: 0.0005,
      explain: "In Homework 3 the CV is the standard deviation divided by the mean: =Stdev/Mean.",
      traps: traps(cv, 0.0005, [{ value: m / s, why: "Upside down: CV = standard deviation ÷ mean." }, { value: Math.sqrt(varP(x)) / m, why: "Used the population standard deviation (STDEV.P)." }]),
    });
    S.ask(`E${r + 8}`, {
      label: "Range", cell: `F${r + 8}`, answer: mx - mn, formula: `=F${r + 1}-F${r}`,
      explain: "Range = maximum − minimum.",
    });
    S.ask(`E${r + 9}`, {
      label: "Mid range", cell: `F${r + 9}`, answer: (mx + mn) / 2, formula: `=AVERAGE(F${r},F${r + 1})`,
      explain: "Homework 3's mid range is the average of the minimum and the maximum.",
      traps: traps((mx + mn) / 2, defTol((mx + mn) / 2), [{ value: (mx - mn) / 2, why: "That is half the range. The mid range is (min + max)/2." }]),
    });
    return {
      tab: "Descriptive measures", title: "Numerical descriptive measures",
      text: [
        `${ctx.story} The ${n} values are in column C.`,
        "Fill the yellow cells with formulas that point at the data, as in Homework 3. Treat the data as a sample.",
        "Do not round: leave every answer as exact as possible.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        "Run Data > Data Analysis > Descriptive Statistics on column C (tick Labels and Summary statistics). Self-check: its Mean, Median, Mode, Standard Deviation, Sample Variance, Range, Minimum and Maximum match your cells.",
      ],
    };
  },
};

// ---------- Q2: quartiles, IQR, whiskers and a percentile ----------
const QUART_CTX = [
  { head: "Call length (minutes)", story: "A help desk timed a sample of support calls.", mu: 8, sd: 2.5, skew: 1 },
  { head: "Order value ($)", story: "An online shop recorded the value of a sample of orders.", mu: 45, sd: 12, skew: 1 },
  { head: "Commute (km)", story: "A company asked a sample of employees how far they commute.", mu: 18, sd: 6, skew: 1 },
  { head: "Battery life (hours)", story: "A lab measured the battery life of a sample of phones.", mu: 21, sd: 2, skew: 0 },
];
const quartiles: BlockMaker = {
  key: "l4.quartiles",
  title: "Quartiles, IQR, whiskers and percentiles (QUARTILE.INC, PERCENTILE.INC)",
  make(rng): Block {
    const ctx = pick(rng, QUART_CTX);
    const n = int(rng, 21, 41);
    const x = Array.from({ length: n }, () => {
      const g = ctx.skew ? (-Math.log(1 - rng()) - 1) * 1.1 + 0.3 * gauss(rng) : gauss(rng);
      return Math.max(round(ctx.sd * 0.2, 1), round(ctx.mu + ctx.sd * g, 1));
    });
    const first = TOP + 1, last = TOP + n, R = `$B$${first}:$B$${last}`;
    const S = new Sheet();
    S.header(`B${TOP}`, ctx.head);
    x.forEach((v, i) => S.set(`B${first + i}`, v, "data"));
    S.header(`D${TOP}`, "Measure").header(`E${TOP}`, "Quart").header(`F${TOP}`, "Value");
    const names = ["Min", "Quartile 1 (Q1)", "Quartile 2 (Q2)", "Quartile 3 (Q3)", "Max"];
    const q = [0, 1, 2, 3, 4].map((k) => pctInc(x, k / 4));
    const qe = [0, 1, 2, 3, 4].map((k) => (k === 0 || k === 4 ? NaN : pctExc(x, k / 4)));
    const iqrE = qe[3] - qe[1], upE = qe[3] + 1.5 * iqrE, loE = qe[1] - 1.5 * iqrE;
    const r = TOP + 1;
    names.forEach((nm, k) => {
      S.given(`E${r + k}`, k);
      S.ask(`D${r + k}`, {
        label: nm, cell: `F${r + k}`, answer: q[k], formula: `=QUARTILE.INC(${R},E${r + k})`,
        explain: k === 0 ? "QUARTILE.INC with quart 0 gives the minimum." : k === 4 ? "QUARTILE.INC with quart 4 gives the maximum." : k === 2 ? `Quartile 2 is the median. ${EXC_OK}` : `QUARTILE.INC(data, ${k}) gives the ${k * 25}% point, as in Homework 3. ${EXC_OK}`,
        alts: altsFor(q[k], qe[k], defTol(q[k])),
      });
    });
    const range = q[4] - q[0], mid = (q[0] + q[4]) / 2, iqr = q[3] - q[1];
    const r2 = r + 6;
    S.ask(`D${r2}`, { label: "Range", cell: `F${r2}`, answer: range, formula: `=F${r + 4}-F${r}`, explain: "Range = max − min." });
    S.ask(`D${r2 + 1}`, { label: "Mid range", cell: `F${r2 + 1}`, answer: mid, formula: `=AVERAGE(F${r},F${r + 4})`, explain: "Mid range = the average of the min and the max." });
    S.ask(`D${r2 + 2}`, {
      label: "IQR", cell: `F${r2 + 2}`, answer: iqr, formula: `=F${r + 3}-F${r + 1}`,
      explain: `Interquartile range = Q3 − Q1: the spread of the middle half of the data. Q3 − Q1 from ${EXC_OK}`,
      alts: altsFor(iqr, iqrE, defTol(iqr)),
      traps: traps(iqr, defTol(iqr), [{ value: range, why: "That is the range (max − min), not the IQR (Q3 − Q1)." }], altsFor(iqr, iqrE, defTol(iqr))),
    });
    const up = q[3] + 1.5 * iqr, lo = q[1] - 1.5 * iqr;
    S.ask(`D${r2 + 3}`, {
      label: "Upper whisker (Q3 + 1.5·IQR)", cell: `F${r2 + 3}`, answer: up, formula: `=F${r + 3}+1.5*F${r2 + 2}`,
      explain: `As in the Lesson 4 data sheet: upper whisker = Q3 + 1.5 × IQR (on a boxplot, if this is higher than the max it stops at the max). Quartiles from ${EXC_OK}`,
      alts: altsFor(up, upE, defTol(up)),
      traps: traps(up, defTol(up), [{ value: q[3] + iqr, why: "Forgot the 1.5: it is Q3 + 1.5 × IQR." }, { value: q[4] + 1.5 * iqr, why: "Start from Q3, not the max." }], altsFor(up, upE, defTol(up))),
    });
    S.ask(`D${r2 + 4}`, {
      label: "Lower whisker (Q1 − 1.5·IQR)", cell: `F${r2 + 4}`, answer: lo, formula: `=F${r + 1}-1.5*F${r2 + 2}`,
      explain: `Lower whisker = Q1 − 1.5 × IQR (on a boxplot, if this is lower than the min it stops at the min). Quartiles from ${EXC_OK}`,
      alts: altsFor(lo, loE, defTol(lo)),
      traps: traps(lo, defTol(lo), [{ value: q[1] - iqr, why: "Forgot the 1.5: it is Q1 − 1.5 × IQR." }], altsFor(lo, loE, defTol(lo))),
    });
    // A percentile, asked the way the exams ask it.
    const style = pick(rng, [
      { k: 0.1, ask: "Value that 90% of the observations are greater than" },
      { k: 0.9, ask: "Value that 90% of the observations are less than" },
      { k: 0.05, ask: "Value that 95% of the observations are greater than" },
      { k: 0.95, ask: "Value that 95% of the observations are less than" },
      { k: 0.2, ask: "Value that 80% of the observations are greater than" },
    ]);
    const pv = pctInc(x, style.k), wrong = pctInc(x, 1 - style.k), pAlts = altsFor(pv, pctExc(x, style.k), defTol(pv));
    S.ask(`D${r2 + 6}`, {
      label: style.ask, cell: `F${r2 + 6}`, answer: pv, formula: `=PERCENTILE.INC(${R},${style.k})`,
      explain: `The k-th percentile has a fraction k of the data below it, so this is PERCENTILE.INC(data, ${style.k}) (PERCENTILE.EXC(data, ${style.k}) also counts: he has used both).`,
      alts: pAlts,
      traps: traps(pv, defTol(pv), [{ value: wrong, why: `Used k = ${round(1 - style.k, 2)}. "${Math.round((style.k < 0.5 ? 1 - style.k : style.k) * 100)}% ${style.k < 0.5 ? "greater" : "less"} than" means a fraction ${style.k} of the data lies below the value.` }, { value: pctExc(x, 1 - style.k), why: `Used k = ${round(1 - style.k, 2)} (with PERCENTILE.EXC). A fraction ${style.k} of the data lies below the value.` }], pAlts),
    });
    return {
      tab: "Quartiles and IQR", title: "Quartiles, IQR and whiskers",
      text: [
        `${ctx.story} The ${n} values are in column B.`,
        "Fill the quartile table with QUARTILE.INC pointing at the quart numbers in column E (as in Homework 3), then the range, mid range, IQR and the boxplot whiskers. (QUARTILE.EXC answers are accepted too; it has no quart 0 or 4, so use MIN and MAX there.)",
        "Last, answer the percentile question with PERCENTILE.INC (or PERCENTILE.EXC).",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        "Insert a Box and Whisker chart of column B (Insert > Statistic chart > Box and Whisker). Self-check: the box runs from about Q1 to Q3 with a line at the median, and any points drawn beyond the whiskers are outside Q1 − 1.5·IQR or Q3 + 1.5·IQR. (Excel's box uses its own quartile method, so it can differ slightly from QUARTILE.INC.)",
      ],
    };
  },
};

// ---------- Q3: z-scores and outliers (Homework 3's K column) ----------
const Z_CTX = [
  { head: "Repair time (days)", story: "A computer repair shop recorded how many days each repair took.", mu: 15, sd: 4 },
  { head: "Daily sales ($00)", story: "A food truck recorded its sales (in hundreds of dollars) each day.", mu: 30, sd: 6 },
  { head: "Weight (g)", story: "A factory weighed a sample of chocolate bars.", mu: 100, sd: 3 },
  { head: "Wait time (minutes)", story: "A clinic recorded how long each patient waited.", mu: 25, sd: 7 },
];
const zscores: BlockMaker = {
  key: "l4.zscores",
  title: "Z-scores and counting outliers (|z| > 2) and extreme outliers (|z| > 3)",
  make(rng): Block {
    const ctx = pick(rng, Z_CTX);
    let x: number[] = [], n = 0, m = 0, s = 0;
    for (let tries = 0; tries < 50; tries++) {
      n = int(rng, 40, 60);
      x = Array.from({ length: n }, () => Math.round(ctx.mu + ctx.sd * gauss(rng)));
      const side = pick(rng, ["high", "high", "low", "both", "none"]);
      const nOut = side === "none" ? 0 : int(rng, 1, 3);
      for (let k = 0; k < nOut; k++) {
        const dir = side === "both" ? (k % 2 ? -1 : 1) : side === "low" ? -1 : 1;
        const far = ctx.mu + dir * ctx.sd * (2.6 + 3 * rng());
        x[int(rng, 0, n - 1)] = Math.max(1, Math.round(far));
      }
      m = mean(x); s = Math.sqrt(varS(x));
      const fences = [m + 2 * s, m - 2 * s, m + 3 * s, m - 3 * s];
      if (x.every((v) => fences.every((f) => Math.abs(v - f) > 1e-6 * s))) break;
    }
    const first = TOP + 1, last = TOP + n, R = `C${first}:C${last}`;
    const S = new Sheet();
    S.header(`B${TOP}`, "Observation ID").header(`C${TOP}`, ctx.head).header(`D${TOP}`, "Z-Score");
    x.forEach((v, i) => { S.set(`B${first + i}`, i + 1, "data"); S.set(`C${first + i}`, v, "data"); });
    S.header(`F${TOP}`, "Measure").header(`G${TOP}`, "Value");
    const r = TOP + 1;
    S.ask(`F${r}`, { label: "Mean", cell: `G${r}`, answer: m, formula: `=AVERAGE(${R})`, explain: "The sample mean x̄: AVERAGE." });
    S.ask(`F${r + 1}`, {
      label: "Stdev", cell: `G${r + 1}`, answer: s, formula: `=STDEV.S(${R})`, explain: "The sample standard deviation S: STDEV.S.",
      traps: traps(s, defTol(s), [{ value: Math.sqrt(varP(x)), why: "STDEV.P is for a population; this is a sample (STDEV.S)." }]),
    });
    const id = int(rng, 1, n), xi = x[id - 1], z = (xi - m) / s;
    S.ask(`F${r + 3}`, {
      label: `Z-score of observation ${id}`, cell: `G${r + 3}`, answer: z, formula: `=(C${first + id - 1}-G${r})/G${r + 1}`, tol: 0.001,
      explain: "Z = (Xᵢ − x̄)/S: how many standard deviations the value is from the mean. In column D he writes =(C9-$G$9)/$G$10 and fills down.",
      traps: traps(z, 0.001, [{ value: (m - xi) / s, why: "Sign flipped: it is (value − mean)/S." }, { value: (xi - m) / Math.sqrt(varP(x)), why: "Divided by the population standard deviation (STDEV.P)." }, { value: xi - m, why: "Forgot to divide by the standard deviation." }]),
    });
    const c = (k: number, gt: boolean) => x.filter((v) => (gt ? (v - m) / s > k : (v - m) / s < -k)).length;
    const asks: [string, number, boolean, string][] = [
      ["Outliers: z more than 2", 2, true, `=COUNTIF(${R},">"&(G${r}+2*G${r + 1}))`],
      ["Outliers: z less than −2", 2, false, `=COUNTIF(${R},"<"&(G${r}-2*G${r + 1}))`],
      ["Extreme outliers: z more than 3", 3, true, `=COUNTIF(${R},">"&(G${r}+3*G${r + 1}))`],
      ["Extreme outliers: z less than −3", 3, false, `=COUNTIF(${R},"<"&(G${r}-3*G${r + 1}))`],
    ];
    asks.forEach(([label, k, gt, f], j) => {
      const ans = c(k, gt);
      S.ask(`F${r + 5 + j + (j >= 2 ? 1 : 0)}`, {
        label, cell: `G${r + 5 + j + (j >= 2 ? 1 : 0)}`, answer: ans, formula: f, tol: 0,
        explain: `With a Z-score column D this is =COUNTIF(D${first}:D${last},"${gt ? ">" : "<"}"&${gt ? k : -k}), as in Homework 3. The same count without the column: z ${gt ? ">" : "<"} ${gt ? k : -k} exactly when the value is ${gt ? "above x̄ + " : "below x̄ − "}${k}S.`,
        traps: traps(ans, 0, [{ value: c(k, !gt), why: "Counted the wrong tail." }, { value: c(k, true) + c(k, false), why: "Counted both tails; this cell asks for one side only." }]),
      });
    });
    return {
      tab: "Z-scores and outliers", title: "Z-scores and outliers",
      text: [
        `${ctx.story} The ${n} values are in column C. Treat them as a sample.`,
        "Find the mean and standard deviation, then a Z-score. Column D is there for your Z-score column if you want it (not marked).",
        "An outlier has a Z-score more than 2 or less than −2; an extreme outlier more than 3 or less than −3. Count each kind, as in Homework 3.",
      ],
      cells: S.cells, parts: S.parts,
      manual: ["Fill column D with =(C9-$G$9)/$G$10 and drag it down. Self-check: COUNTIF on column D gives the same counts as your answers, and the average of column D is 0."],
    };
  },
};

// ---------- Q4: changing units (Spring 2026 Exam 1, quick questions 7–9) ----------
const units: BlockMaker = {
  key: "l4.units",
  title: "How the mean, variance and standard deviation change with units (°C to °F)",
  make(rng): Block {
    const n = int(rng, 8, 12);
    const mu = pick(rng, [36.8, 37.2, 37.6, 38.1, 38.5]), sd = pick(rng, [0.3, 0.5, 0.8, 1.1]);
    const x = Array.from({ length: n }, () => round(mu + sd * gauss(rng), 1));
    if (new Set(x).size === 1) x[0] = round(x[0] + 0.2, 1);
    const first = TOP + 1, last = TOP + n, R = `C${first}:C${last}`;
    const S = new Sheet();
    S.header(`B${TOP}`, "Measurement").header(`C${TOP}`, "Temperature (°C)");
    x.forEach((v, i) => { S.set(`B${first + i}`, i + 1, "data"); S.set(`C${first + i}`, v, "data"); });
    S.header(`E${TOP}`, "Measure").header(`F${TOP}`, "Value");
    const m = mean(x), v = varS(x), s = Math.sqrt(v);
    const mF = (9 / 5) * m + 32, vF = v * (9 / 5) ** 2, sF = s * (9 / 5);
    const r = TOP + 1;
    S.ask(`E${r}`, { label: "Mean (°C)", cell: `F${r}`, answer: m, formula: `=AVERAGE(${R})`, explain: "AVERAGE of the Celsius readings." });
    S.ask(`E${r + 1}`, {
      label: "Variance (°C)", cell: `F${r + 1}`, answer: v, formula: `=VAR.S(${R})`, explain: "A sample of readings: VAR.S.",
      traps: traps(v, defTol(v), [{ value: varP(x), why: "VAR.P is the population variance; use VAR.S for a sample." }]),
    });
    S.ask(`E${r + 2}`, {
      label: "Standard deviation (°C)", cell: `F${r + 2}`, answer: s, formula: `=SQRT(F${r + 1})`, tol: 0.001,
      explain: "The standard deviation is the square root of the variance (STDEV.S gives the same).",
      traps: traps(s, 0.001, [{ value: Math.sqrt(varP(x)), why: "Population standard deviation (STDEV.P)." }]),
    });
    S.ask(`E${r + 4}`, {
      label: "Mean (°F)", cell: `F${r + 4}`, answer: mF, formula: `=(9/5)*F${r}+32`,
      explain: "Every reading becomes (9/5)x + 32, so the mean does too: (9/5)·mean + 32.",
      traps: traps(mF, defTol(mF), [{ value: (9 / 5) * m, why: "Forgot the + 32." }]),
    });
    S.ask(`E${r + 5}`, {
      label: "Variance (°F)", cell: `F${r + 5}`, answer: vF, formula: `=F${r + 1}*(9/5)^2`,
      explain: "Adding 32 shifts every value and does not change the spread; multiplying by 9/5 multiplies the variance by (9/5)².",
      traps: traps(vF, defTol(vF), [{ value: v * (9 / 5), why: "The variance scales by (9/5)², not 9/5." }, { value: vF + 32, why: "Adding 32 does not change the variance." }, { value: (9 / 5) * v + 32, why: "The variance is not converted like a temperature: it scales by (9/5)² and ignores the + 32." }]),
    });
    S.ask(`E${r + 6}`, {
      label: "Standard deviation (°F)", cell: `F${r + 6}`, answer: sF, formula: `=F${r + 2}*9/5`, tol: 0.001,
      explain: "The standard deviation scales by 9/5 (the square root of (9/5)²); the + 32 does not affect it.",
      traps: traps(sF, 0.001, [{ value: sF + 32, why: "Adding 32 does not change the spread." }, { value: s * (9 / 5) ** 2, why: "The standard deviation scales by 9/5; it is the variance that scales by (9/5)²." }]),
    });
    return {
      tab: "Changing units", title: "Changing units: Celsius to Fahrenheit",
      text: [
        `A patient's temperature is measured ${n} times in degrees Celsius (column C). A temperature of x °C is y = (9/5)x + 32 °F.`,
        "Find the mean, variance and standard deviation in °C, then work out the same three measures in °F from your °C answers (without converting the column).",
      ],
      cells: S.cells, parts: S.parts,
      manual: ["Self-check: in column D convert each reading with =(9/5)*C9+32, then take AVERAGE, VAR.S and STDEV.S of column D. They match your °F answers."],
    };
  },
};

export const LESSON_04: Lesson = {
  n: 4,
  title: "Numerical descriptive measures",
  unit: 1,
  week: "Week 3 · Mon 14 and Wed 16 Sep · Numerical descriptive measures (both classes)",
  sources: ["Lesson 4, notes.xlsx", "Lesson 4, Data.xlsx", "Homework 3, solutions.xlsx"],
  summary:
    "A sample is summarized by a few numbers: where its center is (mean, median, mode) and how spread out it is (range, variance, standard deviation, quartiles and IQR), plus Z-scores to spot outliers. These are the statistics we compute from a sample to approximate the population's true parameters, and every exam asks for a table of them.",
  defs: [
    { term: "Parameter", text: "Numbers computed using data from the whole population. Often it is unrealistic to have data for the whole population, so we might never have the \"true\" parameter (sometimes it is impossible, when the population is theoretically infinite).", source: "Lesson 4, notes › Sampling B11–B15" },
    { term: "Sample", text: "A sub-collection of data points from the entire population. Example: measure the height of adult males in a classroom at Babson College.", source: "Lesson 4, notes › Sampling B21–B23" },
    { term: "Frame", text: "All people who could possibly be sampled.", source: "Lesson 4, notes › Sampling N28" },
    { term: "Statistic", text: "A number computed from the data in a sample. The idea is to use your sample to approximate the \"true\" parameters of the population. Caution: the statistic is trying to be close to the true parameter, but in practice it can differ a lot.", source: "Lesson 4, notes › Sampling C44–C48" },
    { term: "n and Xᵢ", text: "When we take a sample we record how many samples there are, usually denoted by n. The value for each individual in the sample is denoted by an X with a sub-index (Xᵢ for individual i).", source: "Lesson 4, notes › Central Tendency B3–B7" },
    { term: "Mode", text: "The most common value in the sample/population. Excel: MODE.SNGL (Homework 3).", source: "Lesson 4, notes › Central Tendency B23" },
    { term: "Median", text: "The value for which half of the data is above and half below. With an even number of values it is the average of the middle two: =MEDIAN(1,1,2,3) gives 1.5.", source: "Lesson 4, notes › Central Tendency B27, O28" },
    { term: "Mean", text: "Otherwise known as the average (AVERAGE in Excel). The mean of the population (the \"true\" average) is denoted by the Greek letter μ; the sample mean is denoted by X with a bar above it (x̄). The average can be thought of as the \"center of mass\" of the data: the see-saw puzzle balances when the average of the positions is 0.", source: "Lesson 4, notes › Central Tendency B36–B43; Puzzle E17" },
    { term: "Range and mid range", text: "Range: the difference between the maximum and the minimum. Mid range: the average of the minimum and maximum (=AVERAGE(min, max) in Homework 3).", source: "Lesson 4, notes › Dispersion B3; Homework 3, solutions › Computer Repair Times H23–H24" },
    { term: "Variance", text: "The mean absolute difference (MAD) exists but \"no one uses it!\" Instead people use the population variance σ² = Σ(Xᵢ − μ)²/N. The sample variance has a slightly different expression: s² = Σ(Xᵢ − x̄)²/(n − 1). Excel: VAR.P for a population, VAR.S for a sample (Homework 3 uses VAR.S).", source: "Lesson 4, notes › Dispersion B7–B17 (formulas written as standard; the notes give them as equations)" },
    { term: "Standard deviation", text: "The square root of the variance. The population standard deviation is σ (sigma); the sample standard deviation is S. Excel: STDEV.S for a sample.", source: "Lesson 4, notes › Dispersion B20–B25; Homework 3, solutions H11" },
    { term: "Quartiles and IQR", text: "QUARTILE.INC(data, k) for k = 0, 1, 2, 3, 4 gives the Min, Quartile 1 (25%), Quartile 2 (50%, the median), Quartile 3 (75%) and the Max. IQR = Q3 − Q1. (His Fall 2026 Exam 1 key used QUARTILE.EXC instead, which has quart 1–3 only; this site accepts both.)", source: "Lesson 4, Data › Computer Repair Times G17–G25; Homework 3, solutions J17–J21, H25" },
    { term: "Whiskers (boxplot)", text: "Upper whisker = Q3 + 1.5·IQR (if higher than max, then equal to max). Lower whisker = Q1 − 1.5·IQR (if lower than min, then equal to min).", source: "Lesson 4, Data › Computer Repair Times G26–I27; Homework 3, solutions H26–H27" },
    { term: "Coefficient of variation (CV)", text: "The standard deviation divided by the mean: =Stdev/Mean.", source: "Lesson 4, Data › Computer Repair Times G12; Homework 3, solutions H12" },
    { term: "Z-score and outliers", text: "The Z-score of a value is (Xᵢ − x̄)/S, its distance from the mean in standard deviations. On the repair-times sheet, outliers are values with z more than 2 or less than −2, and extreme outliers have z more than 3 or less than −3.", source: "Lesson 4, Data › Computer Repair Times D3, K4–K10; Homework 3, solutions D4, L5–L10" },
    { term: "Percentile", text: "PERCENTILE.INC(data, k) gives the value with a fraction k of the data below it; Homework 3 finds the 90th percentile with k = 0.9.", source: "Homework 3, solutions › Computer Repair Times G30–I30" },
  ],
  examples: [
    {
      title: "Center on tiny samples, and the see-saw",
      setup: "Three people give their favorite numbers 1, 2, 3; then a sample 1, 2, 3, 4; then a dot plot with two dots at 1, one at 2 and one at 3. Last, the puzzle: balls at −6, −6, 1, 3, 3, 5 on a see-saw.",
      steps: [
        { say: "Median of 1, 2, 3", formula: "=MEDIAN(C19:C21)", result: "2" },
        { say: "Mean of 1, 2, 3", formula: "=AVERAGE(C31:E31)", result: "2" },
        { say: "Median of 1, 2, 3, 4 (even count: average of the middle two)", formula: "=MEDIAN(H31:K31)", result: "2.5" },
        { say: "Mean of 1, 2, 3, 4", formula: "=AVERAGE(H31:K31)", result: "2.5" },
        { say: "Dot plot 1, 1, 2, 3: the mode is the most common value", result: "1" },
        { say: "Its median", formula: "=MEDIAN(1,1,2,3)", result: "1.5" },
        { say: "Its mean (the notes' cell averages only the axis labels 1, 2, 3; the four dots average 1.75)", formula: "=AVERAGE(1,1,2,3)", result: "1.75" },
        { say: "See-saw: the average position of the balls", formula: "=AVERAGE(C17:C22)", result: "0" },
      ],
      takeaway: "The mean is the center of mass: the see-saw balances at the average.",
      source: "Lesson 4, notes › Central Tendency; Puzzle",
    },
    {
      title: "Computer repair times: the full table",
      setup: "250 computer repair times (days) are in B4:B253. Fill the table of numerical descriptive measures.",
      steps: [
        { say: "Min and max", formula: "=MIN(B4:B253)  and  =MAX(B4:B253)", result: "5 and 40" },
        { say: "Mean", formula: "=AVERAGE(B4:B253)", result: "14.912" },
        { say: "Mode", formula: "=MODE.SNGL(B4:B253)", result: "15" },
        { say: "Median", formula: "=MEDIAN(B4:B253)", result: "14" },
        { say: "Sample variance", formula: "=VAR.S(B4:B253)", result: "35.5023" },
        { say: "Sample standard deviation", formula: "=STDEV.S(B4:B253)", result: "5.9584" },
        { say: "Coefficient of variation", formula: "=H11/H6", result: "0.3996" },
        { say: "Quartiles 0 to 4 (quart number in H17:H21)", formula: "=QUARTILE.INC($B$4:$B$253,H17) … filled down", result: "5, 11, 14, 17, 40" },
        { say: "Range and mid range", formula: "=J21-J17  and  =AVERAGE(J17,J21)", result: "35 and 22.5" },
        { say: "IQR", formula: "=J20-J18", result: "6" },
        { say: "Upper and lower whiskers", formula: "=J20+1.5*H25  and  =J18-1.5*H25", result: "26 and 2 (2 is below the min 5, so on the boxplot the whisker stops at 5)" },
        { say: "90th percentile", formula: "=PERCENTILE.INC(B4:B253,0.9)", result: "21.1" },
      ],
      takeaway: "Sample data: VAR.S and STDEV.S. Quartiles with QUARTILE.INC and the quart number 0–4.",
      source: "Homework 3, solutions › Computer Repair Times (data from Lesson 4, Data)",
    },
    {
      title: "Repair times: Z-scores and outliers",
      setup: "Using the mean (H6) and standard deviation (H11), fill the Z-score column and count the outliers.",
      steps: [
        { say: "Z-score of the first repair (18 days); anchor the mean and SD with $ and fill down", formula: "=(B4-$H$6)/$H$11", result: "0.5183" },
        { say: "Outliers above: z more than 2", formula: "=COUNTIF(D4:D253,\">\"&2)", result: "12" },
        { say: "Outliers below: z less than −2", formula: "=COUNTIF(D4:D253,\"<\"&-2)", result: "0" },
        { say: "Extreme outliers above: z more than 3", formula: "=COUNTIF(D4:D253,\">\"&3)", result: "7" },
        { say: "Extreme outliers below: z less than −3", formula: "=COUNTIF(D4:D253,\"<\"&-3)", result: "0" },
      ],
      takeaway: "All the outliers are on the high side: long repairs, a right-skewed data set (Homework 3 describes the skew as \"right skew, high\").",
      source: "Homework 3, solutions › Computer Repair Times D4, L5–L10, J14",
    },
  ],
  quiz: [
    { q: "A number computed from the data in a sample is called a…", options: ["Parameter", "Statistic", "Frame", "Population"], answer: 1, why: "A statistic comes from a sample; a parameter uses data from the whole population. We use statistics to approximate parameters." },
    { q: "What does the symbol μ denote?", options: ["Sample mean", "Population mean", "Sample standard deviation", "Population standard deviation"], answer: 1, why: "μ is the population (\"true\") mean; the sample mean is x̄ (X with a bar)." },
    { q: "What is the median of 1, 1, 2, 3?", options: ["1", "1.5", "1.75", "2"], answer: 1, why: "With an even count, the median is the average of the middle two values, 1 and 2: =MEDIAN(1,1,2,3) gives 1.5." },
    { q: "Which of these are all measures of dispersion?", options: ["Mean, median, mode", "Range, variance, standard deviation", "Mean, variance, mode", "Median, range, mode"], answer: 1, why: "Range, variance and standard deviation measure spread; mean, median and mode measure central tendency (Spring 2026 Exam 1, Q1–2)." },
    { q: "Your data are a sample of 40 repair times. Which Excel function gives the variance he wants?", options: ["VAR.P", "VAR.S", "STDEV.S", "DEVSQ"], answer: 1, why: "The sample variance divides by n − 1: VAR.S. VAR.P divides by n and is for a whole population." },
    { q: "How is the coefficient of variation computed in Homework 3?", options: ["Mean ÷ standard deviation", "Standard deviation ÷ mean", "Variance ÷ mean", "Range ÷ mean"], answer: 1, why: "CV = Stdev/Mean (=H11/H6 in the solutions)." },
    { q: "Q1 = 11 and Q3 = 17. What is the upper whisker by his formula?", options: ["23", "26", "28", "17"], answer: 1, why: "IQR = 17 − 11 = 6 and the upper whisker is Q3 + 1.5·IQR = 17 + 9 = 26 (Homework 3)." },
    { q: "A value has a Z-score of 2.5. Using the repair-times definitions, it is…", options: ["Not an outlier", "An outlier but not an extreme outlier", "An extreme outlier", "Impossible to say without the median"], answer: 1, why: "z more than 2 makes it an outlier; it would need z more than 3 to be an extreme outlier." },
    { q: "\"What purchase amount are 90% of orders greater than?\" Which formula answers it?", options: ["=PERCENTILE.INC(data,0.9)", "=PERCENTILE.INC(data,0.1)", "=QUARTILE.INC(data,0.9)", "=PERCENTILE.INC(data,90)"], answer: 1, why: "90% above means 10% below, so it is the 10th percentile: k = 0.1 (Spring 2026 Exam 1 Q7 asked exactly this)." },
    { q: "Can the mean, median and mode of a sample all be the same value?", options: ["Yes", "No"], answer: 0, why: "True: for example 2, 2, 2 or 1, 2, 2, 3 (Fall 2025 Exam 1 Part 3(c))." },
  ],
  excel: [
    { fn: "AVERAGE, MEDIAN, MODE.SNGL", use: "Mean, median and mode of a column, e.g. =AVERAGE(B4:B253)." },
    { fn: "MIN, MAX", use: "Smallest and largest values; range = MAX − MIN, mid range = AVERAGE(min, max)." },
    { fn: "VAR.S, STDEV.S", use: "Sample variance and standard deviation (divide by n − 1). He always treats the data as a sample. VAR.P/STDEV.P are the population versions." },
    { fn: "QUARTILE.INC (or QUARTILE.EXC)", use: "=QUARTILE.INC($B$4:$B$253,H17) with the quart number 0–4 in column H, filled down: Min, Q1, Q2, Q3, Max. IQR = Q3 − Q1. His Fall 2026 Exam 1 key used QUARTILE.EXC (quart 1–3 only); both are accepted here." },
    { fn: "PERCENTILE.INC (or PERCENTILE.EXC)", use: "=PERCENTILE.INC(B4:B253,0.9) for the 90th percentile; k is a fraction between 0 and 1. His exam keys have also used PERCENTILE.EXC; both are accepted here." },
    { fn: "Z-score column", use: "=(B4-$H$6)/$H$11 (value minus mean, over standard deviation), with the mean and SD cells anchored by $ so it fills down." },
    { fn: "COUNTIF", use: "Counting outliers from the Z-score column: =COUNTIF(D4:D253,\">\"&2) and =COUNTIF(D4:D253,\"<\"&-2)." },
    { fn: "SKEW, KURT", use: "Homework 3 also reports SKEW (1.70, \"right skew, high\") and KURT (4.08, \"peaked\"). The site does not mark these." },
    { fn: "Data Analysis Toolpak: Descriptive Statistics", use: "Gives the whole table at once (mean, standard error, median, mode, standard deviation, sample variance, kurtosis, skewness, range, min, max, sum, count). Homework 3 asks you to paste its output." },
    { fn: "Box and Whisker chart", use: "Insert > Statistic chart > Box and Whisker for the boxplot asked for in Homework 3 and on exams." },
  ],
  watch: [
    "Fall 2026 Exam 1 Section 2 (Random variables) (Table 4): Min, Max, Mean, Standard deviation, Q1, Q2, Q3 and IQR of 1000 simulated tip amounts. His key used QUARTILE.EXC there (Q1 = 1, Q2 = 3.911, Q3 = 7.1075), while Homework 3 and the Lesson 4 data sheet use QUARTILE.INC. He uses both, so this site accepts either .INC or .EXC for quartiles, percentiles and everything built from them (IQR, whiskers, fences). The two give slightly different numbers; .EXC has no quart 0 or 4.",
    "Fall 2025 Exam 1 Q2(c)–(e): a table of Mean, Max, Q3, Q2, Q1, Min, IQR, Range and Midrange for 4054 speedrun times; (d) \"How fast does a speedrun have to be to be in the top 5%?\" is the 5th percentile (his key shows PERCENTILE.EXC and .INC); (e) a boxplot.",
    "Spring 2026 Exam 1 Excel skills Q2–4: mean, STDEV.S, a Z-score column, then outliers (|z| > 2) and extreme outliers (|z| > 3) counted with =COUNTIF(Q5:Q476,\">2\")+COUNTIF(Q5:Q476,\"<-2\"). Q7: \"What purchase amount are 90% of orders greater than?\" is the 10th percentile.",
    "Spring 2026 Exam 1 quick questions: which measures are dispersion (range, variance, standard deviation) and which central tendency (mean, median, mode); μ is the population mean; °C to °F: the mean becomes (9/5)·38 + 32 = 100.4, the standard deviation is √variance, and the variance is multiplied by (9/5)² (the + 32 does not change spread); Q11–12 asked for dice results with median > mean > mode and median = mode < mean.",
    "Fall 2025 Exam 1 Part 3 true/false: mean, median and mode can all be equal (true); the mean is only defined for numerical data (true); the mode only for numerical data (false: categories have a mode too); the median of whole numbers is always a whole number (false: 1, 2 has median 1.5).",
    "Fall 2025 Exam 1 Part 5(e)–(f): Z-scores computed with given parameter values (mean 5, SD 0.05) instead of the sample's, then a count of values more than 3 standard deviations away.",
    "Common slips: VAR.P/STDEV.P instead of VAR.S/STDEV.S; forgetting the $ on the mean and SD in the Z-score formula, so it breaks when filled down; reading \"90% are greater than\" as k = 0.9; counting only one tail when the question asks for all outliers.",
  ],
  makers: [measures, quartiles, zscores, units],
};
