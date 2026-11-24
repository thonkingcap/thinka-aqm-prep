// Lesson 12: The Central Limit Theorem (Week 8, Mon 19 Oct).
// Built from "Lesson 12, notes.xlsx" (Tasks, Your own RV, Sheet1 = 1000 averages of 100 draws, CLT, Normal)
// and the standard-error fact he wrote at the start of "Lesson 13, notes.xlsx" (Normal sheet).
import { Sheet, int, pick, round, shuffle, tolFor, TOP, type Block, type BlockMaker, type Rng } from "./kit.ts";
import { normDist, normInvGeneral, normCdf } from "../stats.ts";
import type { Lesson } from "./types.ts";

// ---------- local helpers ----------
/** Drop traps that are not numbers or sit too close to the right answer to tell apart. */
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
/** Draw one value of a discrete random variable (values xs, probabilities ps). */
function draw(rng: Rng, xs: number[], ps: number[]): number {
  const u = rng();
  let c = 0;
  for (let i = 0; i < xs.length; i++) { c += ps[i]; if (u < c) return xs[i]; }
  return xs[xs.length - 1];
}
const sumprod = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
function sdS(xs: number[]) { const m = avg(xs); return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1)); }

const PROBS: number[][] = [
  [0.4, 0.4, 0.1, 0.1], [0.1, 0.2, 0.3, 0.4], [0.25, 0.25, 0.25, 0.25], [0.5, 0.2, 0.2, 0.1],
  [0.3, 0.3, 0.2, 0.2], [0.6, 0.2, 0.1, 0.1], [0.2, 0.5, 0.2, 0.1], [0.15, 0.35, 0.35, 0.15],
];

