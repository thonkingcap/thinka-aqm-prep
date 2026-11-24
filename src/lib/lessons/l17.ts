// Lesson 17: P-values and critical values, and one-tailed tests (Week 10 Wed 4 Nov; Week 11 Mon 9 Nov).
// Built from "Lesson 17,notes.xlsx" (Exercises: the cereal boxes; Paired data (blank); Chi Square: simulating the
// sample variance) and "Lesson 17, exercises.xlsx" (the same questions, unanswered). One-tailed tests, counts of 0/1
// outcomes and paired data are not worked in these notes: they follow the professor's past exams (Fall 2025 Exam 2,
// Spring 2026 Exam 3, Fall 2025 and Spring 2026 Finals), with his convention for the tails.
import { Sheet, int, pick, round, normals, TOP, tolFor, decide, DECISIONS, type BlockMaker, type Block, type Part, type Rng } from "./kit.ts";
import { normCdf, normInv, tCdf, tInv, mean, stdevS } from "../stats.ts";
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
const SYM: Record<H0, string> = { eq: "=", le: "≤", ge: "≥" };
const TAILNAME: Record<H0, string> = { eq: "two-tailed", le: "right-tailed", ge: "left-tailed" };
const p2 = (stat: number, cdf: (x: number) => number) => (stat < 0 ? 2 * cdf(stat) : 2 * (1 - cdf(stat)));
const p2F = (stat: number, dist: string) => (stat < 0 ? `=2*${dist}` : `=2*(1-${dist})`);
/** p-value by the class convention: H₀ with = → two tails; ≤ → right tail; ≥ → left tail. */
const pTail = (stat: number, cdf: (x: number) => number, h0: H0) => (h0 === "eq" ? p2(stat, cdf) : h0 === "le" ? 1 - cdf(stat) : cdf(stat));
const pTailF = (stat: number, dist: string, h0: H0) => (h0 === "eq" ? p2F(stat, dist) : h0 === "le" ? `=1-${dist}` : `=${dist}`);
/** A statistic to aim for: in the rejection tail(s) when want, otherwise comfortably outside them. */
function aim(rng: Rng, c: number, h0: H0, want: boolean): number {
  const far = c + 0.3 + 1.6 * rng();
  if (h0 === "eq") return want ? (rng() < 0.5 ? -far : far) : (2 * rng() - 1) * (c - 0.35);
  if (h0 === "le") return want ? far : -1.5 + rng() * (c - 0.35 + 1.5);
  return want ? -far : 1.5 - rng() * (c - 0.35 + 1.5);
}
const clear = (p: number, alpha: number) => (p < alpha ? p < alpha - Math.min(0.01, alpha / 2) : p > alpha + 0.01);
const r4 = (x: number) => String(round(x, 4));
const decisionPart = (cell: string, reject: boolean, formula: string, explain: string): Part => ({
  label: "Decision (R or DR)", cell, answer: decide(reject), formula, options: DECISIONS, explain,
});
/** Round to one significant figure (for "assume σ = 0.3" style numbers). */
const sig1 = (x: number) => { const e = Math.floor(Math.log10(x)); const f = 10 ** e; return Math.max(f, Math.round(x / f) * f); };

// ---------- Q1: the cereal exercises (T test, then Z with two σ's, then critical values in advance) ----------
const CEREAL = [
  { items: "cereal boxes", unit: "oz", mus: [10, 12, 16], sd: [0.3, 0.6], d: 1 },
  { items: "bags of coffee", unit: "g", mus: [250, 340, 500], sd: [4, 8], d: 0 },
  { items: "bottles of juice", unit: "ml", mus: [500, 750], sd: [5, 10], d: 0 },
  { items: "chocolate bars", unit: "g", mus: [100, 45], sd: [1.2, 2.5], d: 1 },
] as const;

