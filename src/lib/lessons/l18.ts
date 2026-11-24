// Lesson 18: the chi-squared test for a variance, and two-sample tests (Week 11, Wed 11 Nov).
// Built from "Lesson 18, notes.xlsx": Variance test (the FACT ((n−1)/σ²)S² ~ χ²_{n−1} and the steps), Exercise
// (H₀: variance ≤ 1, right tail), Two-sample (Toolpak z-Test: Two Sample for Means, known variances).
// The pooled t test and the paired test are not worked in these notes: they follow the Midterm 3 syllabus and
// Spring 2026 Exam 3 Q13–Q14 (whose formula sheet gives S_p² and ν), with the Toolpak's
// "t-Test: Two-Sample Assuming Equal Variances" for unequal sizes (ν = n_X + n_Y − 2).
import { Sheet, int, pick, round, normals, TOP, tolFor, decide, DECISIONS, type BlockMaker, type Block, type Part } from "./kit.ts";
import { normCdf, normInv, tCdf, tInv, chisqCdf, chisqInv, mean, stdevS } from "../stats.ts";
import type { Lesson } from "./types.ts";

// ---------- local helpers ----------
function clean(p: Part): Part {
  if (p.traps) {
    const tol = tolFor(p);
    const seen: number[] = [];
    p.traps = p.traps.filter((t) => {
      if (!Number.isFinite(t.value) || Math.abs(t.value - Number(p.answer)) <= 1.6 * tol) return false;
      if (seen.some((v) => Math.abs(v - t.value) <= tol)) return false;
      seen.push(t.value);
      return true;
    });
    if (!p.traps.length) delete p.traps;
  }
  return p;
}
type H0 = "eq" | "le" | "ge";
const p2 = (stat: number, cdf: (x: number) => number) => (stat < 0 ? 2 * cdf(stat) : 2 * (1 - cdf(stat)));
const p2F = (stat: number, dist: string) => (stat < 0 ? `=2*${dist}` : `=2*(1-${dist})`);
const pTail = (stat: number, cdf: (x: number) => number, h0: H0) => (h0 === "eq" ? p2(stat, cdf) : h0 === "le" ? 1 - cdf(stat) : cdf(stat));
const pTailF = (stat: number, dist: string, h0: H0) => (h0 === "eq" ? p2F(stat, dist) : h0 === "le" ? `=1-${dist}` : `=${dist}`);
const clear = (p: number, alpha: number) => (p < alpha ? p < alpha - Math.min(0.01, alpha / 2) : p > alpha + 0.01);
const r4 = (x: number) => String(round(x, 4));
const decisionPart = (cell: string, reject: boolean, formula: string, explain: string): Part => ({
  label: "Decision (R or DR)", cell, answer: decide(reject), formula, options: DECISIONS, explain,
});
/** 1, 2, 5 × 10^k at or below x. */
const nice125 = (x: number) => { const e = 10 ** Math.floor(Math.log10(x)); const m = x / e; return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * e; };
/** Toolpak-style one-tail p: the tail the statistic points into. */
const sideTail = (stat: number, cdf: (x: number) => number) => (stat < 0 ? cdf(stat) : 1 - cdf(stat));
const sideTailF = (stat: number, dist: string) => (stat < 0 ? `=${dist}` : `=1-${dist}`);
/** Critical-value parts for a statistic with inverse `inv`, laid out from row r in label column Lc / answer column Ac. */
function critParts(S: Sheet, Lc: string, Ac: string, r: number, h0: H0, alpha: number, inv: (q: number) => number, invF: (q: string) => string, aRef: string, name: string, other?: { inv: (q: number) => number; why: string }): number {
  if (h0 === "eq") {
    const c = inv(1 - alpha / 2);
    S.ask(`${Lc}${r}`, clean({ label: `${name} Critical two-tail (upper)`, cell: `${Ac}${r}`, answer: c, formula: `=${invF(`1-${aRef}/2`)}`,
      explain: "Two tails: INV(1 − α/2); the lower critical value is its negative (the Toolpak reports the positive one).",
      traps: [{ value: inv(1 - alpha), why: "That's the one-tail critical value; two tails need 1 − α/2." }, ...(other ? [{ value: other.inv(1 - alpha / 2), why: other.why }] : [])] }));
    return r + 1;
  }
  const c = h0 === "le" ? inv(1 - alpha) : inv(alpha);
  S.ask(`${Lc}${r}`, clean({ label: "critical value", cell: `${Ac}${r}`, answer: c, formula: h0 === "le" ? `=${invF(`1-${aRef}`)}` : `=${invF(aRef)}`,
    explain: h0 === "le" ? "H₀ with ≤ → right tail: INV(1 − α), positive." : "H₀ with ≥ → left tail: INV(α), negative.",
    traps: [{ value: -c, why: "Wrong tail: check the sign in H₀." }, { value: h0 === "le" ? inv(1 - alpha / 2) : inv(alpha / 2), why: "Used α/2; this test is one-tailed." }, ...(other ? [{ value: other.inv(h0 === "le" ? 1 - alpha : alpha), why: other.why }] : [])] }));
  return r + 1;
}

// ---------- Q1: the chi-squared test for a variance ----------
const VAR_CTX = [
  { story: (n: number) => `A student simulates ${n} normally distributed random variables with the RNG; the sample is below.`, what: "the variance of the RNG's numbers", sd: [0.7, 1.4], d: 3, mu: 0, unit: "" },
  { story: (n: number) => `A bottling machine's fill amounts (ml) are normally distributed. A sample of ${n} bottles is below.`, what: "the variance of the fill amounts", sd: [2, 6], d: 1, mu: 500, unit: " ml²" },
  { story: (n: number) => `A bolt factory's lengths (mm) are normally distributed. A sample of ${n} bolts is below.`, what: "the variance of the bolt lengths", sd: [0.1, 0.4], d: 2, mu: 50, unit: " mm²" },
  { story: (n: number) => `Exam scores are normally distributed. A sample of ${n} scores is below.`, what: "the variance of the scores", sd: [8, 16], d: 0, mu: 70, unit: "" },
] as const;

