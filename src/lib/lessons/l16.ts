// Lesson 16: One sample hypothesis tests (Week 10, Mon 2 Nov).
// Built from "Lesson 16, notes.xlsx": the student who "used" the RNG (Z test, σ known), the trivia example
// (T test, σ unknown) and the Critical values sheet (the same test done with critical values).
// Class convention: one-tail functions only; a two-tailed p-value doubles the tail the statistic points into.
import { Sheet, int, pick, round, normals, gauss, TOP, tolFor, decide, DECISIONS, type BlockMaker, type Block, type Part } from "./kit.ts";
import { normCdf, normInv, tCdf, tInv, mean, stdevS } from "../stats.ts";
import type { Lesson } from "./types.ts";

// ---------- local helpers ----------
/** Drop traps that are not numbers or sit too close to the right answer to tell apart. */
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
/** Two-tailed p-value by the class rule: double the tail the statistic points into. */
const p2 = (stat: number, cdf: (x: number) => number) => (stat < 0 ? 2 * cdf(stat) : 2 * (1 - cdf(stat)));
/** The matching formula: =2*DIST(stat) if stat < 0, =2*(1-DIST(stat)) if stat > 0. */
const p2F = (stat: number, dist: string) => (stat < 0 ? `=2*${dist}` : `=2*(1-${dist})`);
const r4 = (x: number) => String(round(x, 4));
const decisionPart = (cell: string, reject: boolean, formula: string, explain: string): Part => ({
  label: "Decision (R or DR)", cell, answer: decide(reject), formula, options: DECISIONS, explain,
});
/** Not too close to α to call: p at least 0.01 away from α (for a reject with α = 0.01, p below α/2). */
const clear = (p: number, alpha: number) => (p < alpha ? p < alpha - Math.min(0.01, alpha / 2) : p > alpha + 0.01);

// ---------- Q1: the student and the RNG (Z test, σ known) ----------
const STUDENT_SETUPS = [
  { mu: 100, sd: 15, d: 0 },
  { mu: 50, sd: 5, d: 0 },
  { mu: 20, sd: 2, d: 1 },
  { mu: 70, sd: 10, d: 0 },
  { mu: 500, sd: 25, d: 0 },
  { mu: 12, sd: 3, d: 1 },
] as const;

