// Lesson 15: Confidence intervals, part 3 (Week 9, Wed 28 Oct).
// Built from "Lesson 15, notes.xlsx": Tasks (recap of scenarios 1 and 2, and why an unknown σ is a problem),
// Sample variance (the "dumb variance" is biased, the sample variance is unbiased) and T distribution
// (the T-statistic, degrees of freedom, T.INV, the interval when nothing is known).
// Its "Hypothesis testing" sheet is empty: hypothesis tests start in Lesson 16.
import { Sheet, pick, round, tolFor, TOP, normals, type Block, type BlockMaker, type Rng } from "./kit.ts";
import { normInv, tInv } from "../stats.ts";
import type { Lesson } from "./types.ts";

// ---------- local helpers ----------
function tidy(S: Sheet) {
  for (const p of S.parts) {
    if (!p.traps || p.options) continue;
    const seen: number[] = [];
    p.traps = p.traps.filter((t) => {
      if (!Number.isFinite(t.value)) return false;
      if (Math.abs(t.value - Number(p.answer)) <= 1.6 * tolFor(p)) return false;
      if (seen.some((s) => Math.abs(s - t.value) < 1e-9)) return false;
      seen.push(t.value);
      return true;
    });
  }
}
const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
const devsq = (xs: number[]) => { const m = avg(xs); return xs.reduce((s, v) => s + (v - m) ** 2, 0); };
const varS = (xs: number[]) => devsq(xs) / (xs.length - 1);
const sdS = (xs: number[]) => Math.sqrt(varS(xs));
const sdP = (xs: number[]) => Math.sqrt(devsq(xs) / xs.length);
const pct = (alpha: number) => `${Math.round((1 - alpha) * 100)}%`;
const aPct = (alpha: number) => `${Math.round((1 - alpha) * 100) === 80 ? "an" : "a"} ${pct(alpha)}`;
const ALPHAS = [0.2, 0.1, 0.05, 0.01];