const variance: BlockMaker = {
  key: "l18.variance",
  title: "Chi-squared test for a variance (right or left tail)",
  make(rng): Block {
    const ctx = pick(rng, VAR_CTX);
    const h0 = pick(rng, ["le", "ge"] as const);
    const alpha = pick(rng, [0.2, 0.1, 0.05, 0.05]);
    const asSd = rng() < 0.35; // the claim is stated as a standard deviation
    const want = rng() < 0.5;
    let xs: number[] = [], h = 0, n = 0;
    for (let tries = 0; tries < 400; tries++) {
      n = int(rng, 8, 16);
      const sd = ctx.sd[0] + (ctx.sd[1] - ctx.sd[0]) * rng();
      xs = normals(rng, n, ctx.mu, sd, ctx.d);
      const s2 = stdevS(xs) ** 2;
      if (!(s2 > 0)) continue;
      const base = asSd ? Math.sqrt(s2) : s2;
      const step = nice125(base / 8);
      const cands: number[] = [];
      for (let k = 1; k <= 120; k++) {
        const c = round(step * k, 6);
        const v0 = asSd ? c * c : c;
        if (v0 < s2 / 4 || v0 > s2 * 4) continue;
        const stat = ((n - 1) / v0) * s2;
        const p = h0 === "le" ? 1 - chisqCdf(stat, n - 1) : chisqCdf(stat, n - 1);
        if ((p < alpha) === want && clear(p, alpha)) cands.push(c);
      }
      if (cands.length) { h = pick(rng, cands); break; }
    }
    const v0 = asSd ? h * h : h;
    const s2 = stdevS(xs) ** 2, stat = ((n - 1) / v0) * s2, df = n - 1;
    const p = h0 === "le" ? 1 - chisqCdf(stat, df) : chisqCdf(stat, df), reject = p < alpha;
    const c = h0 === "le" ? chisqInv(1 - alpha, df) : chisqInv(alpha, df);

    const S = new Sheet();
    const D = S.table("B", TOP + 1, ["Sample"], xs.map((v) => [v]));
    const R = D.cols.Sample.range;
    S.label(`D${TOP + 1}`, "alpha").given(`E${TOP + 1}`, alpha);
    S.label(`D${TOP + 2}`, asSd ? "hypothesized std_dev" : "hypothesized variance").given(`E${TOP + 2}`, h);
    S.header(`G${TOP + 1}`, "Question").header(`H${TOP + 1}`, "Your answer");
    const r = TOP + 2;
    const v0Ref = asSd ? `E${TOP + 2}^2` : `E${TOP + 2}`;
    S.ask(`G${r}`, { label: "n", cell: `H${r}`, answer: n, tol: 0, formula: `=COUNT(${R})`, explain: "Count the sample." });
    S.ask(`G${r + 1}`, clean({ label: "sample variance", cell: `H${r + 1}`, answer: s2, formula: `=VAR.S(${R})`, explain: "S² = VAR.S (divides by n − 1).",
      traps: [{ value: s2 * (n - 1) / n, why: "That's VAR.P. Use VAR.S." }, { value: Math.sqrt(s2), why: "That's the standard deviation; the test uses the variance S²." }] }));
    S.ask(`G${r + 2}`, clean({ label: "test_stat", cell: `H${r + 2}`, answer: stat, formula: `=((H${r}-1)/${v0Ref})*H${r + 1}`,
      explain: "The test statistic is ((n − 1)/σ₀²)·S², which follows a chi-squared distribution with n − 1 degrees of freedom if H₀ is true.",
      traps: [{ value: (n / v0) * s2, why: "Used n; it's (n − 1)." }, ...(asSd ? [{ value: ((n - 1) / h) * s2, why: "Forgot to square the hypothesized standard deviation: σ₀² is needed." }] : []),
        { value: ((n - 1) / v0) * Math.sqrt(s2), why: "Used S instead of S²." }] }));
    S.ask(`G${r + 3}`, clean({ label: "p-val", cell: `H${r + 3}`, answer: p, format: "prob",
      formula: h0 === "le" ? `=1-CHISQ.DIST(H${r + 2},H${r}-1,TRUE)` : `=CHISQ.DIST(H${r + 2},H${r}-1,TRUE)`,
      explain: h0 === "le" ? "H₀: σ² ≤ σ₀² is rejected by large statistics: right tail, 1 − CHISQ.DIST(stat, n − 1, TRUE)." : "H₀: σ² ≥ σ₀² is rejected by small statistics: left tail, CHISQ.DIST(stat, n − 1, TRUE).",
      traps: [{ value: 1 - p, why: "Wrong tail: check the sign in H₀." }, { value: h0 === "le" ? 1 - chisqCdf(stat, n) : chisqCdf(stat, n), why: "Used n degrees of freedom; it's n − 1." }] }));
    S.ask(`G${r + 4}`, clean({ label: "critical value", cell: `H${r + 4}`, answer: c,
      formula: h0 === "le" ? `=CHISQ.INV(1-E${TOP + 1},H${r}-1)` : `=CHISQ.INV(E${TOP + 1},H${r}-1)`,
      explain: h0 === "le" ? "Right tail: CHISQ.INV(1 − α, n − 1) (he wrote CHISQ.INV(0.8,9) for α = 0.2, n = 10)." : "Left tail: CHISQ.INV(α, n − 1).",
      traps: [{ value: h0 === "le" ? chisqInv(alpha, df) : chisqInv(1 - alpha, df), why: "Wrong tail: check the sign in H₀." }, { value: h0 === "le" ? chisqInv(1 - alpha, n) : chisqInv(alpha, n), why: "Used n degrees of freedom; it's n − 1." }] }));
    S.ask(`G${r + 5}`, decisionPart(`H${r + 5}`, reject, `=IF(H${r + 3}<E${TOP + 1},"R","DR")`,
      `p = ${r4(p)} ${reject ? "<" : ">"} α = ${alpha}; the statistic ${r4(stat)} is ${reject ? "inside" : "outside"} the rejection tail (critical value ${r4(c)}): ${reject ? "R" : "DR"}.`));
    const claim = asSd ? `the standard deviation is ${h0 === "le" ? "at most" : "at least"} ${h}` : `the variance is ${h0 === "le" ? "less than" : "more than"} ${h}${ctx.unit}`;
    return {
      tab: "Variance test", title: "Hypothesis test for a variance",
      text: [
        ctx.story(n),
        `Test a null hypothesis which claims that ${claim} (H₀: σ² ${h0 === "le" ? "≤" : "≥"} ${asSd ? `${h}²` : h}) with significance ${Math.round(alpha * 100)}%.`,
        "Find the test statistic, its p-value with CHISQ.DIST and the critical value with CHISQ.INV. Write R or DR.",
      ],
      cells: S.cells, parts: S.parts,
      manual: ["Practise the RNG: simulate 10 values from Normal(mean 0, std_dev 1) and test H₀: σ² ≤ 1 with α = 0.2, as in his Exercise. Self-check: most of the time you should not reject (only about 20% of honest samples are rejected)."],
    };
  },
};