const student: BlockMaker = {
  key: "l16.student",
  title: "Did the student really use the RNG? Two-tailed Z test, σ known",
  make(rng): Block {
    const st = pick(rng, STUDENT_SETUPS);
    const alpha = pick(rng, [0.01, 0.05, 0.1]);
    const n = int(rng, 6, 12);
    const want = rng() < 0.5; // reject?
    const crit = normInv(1 - alpha / 2);
    const se = st.sd / Math.sqrt(n);
    let xs: number[] = [];
    let z = 0, p = 1;
    for (let tries = 0; tries < 400; tries++) {
      const base = normals(rng, n, st.mu, st.sd, st.d);
      const target = want ? (rng() < 0.5 ? -1 : 1) * (crit + 0.3 + 1.6 * rng()) : (2 * rng() - 1) * (crit - 0.35);
      const shift = round(st.mu + target * se - mean(base), st.d);
      xs = base.map((v) => round(v + shift, st.d));
      z = (mean(xs) - st.mu) / se;
      p = p2(z, normCdf);
      if ((p < alpha) === want && clear(p, alpha)) break;
    }
    const xbar = mean(xs), reject = p < alpha;

    const S = new Sheet();
    const D = S.table("C", TOP + 1, ["Sample"], xs.map((v) => [v]));
    const R = D.cols.Sample.range;
    S.header(`E${TOP + 1}`, "Given").header(`F${TOP + 1}`, "Value");
    S.label(`E${TOP + 2}`, "alpha").given(`F${TOP + 2}`, alpha);
    S.label(`E${TOP + 3}`, "hyp mean").given(`F${TOP + 3}`, st.mu);
    S.label(`E${TOP + 4}`, "std_dev (true)").given(`F${TOP + 4}`, st.sd);
    S.header(`H${TOP + 1}`, "Question").header(`I${TOP + 1}`, "Your answer");
    const r = TOP + 2;
    S.ask(`H${r}`, clean({ label: "sample statistic: the sample mean", cell: `I${r}`, answer: xbar, formula: `=AVERAGE(${R})`,
      explain: "The sample statistic for a test about μ is the sample mean." }));
    S.ask(`H${r + 1}`, { label: "sample size n", cell: `I${r + 1}`, answer: n, tol: 0, formula: `=COUNT(${R})`,
      explain: "Count the sample (he used COUNTA; COUNT gives the same here)." });
    S.ask(`H${r + 2}`, clean({ label: "SE", cell: `I${r + 2}`, answer: se, formula: `=F${TOP + 4}/SQRT(I${r + 1})`,
      explain: "The standard error of the mean is σ/√n, with the true σ the student was told to use.",
      traps: [{ value: st.sd, why: "That's σ itself. The standard error is σ/√n." }, { value: st.sd / Math.sqrt(n - 1), why: "Divided by √(n − 1). The standard error is σ/√n." }] }));
    S.ask(`H${r + 3}`, clean({ label: "Z statistic", cell: `I${r + 3}`, answer: z, formula: `=(I${r}-F${TOP + 3})/I${r + 2}`,
      explain: "Z = (x̄ − hypothesized mean)/SE. σ is known, so the statistic is a Z.",
      traps: [{ value: (xbar - st.mu) / st.sd, why: "Divided by σ instead of the standard error σ/√n." }, { value: -z, why: "Wrong way round: it's x̄ minus the hypothesized mean." }] }));
    S.ask(`H${r + 4}`, clean({ label: "p-value", cell: `I${r + 4}`, answer: p, format: "prob", formula: p2F(z, `NORM.S.DIST(I${r + 3},TRUE)`),
      explain: `H₀: μ = ${st.mu} is two-tailed, so double the tail the Z points into: Z is ${z < 0 ? "negative, so 2*NORM.S.DIST(Z,TRUE)" : "positive, so 2*(1-NORM.S.DIST(Z,TRUE))"}.`,
      traps: [{ value: p / 2, why: "That's one tail. With H₀: μ = value, double it to get both tails." }, { value: 1 - p / 2, why: "Took the tail on the wrong side of Z." }] }));
    S.ask(`H${r + 5}`, decisionPart(`I${r + 5}`, reject, `=IF(I${r + 4}<F${TOP + 2},"R","DR")`,
      `p = ${r4(p)} is ${reject ? "smaller" : "bigger"} than α = ${alpha}, so ${reject ? "reject (R)" : "do not reject (DR)"} the null hypothesis.`));
    return {
      tab: "Student and the RNG", title: "Did the student really use the RNG?",
      text: [
        `You ask a student to use the RNG to generate ${n} normally distributed random numbers (rounded) with mean ${st.mu} and std_dev ${st.sd}. The student produces the sample below. You have reason to doubt the student is telling the truth.`,
        `Run the hypothesis test H₀: μ = ${st.mu} against H_A: μ ≠ ${st.mu} with significance α = ${alpha}, using the true std_dev ${st.sd}.`,
        "Fill the yellow cells with formulas that point at the sample and the givens. For the decision write R (reject) or DR (don't reject).",
      ],
      cells: S.cells, parts: S.parts,
      manual: [`Practise the RNG yourself: Data > Data Analysis > Random Number Generation, Normal, mean ${st.mu}, std_dev ${st.sd}, ${n} numbers, then ROUND them. Self-check: run the same test on your own numbers; an honest sample is rejected only about ${Math.round(alpha * 100)}% of the time.`],
    };
  },
};

// ---------- Q2: the trivia example (T test, σ unknown) ----------
const TRIVIA = [
  { what: "trivia scores (out of 10) of a sample of college students", top: 10, claim: "the average trivia score of all college students" },
  { what: "ratings (out of 10) a sample of customers gave a new café", top: 10, claim: "the average rating from all customers" },
  { what: "quiz scores (out of 20) of a sample of first-year students", top: 20, claim: "the average quiz score of all first-years" },
  { what: "numbers of books read last year by a sample of students", top: 15, claim: "the average number of books read by all students" },
] as const;