// ---------- Q1: dumb variance versus sample variance (his Sample variance sheet) ----------
type Pop = { what: string; mu: number; sd: number; d: number };
const POPS: Pop[] = [
  { what: "IQ scores, N(100, 15²)", mu: 100, sd: 15, d: 2 },
  { what: "exam scores, N(70, 12²)", mu: 70, sd: 12, d: 2 },
  { what: "daily sales in $1000s, N(50, 10²)", mu: 50, sd: 10, d: 2 },
  { what: "commute times in minutes, N(20, 4²)", mu: 20, sd: 4, d: 2 },
  { what: "SAT section scores, N(500, 100²)", mu: 500, sd: 100, d: 1 },
];
const TRIALS = 10;
function pairs(rng: Rng, p: Pop): number[][] {
  // Redraw until the average sample variance lands within 20% of σ², so the sheet shows his point clearly.
  let best: number[][] = [];
  for (let k = 0; k < 400; k++) {
    const ps = Array.from({ length: TRIALS }, () => normals(rng, 2, p.mu, p.sd, p.d));
    best = ps;
    const a = avg(ps.map(varS));
    if (Math.abs(a / (p.sd * p.sd) - 1) < 0.2) break;
  }
  return best;
}
const dumbVar: BlockMaker = {
  key: "l15.dumb-variance",
  title: "Biased and unbiased: \"dumb variance\" versus sample variance",
  make(rng): Block {
    const p = pick(rng, POPS);
    const ps = pairs(rng, p);
    const dumb = ps.map((x) => devsq(x) / 2);
    const samp = ps.map(varS);
    const S = new Sheet();
    const top = TOP;
    S.header(`B${top}`, "Trial").header(`C${top}`, "X1").header(`D${top}`, "X2").header(`E${top}`, "dumb variance").header(`F${top}`, "sample variance");
    ps.forEach((x, i) => {
      const row = top + 1 + i;
      S.set(`B${row}`, i + 1, "data").set(`C${row}`, x[0], "data").set(`D${row}`, x[1], "data");
      S.parts.push({
        label: `Trial ${i + 1}: dumb variance`, cell: `E${row}`, answer: dumb[i],
        formula: `=(1/2)*((C${row}-AVERAGE(C${row}:D${row}))^2+(D${row}-AVERAGE(C${row}:D${row}))^2)`,
        explain: "His E5: divide the sum of squared distances from the sample mean by n = 2 (that is the \"dumb\" part).",
        traps: [{ value: samp[i], why: "That is the sample variance (dividing by n − 1 = 1), not the dumb variance." }],
      });
      S.parts.push({
        label: `Trial ${i + 1}: sample variance`, cell: `F${row}`, answer: samp[i], formula: `=VAR.S(C${row}:D${row})`,
        explain: "His F5: =VAR.S, which divides by n − 1.",
        traps: [{ value: dumb[i], why: "Used VAR.P (divides by n): that is the dumb variance." }],
      });
    });
    const last = top + TRIALS;
    const r0 = top;
    S.header(`H${r0}`, "Summary").header(`K${r0}`, "Value");
    S.label(`H${r0 + 1}`, "true standard deviation σ (sample size n = 2)").given(`K${r0 + 1}`, p.sd);
    S.ask(`H${r0 + 2}`, {
      label: "true variance σ²", cell: `K${r0 + 2}`, answer: p.sd ** 2, formula: `=K${r0 + 1}^2`,
      explain: "His K13: =15^2. The population variance is a parameter.",
      traps: [{ value: p.sd, why: "That is σ: square it." }],
    });
    S.ask(`H${r0 + 3}`, {
      label: "average dumb variance", cell: `K${r0 + 3}`, answer: avg(dumb), formula: `=AVERAGE(E${top + 1}:E${last})`,
      explain: "His M14. On average it comes out near half of σ² for n = 2: \"Not close to true variance\".",
    });
    S.ask(`H${r0 + 4}`, {
      label: "average sample variance", cell: `K${r0 + 4}`, answer: avg(samp), formula: `=AVERAGE(F${top + 1}:F${last})`,
      explain: "His M26. On average it is close to σ²: \"Very close to true variance!\"",
    });
    S.ask(`H${r0 + 5}`, {
      label: "Which is the unbiased estimator of σ²? (Dumb variance / Sample variance)", cell: `K${r0 + 5}`, answer: "Sample variance",
      options: ["Dumb variance", "Sample variance"], formula: `"Sample variance"`,
      explain: "An estimate is biased if on average it is not equal to the true parameter. The dumb variance is biased; the sample variance (n − 1) is unbiased.",
    });
    tidy(S);
    return {
      tab: "Dumb vs sample variance", title: "Biased estimators: dumb variance and sample variance",
      text: [
        `Someone sampled X_1, X_2 from ${p.what}, ten times (his task used twenty).`,
        "For each trial compute the \"dumb variance\" (divide by n = 2) and the sample variance (VAR.S, divide by n − 1 = 1), then average each column and compare with the true variance.",
        "Fill the yellow cells with formulas that point at the trials.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [`Redo it with the RNG: 20 (or 1000) rows of two Normal values with mean ${p.mu} and sd ${p.sd}. Self-check: the average sample variance gets close to ${p.sd ** 2}, the average dumb variance close to half of it.`],
    };
  },
};

// ---------- Q2: nothing known, the t interval (his T distribution sheet) ----------
type Ctx = { what: string; unit: string; mu: number; sd: number; d: number };
const CTXS: Ctx[] = [
  { what: "A random variable is sampled", unit: "", mu: 4, sd: 1.5, d: 0 },
  { what: "A food critic records the cost of a meal at restaurants in the city", unit: "dollars", mu: 48, sd: 12, d: 2 },
  { what: "A commuter records how long the drive to work takes", unit: "minutes", mu: 34, sd: 6, d: 1 },
  { what: "A lab measures the battery life of a new phone", unit: "hours", mu: 22, sd: 3, d: 1 },
  { what: "A teacher records exam scores", unit: "points", mu: 72, sd: 14, d: 0 },
  { what: "A café records the number of customers per hour", unit: "customers", mu: 21, sd: 6, d: 0 },
];
const tInterval: BlockMaker = {
  key: "l15.t-interval",
  title: "Nothing known: the t interval with T.INV and ν = n − 1",
  make(rng): Block {
    const c = pick(rng, CTXS);
    const n = pick(rng, [5, 6, 7, 8, 10, 12, 15, 20, 25]);
    const alpha = pick(rng, ALPHAS);
    let xs = normals(rng, n, c.mu, c.sd, c.d);
    for (let k = 0; k < 50 && sdS(xs) === 0; k++) xs = normals(rng, n, c.mu, c.sd, c.d);
    const xbar = avg(xs), s = sdS(xs), nu = n - 1;
    const T = tInv(1 - alpha / 2, nu);
    const se = s / Math.sqrt(n);
    const lo = xbar - se * T, hi = xbar + se * T;

    const S = new Sheet();
    const t = S.table("B", TOP, ["Value"], xs.map((x) => [x]));
    const data = t.cols.Value.range;
    const r = (i: number) => TOP + i;
    S.header(`E${r(0)}`, "Quantity").header(`H${r(0)}`, "Value");
    S.ask(`E${r(1)}`, { label: "sample mean", cell: `H${r(1)}`, answer: xbar, formula: `=AVERAGE(${data})`, explain: "His H27: =AVERAGE(B25:B31)." });
    S.ask(`E${r(2)}`, { label: "n", cell: `H${r(2)}`, answer: n, tol: 0, formula: `=COUNT(${data})`, explain: "The sample size (he typed 7)." });
    S.ask(`E${r(3)}`, {
      label: "sample std_dev (S)", cell: `H${r(3)}`, answer: s, formula: `=STDEV.S(${data})`,
      explain: "His H29: =STDEV.S. σ is unknown, so estimate it with S (divides by n − 1).",
      traps: [{ value: sdP(xs), why: "Used STDEV.P: the sample standard deviation divides by n − 1, use STDEV.S." }],
    });
    S.label(`E${r(4)}`, "alpha").given(`H${r(4)}`, alpha);
    S.ask(`E${r(5)}`, {
      label: "degrees of freedom ν", cell: `H${r(5)}`, answer: nu, tol: 0, formula: `=H${r(2)}-1`,
      explain: "The degrees of freedom (Greek \"nu\") is equal to the sample size minus 1.",
      traps: [{ value: n, why: "ν is n − 1, not n." }],
    });
    S.ask(`E${r(6)}`, {
      label: "T_α/2", cell: `H${r(6)}`, answer: T, formula: `=T.INV(1-H${r(4)}/2,H${r(5)})`,
      explain: "His H31: =T.INV(1-H30/2,H28-1). T.INV works like NORM.S.INV but needs the degrees of freedom.",
      traps: [
        { value: normInv(1 - alpha / 2), why: "Used NORM.S.INV: σ is unknown, so use the t distribution (T.INV)." },
        { value: tInv(1 - alpha / 2, n), why: "Used ν = n instead of n − 1." },
        { value: tInv(1 - alpha, nu), why: "Used 1 − α instead of 1 − α/2." },
      ],
    });
    S.ask(`E${r(7)}`, {
      label: "lower", cell: `H${r(7)}`, answer: lo, formula: `=H${r(1)}-(H${r(3)}/SQRT(H${r(2)}))*H${r(6)}`,
      explain: "His K28: =H27-(H29/SQRT(H28))*H31, sample mean − (S/√n) × T_α/2.",
      traps: [
        { value: xbar - se * normInv(1 - alpha / 2), why: "Used a Z value instead of T_α/2." },
        { value: xbar - (sdP(xs) / Math.sqrt(n)) * tInv(1 - alpha / 2, nu), why: "Used STDEV.P instead of STDEV.S." },
        { value: xbar - s * T, why: "Forgot to divide S by √n." },
      ],
    });
    S.ask(`E${r(8)}`, {
      label: "upper", cell: `H${r(8)}`, answer: hi, formula: `=H${r(1)}+(H${r(3)}/SQRT(H${r(2)}))*H${r(6)}`,
      explain: "His K29: =H27+(H29/SQRT(H28))*H31.",
      traps: [{ value: xbar + se * normInv(1 - alpha / 2), why: "Used a Z value instead of T_α/2." }, { value: xbar + s * T, why: "Forgot to divide S by √n." }],
    });
    tidy(S);
    return {
      tab: "Nothing known t interval", title: "Confidence interval 3: nothing known",
      text: [
        `${c.what}. The ${n} results${c.unit ? ` (in ${c.unit})` : ""} are in column B. We do not know the true mean or the true standard deviation.`,
        `Construct a confidence interval inside which there is ${aPct(alpha)} chance the true mean belongs.`,
        "Fill the yellow cells with formulas that point at the data and alpha.",
      ],
      cells: S.cells, parts: S.parts,
    };
  },
};

// ---------- Q3: which scenario? (exam style: all three in one) ----------
const CASES = ["Both known", "Sigma known", "Nothing known"];
const threeCases: BlockMaker = {
  key: "l15.three-cases",
  title: "Which scenario? μ and σ known, σ known, or nothing known",
  make(rng): Block {
    const sc = pick(rng, [1, 2, 3]);
    const alpha = pick(rng, ALPHAS);
    const mu = pick(rng, [20, 55, 100, 250, 12]);
    const sd = pick(rng, [2, 5, 4, 15, 3]);
    const n = pick(rng, [5, 6, 8, 10, 12, 16, 20]);
    const S = new Sheet();
    const r = (i: number) => TOP + i;
    S.header(`E${r(0)}`, "Given").header(`G${r(0)}`, "Value");
    let text: string[];
    let crit: number, se: number, centre: number;
    let fCrit: string, fSe: string, fCentre: string;
    const trapsCrit: { value: number; why: string }[] = [];
    if (sc === 1) {
      S.label(`E${r(1)}`, "mu").given(`G${r(1)}`, mu);
      S.label(`E${r(2)}`, "sigma").given(`G${r(2)}`, sd);
      S.label(`E${r(3)}`, "n").given(`G${r(3)}`, n);
      S.label(`E${r(4)}`, "alpha").given(`G${r(4)}`, alpha);
      crit = normInv(1 - alpha / 2); se = sd / Math.sqrt(n); centre = mu;
      fCrit = `=NORM.S.INV(1-G${r(4)}/2)`; fSe = `=G${r(2)}/SQRT(G${r(3)})`; fCentre = `=G${r(1)}`;
      trapsCrit.push({ value: tInv(1 - alpha / 2, n - 1), why: "Used T.INV: σ is known, so the critical value is a Z value." });
      text = [
        `Someone is about to use the random number generator to generate ${n} numbers according to a normal distribution with μ = ${mu} and σ = ${sd}.`,
        `Before they produce the numbers, construct an interval inside which there is ${aPct(alpha)} chance their sample mean will belong.`,
        "Say which scenario this is, then fill the yellow cells with formulas that point at the givens.",
      ];
    } else {
      const shift = pick(rng, [-2, -1, 0, 1, 2]) * sd / Math.sqrt(n);
      const xs = normals(rng, n, mu + shift, sd, sd < 5 ? 2 : 1);
      const t = S.table("B", TOP, [sc === 2 ? "Table (σ known)" : "Table"], xs.map((x) => [x]));
      const data = t.cols[Object.keys(t.cols)[0]].range;
      const xbar = avg(xs);
      centre = xbar; fCentre = `=AVERAGE(${data})`;
      if (sc === 2) {
        S.label(`E${r(1)}`, "sigma").given(`G${r(1)}`, sd);
        S.label(`E${r(2)}`, "alpha").given(`G${r(2)}`, alpha);
        crit = normInv(1 - alpha / 2); se = sd / Math.sqrt(n);
        fCrit = `=NORM.S.INV(1-G${r(2)}/2)`; fSe = `=G${r(1)}/SQRT(COUNT(${data}))`;
        trapsCrit.push({ value: tInv(1 - alpha / 2, n - 1), why: "Used T.INV: σ is known, so the critical value is a Z value." });
        text = [
          `A student used the random number generator to make the ${n} numbers in column B with σ = ${sd}, but thinks they made a mistake typing in the mean. They remain confident their standard deviation was correct.`,
          `Construct an interval inside which there is ${aPct(alpha)} chance their actual mean belongs.`,
          "Say which scenario this is, then fill the yellow cells with formulas that point at the data and givens.",
        ];
      } else {
        S.label(`E${r(1)}`, "alpha").given(`G${r(1)}`, alpha);
        crit = tInv(1 - alpha / 2, n - 1); se = sdS(xs) / Math.sqrt(n);
        fCrit = `=T.INV(1-G${r(1)}/2,COUNT(${data})-1)`; fSe = `=STDEV.S(${data})/SQRT(COUNT(${data}))`;
        trapsCrit.push({ value: normInv(1 - alpha / 2), why: "Used NORM.S.INV: nothing is known, so use T.INV with ν = n − 1." });
        trapsCrit.push({ value: tInv(1 - alpha / 2, n), why: "Used ν = n instead of n − 1." });
        text = [
          `Column B shows a sample of ${n} independent and identical normally distributed values. We do not know the population parameters.`,
          `Construct a confidence interval inside which there is ${aPct(alpha)} chance the true mean of the population belongs.`,
          "Say which scenario this is, then fill the yellow cells with formulas that point at the data and alpha.",
        ];
      }
    }
    S.header(`I${r(0)}`, "Question").header(`L${r(0)}`, "Your answer");
    const name = CASES[sc - 1];
    S.ask(`I${r(1)}`, {
      label: "Scenario (Both known / Sigma known / Nothing known)", cell: `L${r(1)}`, answer: name, options: CASES, formula: `"${name}"`,
      explain: sc === 1 ? "μ and σ are both given and the interval is for the sample mean." : sc === 2 ? "σ is trusted but μ is not: Z interval centred on the sample mean." : "Neither μ nor σ is known: use S and the t distribution.",
    });
    S.ask(`I${r(2)}`, {
      label: sc === 3 ? "critical value T_α/2" : "critical value Z_α/2", cell: `L${r(2)}`, answer: crit, formula: fCrit,
      explain: sc === 3 ? "T.INV(1 − α/2, n − 1)." : "NORM.S.INV(1 − α/2).",
      traps: [...trapsCrit, { value: sc === 3 ? tInv(1 - alpha, n - 1) : normInv(1 - alpha), why: "Used 1 − α instead of 1 − α/2." }],
    });
    S.ask(`I${r(3)}`, {
      label: sc === 3 ? "standard error S/√n" : "standard error σ/√n", cell: `L${r(3)}`, answer: se, formula: fSe,
      explain: sc === 3 ? "σ is unknown, so use the sample standard deviation S (STDEV.S)." : "σ is known: σ/√n.",
    });
    S.ask(`I${r(4)}`, {
      label: sc === 1 ? "centre of the interval (μ)" : "centre of the interval (sample mean)", cell: `L${r(4)}`, answer: centre, formula: fCentre,
      explain: sc === 1 ? "Scenario 1 is centred on the known μ." : "μ is unknown, so the interval is centred on the sample mean.",
    });
    S.ask(`I${r(5)}`, {
      label: "lower limit", cell: `L${r(5)}`, answer: centre - se * crit, formula: `=L${r(4)}-L${r(3)}*L${r(2)}`,
      explain: "centre − standard error × critical value.",
      traps: [{ value: centre - se * trapsCrit[0].value, why: trapsCrit[0].why }],
    });
    S.ask(`I${r(6)}`, {
      label: "upper limit", cell: `L${r(6)}`, answer: centre + se * crit, formula: `=L${r(4)}+L${r(3)}*L${r(2)}`,
      explain: "centre + standard error × critical value.",
      traps: [{ value: centre + se * trapsCrit[0].value, why: trapsCrit[0].why }],
    });
    tidy(S);
    return { tab: "Which scenario", title: "Confidence intervals: which scenario?", text, cells: S.cells, parts: S.parts };
  },
};
void round;

export const LESSON_15: Lesson = {
  n: 15,
  title: "Sample variance, the t distribution and the interval when nothing is known",
  unit: 2,
  week: "Week 9 · Wed 28 Oct · Confidence intervals",
  sources: ["Lesson 15, notes.xlsx", "F25_Exam 2 and solutions", "Exam 3 (Spring 2026)", "S26_Final and solutions", "Midterm 3 announcement (Spring 2026)"],
  summary:
    "In reality you don't know the true standard deviation, so you can't compute the standard error or use a Z value. This lesson replaces σ with the sample standard deviation S (dividing by n − 1 makes the sample variance an unbiased estimator) and the normal with the t distribution with ν = n − 1 degrees of freedom, which completes his third scenario: the confidence interval when nothing is known.",
  defs: [
    { term: "Why an unknown σ is a problem", text: "In reality you probably don't know the true mean or standard deviation of anything! If you don't know σ, you don't know the standard error and you don't know the Z-score.", source: "Lesson 15, notes › Tasks B29–H33" },
    { term: "\"Dumb variance\"", text: "Divide the sum of squared distances from the sample mean by n: for two values (1/2)·((X_1 − X̄)² + (X_2 − X̄)²). On average it is not close to the true variance.", source: "Lesson 15, notes › Sample variance E5, N14" },
    { term: "Sample variance", text: "The sample variance divides by n − 1 (VAR.S; its square root is STDEV.S, written S). On average it is very close to the true variance.", source: "Lesson 15, notes › Sample variance F5, N26" },
    { term: "True variance", text: "The true (population) variance σ² is the parameter, e.g. =15^2 = 225 when σ = 15. The sample variance is the statistic that estimates it.", source: "Lesson 15, notes › Sample variance I4, K13" },
    { term: "Estimate; biased estimator", text: "An estimate is a statistic designed to approximate a population parameter. An estimate is biased if on average it is not equal to the true parameter.", source: "Lesson 15, notes › Sample variance I17–I19" },
    { term: "Biased versus unbiased (his examples)", text: "Example: the \"dumb variance\" is a biased estimator. Example: the sample variance is better, it is unbiased.", source: "Lesson 15, notes › Sample variance I21, I28" },
    { term: "T-statistic", text: "T = (X̄ − μ)/(S/√n). This equation defines the T-statistic. This statistic is a random variable (sampling distribution) which follows the t-distribution.", source: "Lesson 15, notes › T distribution B10–B11 (the equation itself is drawn on the sheet)" },
    { term: "Degrees of freedom", text: "The t-distribution depends on the degrees of freedom. The degrees of freedom (denoted by Greek \"nu\", ν) is equal to the sample size minus 1.", source: "Lesson 15, notes › T distribution B12–B13" },
    { term: "Shape of the t-distribution", text: "The t-distribution is symmetric, bell-shaped, mean 0, and as ν increases it starts to look like N(0,1).", source: "Lesson 15, notes › T distribution B15" },
    { term: "T.DIST and T.INV", text: "The T distribution has Excel functions T.DIST and T.INV. They work the same way as NORM.DIST and NORM.INV; the only difference is that you must specify the degrees of freedom (because the t-dist depends on sample size).", source: "Lesson 15, notes › T distribution B20–B21" },
    { term: "Scenario 3: nothing known (key fact)", text: "lower = X̄ − (S/√n)·T_α/2, upper = X̄ + (S/√n)·T_α/2, with T_α/2 = T.INV(1 − α/2, n − 1) and S = STDEV.S.", source: "Lesson 15, notes › T distribution K28–K29, H31" },
    { term: "Interpreting an interval", text: "Scenario 1: there is an 80% chance that if I record the IQ scores of a class of 30 students their sample mean will be between 96.5 and 103.5. Scenario 2: I am 90% sure the new average is in between 1.784 and 1.9 miles. Beware! This isn't proof. The true average could still be 2 miles.", source: "Lesson 15, notes › Tasks M6–M8, O18–R20" },
  ],
  examples: [
    {
      title: "Dumb variance versus sample variance",
      setup: "Sample X_1, X_2 ~ N(100, 15²) twenty times; for each trial compute the \"dumb variance\" and the sample variance, then average them and compare with the true variance 225.",
      table: { head: ["Trial", "X1", "X2"], rows: [[1, 125.247, 115.955], [2, 107.804, 105.432], ["…", "…", "…"], [20, 111.260, 59.202]] },
      steps: [
        { say: "Sample mean of trial 1 (D5)", formula: "=AVERAGE(B5:C5)", result: "120.60092" },
        { say: "Dumb variance of trial 1 (E5): divide by n = 2", formula: "=(1/2)*((B5-D5)^2+(C5-D5)^2)", result: "21.58606" },
        { say: "Sample variance of trial 1 (F5): divide by n − 1", formula: "=VAR.S(B5:C5)", result: "43.17211" },
        { say: "True variance (K13)", formula: "=15^2", result: "225" },
        { say: "Average dumb variance over 20 trials (M14)", formula: "=AVERAGE(E5:E24)", result: "111.11942: not close to the true variance" },
        { say: "Average sample variance (M26)", formula: "=AVERAGE(F5:F24)", result: "222.23884: very close to the true variance!" },
      ],
      takeaway: "Dividing by n underestimates σ² on average (biased); dividing by n − 1 gets it right on average (unbiased).",
      source: "Lesson 15, notes › Sample variance",
    },
    {
      title: "Confidence interval when nothing is known",
      setup: "A random variable is sampled 7 times with results 5, 4, 5, 5, 3, 3, 1. Construct a 90% confidence interval for the true mean.",
      steps: [
        { say: "Sample mean (H27)", formula: "=AVERAGE(B25:B31)", result: "3.71429" },
        { say: "n (H28)", result: "7" },
        { say: "Sample std_dev S (H29)", formula: "=STDEV.S(B25:B31)", result: "1.49603" },
        { say: "alpha (H30)", result: "0.1" },
        { say: "T_α/2 with ν = n − 1 = 6 (H31)", formula: "=T.INV(1-H30/2,H28-1)", result: "1.94318" },
        { say: "lower (K28)", formula: "=H27-(H29/SQRT(H28))*H31", result: "2.61552" },
        { say: "upper (K29)", formula: "=H27+(H29/SQRT(H28))*H31", result: "4.81305" },
      ],
      takeaway: "Nothing known: S instead of σ, T.INV(1 − α/2, n − 1) instead of NORM.S.INV(1 − α/2).",
      source: "Lesson 15, notes › T distribution",
    },
    {
      title: "Recap, scenario 2: the bumped mortar",
      setup: "A mortar is designed to strike at 2 miles with standard deviation 0.1 miles. Someone bumps it before 8 shots: 1.81, 1.812, 2.005, 1.648, 2.005, 1.746, 1.977, 1.735. Inside what range are we 90% sure the true mean belongs?",
      steps: [
        { say: "Sample mean (I18)", formula: "=AVERAGE(C19:C26)", result: "1.84225" },
        { say: "Standard error (I22): σ in I19, n in I20", formula: "=I19/SQRT(I20)", result: "0.03536" },
        { say: "Z_α/2 (I23), α = 0.1 in I21", formula: "=NORM.S.INV(1-I21/2)", result: "1.64485" },
        { say: "lower limit (M18)", formula: "=I18-I22*I23", result: "1.78410" },
        { say: "upper limit (M19)", formula: "=I18+I22*I23", result: "1.90040" },
      ],
      takeaway: "\"I am 90% sure the new average is in between 1.784 and 1.9 miles. Beware! This isn't proof.\"",
      source: "Lesson 15, notes › Tasks (Task 2)",
    },
  ],
  quiz: [
    { q: "An estimate is biased if…", options: ["On average it is not equal to the true parameter", "It is computed from a sample", "It is sometimes larger than the parameter", "It uses the t distribution"], answer: 0, why: "His definition: biased if on average it is not equal to the true parameter. Every estimate misses sometimes; bias is about the average." },
    { q: "Which estimator of σ² is unbiased?", options: ["The sample variance (divide by n − 1, VAR.S)", "The \"dumb variance\" (divide by n)", "Both", "Neither"], answer: 0, why: "His 20 trials: average dumb variance 111 vs true 225; average sample variance 222, very close." },
    { q: "A sample of size 36 has how many degrees of freedom?", options: ["35", "36", "34", "37"], answer: 0, why: "ν = n − 1 = 35 (F25 Exam 2 MC Q2)." },
    { q: "Which is NOT true of the t-distribution?", options: ["Its standard deviation is 1", "It is symmetric", "It has mean 0", "It depends on the sample size"], answer: 0, why: "It is symmetric, bell-shaped, mean 0 and depends on ν, but it is more spread out than N(0,1) (F25 Exam 2 MC Q3)." },
    { q: "As the degrees of freedom get larger, the t-distribution approaches…", options: ["The standard normal N(0,1)", "The uniform distribution", "The t-distribution with ν = 1", "A distribution with standard deviation 0"], answer: 0, why: "\"As nu increases it starts to look like N(0,1)\" (F25 Exam 2 MC Q4)." },
    { q: "Why can't we use NORM.S.INV when σ is unknown?", options: ["Without σ we don't know the standard error or the Z-score; with S the statistic follows the t-distribution", "NORM.S.INV only works for 95%", "Because the sample mean is not normal", "Because the sample is too big"], answer: 0, why: "If you don't know σ, you don't know the standard error and you don't know the Z-score. Replacing σ by S gives the T-statistic." },
    { q: "Nothing known, n = 7, 90% interval. T_α/2 is…", options: ["=T.INV(0.95,6)", "=T.INV(0.95,7)", "=T.INV(0.90,6)", "=NORM.S.INV(0.95)"], answer: 0, why: "1 − α/2 = 0.95 and ν = n − 1 = 6 (his =T.INV(1-H30/2,H28-1) = 1.943)." },
    { q: "The T-statistic is…", options: ["(X̄ − μ)/(S/√n)", "(X̄ − μ)/(σ/√n)", "(X̄ − μ)/S", "(X − μ)/σ"], answer: 0, why: "Same as the Z-score of the sample mean but with the sample standard deviation S in place of σ." },
    { q: "Your 90% interval for the bumped mortar is 1.784 to 1.900 miles; it was designed for 2. What can you say?", options: ["We are 90% sure the new average is in that range, but it isn't proof: the true average could still be 2", "It proves the true mean is no longer 2", "The true mean is exactly 1.842", "90% of shots land between 1.784 and 1.900"], answer: 0, why: "His words: \"Beware! This isn't proof. The true average could still be 2 miles.\"" },
  ],
  excel: [
    { fn: "VAR.S / STDEV.S", use: "Sample variance and sample standard deviation S (divide by n − 1). The unbiased choice." },
    { fn: "T.INV(1 − α/2, n − 1)", use: "T_α/2 for a (1 − α) interval when nothing is known (works like NORM.S.INV, plus the degrees of freedom)." },
    { fn: "T.DIST(t, ν, TRUE)", use: "Probability to the left of t on the t-distribution (used for p-values from Lesson 16 on)." },
    { fn: "NORM.S.INV(1 − α/2)", use: "Z_α/2 in scenarios 1 and 2 (σ known)." },
    { fn: "AVERAGE, COUNT, SQRT", use: "Sample mean, n and the standard error S/SQRT(n) or σ/SQRT(n)." },
  ],
  watch: [
    "S26 Exam 3 Q5: Table 2 holds 50 values, nothing known: a 99% confidence interval (answer cells alpha, n, T, sigma (here S), X^bar, lower limit, upper limit).",
    "S26 Final Q34: Table 10 (4 values), population parameters unknown, 95%: t value =T.INV(1-0.05/2,3), s =STDEV.S(C23:C26), limits =F23-(F25/SQRT(4))*F24 and =F23+(F25/SQRT(4))*F24.",
    "F25 Exam 2 multiple choice: Q2 degrees of freedom for n = 36 (35); Q3 t-distribution has mean 0, is symmetric, bell-shaped and depends on sample size (but its standard deviation is not 1); Q4 it approaches the standard normal; Q8 the sample mean and sample variance are statistics, depend on the sample and are random variables.",
    "Midterm 3 (Spring 2026) announcement lists as standard definitions: significance, degrees of freedom, standard error, sample variance, true variance, estimator (unbiased/biased). Null/alternative hypothesis, critical values and test statistic come with hypothesis testing in Lesson 16.",
    "Decide the scenario first: μ and σ given (interval for the sample mean, Z); σ trusted but μ not (centre x̄, Z); nothing known (centre x̄, S and T.INV with ν = n − 1).",
    "Slips: NORM.S.INV instead of T.INV when σ is unknown; ν = n instead of n − 1; STDEV.P instead of STDEV.S; forgetting to divide S by √n.",
  ],
  makers: [dumbVar, tInterval, threeCases],
};