// ---------- Q1: your own random variable, then its averages ----------
const ownRv: BlockMaker = {
  key: "l12.own-rv",
  title: "Your own random variable: E[X], σ, standard error, Z-score of an average",
  make(rng): Block {
    // Four distinct payouts, like his "My Rv" (3, 7, 6, 23).
    const pool = shuffle(rng, Array.from({ length: 30 }, (_, i) => i + 1));
    const xs = pool.slice(0, 4);
    const ps = shuffle(rng, pick(rng, PROBS));
    const n = pick(rng, [25, 36, 50, 64, 100]);
    const E = sumprod(xs, ps);
    const dev = xs.map((x) => (x - E) ** 2);
    const V = sumprod(dev, ps);
    const sd = Math.sqrt(V);
    const se = sd / Math.sqrt(n);
    // One genuinely simulated average of n draws.
    let tot = 0;
    for (let i = 0; i < n; i++) tot += draw(rng, xs, ps);
    const xbar = round(tot / n, 2);
    const z = (xbar - E) / se;
    const k = pick(rng, [-1.5, -1, -0.5, 0.5, 1, 1.5]);
    const v = round(E + k * se, 2);
    const pBelow = normDist(v, E, se);
    const q = pick(rng, [0.8, 0.9, 0.95, 0.99]);
    const xq = normInvGeneral(q, E, se);

    const S = new Sheet();
    const t = S.table("B", TOP, ["x", "Pr(X=x)", "(x−E[X])^2"], xs.map((x, i) => [x, ps[i]]));
    // Column D (the deviations) are answer cells, like his helper column in Lesson 10.
    xs.forEach((x, i) => {
      const r = t.first + i;
      S.parts.push({
        label: `(x − E[X])^2 for x = ${x}`, cell: `D${r}`, answer: dev[i], formula: `=(B${r}-$G$${TOP + 1})^2`,
        explain: "His helper column: each outcome's squared distance from the expectation (lock E[X] with $ so you can drag).",
        traps: [{ value: x - E, why: "Forgot to square the distance." }, { value: x ** 2, why: "Squared x instead of (x − E[X])." }],
      });
    });
    S.header(`F${TOP}`, "Quantity").header(`G${TOP}`, "Value");
    const R = (i: number) => TOP + i;
    S.ask(`F${R(1)}`, {
      label: "E[X], the true mean μ", cell: `G${R(1)}`, answer: E, formula: `=SUMPRODUCT(B${t.first}:B${t.last},C${t.first}:C${t.last})`,
      explain: "Expectation = Σ x·Pr(X=x), which he computes with SUMPRODUCT.",
      traps: [{ value: avg(xs), why: "Took the plain average of the outcomes: they are not equally likely." }],
    });
    S.ask(`F${R(2)}`, {
      label: "Var[X]", cell: `G${R(2)}`, answer: V, formula: `=SUMPRODUCT(D${t.first}:D${t.last},C${t.first}:C${t.last})`,
      explain: "Variance = Σ (x − E[X])²·Pr(X=x): SUMPRODUCT of the helper column with the probabilities.",
      traps: [{ value: sumprod(xs.map((x) => x * x), ps), why: "Computed E[X²] and forgot to subtract E[X]²." }],
    });
    S.ask(`F${R(3)}`, {
      label: "Std dev[X], the true σ", cell: `G${R(3)}`, answer: sd, formula: `=SQRT(G${R(2)})`,
      explain: "The standard deviation is the square root of the variance.",
      traps: [{ value: V, why: "Left it as the variance: take the square root." }],
    });
    S.label(`F${R(4)}`, "n (draws in each average)").given(`G${R(4)}`, n);
    S.ask(`F${R(5)}`, {
      label: "Standard error of the average, σ/√n", cell: `G${R(5)}`, answer: se, formula: `=G${R(3)}/SQRT(G${R(4)})`,
      explain: "The sample mean of n identical, independent draws has standard deviation σ/√n: the standard error.",
      traps: [{ value: sd / n, why: "Divided by n instead of √n." }, { value: sd, why: "Used σ itself: the average is less spread out than one draw." }, { value: V / n, why: "That is the variance of the average, not its standard deviation." }],
    });
    S.label(`F${R(6)}`, "One simulated average of n draws, x̄").given(`G${R(6)}`, xbar);
    S.ask(`F${R(7)}`, {
      label: "Z-score of that average", cell: `G${R(7)}`, answer: z, formula: `=(G${R(6)}-G${R(1)})/G${R(5)}`,
      explain: "CLT: Z = (x̄ − μ)/(σ/√n) is approximately N(0,1) for large n.",
      traps: [{ value: (xbar - E) / sd, why: "Divided by σ instead of the standard error σ/√n." }],
    });
    S.label(`F${R(8)}`, "A value v").given(`G${R(8)}`, v);
    S.ask(`F${R(9)}`, {
      label: "Pr(an average of n draws is less than v)", cell: `G${R(9)}`, answer: pBelow, format: "prob",
      formula: `=NORM.DIST(G${R(8)},G${R(1)},G${R(5)},TRUE)`,
      explain: "By the CLT the average is approximately normal with mean μ and standard deviation σ/√n, so use NORM.DIST with the standard error.",
      traps: [{ value: normDist(v, E, sd), why: "Used σ instead of the standard error." }, { value: 1 - pBelow, why: "That is the probability of more than v." }],
    });
    S.ask(`F${R(10)}`, {
      label: `The value the average stays below with probability ${q}`, cell: `G${R(10)}`, answer: xq,
      formula: `=NORM.INV(${q},G${R(1)},G${R(5)})`,
      explain: "NORM.INV(probability, mean, std_dev) finds the value with that probability to its left; the std_dev of an average is the standard error.",
      traps: [{ value: normInvGeneral(q, E, sd), why: "Used σ instead of the standard error." }, { value: normInvGeneral(1 - q, E, se), why: "Used 1 − probability: NORM.INV wants the probability to the left." }],
    });
    tidy(S);
    return {
      tab: "Own random variable", title: "Your own random variable and its averages",
      text: [
        "A game pays out x dollars with the probabilities in the table (this is your own random variable X, like his \"My Rv\").",
        `You simulate X ${n} times and take the average, and imagine doing that over and over (his Task 4).`,
        "Fill the yellow cells with formulas that point at the table and the givens.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        `Use Data Analysis › Random Number Generation (Discrete, value and probability input range B${t.first}:C${t.last}) to make 1000 rows of ${n} draws, average each row and make a histogram of the 1000 averages. Self-check: bell-shaped, centred near your E[X], standard deviation near your standard error.`,
      ],
    };
  },
};