// ---------- Q2: Toolpak z-Test: Two Sample for Means (known variances) ----------
const Z_CTX = [
  { story: "Use the RNG to make two different samples: X ~ N(10, 1) and Y ~ N(9, 1)", x: "X", y: "Y", mx: 10, my: 9, sx: 1, sy: 1 },
  { story: "Two filling machines put cereal into boxes (g). Machine X is known to have σ = 4 and machine Y σ = 5", x: "Machine X", y: "Machine Y", mx: 500, my: 500, sx: 4, sy: 5 },
  { story: "Two bakeries' loaves are weighed (g). Bakery X's weights are known to have σ = 8 and bakery Y's σ = 6", x: "Bakery X", y: "Bakery Y", mx: 400, my: 405, sx: 8, sy: 6 },
  { story: "Commute times (minutes) on two routes. Route X is known to have σ = 3 and route Y σ = 2", x: "Route X", y: "Route Y", mx: 25, my: 24, sx: 3, sy: 2 },
] as const;
const H0_TWO: Record<H0, (x: string, y: string) => string> = {
  eq: (x, y) => `the null hypothesis which hypothesizes both means are equal (H₀: μ_${x} = μ_${y})`,
  le: (x, y) => `the null hypothesis H₀: μ_${x} ≤ μ_${y}`,
  ge: (x, y) => `the null hypothesis H₀: μ_${x} ≥ μ_${y}`,
};