const trivia: BlockMaker = {
  key: "l16.trivia",
  title: "Trivia results: two-tailed T test, σ unknown",
  make(rng): Block {
    const ctx = pick(rng, TRIVIA);
    const alpha = pick(rng, [0.05, 0.1, 0.01]);
    const want = rng() < 0.5;
    let xs: number[] = [], mu0 = 0, n = 0;
    for (let tries = 0; tries < 400; tries++) {
      n = int(rng, 20, 34);
      const centre = ctx.top * (0.35 + 0.3 * rng());
      const sd = ctx.top * (0.18 + 0.08 * rng());
      xs = Array.from({ length: n }, () => Math.min(ctx.top, Math.max(0, Math.round(centre + sd * gauss(rng)))));
      const xb = mean(xs), se = stdevS(xs) / Math.sqrt(n);
      if (!(se > 0)) continue;
      const base = Math.round(xb * 2) / 2;
      const cands: number[] = [];
      for (let k = -10; k <= 10; k++) {
        const m0 = base + k * 0.5;
        if (m0 <= 0 || m0 >= ctx.top) continue;
        const t = (xb - m0) / se, p = p2(t, (x) => tCdf(x, n - 1));
        if ((p < alpha) === want && clear(p, alpha) && Math.abs(t) < 6) cands.push(m0);
      }
      if (cands.length) { mu0 = pick(rng, cands); break; }
    }
    const xbar = mean(xs), s = stdevS(xs), se = s / Math.sqrt(n), t = (xbar - mu0) / se;
    const p = p2(t, (x) => tCdf(x, n - 1)), reject = p < alpha;

    const S = new Sheet();
    // Lay the scores out like his sheet: one column of results.
    const D = S.table("B", TOP + 1, ["Results"], xs.map((v) => [v]));
    const R = D.cols.Results.range;
    S.header(`D${TOP + 1}`, "Given").header(`E${TOP + 1}`, "Value");
    S.label(`D${TOP + 2}`, "alpha").given(`E${TOP + 2}`, alpha);
    S.label(`D${TOP + 3}`, "hypothesized mean").given(`E${TOP + 3}`, mu0);
    S.header(`G${TOP + 1}`, "Question").header(`H${TOP + 1}`, "Your answer");
    const r = TOP + 2;
    S.ask(`G${r}`, { label: "n", cell: `H${r}`, answer: n, tol: 0, formula: `=COUNT(${R})`, explain: "Count the results." });
    S.ask(`G${r + 1}`, clean({ label: "sample mean", cell: `H${r + 1}`, answer: xbar, formula: `=AVERAGE(${R})`, explain: "The sample statistic is the sample mean." }));
    S.ask(`G${r + 2}`, clean({ label: "sample std_dev", cell: `H${r + 2}`, answer: s, formula: `=STDEV.S(${R})`,
      explain: "σ is unknown, so estimate it with the sample standard deviation STDEV.S (divides by n − 1).",
      traps: [{ value: s * Math.sqrt((n - 1) / n), why: "That's STDEV.P (divides by n). Use the sample standard deviation STDEV.S." }] }));
    S.ask(`G${r + 3}`, clean({ label: "(sample) standard error", cell: `H${r + 3}`, answer: se, formula: `=H${r + 2}/SQRT(H${r})`,
      explain: "The (sample) standard error is S/√n.", traps: [{ value: s, why: "That's S itself; divide by √n." }] }));
    S.ask(`G${r + 4}`, clean({ label: "T-statistic", cell: `H${r + 4}`, answer: t, formula: `=(H${r + 1}-E${TOP + 3})/H${r + 3}`,
      explain: "T = (x̄ − hypothesized mean)/(S/√n). With S in place of σ it follows a t distribution with n − 1 degrees of freedom.",
      traps: [{ value: (xbar - mu0) / s, why: "Divided by S instead of the standard error S/√n." }, { value: -t, why: "Wrong way round: x̄ minus the hypothesized mean." }] }));
    S.ask(`G${r + 5}`, clean({ label: "p-value", cell: `H${r + 5}`, answer: p, format: "prob", formula: p2F(t, `T.DIST(H${r + 4},H${r}-1,TRUE)`),
      explain: `Two-tailed with ν = n − 1 = ${n - 1}: T is ${t < 0 ? "negative, so 2*T.DIST(T,ν,TRUE)" : "positive, so 2*(1-T.DIST(T,ν,TRUE))"}.`,
      traps: [{ value: p / 2, why: "That's one tail. H₀: μ = value is two-tailed, so double it." },
        { value: p2(t, normCdf), why: "Used NORM.S.DIST. σ is unknown, so use T.DIST with n − 1 degrees of freedom." },
        { value: p2(t, (x) => tCdf(x, n)), why: "Used ν = n. The degrees of freedom are n − 1." }] }));
    S.ask(`G${r + 6}`, decisionPart(`H${r + 6}`, reject, `=IF(H${r + 5}<E${TOP + 2},"R","DR")`,
      `p = ${r4(p)} is ${reject ? "smaller" : "larger"} than α = ${alpha}, so ${reject ? "reject (R)" : "do not reject (DR)"} the null hypothesis.`));
    return {
      tab: "Trivia T test", title: "Testing a mean with σ unknown",
      text: [
        `Below are the ${ctx.what}. Someone claims ${ctx.claim} is ${mu0}.`,
        `Test H₀: μ = ${mu0} against H_A: μ ≠ ${mu0} with significance α = ${alpha}. The true standard deviation is not known.`,
        "Note: the scores themselves are not normally distributed; the test is about the sample mean. Write R or DR for the decision.",
      ],
      cells: S.cells, parts: S.parts,
    };
  },
};