// ---------- Q2: analyse simulated averages (his Sheet1) ----------
type Rv = { name: string; xs: number[]; ps: number[] };
const RVS: Rv[] = [
  { name: "a fair die", xs: [1, 2, 3, 4, 5, 6], ps: [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6] },
  { name: "his \"My Rv\"", xs: [3, 7, 6, 23], ps: [0.4, 0.4, 0.1, 0.1] },
  { name: "a coin flip (1 = heads, 0 = tails)", xs: [0, 1], ps: [0.5, 0.5] },
  { name: "a skewed random variable", xs: [0, 1, 2, 10], ps: [0.5, 0.3, 0.15, 0.05] },
  { name: "the number of items in an online order", xs: [1, 2, 3, 8], ps: [0.45, 0.3, 0.15, 0.1] },
];
const simAverages: BlockMaker = {
  key: "l12.sim-averages",
  title: "Simulated averages: seeing the CLT",
  make(rng): Block {
    const rv = pick(rng, RVS);
    const n = pick(rng, [25, 50, 100]);
    const m = 40;
    const mu = round(sumprod(rv.xs, rv.ps), 4);
    const sigma = round(Math.sqrt(sumprod(rv.xs.map((x) => (x - sumprod(rv.xs, rv.ps)) ** 2), rv.ps)), 4);
    const avgs: number[] = [];
    for (let j = 0; j < m; j++) {
      let tot = 0;
      for (let i = 0; i < n; i++) tot += draw(rng, rv.xs, rv.ps);
      avgs.push(round(tot / n, 2));
    }
    const mA = avg(avgs);
    const sA = sdS(avgs);
    const se = sigma / Math.sqrt(n);
    const zHis = (avgs[0] - mA) / sA;
    const zClt = (avgs[0] - mu) / se;
    const lo = mu - se, hi = mu + se;
    const within = avgs.filter((a) => a >= lo && a <= hi).length;
    const prop = within / m;
    const pred = normDist(hi, mu, se) - normDist(lo, mu, se);

    const S = new Sheet();
    const t = S.table("B", TOP, ["Trial", `Average of ${n} draws`], avgs.map((a, i) => [i + 1, a]));
    const r = (i: number) => TOP + i;
    S.header(`E${r(0)}`, "Given").header(`H${r(0)}`, "Value");
    S.label(`E${r(1)}`, "True mean μ = E[X]").given(`H${r(1)}`, mu);
    S.label(`E${r(2)}`, "True standard deviation σ").given(`H${r(2)}`, sigma);
    S.label(`E${r(3)}`, "n (draws in each average)").given(`H${r(3)}`, n);
    S.header(`E${r(5)}`, "Question").header(`H${r(5)}`, "Your answer");
    const C = t.cols[`Average of ${n} draws`].range;
    const first = `C${t.first}`;
    S.ask(`E${r(6)}`, {
      label: "Sample mean of the 40 averages", cell: `H${r(6)}`, answer: mA, formula: `=AVERAGE(${C})`,
      explain: "His cell CX5: AVERAGE of the column of averages. The CLT says it should sit near μ.",
    });
    S.ask(`E${r(7)}`, {
      label: "Standard deviation of the 40 averages", cell: `H${r(7)}`, answer: sA, formula: `=STDEV.S(${C})`,
      explain: "His cell CX6: STDEV.S of the averages (a sample, so n − 1).",
      traps: [{ value: Math.sqrt(sA ** 2 * (m - 1) / m), why: "Used STDEV.P: these 40 averages are a sample, use STDEV.S." }],
    });
    S.ask(`E${r(8)}`, {
      label: "Standard error σ/√n (what theory predicts for that spread)", cell: `H${r(8)}`, answer: se, formula: `=H${r(2)}/SQRT(H${r(3)})`,
      explain: "Standard error = σ/√n. Compare it with the spread of your simulated averages: they should be close.",
      traps: [{ value: sigma / n, why: "Divided by n instead of √n." }, { value: sigma, why: "That is the spread of one draw, not of an average." }],
    });
    S.ask(`E${r(9)}`, {
      label: "Z-score of trial 1, his way (using the averages' own mean and std dev)", cell: `H${r(9)}`, answer: zHis,
      formula: `=(${first}-H${r(6)})/H${r(7)}`,
      explain: "His column CY: =(CX12-$CX$5)/$CX$6, the average minus the mean of the averages, over their standard deviation.",
    });
    S.ask(`E${r(10)}`, {
      label: "Z-score of trial 1 using μ and the standard error", cell: `H${r(10)}`, answer: zClt,
      formula: `=(${first}-H${r(1)})/H${r(8)}`,
      explain: "CLT: Z = (x̄ − μ)/(σ/√n), approximately N(0,1) for large n.",
      traps: [{ value: (avgs[0] - mu) / sigma, why: "Divided by σ instead of σ/√n." }],
    });
    S.ask(`E${r(11)}`, {
      label: "How many of the 40 averages lie within one standard error of μ?", cell: `H${r(11)}`, answer: within, tol: 0,
      formula: `=COUNTIFS(${C},">="&(H${r(1)}-H${r(8)}),${C},"<="&(H${r(1)}+H${r(8)}))`,
      explain: "Count the averages between μ − σ/√n and μ + σ/√n (COUNTIFS with two conditions).",
    });
    S.ask(`E${r(12)}`, {
      label: "As a proportion of the 40", cell: `H${r(12)}`, answer: prop, format: "prob", formula: `=H${r(11)}/COUNT(${C})`,
      explain: "Divide the count by the number of averages.",
    });
    S.ask(`E${r(13)}`, {
      label: "The proportion the CLT predicts (within one standard error)", cell: `H${r(13)}`, answer: pred, format: "prob",
      formula: `=NORM.DIST(H${r(1)}+H${r(8)},H${r(1)},H${r(8)},TRUE)-NORM.DIST(H${r(1)}-H${r(8)},H${r(1)},H${r(8)},TRUE)`,
      explain: "If the average is N(μ, σ/√n), the probability of landing within one standard error of μ is about 0.68 (the same for any μ and σ).",
      traps: [{ value: normDist(hi, mu, se), why: "Only took the probability left of the upper limit: subtract the left tail too." }, { value: 2 * normCdf(-1), why: "That is the probability of landing OUTSIDE one standard error." }],
    });
    tidy(S);
    return {
      tab: "Simulated averages", title: "Simulated averages: seeing the Central Limit Theorem",
      text: [
        `Someone simulated ${rv.name} ${n} times and averaged the results, then repeated this 40 times (his Task 4 with 40 rows instead of 1000).`,
        "The 40 averages are in column C. The true mean and standard deviation of one draw are given.",
        "Fill the yellow cells with formulas that point at the averages and the givens.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        `Make this yourself with the RNG (Discrete): 1000 rows × ${n} columns, AVERAGE each row, then a histogram of the averages and a NORM.DIST(x, μ, σ/√n, FALSE) curve on top (his Task 5). Self-check: the histogram follows the curve.`,
      ],
    };
  },
};