const ztwo: BlockMaker = {
  key: "l18.ztwo",
  title: "Two-sample z test with known variances (Toolpak)",
  make(rng): Block {
    const ctx = pick(rng, Z_CTX);
    const h0 = pick(rng, ["eq", "eq", "le", "ge"] as const);
    const alpha = pick(rng, [0.2, 0.1, 0.05, 0.05]);
    const nx = int(rng, 8, 14), ny = rng() < 0.5 ? nx : int(rng, 8, 14);
    const want = rng() < 0.5;
    const se = Math.sqrt(ctx.sx ** 2 / nx + ctx.sy ** 2 / ny);
    const c = h0 === "eq" ? normInv(1 - alpha / 2) : normInv(1 - alpha);
    let X: number[] = [], Y: number[] = [];
    for (let tries = 0; tries < 400; tries++) {
      X = normals(rng, nx, ctx.mx, ctx.sx, 2);
      const Y0 = normals(rng, ny, ctx.my, ctx.sy, 2);
      const far = c + 0.3 + 1.6 * rng();
      const target = h0 === "eq" ? (want ? (rng() < 0.5 ? -far : far) : (2 * rng() - 1) * (c - 0.35))
        : h0 === "le" ? (want ? far : -1.5 + rng() * (c + 1.15)) : (want ? -far : 1.5 - rng() * (c + 1.15));
      const shift = round(mean(X) - target * se - mean(Y0), 2);
      Y = Y0.map((v) => round(v + shift, 2));
      const z = (mean(X) - mean(Y)) / se;
      const p = pTail(z, normCdf, h0);
      if ((p < alpha) === want && clear(p, alpha)) break;
    }
    const mx = mean(X), my = mean(Y), z = (mx - my) / se, p = pTail(z, normCdf, h0), reject = p < alpha;

    const S = new Sheet();
    S.header(`B${TOP + 1}`, ctx.x).header(`C${TOP + 1}`, ctx.y);
    X.forEach((v, i) => S.set(`B${TOP + 2 + i}`, v, "data"));
    Y.forEach((v, i) => S.set(`C${TOP + 2 + i}`, v, "data"));
    const RX = `B${TOP + 2}:B${TOP + 1 + nx}`, RY = `C${TOP + 2}:C${TOP + 1 + ny}`;
    S.label(`E${TOP + 1}`, "alpha").given(`F${TOP + 1}`, alpha);
    S.label(`E${TOP + 2}`, `σ of ${ctx.x} (known)`).given(`F${TOP + 2}`, ctx.sx);
    S.label(`E${TOP + 3}`, `σ of ${ctx.y} (known)`).given(`F${TOP + 3}`, ctx.sy);
    S.header(`H${TOP + 1}`, "z-Test: Two Sample for Means").header(`I${TOP + 1}`, "Your answer");
    let r = TOP + 2;
    S.ask(`H${r}`, clean({ label: `Mean (${ctx.x})`, cell: `I${r}`, answer: mx, formula: `=AVERAGE(${RX})`, explain: "Variable 1's mean." }));
    S.ask(`H${r + 1}`, clean({ label: `Mean (${ctx.y})`, cell: `I${r + 1}`, answer: my, formula: `=AVERAGE(${RY})`, explain: "Variable 2's mean." }));
    S.ask(`H${r + 2}`, clean({ label: "z", cell: `I${r + 2}`, answer: z, formula: `=(I${r}-I${r + 1})/SQRT(F${TOP + 2}^2/COUNT(${RX})+F${TOP + 3}^2/COUNT(${RY}))`,
      explain: "The Toolpak's z = (x̄ − ȳ − 0)/√(σ_X²/n_X + σ_Y²/n_Y), with hypothesized mean difference 0 and the known variances σ².",
      traps: [{ value: (mx - my) / Math.sqrt(ctx.sx / nx + ctx.sy / ny), why: "Used σ instead of the variance σ² under the square root (the Toolpak asks for the known variance)." },
        { value: (mx - my) / (ctx.sx ** 2 / nx + ctx.sy ** 2 / ny), why: "Forgot the square root." }, { value: -z, why: "Subtracted the wrong way: Variable 1 minus Variable 2." }] }));
    r += 3;
    const zC = `I${TOP + 4}`;
    const dist = `NORM.S.DIST(${zC},TRUE)`;
    if (h0 === "eq") {
      const one = sideTail(z, normCdf);
      S.ask(`H${r}`, clean({ label: "P(Z<=z) one-tail", cell: `I${r}`, answer: one, format: "prob", formula: sideTailF(z, dist),
        explain: "The Toolpak's one-tail value is the tail the z points into.", traps: [{ value: 1 - one, why: "The other tail: the Toolpak reports the smaller one." }] }));
      S.ask(`H${r + 1}`, clean({ label: "P(Z<=z) two-tail", cell: `I${r + 1}`, answer: p, format: "prob", formula: p2F(z, dist),
        explain: `Double it. He checked the Toolpak with ${z > 0 ? "=(1-NORM.S.DIST(z,TRUE))*2" : "=2*NORM.S.DIST(z,TRUE) (z is negative here)"}.`,
        traps: [{ value: one, why: "That's one tail. Equal means is a two-tailed test." }] }));
      r += 2;
    } else {
      S.ask(`H${r}`, clean({ label: "p-value", cell: `I${r}`, answer: p, format: "prob", formula: pTailF(z, dist, h0),
        explain: `${h0 === "le" ? "H₀: μ_X ≤ μ_Y is rejected by large z: right tail, 1 − NORM.S.DIST(z)." : "H₀: μ_X ≥ μ_Y is rejected by small z: left tail, NORM.S.DIST(z)."} The Toolpak's "one-tail" value only matches when z points into that tail.`,
        traps: [{ value: 1 - p, why: "Wrong tail: check the sign in H₀." }, { value: 2 * Math.min(p, 1 - p), why: "Doubled it, but this test is one-tailed." }] }));
      r += 1;
    }
    const pRow = r - 1;
    r = critParts(S, "H", "I", r, h0, alpha, normInv, (q) => `NORM.S.INV(${q})`, `F${TOP + 1}`, "z");
    S.ask(`H${r}`, decisionPart(`I${r}`, reject, `=IF(I${pRow}<F${TOP + 1},"R","DR")`,
      `p = ${r4(p)} ${reject ? "<" : ">"} α = ${alpha}: ${reject ? "small p-value, R" : "DR"}.`));
    return {
      tab: "Two-sample z test", title: "Comparing two means, variances known",
      text: [
        `${ctx.story}. The two samples are below.`,
        `Use the Toolpak to perform a hypothesis test on ${H0_TWO[h0]("X", "Y")} with α = ${alpha}, assuming we know the true standard deviations (${ctx.sx} and ${ctx.sy}). Here X is the first column and Y the second.`,
        "Then reproduce the Toolpak's numbers with formulas in the yellow cells (they point at the data). Write R or DR.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [`Data > Data Analysis > z-Test: Two Sample for Means. Variable 1 = the ${ctx.x} column, Variable 2 = the ${ctx.y} column, Hypothesized Mean Difference 0, Variable 1 Variance (known) = ${ctx.sx ** 2}, Variable 2 Variance (known) = ${ctx.sy ** 2}, Alpha = ${alpha}. Self-check: its z, P(Z<=z) and z Critical match your cells.`],
    };
  },
};

// ---------- Q3: Toolpak t-Test: Two-Sample Assuming Equal Variances ----------
const T_CTX = [
  { story: "Final exam scores (out of 100) of students in two different sections", x: "Section 1", y: "Section 2", m: 72, sd: [9, 15], d: 0 },
  { story: "Property prices ($ thousands) in one town versus another", x: "Town A", y: "Town B", m: 350, sd: [30, 60], d: 0 },
  { story: "Crop yields (tonnes per field) with two fertilisers", x: "Fertiliser A", y: "Fertiliser B", m: 8, sd: [0.6, 1.2], d: 1 },
] as const;

const pooled: BlockMaker = {
  key: "l18.pooled",
  title: "Two-sample t test assuming equal variances (pooled)",
  make(rng): Block {
    const ctx = pick(rng, T_CTX);
    const h0 = pick(rng, ["eq", "eq", "le", "ge"] as const);
    const alpha = pick(rng, [0.05, 0.05, 0.1, 0.01]);
    const want = rng() < 0.5;
    const sd = ctx.sd[0] + (ctx.sd[1] - ctx.sd[0]) * rng();
    let X: number[] = [], Y: number[] = [], nx = 0, ny = 0;
    const tstat = (A: number[], B: number[]) => {
      const a = A.length, b = B.length, sp2 = ((a - 1) * stdevS(A) ** 2 + (b - 1) * stdevS(B) ** 2) / (a + b - 2);
      return (mean(A) - mean(B)) / Math.sqrt(sp2 * (1 / a + 1 / b));
    };
    for (let tries = 0; tries < 400; tries++) {
      nx = int(rng, 8, 18); ny = rng() < 0.4 ? nx : int(rng, 8, 18);
      X = normals(rng, nx, ctx.m, sd, ctx.d);
      const Y0 = normals(rng, ny, ctx.m, sd, ctx.d);
      const step = ctx.d === 0 ? 1 : 0.1;
      const cands: number[] = [];
      for (let k = -60; k <= 60; k++) {
        const Yk = Y0.map((v) => round(v + k * step, ctx.d));
        const t = tstat(X, Yk), p = pTail(t, (x) => tCdf(x, nx + ny - 2), h0);
        if ((p < alpha) === want && clear(p, alpha) && Math.abs(t) < 6) cands.push(k);
      }
      if (cands.length) { const k = pick(rng, cands); Y = Y0.map((v) => round(v + k * step, ctx.d)); break; }
    }
    const df = nx + ny - 2, vx = stdevS(X) ** 2, vy = stdevS(Y) ** 2, sp2 = ((nx - 1) * vx + (ny - 1) * vy) / df;
    const t = (mean(X) - mean(Y)) / Math.sqrt(sp2 * (1 / nx + 1 / ny));
    const tc = (x: number) => tCdf(x, df);
    const p = pTail(t, tc, h0), reject = p < alpha;

    const S = new Sheet();
    S.header(`B${TOP + 1}`, ctx.x).header(`C${TOP + 1}`, ctx.y);
    X.forEach((v, i) => S.set(`B${TOP + 2 + i}`, v, "data"));
    Y.forEach((v, i) => S.set(`C${TOP + 2 + i}`, v, "data"));
    const RX = `B${TOP + 2}:B${TOP + 1 + nx}`, RY = `C${TOP + 2}:C${TOP + 1 + ny}`;
    S.label(`E${TOP + 1}`, "alpha").given(`F${TOP + 1}`, alpha);
    S.header(`H${TOP + 1}`, "t-Test: Two-Sample Assuming Equal Variances").header(`I${TOP + 1}`, "Your answer");
    const r = TOP + 2;
    S.ask(`H${r}`, clean({ label: `Mean (${ctx.x})`, cell: `I${r}`, answer: mean(X), formula: `=AVERAGE(${RX})`, explain: "Variable 1's mean." }));
    S.ask(`H${r + 1}`, clean({ label: `Mean (${ctx.y})`, cell: `I${r + 1}`, answer: mean(Y), formula: `=AVERAGE(${RY})`, explain: "Variable 2's mean." }));
    S.ask(`H${r + 2}`, clean({ label: `Variance (${ctx.x})`, cell: `I${r + 2}`, answer: vx, formula: `=VAR.S(${RX})`, explain: "Sample variance S_X² (VAR.S).", traps: [{ value: vx * (nx - 1) / nx, why: "That's VAR.P. Use VAR.S." }] }));
    S.ask(`H${r + 3}`, clean({ label: `Variance (${ctx.y})`, cell: `I${r + 3}`, answer: vy, formula: `=VAR.S(${RY})`, explain: "Sample variance S_Y² (VAR.S).", traps: [{ value: vy * (ny - 1) / ny, why: "That's VAR.P. Use VAR.S." }] }));
    S.ask(`H${r + 4}`, clean({ label: "Pooled Variance", cell: `I${r + 4}`, answer: sp2, formula: `=((COUNT(${RX})-1)*I${r + 2}+(COUNT(${RY})-1)*I${r + 3})/(COUNT(${RX})+COUNT(${RY})-2)`,
      explain: `S_p² = ((n_X − 1)S_X² + (n_Y − 1)S_Y²)/(n_X + n_Y − 2): each variance weighted by its degrees of freedom.${nx === ny ? " With equal sizes this is (S_X² + S_Y²)/2, the Exam 3 formula." : ""}`,
      traps: nx === ny ? [{ value: Math.sqrt(sp2), why: "That's S_p; the Toolpak reports the pooled variance S_p²." }] : [{ value: (vx + vy) / 2, why: "Averaged the variances; with unequal sizes weight them by n − 1." }, { value: Math.sqrt(sp2), why: "That's S_p; the Toolpak reports the pooled variance S_p²." }] }));
    S.ask(`H${r + 5}`, { label: "df", cell: `I${r + 5}`, answer: df, tol: 0, formula: `=COUNT(${RX})+COUNT(${RY})-2`,
      explain: "ν = n_X + n_Y − 2 (2n − 2 for equal sizes).", traps: [{ value: Math.min(nx, ny) - 1, why: "That's one sample's n − 1; the pooled test has n_X + n_Y − 2." }].filter((x) => x.value !== df) });
    S.ask(`H${r + 6}`, clean({ label: "t Stat", cell: `I${r + 6}`, answer: t, formula: `=(I${r}-I${r + 1})/SQRT(I${r + 4}*(1/COUNT(${RX})+1/COUNT(${RY})))`,
      explain: "T = (x̄ − ȳ)/√(S_p²(1/n_X + 1/n_Y)), which follows a t distribution with ν = n_X + n_Y − 2.",
      traps: [{ value: (mean(X) - mean(Y)) / Math.sqrt(sp2), why: "Forgot the (1/n_X + 1/n_Y) factor." }, { value: -t, why: "Subtracted the wrong way: Variable 1 minus Variable 2." }] }));
    const tC = `I${r + 6}`;
    const dist = `T.DIST(${tC},I${r + 5},TRUE)`;
    S.ask(`H${r + 7}`, clean({ label: h0 === "eq" ? "P(T<=t) two-tail" : "p-value", cell: `I${r + 7}`, answer: p, format: "prob", formula: pTailF(t, dist, h0),
      explain: h0 === "eq" ? `Two tails, doubled by the sign of t (${t < 0 ? "negative: 2*T.DIST" : "positive: 2*(1 − T.DIST)"}).` : h0 === "le" ? "H₀: μ_X ≤ μ_Y → right tail: 1 − T.DIST(t, ν, TRUE)." : "H₀: μ_X ≥ μ_Y → left tail: T.DIST(t, ν, TRUE).",
      traps: h0 === "eq" ? [{ value: p / 2, why: "That's one tail; equal means is two-tailed." }, { value: p2(t, (x) => tCdf(x, Math.min(nx, ny) - 1)), why: "Used the wrong degrees of freedom: ν = n_X + n_Y − 2." }]
        : [{ value: 1 - p, why: "Wrong tail: check the sign in H₀." }, { value: 2 * Math.min(p, 1 - p), why: "Doubled it, but this test is one-tailed." }] }));
    const next = critParts(S, "H", "I", r + 8, h0, alpha, (q) => tInv(q, df), (q) => `T.INV(${q},I${r + 5})`, `F${TOP + 1}`, "t",
      { inv: normInv, why: "Used NORM.S.INV; σ is unknown, so T.INV with ν = n_X + n_Y − 2." });
    S.ask(`H${next}`, decisionPart(`I${next}`, reject, `=IF(I${r + 7}<F${TOP + 1},"R","DR")`, `p = ${r4(p)} ${reject ? "<" : ">"} α = ${alpha}: ${reject ? "R" : "DR"}.`));
    const hText = h0 === "eq" ? "the null hypothesis that the means for both groups are equal" : `H₀: μ_${ctx.x.replace(/ /g, "")} ${h0 === "le" ? "≤" : "≥"} μ_${ctx.y.replace(/ /g, "")}`;
    return {
      tab: "Pooled t test", title: "Comparing two means, equal variances assumed",
      text: [
        `${ctx.story}: samples of ${nx} and ${ny} are below.`,
        `Assuming the variances of both populations are the same, test ${hText} with α = ${alpha}.`,
        "Run the Toolpak (t-Test: Two-Sample Assuming Equal Variances), then reproduce its numbers with formulas in the yellow cells. Write R or DR.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [`Data > Data Analysis > t-Test: Two-Sample Assuming Equal Variances. Variable 1 = ${ctx.x}, Variable 2 = ${ctx.y}, Hypothesized Mean Difference 0, Alpha = ${alpha}. Self-check: its Pooled Variance, df, t Stat, P(T<=t) and t Critical match your cells (for a one-tailed H₀, its one-tail p only matches when t points into your rejection tail).`],
    };
  },
};

// ---------- Q4: paired test on the differences ----------
const PAIR_CTX = [
  { story: "the scores of the same students in Exams 1 and 2 (out of 100)", a: "Exam 1", b: "Exam 2", dname: "Exam 2 − Exam 1", good: "a student has improved", lo: 40, hi: 95, sd: 10, cap: 100 },
  { story: "the weekly sales (units) of the same salespeople before and after a training course", a: "Before", b: "After", dname: "After − Before", good: "sales went up", lo: 20, hi: 60, sd: 6, cap: 0 },
  { story: "the resting heart rates (bpm) of the same people before and after a month of exercise", a: "Before", b: "After", dname: "After − Before", good: "the rate went up", lo: 55, hi: 90, sd: 4, cap: 0 },
] as const;

const paired: BlockMaker = {
  key: "l18.paired",
  title: "Paired test: one-sample T test on the differences D",
  make(rng): Block {
    const ctx = pick(rng, PAIR_CTX);
    const h0 = pick(rng, ["ge", "le", "eq"] as const);
    const alpha = pick(rng, [0.05, 0.05, 0.1, 0.01]);
    const want = rng() < 0.5;
    let A: number[] = [], B: number[] = [], n = 0;
    for (let tries = 0; tries < 400; tries++) {
      n = int(rng, 10, 18);
      A = Array.from({ length: n }, () => int(rng, ctx.lo, ctx.hi));
      const noise = normals(rng, n, 0, ctx.sd, 0);
      const cands: number[] = [];
      for (let k = -15; k <= 15; k++) {
        const Bk = A.map((v, i) => (ctx.cap ? Math.min(ctx.cap, Math.max(0, v + noise[i] + k)) : v + noise[i] + k));
        const d = Bk.map((v, i) => v - A[i]), s = stdevS(d);
        if (!(s > 0)) continue;
        const t = mean(d) / (s / Math.sqrt(n)), p = pTail(t, (x) => tCdf(x, n - 1), h0);
        if ((p < alpha) === want && clear(p, alpha) && Math.abs(t) < 6) cands.push(k);
      }
      if (cands.length) {
        const k = pick(rng, cands);
        B = A.map((v, i) => (ctx.cap ? Math.min(ctx.cap, Math.max(0, v + noise[i] + k)) : v + noise[i] + k));
        break;
      }
    }
    const d = B.map((v, i) => v - A[i]);
    const dbar = mean(d), sd = stdevS(d), t = dbar / (sd / Math.sqrt(n));
    const cdf = (x: number) => tCdf(x, n - 1);
    const p = pTail(t, cdf, h0), reject = p < alpha;

    const S = new Sheet();
    S.header(`B${TOP + 1}`, ctx.a).header(`C${TOP + 1}`, ctx.b).header(`D${TOP + 1}`, `D = ${ctx.dname}`);
    const f = TOP + 2, l = TOP + 1 + n;
    for (let i = 0; i < n; i++) {
      const row = f + i;
      S.set(`B${row}`, A[i], "data").set(`C${row}`, B[i], "data");
      S.parts.push({ label: `D, row ${i + 1}`, cell: `D${row}`, answer: d[i], tol: 0, formula: `=C${row}-B${row}`,
        explain: `D = ${ctx.dname}, so D is positive when ${ctx.good}.`, traps: d[i] !== 0 ? [{ value: -d[i], why: `Subtracted the wrong way: D = ${ctx.dname}.` }] : undefined });
    }
    const DR = `D${f}:D${l}`;
    S.label(`F${TOP + 1}`, "alpha").given(`G${TOP + 1}`, alpha);
    S.header(`I${TOP + 1}`, "Question").header(`J${TOP + 1}`, "Your answer");
    const r = TOP + 2;
    S.ask(`I${r}`, { label: "n", cell: `J${r}`, answer: n, tol: 0, formula: `=COUNT(${DR})`, explain: "n is the number of pairs.", traps: [{ value: 2 * n, why: "n counts pairs, not both columns." }] });
    S.ask(`I${r + 1}`, clean({ label: "mean of D", cell: `J${r + 1}`, answer: dbar, formula: `=AVERAGE(${DR})`, explain: "D̄, the sample mean of the differences.", traps: [{ value: -dbar, why: `Wrong way round: D = ${ctx.dname}.` }] }));
    S.ask(`I${r + 2}`, clean({ label: "std dev of D", cell: `J${r + 2}`, answer: sd, formula: `=STDEV.S(${DR})`, explain: "S_D = STDEV.S of the differences.",
      traps: [{ value: sd * Math.sqrt((n - 1) / n), why: "That's STDEV.P. Use STDEV.S." }] }));
    S.ask(`I${r + 3}`, clean({ label: "test statistic", cell: `J${r + 3}`, answer: t, formula: `=(J${r + 1}-0)/(J${r + 2}/SQRT(J${r}))`,
      explain: "The paired test is a one-sample T test on D with hypothesized mean 0: T = D̄/(S_D/√n), ν = n − 1.",
      traps: [{ value: -t, why: `Wrong way round: D = ${ctx.dname}.` }, { value: dbar / sd, why: "Divided by S_D, not S_D/√n." }] }));
    const dist = `T.DIST(J${r + 3},J${r}-1,TRUE)`;
    const next = critParts(S, "I", "J", r + 4, h0, alpha, (q) => tInv(q, n - 1), (q) => `T.INV(${q},J${r}-1)`, `G${TOP + 1}`, "T",
      { inv: (q) => tInv(q, 2 * n - 2), why: "Used ν = 2n − 2 (the unpaired test). A paired test has n − 1." });
    S.ask(`I${next}`, clean({ label: "p value", cell: `J${next}`, answer: p, format: "prob", formula: pTailF(t, dist, h0),
      explain: h0 === "eq" ? `Two tails, doubled by the sign of T (${t < 0 ? "negative: 2*T.DIST" : "positive: 2*(1 − T.DIST)"}).` : h0 === "le" ? "H₀: μ_D ≤ 0 → right tail: 1 − T.DIST(T, n − 1, TRUE)." : "H₀: μ_D ≥ 0 → left tail: T.DIST(T, n − 1, TRUE).",
      traps: h0 === "eq" ? [{ value: p / 2, why: "That's one tail; H₀: μ_D = 0 is two-tailed." }] : [{ value: 1 - p, why: "Wrong tail: check the sign in H₀." }, { value: 2 * Math.min(p, 1 - p), why: "Doubled it, but this test is one-tailed." }] }));
    S.ask(`I${next + 1}`, decisionPart(`J${next + 1}`, reject, `=IF(J${next}<G${TOP + 1},"R","DR")`, `p = ${r4(p)} ${reject ? "<" : ">"} α = ${alpha}: ${reject ? "R" : "DR"}.`));
    return {
      tab: "Paired test", title: "Paired sample: test the differences",
      text: [
        `The table shows ${ctx.story}. The pairs belong together, so this is a paired sample.`,
        `Let D denote the difference ${ctx.dname} (D is positive if ${ctx.good}). Complete the D column.`,
        `Test the null hypothesis H₀: μ ${h0 === "eq" ? "=" : h0 === "le" ? "≤" : "≥"} 0 with α = ${alpha}, where μ is the hypothesized mean of D.`,
        "Write R for reject and DR for do not reject.",
      ],
      cells: S.cells, parts: S.parts,
    };
  },
};

export const LESSON_18: Lesson = {
  n: 18,
  title: "The chi-squared test for a variance, and two-sample tests",
  unit: 2,
  week: "Week 11 · Wed 11 Nov · Two sample tests, and the chi-squared test for a variance",
  sources: ["Lesson 18, notes.xlsx", "Midterm 3 announcement (Spring 2026)", "Spring 2026 Exam 3"],
  summary:
    "The sample variance follows a chi-squared distribution, so ((n − 1)/σ₀²)·S² gives a hypothesis test for a variance, with the tail decided by the sign in H₀. Then the same four steps compare two populations: a z test when both variances are known, a pooled t test when they are unknown but assumed equal, and a paired test (a one-sample T test on the differences) when the observations come in pairs.",
  defs: [
    { term: "FACT: the pdf for sample variance", text: "A sample of n independent and identical normal random variables X_i has a sample variance S² whose probability density function is given by the chi-squared distribution with n − 1 degrees of freedom: ((n − 1)/σ²)·S² ~ χ²_{n−1}.", source: "Lesson 18, notes › Variance test B8:B15 (bold) and the equation at D8" },
    { term: "The chi-squared distribution", text: "Like the t-distribution it depends on the sample size. Unlike the normal and t-distributions it is not symmetric; it is right-skewed.", source: "Lesson 18, notes › Variance test B17:B18" },
    { term: "Variance test, Steps 0–1", text: "Step 0) Start with a significance alpha. Step 1) Formulate a null hypothesis H_0: σ² ≥ σ₀² or σ² ≤ σ₀².", source: "Lesson 18, notes › Variance test B22:D24" },
    { term: "Variance test, Step 2", text: "Create your test statistic ((n − 1)/σ₀²)·S² and critical values. Find p-values using CHISQ.DIST, or critical values using CHISQ.INV.", source: "Lesson 18, notes › Variance test D26, equation at F28, D33" },
    { term: "Variance test, Step 3", text: "Reject the null if p-value < alpha or the test statistic is outside the critical values (inside the rejection tails); otherwise, don't reject.", source: "Lesson 18, notes › Variance test D35:D36" },
    { term: "Which tail", text: "H₀: σ² ≤ σ₀² (\"the variance is less than 1\") is rejected by a large statistic: right tail, p = 1 − CHISQ.DIST(stat, n − 1, TRUE), critical value CHISQ.INV(1 − α, n − 1). H₀: σ² ≥ σ₀² is the left tail: p = CHISQ.DIST(stat, n − 1, TRUE), critical value CHISQ.INV(α, n − 1).", source: "Lesson 18, notes › Exercise J10:K12 (the left tail by the same convention)" },
    { term: "Two populations", text: "Often we are interested in comparing two different populations: e.g. one class's exam scores with another; property prices in one town versus another. A typical null hypothesis might hypothesize that the mean of one population is =/>/< another population's mean.", source: "Lesson 18, notes › Two-sample B2:B6" },
    { term: "Same steps for two samples", text: "The steps in a hypothesis test remain the same: choose an alpha; formulate the hypothesis; find a test statistic which follows a sampling distribution; compute a p-value or critical values and use this to reach a conclusion.", source: "Lesson 18, notes › Two-sample B8:B9" },
    { term: "Toolpak z-Test: Two Sample for Means", text: "For known standard deviations. It reports Mean, Known Variance, Observations, Hypothesized Mean Difference, z, P(Z<=z) one-tail, z Critical one-tail, P(Z<=z) two-tail, z Critical two-tail. Its z = (x̄ − ȳ)/√(σ_X²/n_X + σ_Y²/n_Y); he checked the two-tail p with =(1−NORM.S.DIST(z,TRUE))*2.", source: "Lesson 18, notes › Two-sample K16:M27" },
    { term: "Unpaired vs paired", text: "Know the difference between an unpaired and paired two-sample. For a paired sample perform a hypothesis test on the difference between grouped pairs. For an unpaired sample be able to perform a hypothesis test assuming the variances of both samples are equal.", source: "Midterm 3 announcement (Spring 2026)" },
    { term: "Pooled t test (equal variances)", text: "Exam 3's formula sheet (equal sizes n): S_p² = (S_X² + S_Y²)/2, T = (Ȳ − X̄)/√(2S_p²/n) ~ t_ν with ν = 2n − 2. The Toolpak's t-Test: Two-Sample Assuming Equal Variances does the general case: S_p² = ((n_X − 1)S_X² + (n_Y − 1)S_Y²)/(n_X + n_Y − 2), ν = n_X + n_Y − 2.", source: "Spring 2026 Exam 3 Q14 (formulae); Excel Toolpak" },
    { term: "Paired test", text: "Let D be the difference within each pair (e.g. Exam 2 − Exam 1, positive if a student improved) and test the hypothesized mean of D: a one-sample T test, T = D̄/(S_D/√n), ν = n − 1.", source: "Spring 2026 Exam 3 Q13" },
  ],
  examples: [
    {
      title: "Is the variance less than 1?",
      setup: "Simulate 10 normally distributed random variables with mean 0 and std_dev 1 (his sample is in B6:B15). Test a null hypothesis which claims that the variance is less than 1 (H₀: σ² ≤ 1) with significance 20%.",
      steps: [
        { say: "alpha (J6) 0.2, n (J7) 10. Sample variance", formula: "=VAR.S(B6:B15)", result: "0.7685" },
        { say: "Hypothesized variance (J9) 1. Test statistic ((n − 1)/σ₀²)·S²", formula: "=((J7-1)/J9)*J8", result: "6.9161" },
        { say: "p-value: H₀ with ≤ is rejected by large values, so the right tail", formula: "=1-CHISQ.DIST(J10,J7-1,TRUE)", result: "0.6459" },
        { say: "This p-value is greater than alpha, so DR.", result: "DR" },
        { say: "Critical value (right tail, 1 − α = 0.8, ν = 9)", formula: "=CHISQ.INV(0.8,9)", result: "12.2421" },
        { say: "I do not reject the null hypothesis because my test stat is left of this.", result: "DR" },
      ],
      takeaway: "((n − 1)/σ₀²)·S² ~ χ²_{n−1}; the sign in H₀ picks the tail.",
      source: "Lesson 18, notes › Exercise",
    },
    {
      title: "Two samples, known standard deviations (Toolpak)",
      setup: "Use the RNG to make two different samples (each size 10): X ~ N(10,1), Y ~ N(9,1). Use the Toolpak to test the null hypothesis that both means are equal with α = 20%, assuming we know the true standard deviations (1 for both).",
      steps: [
        { say: "Data > Data Analysis > z-Test: Two Sample for Means; variances (known) 1 and 1, hypothesized mean difference 0, alpha 0.2. Means reported", result: "9.8082 and 8.3951" },
        { say: "z (reproduce it: (x̄ − ȳ)/√(σ_X²/n_X + σ_Y²/n_Y))", formula: "=(AVERAGE(B16:B25)-AVERAGE(C16:C25))/SQRT(1/10+1/10)", result: "3.1597" },
        { say: "P(Z<=z) one-tail", formula: "=1-NORM.S.DIST(L23,TRUE)", result: "0.00079" },
        { say: "z Critical one-tail (the Toolpak's value)", formula: "=NORM.S.INV(1-0.2)", result: "0.8416" },
        { say: "P(Z<=z) two-tail, as he checked it", formula: "=(1-NORM.S.DIST(L23,TRUE))*2", result: "0.00158" },
        { say: "z Critical two-tail", formula: "=NORM.S.INV(1-0.2/2)", result: "1.2816" },
        { say: "Small p-value: REJECT.", result: "R" },
      ],
      takeaway: "Equal means is two-tailed: use the Toolpak's two-tail p and critical value.",
      source: "Lesson 18, notes › Two-sample",
    },
    {
      title: "Spring 2026 Exam 3 Q13–Q14 (paired, then pooled)",
      setup: "Q13: Table 3 has 101 students' Exam 1 and Exam 2 scores. D = Exam 2 − Exam 1 (positive if a student improved). Test H₀: μ_D ≥ 0 with α = 0.05. Q14: Tables 4 and 5 hold 23 final exam scores from each of two sections. Assuming equal variances, test that both means are equal with α = 0.05. (There are no published solutions: these are our own workings.)",
      steps: [
        { say: "Q13: make a D column (=E5-D5, filled down), then n = 101, D̄", formula: "=AVERAGE(D column)", result: "-1.6139" },
        { say: "S_D", formula: "=STDEV.S(D column)", result: "16.2972" },
        { say: "Test statistic T = D̄/(S_D/√n)", formula: "=AVERAGE(D column)/(STDEV.S(D column)/SQRT(101))", result: "-0.9952" },
        { say: "H₀ with ≥ → left tail: critical value and p-value", formula: "=T.INV(0.05,100)  and  =T.DIST(T,100,TRUE)", result: "-1.6602 and 0.1610 → DR" },
        { say: "Q14: S_p² = (S_4² + S_5²)/2", formula: "=(VAR.S(G11:G33)+VAR.S(I11:I33))/2", result: "231.0079" },
        { say: "T = (x̄₄ − x̄₅)/√(2S_p²/n) with n = 23", formula: "=(AVERAGE(G11:G33)-AVERAGE(I11:I33))/SQRT(2*Sp2/23)", result: "1.3290" },
        { say: "ν = 2n − 2 = 44; two tails, T positive", formula: "=T.INV(1-0.05/2,44)  and  =2*(1-T.DIST(T,44,TRUE))", result: "2.0154 and 0.1907 → DR" },
      ],
      takeaway: "Paired: one sample of differences, ν = n − 1. Unpaired with equal variances: pool, ν = n_X + n_Y − 2.",
      source: "Spring 2026 Exam 3 › Two-sample tests",
    },
  ],
  quiz: [
    { q: "For a normal sample of size n, which quantity follows a chi-squared distribution with n − 1 degrees of freedom?", options: ["((n − 1)/σ²)·S²", "(x̄ − μ)/(S/√n)", "S/σ", "n·S²/σ"], answer: 0,
      why: "His FACT: the sample variance's pdf is chi-squared: ((n − 1)/σ²)·S² ~ χ²_{n−1}. The second option is the T statistic." },
    { q: "The chi-squared distribution is…", options: ["right-skewed and depends on the sample size", "symmetric and bell-shaped", "the same for every n", "left-skewed"], answer: 0,
      why: "\"Like the t-distribution it depends on the sample size. Unlike the normal and t-distributions it is not symmetric; it is right-skewed.\"" },
    { q: "H₀: the variance is at most 1, α = 0.2, n = 10. The critical value is…", options: ["=CHISQ.INV(0.8,9)", "=CHISQ.INV(0.2,9)", "=CHISQ.INV(0.9,9)", "=CHISQ.INV(0.8,10)"], answer: 0,
      why: "H₀ with ≤ is rejected by large values: right tail, 1 − α = 0.8, ν = n − 1 = 9. This is his Exercise." },
    { q: "H₀: σ² ≥ 4 with test statistic 3.1 and ν = 11. The p-value is…", options: ["=CHISQ.DIST(3.1,11,TRUE)", "=1-CHISQ.DIST(3.1,11,TRUE)", "=2*CHISQ.DIST(3.1,11,TRUE)", "=CHISQ.INV(3.1,11)"], answer: 0,
      why: "H₀ with ≥ is rejected by small values: the left tail, CHISQ.DIST(stat, ν, TRUE)." },
    { q: "Which Toolpak tool do you use to compare two means when both true standard deviations are known?", options: ["z-Test: Two Sample for Means", "t-Test: Paired Two Sample for Means", "t-Test: Two-Sample Assuming Equal Variances", "Descriptive Statistics"], answer: 0,
      why: "His Two-sample sheet: known standard deviations (1 for both) → z-Test: Two Sample for Means." },
    { q: "Testing that two means are equal, the Toolpak gives z = 3.16. The p-value to compare with α is…", options: ["P(Z<=z) two-tail", "P(Z<=z) one-tail", "z Critical two-tail", "1 − P(Z<=z) one-tail"], answer: 0,
      why: "Equal means is a two-tailed hypothesis; he checked it with =(1−NORM.S.DIST(z,TRUE))*2." },
    { q: "Two independent samples of sizes 12 and 15, variances assumed equal. The degrees of freedom are…", options: ["25", "11", "14", "27"], answer: 0,
      why: "Pooled t test: ν = n_X + n_Y − 2 = 12 + 15 − 2 = 25." },
    { q: "The same 30 students sit Exam 1 and Exam 2. The right test is…", options: ["a paired test: a one-sample T test on the differences, ν = 29", "a pooled t test with ν = 58", "a z test with known variances", "a chi-squared test"], answer: 0,
      why: "The scores come in pairs (same student), so test the mean of the differences D: one sample of 30, ν = n − 1." },
    { q: "Exam 3 defined D so it is positive if a student improved, and tested H₀: μ_D ≥ 0. Which tail?", options: ["Left tail: p = T.DIST(T, n − 1, TRUE)", "Right tail: p = 1 − T.DIST(T, n − 1, TRUE)", "Two tails", "It depends on the data"], answer: 0,
      why: "H₀ with ≥ is rejected by small (negative) T: the left tail." },
  ],
  excel: [
    { fn: "VAR.S", use: "The sample variance S² for the variance test and for each sample in a pooled t test." },
    { fn: "CHISQ.DIST(x,n-1,TRUE)", use: "Variance-test p-values: left tail CHISQ.DIST, right tail 1 − CHISQ.DIST." },
    { fn: "CHISQ.INV(p,n-1)", use: "Variance-test critical values: CHISQ.INV(1−α, n−1) for the right tail, CHISQ.INV(α, n−1) for the left." },
    { fn: "Toolpak: z-Test: Two Sample for Means", use: "Two means, known variances (enter the variances σ², not σ). Check its two-tail p with =(1-NORM.S.DIST(z,TRUE))*2 when z > 0." },
    { fn: "Toolpak: t-Test: Two-Sample Assuming Equal Variances", use: "Two means, unknown but equal variances: reports the pooled variance, df = n_X + n_Y − 2, t Stat and p-values." },
    { fn: "AVERAGE, STDEV.S, COUNT, T.DIST, T.INV", use: "The paired test: make a column of differences D, then a one-sample T test on it." },
    { fn: "NORM.S.DIST / NORM.S.INV", use: "Reproduce the z test's p-values and critical values." },
  ],
  watch: [
    "Spring 2026 Exam 3 section 4 'Two-sample tests': Q13 paired (D = Exam 2 − Exam 1, H₀: μ_D ≥ 0, left tail) and Q14 pooled with equal section sizes (S_p² = (S_X² + S_Y²)/2, ν = 2n − 2 on the formula sheet). Both use the n / alpha / test statistic / critical value / p value / Decision (R or DR) template.",
    "The Midterm 3 syllabus: know unpaired vs paired; for paired, test the differences; for unpaired, test assuming equal variances.",
    "The variance test was in Lesson 18's notes, not on Spring 2026 Exam 3; expect it in the same style as his Exercise (variance ≤ σ₀², right tail, CHISQ.DIST/CHISQ.INV).",
    "Common slips: dividing by n instead of n − 1 in the χ² statistic; using S instead of S²; forgetting to square a hypothesized standard deviation; using the wrong tail (≤ is right, ≥ is left); entering σ instead of σ² as the Toolpak's 'known variance'; ν = n − 1 in a pooled test (it is n_X + n_Y − 2) or ν = 2n − 2 in a paired test (it is n − 1); subtracting the pairs the wrong way round.",
    "Toolpak output is pasted values: on the exam he grades the numbers, so a formula reproducing them (AVERAGE, VAR.S, NORM.S.DIST, T.DIST) is a good check.",
  ],
  makers: [variance, ztwo, pooled, paired],
};