const cereal: BlockMaker = {
  key: "l17.cereal",
  title: "Cereal boxes: T test, then Z tests with two assumed σ's, then critical values",
  make(rng): Block {
    const ctx = pick(rng, CEREAL);
    const mu0 = pick(rng, ctx.mus);
    const sdTrue = ctx.sd[0] + (ctx.sd[1] - ctx.sd[0]) * rng();
    const n = int(rng, 5, 8);
    const alpha = pick(rng, [0.05, 0.1, 0.05, 0.01]);
    const want = rng() < 0.5;
    const c = tInv(1 - alpha / 2, n - 1);
    let xs: number[] = [];
    for (let tries = 0; tries < 400; tries++) {
      const base = normals(rng, n, mu0, sdTrue, ctx.d);
      const s0 = stdevS(base);
      if (!(s0 > 0)) continue;
      const shift = round(mu0 + aim(rng, c, "eq", want) * (s0 / Math.sqrt(n)) - mean(base), ctx.d);
      xs = base.map((v) => round(v + shift, ctx.d));
      const t = (mean(xs) - mu0) / (stdevS(xs) / Math.sqrt(n));
      const p = p2(t, (x) => tCdf(x, n - 1));
      if ((p < alpha) === want && clear(p, alpha)) break;
    }
    const xbar = mean(xs), s = stdevS(xs), se = s / Math.sqrt(n), t = (xbar - mu0) / se;
    const p = p2(t, (x) => tCdf(x, n - 1)), reject = p < alpha;
    const sigA = sig1(s * (0.5 + 0.3 * rng())), sigB = sig1(s * (3 + 2 * rng()));
    const zA = (xbar - mu0) / (sigA / Math.sqrt(n)), zB = (xbar - mu0) / (sigB / Math.sqrt(n));
    const m = int(rng, 8, 20), alpha2 = pick(rng, [0.01, 0.05, 0.1]);
    const cR = tInv(1 - alpha2 / 2, m - 1);

    const S = new Sheet();
    const D = S.table("C", TOP + 1, ["Weights"], xs.map((v) => [v]));
    const R = D.cols.Weights.range;
    S.label(`E${TOP + 1}`, "alpha").given(`F${TOP + 1}`, alpha);
    S.label(`E${TOP + 2}`, "hypothesized mean").given(`F${TOP + 2}`, mu0);
    // Question 1, laid out like his F/H and J/L columns.
    S.header(`H${TOP + 1}`, "Question 1").header(`I${TOP + 1}`, "Your answer");
    const r = TOP + 2;
    S.ask(`H${r}`, { label: "n", cell: `I${r}`, answer: n, tol: 0, formula: `=COUNT(${R})`, explain: "Count the weights (he used COUNTA)." });
    S.ask(`H${r + 1}`, clean({ label: "(sample) std_dev", cell: `I${r + 1}`, answer: s, formula: `=STDEV.S(${R})`, explain: "σ is unknown, so use the sample standard deviation STDEV.S.",
      traps: [{ value: s * Math.sqrt((n - 1) / n), why: "That's STDEV.P. Use STDEV.S (n − 1)." }] }));
    S.ask(`H${r + 2}`, clean({ label: "sample mean", cell: `I${r + 2}`, answer: xbar, formula: `=AVERAGE(${R})`, explain: "The sample statistic." }));
    S.ask(`H${r + 3}`, clean({ label: "SE", cell: `I${r + 3}`, answer: se, formula: `=I${r + 1}/SQRT(I${r})`, explain: "The (sample) standard error S/√n." }));
    S.ask(`H${r + 4}`, clean({ label: "(T) test statistic", cell: `I${r + 4}`, answer: t, formula: `=(I${r + 2}-F${TOP + 2})/I${r + 3}`,
      explain: "T = (x̄ − hypothesized mean)/SE.", traps: [{ value: (xbar - mu0) / s, why: "Divided by S instead of S/√n." }] }));
    S.ask(`H${r + 5}`, clean({ label: "p-value", cell: `I${r + 5}`, answer: p, format: "prob", formula: p2F(t, `T.DIST(I${r + 4},I${r}-1,TRUE)`),
      explain: `"Equal to" means two tails: T is ${t < 0 ? "negative, so =T.DIST(T,n−1,TRUE)*2 as he wrote" : "positive, so =2*(1−T.DIST(T,n−1,TRUE))"}.`,
      traps: [{ value: p / 2, why: "One tail only: double it for a two-tailed test." }, { value: p2(t, normCdf), why: "Used the normal; σ is unknown so use T.DIST with n − 1." }] }));
    S.ask(`H${r + 6}`, clean({ label: "critical value (right)", cell: `I${r + 6}`, answer: c, formula: `=T.INV(1-F${TOP + 1}/2,I${r}-1)`,
      explain: "He wrote =T.INV(1-alpha/2,n-1); the left one is its negative.",
      traps: [{ value: tInv(1 - alpha, n - 1), why: "Used 1 − α; two tails need 1 − α/2." }, { value: normInv(1 - alpha / 2), why: "Used NORM.S.INV; σ is unknown so T.INV with n − 1." }] }));
    S.ask(`H${r + 7}`, decisionPart(`I${r + 7}`, reject, `=IF(I${r + 5}<F${TOP + 1},"R","DR")`,
      `p = ${r4(p)} ${reject ? "<" : ">"} α = ${alpha}, and T = ${r4(t)} is ${reject ? "outside" : "within"} ±${r4(c)}: ${reject ? "R" : "DR"}.`));
    // Questions 2 and 3: assume a true σ.
    const z1 = TOP + 1;
    const zBlock = (top: number, sig: number, z: number, q: string) => {
      S.header(`K${top}`, q).header(`L${top}`, "Your answer");
      S.label(`K${top + 1}`, "std_dev (assumed)").given(`L${top + 1}`, sig);
      S.ask(`K${top + 2}`, clean({ label: `SE (σ = ${sig})`, cell: `L${top + 2}`, answer: sig / Math.sqrt(n), formula: `=L${top + 1}/SQRT(I${r})`, explain: "With σ assumed, SE = σ/√n." }));
      S.ask(`K${top + 3}`, clean({ label: `(Z) test stat (σ = ${sig})`, cell: `L${top + 3}`, answer: z, formula: `=(I${r + 2}-F${TOP + 2})/L${top + 2}`,
        explain: "σ is assumed known, so this is a Z statistic.", traps: [{ value: t, why: "That's the T from Question 1; use the assumed σ." }] }));
      const pz = p2(z, normCdf);
      S.ask(`K${top + 4}`, clean({ label: `p-val (σ = ${sig})`, cell: `L${top + 4}`, answer: pz, format: "prob", formula: p2F(z, `NORM.S.DIST(L${top + 3},TRUE)`),
        explain: `Two tails with the normal: Z is ${z < 0 ? "negative, so 2*NORM.S.DIST(Z,TRUE)" : "positive, so 2*(1−NORM.S.DIST(Z,TRUE))"}.`,
        traps: [{ value: pz / 2, why: "One tail only: double it." }, { value: p, why: "That's the T-test p-value from Question 1." }] }));
    };
    zBlock(z1, sigA, zA, "Question 2");
    zBlock(z1 + 6, sigB, zB, "Question 3");
    const q5 = z1 + 12;
    S.header(`K${q5}`, "Question 5").header(`L${q5}`, "Value");
    S.label(`K${q5 + 1}`, "sample size").given(`L${q5 + 1}`, m);
    S.label(`K${q5 + 2}`, "alpha").given(`L${q5 + 2}`, alpha2);
    S.ask(`K${q5 + 3}`, clean({ label: "right critical value", cell: `L${q5 + 3}`, answer: cR, formula: `=T.INV(1-L${q5 + 2}/2,L${q5 + 1}-1)`,
      explain: `σ unknown, so T with ν = ${m} − 1 = ${m - 1}; two tails: T.INV(1 − α/2, ν). No data are needed.`,
      traps: [{ value: tInv(1 - alpha2 / 2, m), why: "Used ν = n; it is n − 1." }, { value: tInv(1 - alpha2, m - 1), why: "Used 1 − α; two tails need 1 − α/2." }, { value: normInv(1 - alpha2 / 2), why: "Used NORM.S.INV; σ is unknown." }] }));
    S.ask(`K${q5 + 4}`, clean({ label: "left critical value", cell: `L${q5 + 4}`, answer: -cR, formula: `=T.INV(L${q5 + 2}/2,L${q5 + 1}-1)`,
      explain: "He wrote =T.INV(alpha/2,n-1): the same size, negative.", traps: [{ value: cR, why: "The left critical value is negative." }] }));
    return {
      tab: "Cereal box exercises", title: "P-values and critical values",
      text: [
        `1. ${n} ${ctx.items} are randomly sampled and weighed (${ctx.unit}); their weights are below. Test the hypothesis that the mean is equal to ${mu0} with significance ${Math.round(alpha * 100)}% (σ unknown).`,
        `2. If we assume the true standard deviation to be ${sigA}, what is the p-value of this sample? 3. If we assume it to be ${sigB}, what is the p-value?`,
        "4. Interpret the difference between your answers to questions 2 and 3 (see the self-check below).",
        `5. A sample of ${m} ${ctx.items} will be given. The standard deviation is unknown. For a test with significance ${Math.round(alpha2 * 100)}%, what are the critical values for the test statistic?`,
        "Write R or DR for the conclusion.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [`Question 4, in words. Self-check: with σ = ${sigB} the standard error is larger, so the Z statistic is closer to zero and the two tails gain more probability: the p-value is bigger than with σ = ${sigA}.`],
    };
  },
};

// ---------- Q2: every one-sample case: σ known/unknown × H₀ with =, ≤, ≥ ----------
const CLAIMS = [
  { thing: "A machine is designed to dispense 330ml of liquid into a can", what: "the amount dispensed (ml)", mu: 330, sd: 3, d: 0 },
  { thing: "A cereal filler is set to put 525g into each box", what: "the weight of cereal (g)", mu: 525, sd: 15, d: 0 },
  { thing: "A pub is meant to pour 568ml into each pint", what: "the amount poured (ml)", mu: 568, sd: 15, d: 0 },
  { thing: "A battery maker says its batteries last 20 hours", what: "battery life (hours)", mu: 20, sd: 2, d: 1 },
  { thing: "A pizza shop promises delivery in 30 minutes", what: "delivery time (minutes)", mu: 30, sd: 5, d: 1 },
  { thing: "A factory cuts bolts to a length of 50mm", what: "bolt length (mm)", mu: 50, sd: 0.4, d: 2 },
] as const;

const onesample: BlockMaker = {
  key: "l17.onesample",
  title: "One-sample test, any case: Z or T, two-, right- or left-tailed",
  make(rng): Block {
    const ctx = pick(rng, CLAIMS);
    const known = rng() < 0.5;
    const h0 = pick(rng, ["eq", "le", "ge"] as const);
    const alpha = pick(rng, [0.05, 0.05, 0.01, 0.1]);
    const n = int(rng, 10, 25);
    const want = rng() < 0.5;
    const cdf = known ? normCdf : (x: number) => tCdf(x, n - 1);
    const inv = known ? normInv : (q: number) => tInv(q, n - 1);
    const c = h0 === "eq" ? inv(1 - alpha / 2) : inv(1 - alpha);
    let xs: number[] = [];
    for (let tries = 0; tries < 400; tries++) {
      const base = normals(rng, n, ctx.mu, ctx.sd, ctx.d);
      const se0 = (known ? ctx.sd : stdevS(base)) / Math.sqrt(n);
      if (!(se0 > 0)) continue;
      const shift = round(ctx.mu + aim(rng, c, h0, want) * se0 - mean(base), ctx.d);
      xs = base.map((v) => round(v + shift, ctx.d));
      const st = (mean(xs) - ctx.mu) / ((known ? ctx.sd : stdevS(xs)) / Math.sqrt(n));
      const p = pTail(st, cdf, h0);
      if ((p < alpha) === want && clear(p, alpha)) break;
    }
    const xbar = mean(xs), s = stdevS(xs), sig = known ? ctx.sd : s, stat = (xbar - ctx.mu) / (sig / Math.sqrt(n));
    const p = pTail(stat, cdf, h0), reject = p < alpha;
    const L = known ? "Z" : "T";

    const S = new Sheet();
    const D = S.table("C", TOP + 1, ["Table"], xs.map((v) => [v]));
    const R = D.cols.Table.range;
    S.header(`E${TOP + 1}`, "Given").header(`F${TOP + 1}`, "Value");
    S.label(`E${TOP + 2}`, "alpha").given(`F${TOP + 2}`, alpha);
    S.label(`E${TOP + 3}`, "hypothesized mean μ₀").given(`F${TOP + 3}`, ctx.mu);
    if (known) S.label(`E${TOP + 4}`, "σ (trusted)").given(`F${TOP + 4}`, ctx.sd);
    S.header(`H${TOP + 1}`, "Question").header(`I${TOP + 1}`, "Your answer");
    let r = TOP + 2;
    const nC = `I${r}`, mC = `I${r + 1}`;
    S.ask(`H${r}`, { label: "n", cell: nC, answer: n, tol: 0, formula: `=COUNT(${R})`, explain: "Count the sample." });
    S.ask(`H${r + 1}`, clean({ label: "sample mean", cell: mC, answer: xbar, formula: `=AVERAGE(${R})`, explain: "The sample statistic." }));
    r += 2;
    let sdRef = `F${TOP + 4}`;
    if (!known) {
      sdRef = `I${r}`;
      S.ask(`H${r}`, clean({ label: "sample std dev", cell: sdRef, answer: s, formula: `=STDEV.S(${R})`, explain: "σ is doubted, so estimate it with STDEV.S.",
        traps: [{ value: s * Math.sqrt((n - 1) / n), why: "That's STDEV.P. Use STDEV.S (n − 1)." }] }));
      r++;
    }
    const statC = `I${r}`;
    const dist = known ? `NORM.S.DIST(${statC},TRUE)` : `T.DIST(${statC},${nC}-1,TRUE)`;
    const wrongStat = known ? (xbar - ctx.mu) / (s / Math.sqrt(n)) : (xbar - ctx.mu) / (ctx.sd / Math.sqrt(n));
    S.ask(`H${r}`, clean({ label: "test statistic", cell: statC, answer: stat, formula: `=(${mC}-F${TOP + 3})/(${sdRef}/SQRT(${nC}))`,
      explain: known ? "σ is trusted: Z = (x̄ − μ₀)/(σ/√n)." : "σ is unknown: T = (x̄ − μ₀)/(S/√n), with ν = n − 1.",
      traps: [{ value: wrongStat, why: known ? "Used S from the data, but σ is trusted here: divide by σ/√n." : `Used the stated σ = ${ctx.sd}, but it is doubted: use S.` },
        { value: (xbar - ctx.mu) / sig, why: "Divided by the standard deviation, not the standard error." }] }));
    r++;
    const invName = known ? "NORM.S.INV" : "T.INV";
    const invF = (q: string) => (known ? `NORM.S.INV(${q})` : `T.INV(${q},${nC}-1)`);
    const other = known ? (q: number) => tInv(q, n - 1) : normInv;
    const otherWhy = known ? "Used T.INV, but σ is known: use NORM.S.INV." : "Used NORM.S.INV, but σ is unknown: use T.INV with n − 1.";
    let critCells: { lo?: string; hi?: string } = {};
    if (h0 === "eq") {
      critCells = { lo: `I${r}`, hi: `I${r + 1}` };
      S.ask(`H${r}`, clean({ label: "lower critical value", cell: `I${r}`, answer: -c, formula: `=-${invF(`1-F${TOP + 2}/2`)}`,
        explain: `Two tails: −${invName}(1 − α/2).`, traps: [{ value: -inv(1 - alpha), why: "Used α instead of α/2." }, { value: -other(1 - alpha / 2), why: otherWhy }] }));
      S.ask(`H${r + 1}`, clean({ label: "upper critical value", cell: `I${r + 1}`, answer: c, formula: `=${invF(`1-F${TOP + 2}/2`)}`,
        explain: `Two tails: ${invName}(1 − α/2).`, traps: [{ value: inv(1 - alpha), why: "Used 1 − α instead of 1 − α/2." }, { value: other(1 - alpha / 2), why: otherWhy }] }));
      r += 2;
    } else if (h0 === "le") {
      critCells = { hi: `I${r}` };
      S.ask(`H${r}`, clean({ label: "critical value", cell: `I${r}`, answer: c, formula: `=${invF(`1-F${TOP + 2}`)}`,
        explain: `H₀: μ ≤ μ₀ is rejected only by large statistics: the right tail, ${invName}(1 − α), a positive number.`,
        traps: [{ value: -c, why: "Wrong tail: H₀ with ≤ rejects on the right, so the critical value is positive." }, { value: inv(1 - alpha / 2), why: "Used α/2, but a one-tailed test puts all of α in one tail." }, { value: other(1 - alpha), why: otherWhy }] }));
      r++;
    } else {
      critCells = { lo: `I${r}` };
      S.ask(`H${r}`, clean({ label: "critical value", cell: `I${r}`, answer: -c, formula: `=${invF(`F${TOP + 2}`)}`,
        explain: `H₀: μ ≥ μ₀ is rejected only by small statistics: the left tail, ${invName}(α), a negative number.`,
        traps: [{ value: c, why: "Wrong tail: H₀ with ≥ rejects on the left, so the critical value is negative." }, { value: -inv(1 - alpha / 2), why: "Used α/2, but a one-tailed test puts all of α in one tail." }, { value: -other(1 - alpha), why: otherWhy }] }));
      r++;
    }
    const pC = `I${r}`;
    const F = cdf(stat);
    const pTraps = h0 === "eq"
      ? [{ value: p / 2, why: "One tail only: with an = in H₀ double it." }, { value: 1 - p / 2, why: "Took the tail on the wrong side of the statistic." }]
      : [{ value: 1 - p, why: h0 === "le" ? "Took the left tail; H₀ with ≤ is a right-tail test: 1 − DIST(stat)." : "Took the right tail; H₀ with ≥ is a left-tail test: DIST(stat)." },
        { value: 2 * Math.min(F, 1 - F), why: "Doubled it, but this test is one-tailed." }];
    S.ask(`H${r}`, clean({ label: "p value", cell: pC, answer: p, format: "prob", formula: pTailF(stat, dist, h0),
      explain: h0 === "eq" ? `Two tails: ${L} is ${stat < 0 ? "negative, so 2*DIST(stat)" : "positive, so 2*(1 − DIST(stat))"}.` : h0 === "le" ? "Right tail: p = 1 − DIST(stat)." : "Left tail: p = DIST(stat).",
      traps: pTraps }));
    S.ask(`H${r + 1}`, decisionPart(`I${r + 1}`, reject, `=IF(${pC}<F${TOP + 2},"R","DR")`,
      `p = ${r4(p)} ${reject ? "<" : ">"} α = ${alpha}${critCells.lo && critCells.hi ? `; ${L} = ${r4(stat)} is ${reject ? "outside" : "inside"} ±${r4(c)}` : `; ${L} = ${r4(stat)} is ${reject ? "past" : "not past"} the critical value ${r4(h0 === "le" ? c : -c)}`}: ${reject ? "R" : "DR"}.`));

    const suspect = h0 === "eq" ? `We suspect the true mean is not ${ctx.mu}.` : h0 === "le" ? `We begin to suspect the true mean is actually more than ${ctx.mu}.` : `We begin to suspect the true mean is actually less than ${ctx.mu}.`;
    return {
      tab: "One-sample test", title: `${TAILNAME[h0][0].toUpperCase()}${TAILNAME[h0].slice(1)} ${L} test for a mean`,
      text: [
        `${ctx.thing}: ${ctx.what} is claimed to be normally distributed with mean μ = ${ctx.mu} and σ = ${ctx.sd}. The table shows a sample of ${n}.`,
        `${suspect} ${known ? "However we continue to trust the stated standard deviation." : "We now doubt the claims about both μ and σ."}`,
        `Use the sample to test the null hypothesis H₀: μ ${SYM[h0]} ${ctx.mu} with α = ${alpha}.`,
        "Write R for reject and DR for do not reject.",
      ],
      cells: S.cells, parts: S.parts,
    };
  },
};

// ---------- Q3: a mean of 0s and 1s (coin flips, games won) ----------
const COUNTS = [
  { story: (N: number) => `I flip a coin ${N} times. If it lands heads I record X = 1 and if it lands tails X = 0.`, one: "heads", zero: "tails", p0s: [0.5] },
  { story: (N: number) => `A chess player's last ${N} games as white are recorded: X = 1 for a game won, X = 0 for a game lost.`, one: "won", zero: "lost", p0s: [0.5, 0.49, 0.55] },
  { story: (N: number) => `A basketball player takes ${N} free throws: X = 1 for a basket made, X = 0 for a miss.`, one: "made", zero: "missed", p0s: [0.7, 0.75, 0.8] },
  { story: (N: number) => `${N} customers are asked if they would recommend a shop: X = 1 for yes, X = 0 for no.`, one: "yes", zero: "no", p0s: [0.6, 0.65] },
] as const;

const counts: BlockMaker = {
  key: "l17.counts",
  title: "Testing the mean of 0/1 outcomes (one-tailed T test)",
  make(rng): Block {
    const ctx = pick(rng, COUNTS);
    const p0 = pick(rng, ctx.p0s);
    const h0 = pick(rng, ["le", "ge"] as const);
    const alpha = pick(rng, [0.05, 0.05, 0.01, 0.1]);
    const want = rng() < 0.5;
    let N = 0, k = 0;
    for (let tries = 0; tries < 400; tries++) {
      N = pick(rng, [200, 300, 400, 500, 800, 1000, 1200, 1500]);
      const sd = Math.sqrt(p0 * (1 - p0) * N);
      const cands: number[] = [];
      for (let kk = Math.round(N * p0 - 4 * sd); kk <= Math.round(N * p0 + 4 * sd); kk++) {
        const xb = kk / N, S2 = (kk * (1 - xb) ** 2 + (N - kk) * xb ** 2) / (N - 1);
        const t = (xb - p0) / Math.sqrt(S2 / N), p = pTail(t, (x) => tCdf(x, N - 1), h0);
        if ((p < alpha) === want && clear(p, alpha) && Math.abs(t) < 4.5) cands.push(kk);
      }
      if (cands.length) { k = pick(rng, cands); break; }
    }
    const xbar = k / N, s = Math.sqrt((k * (1 - xbar) ** 2 + (N - k) * xbar ** 2) / (N - 1));
    const t = (xbar - p0) / (s / Math.sqrt(N)), p = pTail(t, (x) => tCdf(x, N - 1), h0), reject = p < alpha;
    const c = h0 === "le" ? tInv(1 - alpha, N - 1) : tInv(alpha, N - 1);

    const S = new Sheet();
    S.header(`C${TOP + 1}`, "Outcome").header(`D${TOP + 1}`, "Number of occurrences");
    S.set(`C${TOP + 2}`, 1, "data").set(`D${TOP + 2}`, k, "data");
    S.set(`C${TOP + 3}`, 0, "data").set(`D${TOP + 3}`, N - k, "data");
    S.hint(`E${TOP + 2}`, `(${ctx.one})`).hint(`E${TOP + 3}`, `(${ctx.zero})`);
    S.label(`C${TOP + 5}`, "alpha").given(`D${TOP + 5}`, alpha);
    S.label(`C${TOP + 6}`, "hypothesized mean").given(`D${TOP + 6}`, p0);
    S.header(`G${TOP + 1}`, "Question").header(`H${TOP + 1}`, "Your answer");
    const r = TOP + 2;
    const O = `C${TOP + 2}:C${TOP + 3}`, Nn = `D${TOP + 2}:D${TOP + 3}`;
    S.ask(`G${r}`, { label: "n", cell: `H${r}`, answer: N, tol: 0, formula: `=SUM(${Nn})`, explain: "n is the total number of trials." });
    S.ask(`G${r + 1}`, clean({ label: "Sample mean", cell: `H${r + 1}`, answer: xbar, formula: `=SUMPRODUCT(${O},${Nn})/H${r}`,
      explain: `The mean of the 0s and 1s is the proportion of ones: ${k}/${N}.`, traps: [{ value: k / (N - k), why: `Divided by the ${ctx.zero} count, not by n.` }] }));
    S.ask(`G${r + 2}`, clean({ label: "Sample std dev", cell: `H${r + 2}`, answer: s, formula: `=SQRT((D${TOP + 2}*(C${TOP + 2}-H${r + 1})^2+D${TOP + 3}*(C${TOP + 3}-H${r + 1})^2)/(H${r}-1))`,
      explain: "S = √(Σ(xᵢ − x̄)²/(n − 1)): each 1 contributes (1 − x̄)² and each 0 contributes (0 − x̄)².",
      traps: [{ value: Math.sqrt(xbar * (1 - xbar)), why: "Divided by n, not n − 1." }, { value: s * s, why: "That's the sample variance; take the square root." }] }));
    S.ask(`G${r + 3}`, clean({ label: "test statistic", cell: `H${r + 3}`, answer: t, formula: `=(H${r + 1}-D${TOP + 6})/(H${r + 2}/SQRT(H${r}))`,
      explain: "σ is not known, so T = (x̄ − μ₀)/(S/√n) with ν = n − 1.", traps: [{ value: (xbar - p0) / s, why: "Divided by S, not S/√n." }] }));
    S.ask(`G${r + 4}`, clean({ label: "critical value", cell: `H${r + 4}`, answer: c,
      formula: h0 === "le" ? `=T.INV(1-D${TOP + 5},H${r}-1)` : `=T.INV(D${TOP + 5},H${r}-1)`,
      explain: h0 === "le" ? "H₀: μ ≤ μ₀ → right tail: T.INV(1 − α, n − 1)." : "H₀: μ ≥ μ₀ → left tail: T.INV(α, n − 1), negative.",
      traps: [{ value: -c, why: "Wrong tail (wrong sign)." }, { value: h0 === "le" ? tInv(1 - alpha / 2, N - 1) : tInv(alpha / 2, N - 1), why: "Used α/2; this test is one-tailed." }] }));
    S.ask(`G${r + 5}`, clean({ label: "p value", cell: `H${r + 5}`, answer: p, format: "prob",
      formula: h0 === "le" ? `=1-T.DIST(H${r + 3},H${r}-1,TRUE)` : `=T.DIST(H${r + 3},H${r}-1,TRUE)`,
      explain: h0 === "le" ? "Right tail: 1 − T.DIST(T, n − 1, TRUE)." : "Left tail: T.DIST(T, n − 1, TRUE).",
      traps: [{ value: 1 - p, why: "Wrong tail." }] }));
    S.ask(`G${r + 6}`, decisionPart(`H${r + 6}`, reject, `=IF(H${r + 5}<D${TOP + 5},"R","DR")`, `p = ${r4(p)} ${reject ? "<" : ">"} α = ${alpha}: ${reject ? "R" : "DR"}.`));
    return {
      tab: "Mean of 0s and 1s", title: "Hypothesis test for a mean of 0/1 outcomes",
      text: [
        `${ctx.story(N)} The results are in the table: ${k} ${ctx.one} and ${N - k} ${ctx.zero}.`,
        "Find the sample mean and sample standard deviation of X.",
        `Test the null hypothesis H₀: μ ${SYM[h0]} ${p0} with α = ${alpha} (σ is not known).`,
        "Write R for reject and DR for do not reject.",
      ],
      cells: S.cells, parts: S.parts,
    };
  },
};

// ---------- Q4: paired data (predicted vs actual) ----------
const PAIRED = [
  { story: "A video website predicts each viewer's age from cookies data. The table shows predicted and actual ages", a: "Predicted age", b: "Actual age", lo: 18, hi: 70, sd: 5 },
  { story: "A delivery app estimates each delivery time (minutes). The table shows estimated and actual times", a: "Estimated time", b: "Actual time", lo: 15, hi: 60, sd: 4 },
  { story: "A bathroom scale is tested on people of known weight (kg). The table shows scale readings and true weights", a: "Scale reading", b: "True weight", lo: 50, hi: 100, sd: 1.5 },
] as const;

const paired: BlockMaker = {
  key: "l17.paired",
  title: "Paired data: differences and a two-tailed T test with critical values",
  make(rng): Block {
    const ctx = pick(rng, PAIRED);
    const n = int(rng, 12, 18);
    const alpha = pick(rng, [0.05, 0.1, 0.01]);
    const want = rng() < 0.5;
    const c = tInv(1 - alpha / 2, n - 1);
    let A: number[] = [], B: number[] = [];
    for (let tries = 0; tries < 400; tries++) {
      B = Array.from({ length: n }, () => int(rng, ctx.lo, ctx.hi));
      const noise = normals(rng, n, 0, ctx.sd, 0);
      const s0 = stdevS(noise);
      if (!(s0 > 0)) continue;
      const bias = Math.round(aim(rng, c, "eq", want) * s0 / Math.sqrt(n) - mean(noise));
      A = B.map((v, i) => v + noise[i] + bias);
      const d = A.map((v, i) => v - B[i]);
      const t = mean(d) / (stdevS(d) / Math.sqrt(n));
      const p = p2(t, (x) => tCdf(x, n - 1));
      if ((p < alpha) === want && clear(p, alpha)) break;
    }
    const d = A.map((v, i) => v - B[i]);
    const dbar = mean(d), sd = stdevS(d), t = dbar / (sd / Math.sqrt(n)), reject = t < -c || t > c;

    const S = new Sheet();
    S.header(`C${TOP + 1}`, "Case").header(`D${TOP + 1}`, ctx.a).header(`E${TOP + 1}`, ctx.b).header(`F${TOP + 1}`, "Difference");
    const f = TOP + 2, l = TOP + 1 + n;
    for (let i = 0; i < n; i++) {
      const row = f + i;
      S.set(`C${row}`, i + 1, "data").set(`D${row}`, A[i], "data").set(`E${row}`, B[i], "data");
      S.parts.push({ label: `Difference, case ${i + 1}`, cell: `F${row}`, answer: d[i], tol: 0, formula: `=D${row}-E${row}`,
        explain: `Difference = ${ctx.a.toLowerCase()} − ${ctx.b.toLowerCase()}.`, traps: d[i] !== 0 ? [{ value: -d[i], why: "Subtracted the wrong way round." }] : undefined });
    }
    const DR = `F${f}:F${l}`;
    S.label(`H${TOP + 1}`, "alpha").given(`I${TOP + 1}`, alpha);
    S.header(`H${TOP + 3}`, "Question").header(`I${TOP + 3}`, "Your answer");
    const r = TOP + 4;
    S.ask(`H${r}`, clean({ label: "(a) sample mean of the differences", cell: `I${r}`, answer: dbar, formula: `=AVERAGE(${DR})`, explain: "Average the difference column." }));
    S.ask(`H${r + 1}`, clean({ label: "(b) sample std dev of the differences", cell: `I${r + 1}`, answer: sd, formula: `=STDEV.S(${DR})`, explain: "STDEV.S of the differences.",
      traps: [{ value: sd * Math.sqrt((n - 1) / n), why: "That's STDEV.P. Use STDEV.S." }] }));
    S.ask(`H${r + 2}`, clean({ label: "(c) T-statistic (true mean zero)", cell: `I${r + 2}`, answer: t, formula: `=(I${r}-0)/(I${r + 1}/SQRT(COUNT(${DR})))`,
      explain: "A paired sample is one sample of differences: T = (D̄ − 0)/(S_D/√n), ν = n − 1.", traps: [{ value: dbar / sd, why: "Divided by S_D, not S_D/√n." }] }));
    S.ask(`H${r + 3}`, clean({ label: "Lower critical T-value", cell: `I${r + 3}`, answer: -c, formula: `=-T.INV(1-I${TOP + 1}/2,COUNT(${DR})-1)`,
      explain: `Two tails, ν = n − 1 = ${n - 1}.`, traps: [{ value: tInv(alpha, n - 1), why: "Used α; two tails need α/2." }, { value: -tInv(1 - alpha / 2, 2 * n - 2), why: "Used ν = 2n − 2: a paired test has one sample of n differences, ν = n − 1." }] }));
    S.ask(`H${r + 4}`, clean({ label: "Upper critical T-value", cell: `I${r + 4}`, answer: c, formula: `=T.INV(1-I${TOP + 1}/2,COUNT(${DR})-1)`,
      explain: "T.INV(1 − α/2, n − 1).", traps: [{ value: tInv(1 - alpha, n - 1), why: "Used 1 − α; two tails need 1 − α/2." }] }));
    S.ask(`H${r + 5}`, decisionPart(`I${r + 5}`, reject, `=IF(OR(I${r + 2}<I${r + 3},I${r + 2}>I${r + 4}),"R","DR")`,
      `T = ${r4(t)} is ${reject ? "outside" : "inside"} ±${r4(c)}: ${reject ? "R" : "DR"}.`));
    return {
      tab: "Paired data", title: "Paired data: is the prediction working?",
      text: [
        `${ctx.story} for ${n} cases. Complete the Difference column (${ctx.a.toLowerCase()} − ${ctx.b.toLowerCase()}).`,
        "For the differences find (a) the sample mean, (b) the sample standard deviation, (c) the T-statistic assuming the true mean is zero.",
        `Test the null hypothesis that the mean of the differences is zero with α = ${alpha}: find the lower and upper critical values and make a decision (R or DR).`,
      ],
      cells: S.cells, parts: S.parts,
    };
  },
};

// ---------- Q5: the Chi Square sheet: how sample variances spread ----------
const SIMS = [
  { mu: 0, sd: 1, d: 3 },
  { mu: 10, sd: 2, d: 2 },
  { mu: 50, sd: 5, d: 2 },
  { mu: 100, sd: 15, d: 1 },
] as const;

const varsim: BlockMaker = {
  key: "l17.varsim",
  title: "Simulated rows: sample means and sample variances",
  make(rng): Block {
    const sim = pick(rng, SIMS);
    const rows = 15, trials = 10;
    const data = Array.from({ length: rows }, () => normals(rng, trials, sim.mu, sim.sd, sim.d));
    const means = data.map(mean), vars = data.map((r) => stdevS(r) ** 2);
    const v2 = sim.sd ** 2;
    const S = new Sheet();
    const hr = TOP + 1, f = TOP + 2, l = TOP + 1 + rows;
    for (let j = 0; j < trials; j++) S.header(`${"CDEFGHIJKL"[j]}${hr}`, `Trial ${j + 1}`);
    S.header(`M${hr}`, "(row) s.mean").header(`N${hr}`, "(row) s.variance");
    data.forEach((row, i) => {
      const rr = f + i;
      S.label(`B${rr}`, `Simulation ${i + 1}`);
      row.forEach((v, j) => S.set(`${"CDEFGHIJKL"[j]}${rr}`, v, "data"));
      S.parts.push(clean({ label: `Simulation ${i + 1}: sample mean`, cell: `M${rr}`, answer: means[i], formula: `=AVERAGE(C${rr}:L${rr})`, explain: "AVERAGE of the row." }));
      S.parts.push(clean({ label: `Simulation ${i + 1}: sample variance`, cell: `N${rr}`, answer: vars[i], formula: `=VAR.S(C${rr}:L${rr})`, explain: "VAR.S of the row (divides by n − 1).",
        traps: [{ value: vars[i] * 0.9, why: "That's VAR.P (divides by n). Use VAR.S." }] }));
    });
    S.header(`P${hr}`, "Summary").header(`Q${hr}`, "Your answer");
    S.label(`P${l + 2}`, "true mean μ").given(`Q${l + 2}`, sim.mu);
    S.label(`P${l + 3}`, "true variance σ²").given(`Q${l + 3}`, v2);
    const avgM = mean(means), avgV = mean(vars), below = vars.filter((v) => v < v2).length;
    S.ask(`P${f}`, clean({ label: "average of the sample means", cell: `Q${f}`, answer: avgM, formula: `=AVERAGE(M${f}:M${l})`, explain: "Close to μ: the sample mean is centred on the true mean." }));
    S.ask(`P${f + 1}`, clean({ label: "average of the sample variances", cell: `Q${f + 1}`, answer: avgV, formula: `=AVERAGE(N${f}:N${l})`, explain: "Close to σ²: VAR.S is an unbiased estimator of the variance." }));
    S.ask(`P${f + 2}`, clean({ label: "min s.variance", cell: `Q${f + 2}`, answer: Math.min(...vars), formula: `=MIN(N${f}:N${l})`, explain: "He found the min and max to choose histogram bins." }));
    S.ask(`P${f + 3}`, clean({ label: "max s.variance", cell: `Q${f + 3}`, answer: Math.max(...vars), formula: `=MAX(N${f}:N${l})`, explain: "The largest sample variance sits far above σ²: a long right tail." }));
    S.ask(`P${f + 4}`, { label: "how many s.variances are below σ²", cell: `Q${f + 4}`, answer: below, tol: 0, formula: `=COUNTIF(N${f}:N${l},"<"&Q${l + 3})`,
      explain: "Usually more than half: the distribution of S² is right-skewed, so most values sit below its mean σ² with a few large ones above." });
    return {
      tab: "Spread of S²", title: "So far only the mean: what about dispersion?",
      text: [
        `Each row is a simulation of ten trials of N(${sim.mu}, ${sim.sd}²) (like his "simulate ten trials of N(0,1), 100 times", with ${rows} rows here).`,
        "Find the sample mean and sample variance of each row, then summarise them.",
        "Then make a histogram of each column (not marked): see below.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        "Make a Toolpak histogram of the row means and one of the row variances (find the MIN and MAX first to choose bins). Self-check: the means are roughly symmetric around μ; the variances are right-skewed, bunched below σ² with a long tail to the right.",
        `Practise the RNG: simulate 10 columns × 100 rows of Normal(mean ${sim.mu}, std_dev ${sim.sd}) yourself and repeat. That right-skewed shape is the chi-squared distribution of Lesson 18.`,
      ],
    };
  },
};

export const LESSON_17: Lesson = {
  n: 17,
  title: "P-values, critical values and one-tailed tests",
  unit: 2,
  week: "Week 10–11 · Wed 4 and Mon 9 Nov · P-values, critical values and one-tailed tests",
  sources: ["Lesson 17,notes.xlsx", "Lesson 17, exercises.xlsx", "Fall 2025 Exam 2 (solutions)", "Spring 2026 Exam 3", "Fall 2025 and Spring 2026 Finals"],
  summary:
    "Practice with Z and T tests: the same sample can give very different p-values depending on what you assume about σ, and critical values can be found before any data arrive. It then covers one-tailed tests (which tail comes from the sign in H₀), tests on 0/1 outcomes and paired data, and a simulation showing that sample variances are right-skewed, which leads to the chi-squared test.",
  defs: [
    { term: "T test, σ unknown (Exercise 1)", text: "With σ unknown: (sample) std_dev =STDEV.S, SE = std_dev/SQRT(n), (T) test statistic = (sample mean − 10)/SE, p-value =T.DIST(T,n−1,TRUE)*2 for his negative T. \"This p-value is bigger than 5% so we DR.\"", source: "Lesson 17,notes › Exercises F6:P9" },
    { term: "Critical value check", text: "Critical value =T.INV(1−alpha/2,n−1). \"Test statistic within critical values: DR.\"", source: "Lesson 17,notes › Exercises J9:M9" },
    { term: "Z test, σ assumed (Exercises 2–3)", text: "If we assume the true standard deviation, SE = σ/SQRT(n), the (Z) test stat = (sample mean − 10)/SE, and the p-value =NORM.DIST(Z,0,1,TRUE)*2 or =2*NORM.S.DIST(Z,TRUE) (his Z values were negative here; for a positive Z use =2*(1-NORM.S.DIST(Z,TRUE))).", source: "Lesson 17,notes › Exercises E13:J18" },
    { term: "Why σ matters (Exercise 4)", text: "For larger standard deviations the standard error is larger and therefore the (absolute value) Z statistic becomes smaller. The Z statistic gets closer to zero which means the two tails gain more probability.", source: "Lesson 17,notes › Exercises B22:B23" },
    { term: "Critical values before the sample (Exercise 5)", text: "A sample of 10 boxes will be given, σ unknown, significance 1%: right critical value =T.INV(1−0.01/2,9) = 3.2498, left critical value =T.INV(0.01/2,9) = −3.2498. They depend only on α and the degrees of freedom, not on the data.", source: "Lesson 17,notes › Exercises B25:G29" },
    { term: "What about dispersion?", text: "So far we have only been interested in the mean as a measure of central tendency. What about dispersion? We're going to consider the variance.", source: "Lesson 17,notes › Chi Square B2:B4" },
    { term: "Simulating the sample variance", text: "Task: simulate ten trials of N(0,1), 100 times. Find the sample mean (AVERAGE) and sample variance (VAR.S) of each row and make a histogram of each. The sample means spread symmetrically around 0; the sample variances (0.155 to 2.675 in his run) are right-skewed.", source: "Lesson 17,notes › Chi Square B6:T10, histograms Q12:Z37" },
    { term: "One-tailed test, H₀: μ ≤ μ₀", text: "Rejected only by large statistics: right tail. Critical value =T.INV(1−α,n−1) (or NORM.S.INV(1−α)); p-value =1−T.DIST(T,n−1,TRUE).", source: "Fall 2025 Exam 2 › Chess H34; Spring 2026 Final › Hypothesis testing D45:D46" },
    { term: "One-tailed test, H₀: μ ≥ μ₀", text: "Rejected only by small statistics: left tail. Critical value =T.INV(α,n−1), a negative number; p-value =T.DIST(T,n−1,TRUE).", source: "Fall 2025 Exam 2 › Chess H54; Spring 2026 Exam 3 Q7–Q8" },
    { term: "Mean and std dev of 0/1 outcomes", text: "Record X = 1 or 0. The sample mean is the proportion of ones; the sample variance is (1/(n−1))·(#ones·(1−x̄)² + #zeros·(0−x̄)²).", source: "Fall 2025 Exam 2 › Chess F21, N23; Spring 2026 Exam 3 Q11" },
    { term: "Paired data", text: "For a paired sample, perform a hypothesis test on the differences between the grouped pairs: one sample of differences, T = D̄/(S_D/√n) with n − 1 degrees of freedom. (The notes' 'Paired data' sheet is blank; this is from the exam syllabus and the Fall 2025 Final.)", source: "Midterm 3 announcement; Fall 2025 Final › Paired Data" },
  ],
  examples: [
    {
      title: "Cereal boxes: T test, then Z with two values of σ",
      setup: "Five cereal boxes are weighed: 10.1, 9.8, 9.7, 9.1, 10.2 (C4:C8). Test the hypothesis that the mean is equal to 10 with significance 5%. Then find the p-value if the true standard deviation is 0.3, and if it is 2.",
      table: { head: ["Box", "1", "2", "3", "4", "5"], rows: [["Weight", 10.1, 9.8, 9.7, 9.1, 10.2]] },
      steps: [
        { say: "n", formula: "=COUNTA(C4:C8)", result: "5" },
        { say: "(sample) std_dev", formula: "=STDEV.S(C4:C8)", result: "0.4324" },
        { say: "sample mean", formula: "=AVERAGE(C4:C8)", result: "9.78" },
        { say: "SE", formula: "=H8/SQRT(H7)", result: "0.1934" },
        { say: "(T) test statistic", formula: "=(H9-10)/L6", result: "-1.1376" },
        { say: "p-value (T negative, so double the left tail)", formula: "=T.DIST(L7,H7-1,TRUE)*2", result: "0.3188" },
        { say: "critical value", formula: "=T.INV(1-H6/2,H7-1)", result: "2.7764" },
        { say: "Conclusion: the p-value is bigger than 5% and the statistic is within ±2.776, so DR.", result: "DR" },
        { say: "Q2: σ = 0.3. SE then Z", formula: "=(H9-10)/F14", result: "-1.6398 (SE 0.1342)" },
        { say: "Q2 p-value", formula: "=NORM.DIST(J13,0,1,TRUE)*2", result: "0.1011" },
        { say: "Q3: σ = 2. Z", formula: "=(H9-10)/F18", result: "-0.2460 (SE 0.8944)" },
        { say: "Q3 p-value", formula: "=2*NORM.S.DIST(J17,TRUE)", result: "0.8057" },
      ],
      takeaway: "A bigger σ means a bigger SE, a Z closer to zero, and more probability in the two tails.",
      source: "Lesson 17,notes › Exercises",
    },
    {
      title: "Critical values for a sample you haven't seen yet",
      setup: "A sample of 10 boxes will be given. The standard deviation is unknown. For a test with significance 1%, what are the critical values for the test statistic?",
      steps: [
        { say: "σ unknown: T with ν = 10 − 1 = 9. Right critical value", formula: "=T.INV(1-0.01/2,9)", result: "3.2498" },
        { say: "Left critical value", formula: "=T.INV(0.01/2,9)", result: "-3.2498" },
      ],
      takeaway: "Critical values only need α, the tails and ν.",
      source: "Lesson 17,notes › Exercises F28:G29",
    },
    {
      title: "A one-tailed test on 0/1 data (Fall 2025 Exam 2, chess)",
      setup: "Games played as white: 1941 won out of 3678. X = 1 for a win. Test the null hypothesis that the mean of X is less than 0.5 (H₀: μ ≤ 0.5) with significance 0.05.",
      steps: [
        { say: "Sample mean", formula: "=C14/SUM(C14:D14)", result: "0.5277" },
        { say: "Sample variance", formula: "=(1/(SUM(C14:D14)-1))*(C14*(1-F21)^2+D14*(0-F21)^2)", result: "0.2493" },
        { say: "Critical T-value: H₀ with ≤ rejects on the right", formula: "=T.INV(0.95,SUM(C14:D14)-1)", result: "1.6453" },
        { say: "T-statistic", formula: "=(F21-0.5)/(SQRT(N23)/SQRT(SUM(C14:D14)))", result: "3.3685" },
        { say: "3.37 > 1.645, so reject.", result: "R" },
      ],
      takeaway: "H₀: μ ≤ μ₀ → right tail; H₀: μ ≥ μ₀ → left tail.",
      source: "Fall 2025 Exam 2, solutions › Chess",
    },
  ],
  quiz: [
    { q: "Same five boxes, same mean. Assuming σ = 2 instead of σ = 0.3, the p-value…", options: ["gets bigger", "gets smaller", "stays the same", "becomes negative"], answer: 0,
      why: "Larger σ → larger standard error → |Z| smaller, closer to zero → the two tails gain more probability (0.806 vs 0.101 in his notes)." },
    { q: "In Exercise 1 the T statistic was −1.14 and the critical values ±2.78. The conclusion is…", options: ["DR: the statistic is within the critical values", "R: the statistic is negative", "R: |T| < 2.78", "Can't tell without the p-value"], answer: 0,
      why: "\"Test statistic within critical values: DR\", matching the p-value 0.319 > 5%." },
    { q: "A sample of 10 will be given, σ unknown, α = 1%, two tails. The right critical value is…", options: ["=T.INV(1-0.01/2,9)", "=T.INV(1-0.01,9)", "=T.INV(1-0.01/2,10)", "=NORM.S.INV(1-0.01/2)"], answer: 0,
      why: "Two tails split α, and ν = n − 1 = 9. No data needed." },
    { q: "H₀: μ ≥ 330 with α = 0.05, σ = 3 trusted. Which pair is right?", options: ["Critical value =NORM.S.INV(0.05); p =NORM.S.DIST(Z,TRUE)", "Critical value =NORM.S.INV(0.95); p =1-NORM.S.DIST(Z,TRUE)", "Critical value =NORM.S.INV(0.975); p =2*NORM.S.DIST(Z,TRUE)", "Critical value =T.INV(0.05,16); p =T.DIST(Z,16,TRUE)"], answer: 0,
      why: "H₀ with ≥ is rejected by small values: the left tail. σ is trusted, so normal." },
    { q: "H₀: μ ≤ 0.5, T = 2.35 with ν = 999. The p-value is…", options: ["=1-T.DIST(2.35,999,TRUE)", "=T.DIST(2.35,999,TRUE)", "=2*(1-T.DIST(2.35,999,TRUE))", "=T.DIST(-2.35,999,TRUE)*2"], answer: 0,
      why: "H₀ with ≤ → right tail: 1 − T.DIST. A one-tailed test is not doubled." },
    { q: "1000 coin flips: 537 heads. The sample standard deviation is…", options: ["=SQRT((537*(1-0.537)^2+463*(0-0.537)^2)/999)", "=SQRT(0.537*0.463)", "=537/1000", "=(537-463)/1000"], answer: 0,
      why: "S divides the sum of squared deviations by n − 1. √(x̄(1−x̄)) divides by n." },
    { q: "How do you test paired data (e.g. predicted and actual age of the same viewer)?", options: ["Take the differences and run a one-sample T test on them (ν = n − 1)", "Treat them as two independent samples with ν = 2n − 2", "Use a Z test on each column", "Compare the two means by eye"], answer: 0,
      why: "For a paired sample you test the mean of the differences of the pairs: one sample, n − 1 degrees of freedom." },
    { q: "In his Chi Square simulation, the histogram of the 100 sample variances is…", options: ["right-skewed", "symmetric like the normal", "left-skewed", "uniform"], answer: 0,
      why: "Sample variances can't go below 0 but can be large, so they bunch up with a long right tail. Lesson 18 names this the chi-squared distribution." },
  ],
  excel: [
    { fn: "STDEV.S, AVERAGE, COUNT (COUNTA)", use: "Sample std_dev, sample mean and n for the test statistic." },
    { fn: "T.DIST(t,n-1,TRUE)", use: "p-values when σ is unknown: left tail T.DIST, right tail 1 − T.DIST, two tails doubled by the sign of T." },
    { fn: "NORM.S.DIST(z,TRUE) / NORM.DIST(z,0,1,TRUE)", use: "p-values when σ is assumed known (he used both forms in Lesson 17)." },
    { fn: "T.INV / NORM.S.INV", use: "Critical values: two tails ±INV(1−α/2); right tail INV(1−α); left tail INV(α)." },
    { fn: "SUMPRODUCT, SUM", use: "Mean of 0/1 outcomes from a count table (=SUMPRODUCT(outcomes,counts)/SUM(counts)), as in the Spring 2026 Final." },
    { fn: "VAR.S, MIN, MAX", use: "Row sample variances in the simulation, and the range for the histogram bins." },
    { fn: "Toolpak: Histogram", use: "Histograms of the simulated sample means and sample variances (not marked by the site)." },
  ],
  watch: [
    "Spring 2026 Exam 3 Q7 and Q8 used the same 17 cans twice: Q7 trusts σ = 3 (left-tailed Z test, H₀: μ ≥ 330), Q8 doubts σ (left-tailed T test, ν = 16). Q9 asked whether they must agree: no, different assumptions.",
    "Spring 2026 Exam 3 Q10–Q12: a coin's X ∈ {0, 1}, 537 heads in 1000 flips, then H₀: μ ≤ 0.5 (right tail). Fall 2025 Exam 2 'Chess' and Spring 2026 Final Q36–Q38 (a die, H₀: μ ≤ 3.5) are the same pattern; each gave fallback values (e.g. 'use x̄ = 0.51 and S = 0.2') if you couldn't find the mean and std dev.",
    "Fall 2025 Final 'Paired Data': complete the Difference column, then the mean, std dev, T assuming the true mean is zero, and the lower and upper critical T-values for H₀: mean difference = 0.",
    "Tails: the sign in H₀ decides it. ≤ → right tail (1 − DIST, INV(1−α)); ≥ → left tail (DIST, INV(α), negative); = → two tails (double by the sign, ±INV(1−α/2)). Don't double a one-tailed p-value.",
    "Common slips: using α/2 in a one-tailed test; a positive critical value for a left-tailed test; 1 − DIST when the test is left-tailed; NORM when σ is doubted; dividing by n instead of n − 1 for the 0/1 standard deviation.",
  ],
  makers: [cereal, onesample, counts, paired, varsim],
};