// ---------- Q3: probabilities for the sample mean of normal values ----------
type Ctx = { what: string; unit: string; mu: number; sd: number };
const NORMALS: Ctx[] = [
  { what: "the time to download an image file", unit: "seconds", mu: 18, sd: 5 },
  { what: "the hours a teacher works in the holidays", unit: "hours", mu: 20, sd: 5 },
  { what: "the weight of a block of butter", unit: "g", mu: 510, sd: 4 },
  { what: "an IQ score", unit: "points", mu: 100, sd: 15 },
  { what: "the amount of cereal a machine puts in a box", unit: "ounces", mu: 11, sd: 0.5 },
  { what: "the weight of an adult male African elephant", unit: "kg", mu: 5300, sd: 800 },
];
const dp = (sd: number) => (sd < 1 ? 2 : sd < 10 ? 1 : 0);
const xbarProb: BlockMaker = {
  key: "l12.xbar-prob",
  title: "Probabilities for the sample mean (standard error σ/√n)",
  make(rng): Block {
    const c = pick(rng, NORMALS);
    const n = pick(rng, [4, 5, 8, 9, 10, 16, 25]);
    const se = c.sd / Math.sqrt(n);
    const d = dp(c.sd);
    const a = round(c.mu - pick(rng, [0.5, 0.8, 1, 1.25, 1.5, 2]) * se, d);
    const b = round(c.mu + pick(rng, [0.5, 0.8, 1, 1.25, 1.5, 2]) * se, d);
    const q = pick(rng, [0.8, 0.9, 0.95, 0.99]);
    const pOne = normDist(a, c.mu, c.sd);
    const pLess = normDist(a, c.mu, se);
    const pMore = 1 - normDist(b, c.mu, se);
    const pBetween = normDist(b, c.mu, se) - normDist(a, c.mu, se);
    const xq = normInvGeneral(q, c.mu, se);

    const S = new Sheet();
    const r = (i: number) => TOP + i;
    S.header(`B${r(0)}`, "Given").header(`D${r(0)}`, "Value");
    S.label(`B${r(1)}`, "mean μ").given(`D${r(1)}`, c.mu);
    S.label(`B${r(2)}`, "standard deviation σ").given(`D${r(2)}`, c.sd);
    S.label(`B${r(3)}`, "n (sample size)").given(`D${r(3)}`, n);
    S.label(`B${r(4)}`, "value a").given(`D${r(4)}`, a);
    S.label(`B${r(5)}`, "value b").given(`D${r(5)}`, b);
    S.header(`F${r(0)}`, "Question").header(`I${r(0)}`, "Your answer");
    S.ask(`F${r(1)}`, {
      label: "Standard error of the sample mean", cell: `I${r(1)}`, answer: se, formula: `=D${r(2)}/SQRT(D${r(3)})`,
      explain: "X̄ ~ N(μ, standard error) with standard error = σ/√n.",
      traps: [{ value: c.sd / n, why: "Divided by n instead of √n." }],
    });
    S.ask(`F${r(2)}`, {
      label: "Pr(ONE value is less than a)", cell: `I${r(2)}`, answer: pOne, format: "prob", formula: `=NORM.DIST(D${r(4)},D${r(1)},D${r(2)},TRUE)`,
      explain: "A single value X ~ N(μ, σ²): NORM.DIST with σ.",
      traps: [{ value: pLess, why: "Used the standard error: a single value has standard deviation σ." }],
    });
    S.ask(`F${r(3)}`, {
      label: "Pr(the sample mean is less than a)", cell: `I${r(3)}`, answer: pLess, format: "prob", formula: `=NORM.DIST(D${r(4)},D${r(1)},I${r(1)},TRUE)`,
      explain: "The sample mean has standard deviation σ/√n, so use the standard error in NORM.DIST (his cereal task: =NORM.DIST(10.5,J19,J20,TRUE)).",
      traps: [{ value: pOne, why: "Used σ: the sample mean is less spread out, use the standard error." }],
    });
    S.ask(`F${r(4)}`, {
      label: "Pr(the sample mean is more than b)", cell: `I${r(4)}`, answer: pMore, format: "prob", formula: `=1-NORM.DIST(D${r(5)},D${r(1)},I${r(1)},TRUE)`,
      explain: "NORM.DIST gives the probability to the left, so take 1 − it for more than b.",
      traps: [{ value: 1 - pMore, why: "Forgot the 1 −: NORM.DIST is the probability of less than b." }, { value: 1 - normDist(b, c.mu, c.sd), why: "Used σ instead of the standard error." }],
    });
    S.ask(`F${r(5)}`, {
      label: "Pr(a < sample mean < b)", cell: `I${r(5)}`, answer: pBetween, format: "prob",
      formula: `=NORM.DIST(D${r(5)},D${r(1)},I${r(1)},TRUE)-NORM.DIST(D${r(4)},D${r(1)},I${r(1)},TRUE)`,
      explain: "Probability left of b minus probability left of a.",
      traps: [{ value: normDist(b, c.mu, c.sd) - normDist(a, c.mu, c.sd), why: "Used σ instead of the standard error." }],
    });
    S.ask(`F${r(6)}`, {
      label: `The value the sample mean stays below with probability ${q}`, cell: `I${r(6)}`, answer: xq,
      formula: `=NORM.INV(${q},D${r(1)},I${r(1)})`,
      explain: "NORM.INV(probability, mean, std_dev) finds the value with that probability to its left; for the sample mean the std_dev is the standard error.",
      traps: [{ value: normInvGeneral(q, c.mu, c.sd), why: "Used σ instead of the standard error." }, { value: normInvGeneral(1 - q, c.mu, se), why: "Put in 1 − probability: NORM.INV wants the probability to the left." }],
    });
    tidy(S);
    return {
      tab: "Sample mean probs", title: "Probabilities for the sample mean",
      text: [
        `X is ${c.what} (in ${c.unit}). X is normally distributed with mean ${c.mu} and standard deviation ${c.sd}.`,
        `You take a sample of n = ${n} independent values and compute the sample mean X̄.`,
        "Fill the yellow cells with formulas that point at the givens.",
      ],
      cells: S.cells, parts: S.parts,
    };
  },
};
void int;