// ---------- Q3: the Critical values sheet ----------
const CRIT_CTX = [
  { what: "guesses of Dr Phil's age from a class trivia quiz", unit: "years", mu: [30, 45], sd: [8, 18] },
  { what: "times (minutes) a sample of commuters took to get to campus", unit: "minutes", mu: [25, 45], sd: [6, 12] },
  { what: "weights (g) of a sample of apples from an orchard", unit: "g", mu: [140, 200], sd: [12, 25] },
  { what: "monthly phone bills ($) of a sample of students", unit: "$", mu: [40, 80], sd: [10, 20] },
] as const;

const critical: BlockMaker = {
  key: "l16.critical",
  title: "Critical value test (Z or T), two-tailed",
  make(rng): Block {
    const ctx = pick(rng, CRIT_CTX);
    const known = rng() < 0.5;
    const alpha = pick(rng, [0.05, 0.1, 0.01]);
    const want = rng() < 0.5;
    const sdTrue = round(ctx.sd[0] + (ctx.sd[1] - ctx.sd[0]) * rng(), 0);
    let xs: number[] = [], mu0 = 0, n = 0;
    for (let tries = 0; tries < 400; tries++) {
      n = int(rng, 25, 45);
      const centre = ctx.mu[0] + (ctx.mu[1] - ctx.mu[0]) * rng();
      xs = normals(rng, n, centre, sdTrue, 0).map((v) => Math.max(1, v));
      const xb = mean(xs), se = (known ? sdTrue : stdevS(xs)) / Math.sqrt(n);
      const crit = known ? normInv(1 - alpha / 2) : tInv(1 - alpha / 2, n - 1);
      const cands: number[] = [];
      for (let k = -12; k <= 12; k++) {
        const m0 = Math.round(xb) + k;
        const st = (xb - m0) / se;
        const p = p2(st, known ? normCdf : (x) => tCdf(x, n - 1));
        if ((Math.abs(st) > crit) === want && (p < alpha) === want && clear(p, alpha) && Math.abs(st) < 7) cands.push(m0);
      }
      if (cands.length) { mu0 = pick(rng, cands); break; }
    }
    const xbar = mean(xs), s = stdevS(xs), sig = known ? sdTrue : s, se = sig / Math.sqrt(n), stat = (xbar - mu0) / se;
    const crit = known ? normInv(1 - alpha / 2) : tInv(1 - alpha / 2, n - 1);
    const reject = stat < -crit || stat > crit;
    const L = known ? "Z" : "T";

    const S = new Sheet();
    const D = S.table("B", TOP + 1, ["Sample"], xs.map((v) => [v]));
    const R = D.cols.Sample.range;
    S.header(`D${TOP + 1}`, "Given").header(`E${TOP + 1}`, "Value");
    S.label(`D${TOP + 2}`, "alpha").given(`E${TOP + 2}`, alpha);
    S.label(`D${TOP + 3}`, "hypothesized mean").given(`E${TOP + 3}`, mu0);
    if (known) S.label(`D${TOP + 4}`, "true std_dev σ").given(`E${TOP + 4}`, sdTrue);
    S.header(`G${TOP + 1}`, "Question").header(`H${TOP + 1}`, "Your answer");
    let r = TOP + 2;
    const nCell = `H${r}`, mCell = `H${r + 1}`;
    S.ask(`G${r}`, { label: "n", cell: nCell, answer: n, tol: 0, formula: `=COUNT(${R})`, explain: "Count the sample." });
    S.ask(`G${r + 1}`, clean({ label: "sample mean", cell: mCell, answer: xbar, formula: `=AVERAGE(${R})`, explain: "The sample statistic." }));
    r += 2;
    let sdRef = `E${TOP + 4}`;
    if (!known) {
      sdRef = `H${r}`;
      S.ask(`G${r}`, clean({ label: "sample std_dev", cell: sdRef, answer: s, formula: `=STDEV.S(${R})`, explain: "σ is unknown: use STDEV.S.",
        traps: [{ value: s * Math.sqrt((n - 1) / n), why: "That's STDEV.P. Use STDEV.S (n − 1)." }] }));
      r++;
    }
    const seCell = `H${r}`;
    S.ask(`G${r}`, clean({ label: "SE", cell: seCell, answer: se, formula: `=${sdRef}/SQRT(${nCell})`,
      explain: known ? "SE = σ/√n with the true σ." : "SE = S/√n, the (sample) standard error." }));
    const statCell = `H${r + 1}`;
    S.ask(`G${r + 1}`, clean({ label: `test statistic (${L})`, cell: statCell, answer: stat, formula: `=(${mCell}-E${TOP + 3})/${seCell}`,
      explain: `${L} = (x̄ − hypothesized mean)/SE.`,
      traps: [{ value: (xbar - mu0) / sig, why: "Divided by the standard deviation, not the standard error." }] }));
    const loCell = `H${r + 2}`, hiCell = `H${r + 3}`;
    const invHi = known ? `NORM.S.INV(1-E${TOP + 2}/2)` : `T.INV(1-E${TOP + 2}/2,${nCell}-1)`;
    const wrongOther = known ? tInv(1 - alpha / 2, n - 1) : normInv(1 - alpha / 2);
    S.ask(`G${r + 2}`, clean({ label: "left critical value", cell: loCell, answer: -crit, formula: `=-${invHi}`,
      explain: `Two tails, so α/2 in each: the left critical value is −${known ? "NORM.S.INV" : "T.INV"}(1 − α/2${known ? "" : ", n − 1"}) (the same as ${known ? "Z" : "T"}_α/2 in a confidence interval, with a minus sign).`,
      traps: [{ value: known ? normInv(alpha) : tInv(alpha, n - 1), why: "Used α instead of α/2: a two-tailed test splits α between the tails." },
        { value: -wrongOther, why: known ? "Used T.INV, but σ is known: use NORM.S.INV." : "Used NORM.S.INV, but σ is unknown: use T.INV with n − 1 degrees of freedom." }] }));
    S.ask(`G${r + 3}`, clean({ label: "right critical value", cell: hiCell, answer: crit, formula: `=${invHi}`,
      explain: `The right critical value is ${known ? "NORM.S.INV(1 − α/2)" : "T.INV(1 − α/2, n − 1)"}.`,
      traps: [{ value: known ? normInv(1 - alpha) : tInv(1 - alpha, n - 1), why: "Used 1 − α instead of 1 − α/2." },
        { value: wrongOther, why: known ? "Used T.INV, but σ is known: use NORM.S.INV." : "Used NORM.S.INV, but σ is unknown: use T.INV with n − 1 degrees of freedom." }] }));
    S.ask(`G${r + 4}`, decisionPart(`H${r + 4}`, reject, `=IF(OR(${statCell}<${loCell},${statCell}>${hiCell}),"R","DR")`,
      `${L} = ${r4(stat)} is ${reject ? "outside" : "inside"} the critical values ±${r4(crit)}, so ${reject ? "reject (R)" : "do not reject (DR)"}.`));
    return {
      tab: "Critical value test", title: "Critical value test for a mean",
      text: [
        `The sample below shows ${ctx.what}.`,
        `Test the null hypothesis that the population mean is ${mu0} ${ctx.unit} (H₀: μ = ${mu0}) with a ${Math.round(alpha * 100)}% significance using a critical value test.`,
        known ? `Assume the true standard deviation is known: σ = ${sdTrue}.` : "The true standard deviation is not known.",
        "Reject if the test statistic falls outside the critical values. Write R or DR for the decision.",
      ],
      cells: S.cells, parts: S.parts,
    };
  },
};