// ---------- the lesson ----------
export const LESSON_12: Lesson = {
  n: 12,
  title: "The Central Limit Theorem",
  unit: 2,
  week: "Week 8 · Mon 19 Oct · The Central Limit Theorem",
  sources: ["Lesson 12, notes.xlsx", "Lesson 13, notes.xlsx (Normal sheet: the standard error)", "F25_Exam 2 (multiple choice)"],
  summary:
    "Averages behave far better than single values: simulate any random variable, average many draws, and the averages pile up in a bell shape around the true mean. That is the Central Limit Theorem, and it is what lets us use NORM.DIST and NORM.INV with the standard error σ/√n for every confidence interval and hypothesis test that follows.",
  defs: [
    {
      term: "Central Limit Theorem",
      text: "Let X_1, X_2, …, X_n be identical and independent random variables with true mean μ and true standard deviation σ. Take the sample mean and using this find the Z-score. For large n the Z-score is approximately normally distributed with mean 0 and standard deviation 1.",
      source: "Lesson 12, notes › CLT B3",
    },
    {
      term: "A sample as random variables",
      text: "You can model a sample of size n by n identical and independent random variables X_1, X_2, …, X_n.",
      source: "Lesson 13, notes › Normal B8",
    },
    {
      term: "Standard error",
      text: "Standard error = σ/√n. It is the standard deviation of the sample mean X̄: if each X_i is normal with mean μ and standard deviation σ then X̄ ~ N(μ, standard error).",
      source: "Lesson 13, notes › Normal B10, F12",
    },
    {
      term: "CLT for the sample mean",
      text: "Even if the X_i are not normally distributed, for large n, X̄ ~ N(μ, standard error) is approximately true.",
      source: "Lesson 13, notes › Normal B13",
    },
    {
      term: "Z-score of a sample mean (key fact)",
      text: "The Z-score in the CLT is Z = (X̄ − μ)/(σ/√n). In his simulation (1000 averages of 100 draws) he standardised each average with =(CX12-$CX$5)/$CX$6: the average minus the mean of the averages, divided by their standard deviation.",
      source: "Lesson 12, notes › Sheet1 CY12",
    },
    {
      term: "Averaging makes a bell (the simulation tasks)",
      text: "Simulate your random variable, rerun and average two results, then average 100 draws 1000 times: the histogram of the averages becomes bell-shaped. Notice the Central Limit Theorem by plotting NORM.DIST(_,_,_,FALSE) over it.",
      source: "Lesson 12, notes › Tasks B4–B16",
    },
    {
      term: "NORM.INV",
      text: "NORM.INV(probability, mean, std_dev) finds the value x for which the specified probability lies to the left.",
      source: "Lesson 12, notes › Normal K33",
    },
    {
      term: "Normal notation",
      text: "The quantity X is normally distributed with mean μ and standard deviation σ. Equivalently, just write X ~ N(μ, σ²).",
      source: "Lesson 13, notes › Normal B4–B6",
    },
  ],
  examples: [
    {
      title: "His \"My Rv\": 1000 averages of 100 draws",
      setup:
        "His own random variable takes the values 3, 7, 6, 23 with probabilities 0.4, 0.4, 0.1, 0.1. He simulated it 100 times, averaged, and did that 1000 times (Sheet1), then found the Z-score of each average and made a histogram.",
      table: { head: ["x", "Pr(X=x)"], rows: [[3, 0.4], [7, 0.4], [6, 0.1], [23, 0.1]] },
      steps: [
        { say: "Average of one row of 100 draws (his CX12)", formula: "=AVERAGE(B12:CW12)", result: "6.54" },
        { say: "Mean of the 1000 averages (CX5)", formula: "=AVERAGE(CX12:CX1011)", result: "6.92304" },
        { say: "Standard deviation of the 1000 averages (CX6)", formula: "=STDEV.S(CX12:CX1011)", result: "0.57427" },
        { say: "Z-score of the first average (CY12), then drag down", formula: "=(CX12-$CX$5)/$CX$6", result: "−0.66701" },
        { say: "Check with theory: E[X] = Σ x·Pr(X=x) (values in B4:B7, probabilities in C4:C7)", formula: "=SUMPRODUCT(B4:B7,C4:C7)", result: "6.9" },
        { say: "Theory: σ = √(Σ (x − 6.9)²·Pr) = √32.09 = 5.66480, so the standard error is σ/√100", formula: "=SQRT(32.09)/SQRT(100)", result: "0.56648" },
      ],
      takeaway: "The averages centre on μ = 6.9 with spread about σ/√n = 0.566, and their histogram is bell-shaped even though X itself is lopsided.",
      source: "Lesson 12, notes › Your own RV, Sheet1 (the theory lines are our check)",
    },
    {
      title: "Normal recap: download times (Normal sheet)",
      setup: "X, the time to download an image file, is normal with mean 18.0 seconds and standard deviation 5.0 seconds.",
      steps: [
        { say: "Probability it takes less than 15 seconds", formula: "=NORM.DIST(15,18,5,TRUE)", result: "0.27425" },
        { say: "Probability it takes more than 25 seconds", formula: "=1-NORM.DIST(25,18,5,TRUE)", result: "0.08076" },
        { say: "Probability it takes between 16 and 20 seconds", formula: "=NORM.DIST(20,18,5,TRUE)-NORM.DIST(16,18,5,TRUE)", result: "0.31084" },
        { say: "How long for 90% of images to download?", formula: "=NORM.INV(0.9,18,5)", result: "24.40776" },
        { say: "The bottom 10% fastest downloads take at most", formula: "=NORM.INV(0.1,18,5)", result: "11.59224" },
      ],
      takeaway: "Same functions for a sample mean: just swap σ for the standard error σ/√n.",
      source: "Lesson 12, notes › Normal (the answers to the first three are our computations; he left the cells for class)",
    },
  ],
  quiz: [
    {
      q: "For the Central Limit Theorem, the random variables X_1, …, X_n in the sample must be…",
      options: ["Identical and independent", "Normally distributed", "Positive valued", "Continuous"],
      answer: 0,
      why: "His statement starts \"Let X_1, …, X_n be identical and independent random variables\". They do NOT need to be normal: that is the whole point (F25 Exam 2 MC Q6).",
    },
    {
      q: "What does the CLT say happens for large n?",
      options: [
        "The Z-score of the sample mean is approximately N(0,1)",
        "Each X_i becomes normally distributed",
        "The sample mean equals the true mean exactly",
        "The standard deviation of each X_i shrinks to 0",
      ],
      answer: 0,
      why: "Take the sample mean, find its Z-score: for large n the Z-score is approximately normal with mean 0 and standard deviation 1.",
    },
    {
      q: "The standard error of the mean is…",
      options: ["σ/√n", "σ/n", "σ²/n", "σ·√n"],
      answer: 0,
      why: "He writes \"standard error = sigma/Sqrt(n)\": it is the standard deviation of X̄.",
    },
    {
      q: "As the sample size n increases, the standard error of the mean…",
      options: ["Decreases", "Increases", "Stays the same"],
      answer: 0,
      why: "σ/√n gets smaller as n grows: averages of more values are less spread out (F25 Exam 2 MC Q5).",
    },
    {
      q: "X ~ N(18, 5²). For samples of n = 25, the sample mean X̄ has standard deviation…",
      options: ["1", "5", "0.2", "3.6"],
      answer: 0,
      why: "Standard error = 5/√25 = 1.",
    },
    {
      q: "You roll a die twice and average the two results, 1000 times (his Task 3). Compared with the histogram of single rolls, the histogram of the averages is…",
      options: ["More bunched in the middle, starting to look bell-shaped", "Exactly the same flat shape", "More spread out", "Shifted to the right"],
      answer: 0,
      why: "Averages are less spread out and pile up near the mean; with more values in each average the bell shape gets clearer.",
    },
    {
      q: "What does NORM.INV(0.9, 18, 5) give?",
      options: [
        "The value x with probability 0.9 to its left",
        "The probability of being less than 0.9",
        "The probability of being more than 18",
        "The Z-score of 0.9",
      ],
      answer: 0,
      why: "NORM.INV(probability, mean, std_dev) finds the value x for which the specified probability lies to the left (24.41 seconds here).",
    },
    {
      q: "In Task 5 he plots NORM.DIST(x, μ, σ, FALSE). What does the FALSE do?",
      options: [
        "Gives the height of the bell curve (to draw over the histogram)",
        "Gives the probability to the left of x",
        "Gives the probability to the right of x",
        "Makes Excel ignore the mean",
      ],
      answer: 0,
      why: "TRUE gives the cumulative probability to the left; FALSE gives the curve's height, which is what you plot to see the bell shape.",
    },
  ],
  excel: [
    { fn: "Data Analysis › Random Number Generation", use: "Discrete distribution with a value-and-probability input range to simulate your own random variable (1000 rows; 100 columns for averages of 100)." },
    { fn: "AVERAGE", use: "Average each row of simulated draws (=AVERAGE(B12:CW12)), and the column of averages." },
    { fn: "STDEV.S", use: "Standard deviation of the simulated averages (a sample)." },
    { fn: "SUMPRODUCT", use: "E[X] = SUMPRODUCT(values, probabilities); Var[X] = SUMPRODUCT((x − E[X])² column, probabilities)." },
    { fn: "SQRT", use: "σ = SQRT(variance) and the standard error σ/SQRT(n)." },
    { fn: "NORM.DIST(x, mean, sd, TRUE/FALSE)", use: "TRUE: probability to the left. For a sample mean use the standard error as sd. FALSE: the bell curve's height, to plot over a histogram." },
    { fn: "NORM.INV(probability, mean, sd)", use: "The value with that probability to its left." },
    { fn: "Toolpak Histogram", use: "Frequency table of the 1000 averages (or Z-scores) with a bins column." },
  ],
  watch: [
    "F25 Exam 2 multiple choice: Q5 \"the standard error of the mean decreases as the sample size increases\"; Q6 the CLT needs the X_i to be independent and identical (not normal, not positive, not continuous).",
    "Midterm 3 announcement (Spring 2026) lists \"statement of the Central Limit Theorem\" and \"standard error\" among the standard definitions to know; learning his CLT sentence closely is our advice.",
    "F25 Exam 2 Q1(a): \"For a sample of size n = 17 what is the standard error of the mean?\" Answer =15/SQRT(17).",
    "Most common slip: using σ instead of σ/√n in NORM.DIST or NORM.INV when the question is about the sample mean (or the other way round for one value).",
    "Second slip: dividing by n instead of √n.",
  ],
  makers: [ownRv, simAverages, xbarProb],
};