export const LESSON_16: Lesson = {
  n: 16,
  title: "One sample hypothesis tests",
  unit: 2,
  week: "Week 10 · Mon 2 Nov · One sample hypothesis tests",
  sources: ["Lesson 16, notes.xlsx"],
  summary:
    "A hypothesis test assumes the null hypothesis is true and asks how likely a sample this extreme (or worse) would be: that probability is the p-value, and we reject when it is smaller than the significance α. This lesson does it for a mean with σ known (a Z statistic) and σ unknown (a T statistic), first with p-values and then with critical values.",
  defs: [
    { term: "Significance α (Step 0)", text: "Step 0) Decide a tolerance/significance alpha. In his example α = 0.01: \"A 1% probability makes me suspicious.\"", source: "Lesson 16, notes › Hypothesis testing E14, M9:O9" },
    { term: "The big idea", text: "We assume the student is telling the truth (the null hypothesis) and calculate the probability that they would find this result or worse (worse = extreme).", source: "Lesson 16, notes › Hypothesis testing E11:E12" },
    { term: "Null hypothesis H₀ (Step 1)", text: "Formulate a null and alternative hypothesis. The null hypothesis is the default/thing you are suspicious about, e.g. H_0: mu = 100.", source: "Lesson 16, notes › Hypothesis testing E16, F18" },
    { term: "Alternative hypothesis H_A", text: "The alternative to the null, e.g. H_A: mu ≠ 100.", source: "Lesson 16, notes › Hypothesis testing F20" },
    { term: "p-value (Step 2)", text: "We use our sampling distribution to calculate the probability of obtaining the sample statistic or worse. This probability is called the p-value.", source: "Lesson 16, notes › Hypothesis testing E22:F23" },
    { term: "Sample statistic", text: "For a test about the mean, the sample statistic is the sample mean (=AVERAGE of the sample).", source: "Lesson 16, notes › Hypothesis testing F25" },
    { term: "Z statistic (σ known)", text: "SE = std_dev (true)/SQRT(n), and the Z statistic = (sample mean − hyp mean)/SE.", source: "Lesson 16, notes › Hypothesis testing F30:I32" },
    { term: "T statistic (σ unknown)", text: "Use the sample std_dev (STDEV.S) and the (sample) standard error S/√n: T = (sample mean − hypothesized mean)/(S/√n), with n − 1 degrees of freedom in T.DIST.", source: "Lesson 16, notes › example G15:J17, N12" },
    { term: "Two tails", text: "With H_A: mu ≠ value, double the probability to get both tails: =2*NORM.S.DIST(Z,TRUE) for his negative Z.", source: "Lesson 16, notes › Hypothesis testing M27:N27" },
    { term: "Decision (Step 3)", text: "Is your p-value smaller than alpha? If yes, REJECT THE NULL HYPOTHESIS. If the p-value is bigger than alpha then we DO NOT REJECT THE NULL HYPOTHESIS. (On exams: R or DR.)", source: "Lesson 16, notes › Hypothesis testing E34:F38" },
    { term: "Rejecting is not proof", text: "Just because we reject the null hypothesis it does not mean it is false! Extremely low p-value events do happen in the real world!", source: "Lesson 16, notes › Hypothesis testing E40:G41" },
    { term: "Critical values", text: "A different way of doing Step 2 which gives the same result: instead of calculating a p-value you find critical values of the T/Z-statistic such that if your T/Z-statistic exceeds these values you reject. They are the same as the Z_{alpha/2} and T_{alpha/2} appearing in the confidence intervals.", source: "Lesson 16, notes › Critical values B2:B7" },
    { term: "Non-normal data", text: "In the trivia example he notes that the random variable X (trivia score) is not normally distributed; the test is still run on the sample mean of the 32 results.", source: "Lesson 16, notes › example E6" },
  ],
  examples: [
    {
      title: "The student who \"used\" the RNG",
      setup: "A student was asked to use the RNG to generate 8 normally distributed random numbers (rounded) with mean 100 and std_dev 15. They produced 80, 80, 83, 80, 79, 79, 80, 81 (in C5:C12). \"This was possible: prove me wrong!\" Test H₀: μ = 100 against H_A: μ ≠ 100 with α = 0.01.",
      steps: [
        { say: "Sample statistic: the sample mean", formula: "=AVERAGE(C5:C12)", result: "80.25" },
        { say: "Sample size", formula: "=COUNTA(C5:C12)", result: "8" },
        { say: "Givens: alpha 0.01 (I28), hyp mean 100 (I29), std_dev (true) 15 (I30). Standard error", formula: "=I30/SQRT(I27)", result: "5.3033" },
        { say: "Z statistic", formula: "=(K25-I29)/I31", result: "-3.7241" },
        { say: "p-value: Z is negative, so double the left tail to get both tails", formula: "=2*NORM.S.DIST(I32,TRUE)", result: "0.000196 (0.0196%)" },
        { say: "Step 3: p-value < alpha, so reject the null hypothesis (R).", result: "R" },
      ],
      takeaway: "If the student is telling the truth, the chance of this sample or worse is 0.0196%: reject, but remember this is not proof.",
      source: "Lesson 16, notes › Hypothesis testing",
    },
    {
      title: "Trivia results (σ unknown)",
      setup: "32 trivia results (B3:B34) from a sample of college students. Test H₀: μ = 5 against H_A: μ ≠ 5 with α = 0.05. The trivia score is not normally distributed and σ is unknown.",
      table: { head: ["Results (by row of 8)", "", "", "", "", "", "", ""], rows: [[3, 8, 9, 2, 3, 3, 8, 10], [7, 8, 7, 4, 6, 4, 5, 1], [4, 8, 4, 4, 3, 7, 3, 6], [6, 8, 2, 4, 5, 8, 2, 8]] },
      steps: [
        { say: "n", formula: "=COUNTA(B3:B34)", result: "32" },
        { say: "Sample mean", formula: "=AVERAGE(B3:B34)", result: "5.3125" },
        { say: "Sample std_dev", formula: "=STDEV.S(B3:B34)", result: "2.4421" },
        { say: "(Sample) standard error", formula: "=J15/SQRT(J13)", result: "0.4317" },
        { say: "T-statistic", formula: "=(J14-5)/J16", result: "0.7239" },
        { say: "p-value: T is positive, so double the right tail (he also wrote =2*T.DIST(-J17,J13-1,TRUE), the same number)", formula: "=2*(1-T.DIST(J17,J13-1,TRUE))", result: "0.4746" },
        { say: "Step 3: the p-value is larger than alpha, so we do not reject the null hypothesis (DR).", result: "DR" },
      ],
      takeaway: "σ unknown: use STDEV.S, S/√n and T.DIST with n − 1 degrees of freedom.",
      source: "Lesson 16, notes › example",
    },
    {
      title: "Critical value test: Dr Phil's age",
      setup: "93 age guesses from the trivia quiz (B12:B106, two outliers removed). Test the null hypothesis that Dr Phil's age is 34 with a 5% significance using a critical value test.",
      steps: [
        { say: "Sample mean", formula: "=AVERAGE(B12:B106)", result: "46.3564" },
        { say: "n", formula: "=COUNTA(B12:B106)", result: "93" },
        { say: "Sample std_dev", formula: "=STDEV.S(B12:B106)", result: "18.2295" },
        { say: "SE", formula: "=H14/SQRT(H13)", result: "1.8903" },
        { say: "Test statistic", formula: "=(H12-34)/H15", result: "6.5367" },
        { say: "Critical T-values: he typed =T.INV(0.05/2,H13-1) = −1.986 for the left one; the right one is", formula: "=T.INV(1-0.05/2,H13-1)", result: "1.9861" },
        { say: "The T-stat exceeds the right critical value +1.99, so we reject the null hypothesis.", result: "R" },
      ],
      takeaway: "Reject when the statistic lands beyond a critical value: the same decision the p-value gives.",
      source: "Lesson 16, notes › Critical values",
    },
  ],
  quiz: [
    { q: "In his notes, what is the null hypothesis?", options: ["The default, the thing you are suspicious about", "The thing you hope to prove", "Whatever the sample mean says", "The hypothesis with the ≠ sign"], answer: 0,
      why: "Step 1: \"The null hypothesis is default/thing you are suspicious about\", e.g. H_0: mu = 100. The ≠ goes in the alternative." },
    { q: "What is the p-value?", options: ["The probability that H₀ is true", "Assuming H₀, the probability of obtaining the sample statistic or worse", "The probability of making a mistake", "The significance α"], answer: 1,
      why: "Step 2: we assume the null and use the sampling distribution to find the probability of the sample statistic or worse (more extreme)." },
    { q: "The p-value is 0.03 and α = 0.05. The decision is…", options: ["R: reject the null hypothesis", "DR: do not reject", "It depends on n", "Accept the alternative as proved"], answer: 0,
      why: "Step 3: p-value smaller than alpha, so reject. Rejecting is still not proof." },
    { q: "We reject H₀: μ = 100. Does that mean μ is not 100?", options: ["Yes, it is proved false", "No: extremely low p-value events do happen", "Only if α = 0.01", "Only if n > 30"], answer: 1,
      why: "\"Just because we reject the null hypothesis it does not mean it is false!\"" },
    { q: "σ = 15 is known, n = 8, x̄ = 80.25, H₀: μ = 100. Which formula gives the p-value (Z in I32)?", options: ["=2*NORM.S.DIST(I32,TRUE)", "=NORM.S.DIST(I32,TRUE)", "=2*(1-NORM.S.DIST(I32,TRUE))", "=1-NORM.S.DIST(I32,TRUE)"], answer: 0,
      why: "Z ≈ −3.72 is negative and the test is two-tailed, so double the left tail: 2*NORM.S.DIST(Z,TRUE). 2*(1−…) would give nearly 2." },
    { q: "σ is unknown. Which statistic and distribution?", options: ["Z with NORM.S.DIST", "T = (x̄ − μ₀)/(S/√n) with T.DIST and n − 1 degrees of freedom", "T with n degrees of freedom", "Z with STDEV.P"], answer: 1,
      why: "The trivia example uses STDEV.S, the (sample) standard error S/√n and T.DIST(…, n − 1, TRUE)." },
    { q: "T = 0.72 with ν = 31 in a two-tailed test. The class formula for the p-value is…", options: ["=2*(1-T.DIST(0.72,31,TRUE))", "=2*T.DIST(0.72,31,TRUE)", "=T.DIST(0.72,31,TRUE)", "=1-T.DIST(0.72,31,TRUE)"], answer: 0,
      why: "T is positive, so double the right tail: 2*(1 − T.DIST). 2*T.DIST(0.72,…) is bigger than 1." },
    { q: "How are critical values for a two-tailed test related to confidence intervals?", options: ["They are the Z_{α/2} or T_{α/2} from the intervals", "They are the interval's limits", "They are unrelated", "They are α/2"], answer: 0,
      why: "\"This is the same as the Z_{alpha/2} and T_{alpha/2} appearing in the confidence intervals.\" Reject if the statistic is beyond them." },
    { q: "The critical value method and the p-value method…", options: ["give the same decision", "can disagree", "need different α", "only work for Z"], answer: 0,
      why: "\"There is a different way of doing Step 2 which gives the same result.\"" },
  ],
  excel: [
    { fn: "AVERAGE / COUNT (COUNTA)", use: "The sample mean (the sample statistic) and the sample size n." },
    { fn: "STDEV.S", use: "The sample std_dev when σ is unknown (divides by n − 1)." },
    { fn: "SQRT", use: "Standard error: σ/SQRT(n), or S/SQRT(n) when σ is unknown." },
    { fn: "NORM.S.DIST(z,TRUE)", use: "Z-test p-value. Two tails: =2*NORM.S.DIST(z,TRUE) if z < 0, =2*(1-NORM.S.DIST(z,TRUE)) if z > 0." },
    { fn: "T.DIST(t,n-1,TRUE)", use: "T-test p-value, doubled the same way for two tails (class convention: no T.DIST.2T, no ABS)." },
    { fn: "NORM.S.INV / T.INV", use: "Critical values for two tails: ±NORM.S.INV(1-α/2) or ±T.INV(1-α/2,n-1)." },
    { fn: "IF", use: "Optional: =IF(p<alpha,\"R\",\"DR\") writes the decision." },
  ],
  watch: [
    "Spring 2026 Exam 3 Q6: the student's 5 RNG numbers with σ = 5 known, test H₀: μ = 55 with α = 0.05 (two-tailed Z). The answer template asks for n, alpha, test statistic, critical value, p value and a decision written R or DR.",
    "Fall 2025 Exam 2 'Test for Mean': critical Z values ±NORM.S.INV(1-0.05/2), the Z statistic (x̄ − 525)/(15/√138), and the p-value =2*NORM.S.DIST(Z,TRUE) because Z was negative.",
    "Spring 2026 Final Q35: a student's 20 RNG numbers, H₀: μ = 20 with α = 0.05; the solution used a T test (critical values ±T.INV(1-α/2,19)) and also accepted a Z test with σ = 2.",
    "Fall 2025 Exam 2 multiple choice: 'If the null hypothesis is false then the true hypothesis is the alternative hypothesis'; 'as α decreases the distance between the two critical values increases'.",
    "Common slips: forgetting to double the p-value in a two-tailed test; doubling the wrong tail (2*(1−DIST) for a negative statistic gives a number above 1); dividing by σ instead of σ/√n; using NORM.S.DIST when σ is unknown; using n instead of n − 1 degrees of freedom.",
    "Do not round. Point at the cells: he grades the underlying value.",
  ],
  makers: [student, trivia, critical],
};
