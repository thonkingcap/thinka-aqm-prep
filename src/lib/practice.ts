// Seeded, offline practice-question generator for AQM 1000 Midterm 2.
// Every number part carries the Excel formula (with this question's numbers) that produces
// its answer exactly; practice.test.ts evaluates each formula and compares.
// Conventions: one-tail .DIST/.INV functions only (no T.DIST.2T, T.INV.2T, ABS, …).
import { normDist, normInvGeneral, normInv, normCdf, tInv, tCdf, mean, stdevS, chisqCdf, chisqInv } from "./stats.ts";
import { evaluate, type CellContext } from "./excel.ts";
import { runTest, NULLS, TWELVE } from "./tests12.ts";
import type { Null, Sigma, Method } from "./tests12.ts";

export type TopicId = "normal" | "clt" | "ci-z" | "t" | "ht" | "var" | "two" | "concept";
export type QuestionKind =
  | "normal-less" | "normal-more" | "normal-between" | "normal-inverse" | "zscore"
  | "sample-mean" | "xbar-range" | "ci-z" | "ci-t" | "ht" | "ht-full"
  | "var-test" | "two-z" | "two-t" | "paired" | "bernoulli" | "concept";
/** A likely wrong answer and what it means: the review names the slip when a student's value matches it. */
export type Trap = { value: number; why: string };
export type Part = {
  id: string;
  label: string;
  kind: "number" | "choice" | "text";
  /** Number, the option for a choice, or the model answer for a written part. */
  answer: number | string;
  /** Written parts: the ideas a full-credit answer must contain. */
  keyPoints?: string[];
  traps?: Trap[];
  options?: string[];
  tol?: number;
  format?: "prob" | "num";
  unit?: string;
  excel: string;
  explain: string;
};
export type Question = {
  id: string;
  seed: number;
  kind: QuestionKind;
  topic: TopicId;
  title: string;
  prompt: string;
  data?: number[];
  /** A second data column (two-sample and paired questions), with both column headers. */
  data2?: number[];
  dataLabels?: [string, string];
  given?: { label: string; value: string }[];
  caseKey?: string;
  parts: Part[];
};

export const KINDS: { id: QuestionKind; label: string; topic: TopicId }[] = [
  { id: "normal-less", label: "P(X < a)", topic: "normal" },
  { id: "normal-more", label: "P(X > a)", topic: "normal" },
  { id: "normal-between", label: "P(a < X < b)", topic: "normal" },
  { id: "normal-inverse", label: "Percentiles (NORM.INV)", topic: "normal" },
  { id: "zscore", label: "Z-scores", topic: "normal" },
  { id: "sample-mean", label: "Probability for x̄", topic: "clt" },
  { id: "xbar-range", label: "Where x̄ will land", topic: "clt" },
  { id: "ci-z", label: "Interval for μ, σ known", topic: "ci-z" },
  { id: "ci-t", label: "Interval for μ, σ unknown", topic: "t" },
  { id: "ht", label: "Hypothesis test", topic: "ht" },
  { id: "ht-full", label: "Hypothesis test, exam style", topic: "ht" },
  { id: "var-test", label: "Test for a variance (χ²)", topic: "var" },
  { id: "two-z", label: "Two samples, σ known", topic: "two" },
  { id: "two-t", label: "Two samples, equal variances", topic: "two" },
  { id: "paired", label: "Paired data", topic: "two" },
  { id: "bernoulli", label: "0/1 data (coin flips)", topic: "ht" },
  { id: "concept", label: "Explain it (written)", topic: "concept" },
];

// ---------- seeded RNG ----------
type Rng = () => number;
function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randInt = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
const uniform = (rng: Rng, lo: number, hi: number) => lo + (hi - lo) * rng();
function gauss(rng: Rng): number {
  const u = 1 - rng(), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const roundTo = (x: number, dp: number) => Number(x.toFixed(dp));
/** Clean number text for formulas and prompts (no float noise, no exponent). */
const fmt = (x: number) => {
  const v = Number(x.toFixed(6));
  return Object.is(v, -0) ? "0" : String(v);
};
const r4 = (x: number) => fmt(roundTo(x, 4));

// ---------- scenarios ----------
type Range = [lo: number, hi: number, step: number];
type Scenario = {
  pop: string;       // "The weight of cereal boxes filled on a packing line"
  quantity: string;  // "weight"
  item: string;      // "cereal box"
  items: string;     // "cereal boxes"
  prep?: string;     // "of" (default) / "on"
  unit: string;
  owner: string;     // who runs the hypothesis test
  mu: Range;
  sd: Range;
  dp: number;        // decimals of raw data values
};
const BUILTIN: Scenario[] = [
  { pop: "The weight of cereal boxes filled on a packing line", quantity: "weight", item: "cereal box", items: "cereal boxes", unit: "oz", owner: "The plant's quality manager", mu: [10.5, 12, 0.1], sd: [0.3, 0.6, 0.05], dp: 2 },
  { pop: "The time to download an image from a company website", quantity: "download time", item: "image", items: "images", unit: "seconds", owner: "The IT team", mu: [15, 22, 0.5], sd: [3, 6, 0.5], dp: 1 },
  { pop: "The weight of butter blocks from a regional dairy", quantity: "weight", item: "butter block", items: "butter blocks", unit: "g", owner: "The dairy's inspector", mu: [505, 515, 1], sd: [3, 6, 0.5], dp: 1 },
  { pop: "IQ scores in the adult population", quantity: "IQ score", item: "adult", items: "adults", unit: "points", owner: "A psychologist", mu: [100, 100, 1], sd: [15, 15, 1], dp: 0 },
  { pop: "The size of orders placed with a bike wholesaler", quantity: "order size", item: "bike order", items: "bike orders", unit: "units", owner: "The wholesaler's sales director", mu: [160, 200, 5], sd: [10, 20, 1], dp: 0 },
  { pop: "Monthly grocery spending per household in a city", quantity: "monthly grocery spend", item: "household", items: "households", unit: "$", owner: "A market researcher", mu: [400, 500, 10], sd: [150, 200, 5], dp: 0 },
  { pop: "The cost of a meal at a downtown restaurant", quantity: "meal cost", item: "restaurant meal", items: "restaurant meals", unit: "$", owner: "The restaurant's owner", mu: [45, 55, 1], sd: [10, 14, 0.5], dp: 2 },
  { pop: "The lifetime of an LED light bulb model", quantity: "lifetime", item: "light bulb", items: "light bulbs", unit: "days", owner: "The manufacturer", mu: [940, 960, 1], sd: [12, 18, 1], dp: 0 },
  { pop: "The height of professional basketball players", quantity: "height", item: "pro basketball player", items: "pro basketball players", unit: "cm", owner: "A sports analyst", mu: [183, 190, 1], sd: [8, 11, 0.5], dp: 1 },
  { pop: "The one-way commute time of employees at a large firm", quantity: "commute time", item: "employee", items: "employees", unit: "minutes", owner: "The HR department", mu: [28, 36, 1], sd: [7, 11, 0.5], dp: 1 },
  { pop: "The number of online orders a retailer receives per day", quantity: "number of online orders", item: "day", items: "days", prep: "on", unit: "orders", owner: "The e-commerce manager", mu: [650, 720, 5], sd: [140, 170, 2], dp: 0 },
  { pop: "The battery life of a phone model on a full charge", quantity: "battery life", item: "phone", items: "phones", unit: "hours", owner: "A tech reviewer", mu: [13, 15, 0.5], sd: [2, 3, 0.25], dp: 1 },
];
let SCENARIOS: Scenario[] = BUILTIN;
export type { Scenario };
/** Runs `fn` with custom scenarios (from a custom set) in place of the built-in ones. Generators are synchronous. */
export function withScenarios<T>(list: Scenario[] | undefined, fn: () => T): T {
  if (!list?.length) return fn();
  const prev = SCENARIOS;
  SCENARIOS = list;
  try { return fn(); } finally { SCENARIOS = prev; }
}
const draw = (rng: Rng, [lo, hi, step]: Range) => roundTo(lo + step * randInt(rng, 0, Math.round((hi - lo) / step)), 6);
const u = (sc: Scenario, v: number | string) => (sc.unit === "$" ? `$${v}` : `${v} ${sc.unit}`);
const one = (sc: Scenario) => `the ${sc.quantity} ${sc.prep ?? "of"} a randomly chosen ${sc.item}`;
const dist = (sc: Scenario, mu: number, sd: number) =>
  `${sc.pop} is normally distributed with mean μ = ${u(sc, fmt(mu))} and standard deviation σ = ${u(sc, fmt(sd))}.`;
const unitOf = (sc: Scenario) => (sc.unit === "$" ? "$" : sc.unit);
function sample(rng: Rng, sc: Scenario, center: number, sd: number, n: number): number[] {
  const floor = Math.max(10 ** -sc.dp, 0.1 * center);
  return Array.from({ length: n }, () => roundTo(Math.max(floor, center + sd * gauss(rng)), sc.dp));
}
const list = (sc: Scenario, data: number[]) => data.map((v) => v.toFixed(sc.dp)).join(",");

// ---------- tolerances ----------
/** Probabilities: 0.001, tightened for small p so a one-tail vs two-tail slip still fails. */
const tolProb = (p: number) => Math.max(0.0002, Math.min(0.001, 0.05 * p));
const TOL_STAT = 0.01;
const TOL_CRIT = 0.005;
/** Values on the data scale: about 2% of a standard error (Z vs T or σ vs σ/√n slips fail). */
const tolSE = (se: number) => Math.max(0.0005, 0.02 * se);
/** Values from NORM.INV / μ + zσ: half a percent of σ. */
const tolSd = (sd: number) => Math.max(0.0005, 0.005 * sd);

const confAlpha = (conf: number) => roundTo(1 - conf / 100, 4);

// ---------- builders ----------
type P = Omit<Part, "id">;
type Draft = Omit<Question, "id" | "seed" | "kind" | "topic" | "parts"> & { parts: P[] };
const topicOf = (k: QuestionKind) => KINDS.find((x) => x.id === k)!.topic;
const letters = "abcdefghijklmnop";
function finish(kind: QuestionKind, seed: number, d: Draft): Question {
  return { id: `${kind}-${seed}`, seed, kind, topic: topicOf(kind), ...d, parts: d.parts.map((p, i) => ({ ...p, id: letters[i] })) };
}
const num = (label: string, answer: number, excel: string, tol: number, format: "prob" | "num", explain: string, unit?: string): P =>
  ({ label, kind: "number", answer, excel, tol, format, explain, ...(unit ? { unit } : {}) });

function normalProb(kind: "normal-less" | "normal-more" | "normal-between", rng: Rng): Draft {
  const sc = pick(rng, SCENARIOS);
  const mu = draw(rng, sc.mu), sd = draw(rng, sc.sd);
  const vdp = Math.max(sc.dp, sd < 1 ? 2 : 0);
  const at = (k: number) => roundTo(mu + k * sd, vdp);
  const given = [{ label: "μ", value: fmt(mu) }, { label: "σ", value: fmt(sd) }];
  const args = `${fmt(mu)},${fmt(sd)},TRUE`;
  if (kind === "normal-between") {
    const k1 = uniform(rng, -2, 0.6);
    const a = at(k1);
    let b = at(k1 + uniform(rng, 0.5, 2));
    if (b <= a) b = roundTo(a + sd, vdp);
    const ans = normDist(b, mu, sd) - normDist(a, mu, sd);
    return {
      title: "Probability between two values",
      prompt: `${dist(sc, mu, sd)} What is the probability that ${one(sc)} is between ${u(sc, fmt(a))} and ${u(sc, fmt(b))}?`,
      given: [...given, { label: "a", value: fmt(a) }, { label: "b", value: fmt(b) }],
      parts: [num(`P(${fmt(a)} < X < ${fmt(b)})`, ans, `=NORM.DIST(${fmt(b)},${args})-NORM.DIST(${fmt(a)},${args})`, tolProb(ans), "prob",
        "NORM.DIST gives the area to the left of a value. The area between a and b is the area left of b minus the area left of a.")],
    };
  }
  const k = uniform(rng, 0.2, 2.3) * (rng() < 0.5 ? -1 : 1);
  const a = at(k);
  const less = kind === "normal-less";
  const left = normDist(a, mu, sd);
  const ans = less ? left : 1 - left;
  return {
    title: less ? "Less-than probability" : "More-than probability",
    prompt: `${dist(sc, mu, sd)} What is the probability that ${one(sc)} is ${less ? "less" : "more"} than ${u(sc, fmt(a))}?`,
    given: [...given, { label: "a", value: fmt(a) }],
    parts: [{ traps: [{ value: 1 - ans, why: less ? "Gave the area to the right. NORM.DIST(…, TRUE) is already the area to the left." : "Gave the area to the left. \"More than\" is 1 − NORM.DIST(…, TRUE)." }], ...num(`P(X ${less ? "<" : ">"} ${fmt(a)})`, ans, `=${less ? "" : "1-"}NORM.DIST(${fmt(a)},${args})`, tolProb(ans), "prob",
      less ? "NORM.DIST(a, μ, σ, TRUE) is the area to the left of a, which is exactly P(X < a)."
        : "NORM.DIST only gives the area to the left of a, so the area to the right is 1 minus it.") }],
  };
}

function normalInverse(rng: Rng): Draft {
  const sc = pick(rng, SCENARIOS);
  const mu = draw(rng, sc.mu), sd = draw(rng, sc.sd);
  const given = [{ label: "μ", value: fmt(mu) }, { label: "σ", value: fmt(sd) }];
  const inv = (p: number) => normInvGeneral(Number(fmt(p)), mu, sd);
  const f = (p: number) => `=NORM.INV(${fmt(p)},${fmt(mu)},${fmt(sd)})`;
  const unit = unitOf(sc);
  const variant = pick(rng, ["top", "bottom", "quartiles", "middle"] as const);
  if (variant === "top" || variant === "bottom") {
    const p = pick(rng, [0.01, 0.025, 0.05, 0.1, 0.15, 0.2, 0.25]);
    const pct = fmt(p * 100);
    const left = variant === "top" ? 1 - p : p;
    return {
      title: variant === "top" ? `Cutoff for the top ${pct}%` : `Cutoff for the bottom ${pct}%`,
      prompt: `${dist(sc, mu, sd)} What ${sc.quantity} separates the ${variant} ${pct}% of ${sc.items} from the rest?`,
      given,
      parts: [{ traps: [{ value: inv(1 - left), why: "Put the wrong area into NORM.INV. It needs the area to the LEFT of the cutoff." }], ...num(`Cutoff for the ${variant} ${pct}%`, inv(left), f(left), tolSd(sd), "num",
        variant === "top"
          ? `NORM.INV needs the area to the LEFT of the answer. The top ${pct}% has ${fmt(left * 100)}% below it, so ${fmt(left)} goes in.`
          : `The bottom ${pct}% is the area to the left of the cutoff, so ${fmt(p)} goes straight into NORM.INV.`, unit) }],
    };
  }
  if (variant === "quartiles") {
    return {
      title: "Quartiles Q1 and Q3",
      prompt: `${dist(sc, mu, sd)} Find the first quartile Q1 and the third quartile Q3 of the ${sc.quantity}.`,
      given,
      parts: [
        num("First quartile Q1", inv(0.25), f(0.25), tolSd(sd), "num", "Q1 is the 25th percentile: the value with 25% of the area to its left.", unit),
        num("Third quartile Q3", inv(0.75), f(0.75), tolSd(sd), "num", "Q3 is the 75th percentile: the value with 75% of the area to its left.", unit),
      ],
    };
  }
  const m = pick(rng, [0.5, 0.8, 0.9, 0.95]);
  const lo = roundTo((1 - m) / 2, 4), hi = roundTo(1 - lo, 4);
  return {
    title: `Middle ${fmt(m * 100)}%`,
    prompt: `${dist(sc, mu, sd)} Between which two values does the middle ${fmt(m * 100)}% of the ${sc.quantity} fall?`,
    given,
    parts: [
      num("Lower value", inv(lo), f(lo), tolSd(sd), "num", `The middle ${fmt(m * 100)}% leaves ${fmt(lo * 100)}% in each tail, so the lower value has ${fmt(lo)} to its left.`, unit),
      num("Upper value", inv(hi), f(hi), tolSd(sd), "num", `The upper value has ${fmt(lo * 100)}% above it, so ${fmt(hi)} of the area is to its left.`, unit),
    ],
  };
}

function zscore(rng: Rng): Draft {
  const sc = pick(rng, SCENARIOS);
  const mu = draw(rng, sc.mu), sd = draw(rng, sc.sd);
  const vdp = Math.max(sc.dp, sd < 1 ? 2 : 0);
  let x = roundTo(mu + uniform(rng, 0.3, 2.6) * (rng() < 0.5 ? -1 : 1) * sd, vdp);
  if (x === mu) x = roundTo(mu + sd, vdp);
  const k = pick(rng, [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5]);
  const above = rng() < 0.5;
  const xk = above ? mu + k * sd : mu - k * sd;
  return {
    title: "Z-scores",
    prompt: `${dist(sc, mu, sd)} (a) What is the z-score of ${u(sc, fmt(x))}? (b) What ${sc.quantity} is ${fmt(k)} standard deviations ${above ? "above" : "below"} the mean?`,
    given: [{ label: "μ", value: fmt(mu) }, { label: "σ", value: fmt(sd) }, { label: "x", value: fmt(x) }],
    parts: [
      num(`z-score of ${fmt(x)}`, (x - mu) / sd, `=(${fmt(x)}-${fmt(mu)})/${fmt(sd)}`, TOL_STAT, "num",
        "z = (x − μ)/σ counts how many standard deviations x sits from the mean; negative means below."),
      num(`Value ${fmt(k)} standard deviations ${above ? "above" : "below"} the mean`, xk, `=${fmt(mu)}${above ? "+" : "-"}${fmt(k)}*${fmt(sd)}`, tolSd(sd), "num",
        `Going back from z to x: x = μ + z·σ, with z = ${above ? "" : "−"}${fmt(k)}.`, unitOf(sc)),
    ],
  };
}

function sampleMean(rng: Rng): Draft {
  const sc = pick(rng, SCENARIOS);
  const mu = draw(rng, sc.mu), sd = draw(rng, sc.sd);
  const n = pick(rng, [4, 5, 6, 8, 9, 10, 12, 15, 16, 20, 25, 30, 36, 40]);
  const se = sd / Math.sqrt(n);
  const adp = Math.min(sc.dp + 1, 2);
  let a = roundTo(mu + uniform(rng, 0.3, 2.3) * (rng() < 0.5 ? -1 : 1) * se, adp);
  if (a === mu) a = roundTo(mu + se, adp);
  const less = rng() < 0.5;
  const left = normDist(a, mu, se);
  const ans = less ? left : 1 - left;
  const seF = `${fmt(sd)}/SQRT(${n})`;
  return {
    title: "Probability for a sample mean",
    prompt: `${dist(sc, mu, sd)} A random sample of ${n} ${sc.items} is taken. What is the probability that the sample mean x̄ is ${less ? "less" : "more"} than ${u(sc, fmt(a))}?`,
    given: [{ label: "μ", value: fmt(mu) }, { label: "σ", value: fmt(sd) }, { label: "n", value: String(n) }, { label: "a", value: fmt(a) }],
    parts: [
      num("Standard error of x̄", se, `=${seF}`, tolSE(se) / 4, "num", "x̄ varies less than one value: its standard error is σ/√n.", unitOf(sc)),
      { traps: [
          { value: less ? normDist(a, mu, sd) : 1 - normDist(a, mu, sd), why: "Used σ inside NORM.DIST. The sample mean's spread is the standard error σ/√n." },
          { value: 1 - ans, why: less ? "Gave the area to the right; \"less than\" is NORM.DIST itself." : "Gave the area to the left; \"more than\" is 1 − NORM.DIST." },
        ], ...num(`P(X̄ ${less ? "<" : ">"} ${fmt(a)})`, ans, `=${less ? "" : "1-"}NORM.DIST(${fmt(a)},${fmt(mu)},${seF},TRUE)`, tolProb(ans), "prob",
        `X̄ is normal with mean μ and standard deviation σ/√n, so use σ/√n (not σ) inside NORM.DIST${less ? "" : ", and 1 minus it for \"more than\""}.`) },
    ],
  };
}

function xbarRange(rng: Rng): Draft {
  const sc = pick(rng, SCENARIOS);
  const mu = draw(rng, sc.mu), sd = draw(rng, sc.sd);
  const n = randInt(rng, 5, 50);
  const conf = pick(rng, [80, 90, 95, 98, 99]);
  const alpha = confAlpha(conf);
  const z = normInv(1 - alpha / 2);
  const zF = `NORM.S.INV(1-${fmt(alpha)}/2)`;
  const se = sd / Math.sqrt(n);
  return {
    title: "Where will x̄ land?",
    prompt: `${dist(sc, mu, sd)} A random sample of ${n} ${sc.items} will be taken. Find the interval, centred on μ, in which the sample mean x̄ will fall with ${conf}% probability.`,
    given: [{ label: "μ", value: fmt(mu) }, { label: "σ", value: fmt(sd) }, { label: "n", value: String(n) }, { label: "Confidence", value: `${conf}%` }],
    parts: [
      num("Z_α/2", z, `=${zF}`, TOL_CRIT, "num", `${conf}% in the middle leaves α/2 = ${fmt(alpha / 2)} in each tail, so Z_α/2 = NORM.S.INV(1 − α/2).`),
      num("Lower limit", mu - (z * sd) / Math.sqrt(n), `=${fmt(mu)}-${zF}*${fmt(sd)}/SQRT(${n})`, tolSE(se), "num", "μ is known, so the interval is μ − Z_α/2 · σ/√n.", unitOf(sc)),
      num("Upper limit", mu + (z * sd) / Math.sqrt(n), `=${fmt(mu)}+${zF}*${fmt(sd)}/SQRT(${n})`, tolSE(se), "num", "Upper end: μ + Z_α/2 · σ/√n.", unitOf(sc)),
    ],
  };
}

function ciZ(rng: Rng): Draft {
  const sc = pick(rng, SCENARIOS);
  const truth = draw(rng, sc.mu), sd = draw(rng, sc.sd);
  const conf = pick(rng, [80, 90, 95, 98, 99]);
  const alpha = confAlpha(conf);
  const z = normInv(1 - alpha / 2);
  const zF = `NORM.S.INV(1-${fmt(alpha)}/2)`;
  const useData = rng() < 0.5;
  const parts: P[] = [];
  let n: number, xbar: number, xF: string, data: number[] | undefined;
  if (useData) {
    n = randInt(rng, 8, 15);
    data = sample(rng, sc, truth + uniform(rng, -1, 1) * sd / Math.sqrt(n), sd, n);
    xbar = mean(data);
    xF = `AVERAGE(${list(sc, data)})`;
  } else {
    n = randInt(rng, 10, 60);
    xbar = roundTo(truth + gauss(rng) * sd / Math.sqrt(n), Math.min(sc.dp + 1, 3));
    xF = fmt(xbar);
  }
  const se = sd / Math.sqrt(n);
  if (useData) parts.push(num("Sample mean x̄", xbar, `=${xF}`, tolSE(se), "num", "x̄ is the average of the sample: AVERAGE of the data.", unitOf(sc)));
  parts.push(
    num("Standard error σ/√n", se, `=${fmt(sd)}/SQRT(${n})`, tolSE(se) / 4, "num", "σ is known, so the standard error is σ/√n.", unitOf(sc)),
    num("Z_α/2", z, `=${zF}`, TOL_CRIT, "num", `σ is known, so the critical value comes from Z: NORM.S.INV(1 − α/2) with α = ${fmt(alpha)}.`),
    { traps: [{ value: xbar - z * sd, why: "Used σ instead of the standard error σ/√n." }, { value: xbar - (normInv(1 - alpha) * sd) / Math.sqrt(n), why: "Used 1 − α; a two-sided interval needs NORM.S.INV(1 − α/2)." }], ...num("Lower limit", xbar - (z * sd) / Math.sqrt(n), `=${xF}-${zF}*${fmt(sd)}/SQRT(${n})`, tolSE(se), "num", "μ is unknown, so centre the interval on x̄: x̄ − Z_α/2 · σ/√n.", unitOf(sc)) },
    { traps: [{ value: xbar + z * sd, why: "Used σ instead of the standard error σ/√n." }, { value: xbar + (normInv(1 - alpha) * sd) / Math.sqrt(n), why: "Used 1 − α; a two-sided interval needs NORM.S.INV(1 − α/2)." }], ...num("Upper limit", xbar + (z * sd) / Math.sqrt(n), `=${xF}+${zF}*${fmt(sd)}/SQRT(${n})`, tolSE(se), "num", "Upper end: x̄ + Z_α/2 · σ/√n.", unitOf(sc)) },
  );
  return {
    title: `${conf}% interval for μ, σ known`,
    prompt: `${sc.pop} is normally distributed with unknown mean μ and known standard deviation σ = ${u(sc, fmt(sd))}. ` +
      (useData ? `A random sample of ${n} ${sc.items} gave the values below.` : `A random sample of ${n} ${sc.items} has mean x̄ = ${u(sc, fmt(xbar))}.`) +
      ` Build a ${conf}% confidence interval for μ.`,
    data,
    given: [...(useData ? [] : [{ label: "x̄", value: fmt(xbar) }]), { label: "σ", value: fmt(sd) }, { label: "n", value: String(n) }, { label: "Confidence", value: `${conf}%` }],
    parts,
  };
}

function ciT(rng: Rng): Draft {
  const sc = pick(rng, SCENARIOS);
  const truth = draw(rng, sc.mu), sd = draw(rng, sc.sd);
  const conf = pick(rng, [80, 90, 95, 98, 99]);
  const alpha = confAlpha(conf);
  const n = randInt(rng, 6, 15);
  const data = sample(rng, sc, truth, sd, n);
  const xbar = mean(data), s = stdevS(data);
  const t = tInv(1 - alpha / 2, n - 1);
  const L = list(sc, data);
  const xF = `AVERAGE(${L})`, sF = `STDEV.S(${L})`, tF = `T.INV(1-${fmt(alpha)}/2,${n}-1)`;
  const se = s / Math.sqrt(n);
  return {
    title: `${conf}% interval for μ, σ unknown`,
    prompt: `${sc.pop} is normally distributed, but neither μ nor σ is known. A random sample of ${n} ${sc.items} gave the values below. Build a ${conf}% confidence interval for μ.`,
    data,
    given: [{ label: "n", value: String(n) }, { label: "Confidence", value: `${conf}%` }],
    parts: [
      num("Sample mean x̄", xbar, `=${xF}`, tolSE(se), "num", "x̄ is the AVERAGE of the data.", unitOf(sc)),
      num("Sample standard deviation s", s, `=${sF}`, Math.max(0.0005, 0.01 * s), "num", "σ is unknown, so estimate it with s = STDEV.S (divides by n − 1).", unitOf(sc)),
      { traps: [{ value: normInv(1 - alpha / 2), why: "That's Z_α/2. σ is unknown, so use T.INV with ν = n − 1." }, { value: tInv(1 - alpha, n - 1), why: "Used 1 − α. A two-sided interval puts α/2 in each tail: T.INV(1 − α/2, ν)." }, { value: tInv(1 - alpha / 2, n), why: "Used ν = n. Degrees of freedom are n − 1." }], ...num(`T_α/2 (ν = ${n - 1})`, t, `=${tF}`, TOL_CRIT, "num", `With s instead of σ, use the t distribution with ν = n − 1 = ${n - 1}: T.INV(1 − α/2, ν).`) },
      { traps: [{ value: xbar - (normInv(1 - alpha / 2) * s) / Math.sqrt(n), why: "Used Z_α/2 (NORM.S.INV). σ is unknown, so the multiplier is T.INV(1 − α/2, n − 1)." }, { value: xbar - t * s, why: "Forgot to divide s by √n." }], ...num("Lower limit", xbar - (t * s) / Math.sqrt(n), `=${xF}-${tF}*${sF}/SQRT(${n})`, tolSE(se), "num", "x̄ − T_α/2 · s/√n.", unitOf(sc)) },
      { traps: [{ value: xbar + (normInv(1 - alpha / 2) * s) / Math.sqrt(n), why: "Used Z_α/2 (NORM.S.INV). σ is unknown, so the multiplier is T.INV(1 − α/2, n − 1)." }, { value: xbar + t * s, why: "Forgot to divide s by √n." }], ...num("Upper limit", xbar + (t * s) / Math.sqrt(n), `=${xF}+${tF}*${sF}/SQRT(${n})`, tolSE(se), "num", "x̄ + T_α/2 · s/√n.", unitOf(sc)) },
    ],
  };
}

export const DECISIONS = ["Reject H₀", "Do not reject H₀"];
function decisionPart(reject: boolean, alpha: number, rule: string, method: "p" | "crit" | "both", S: string): P {
  const decision = reject ? DECISIONS[0] : DECISIONS[1];
  return {
    label: "Decision at α = " + fmt(alpha) + " (R or DR)", kind: "choice", answer: decision, options: DECISIONS,
    excel: `${rule} → ${decision}`,
    explain: method === "p" ? "Reject H₀ when the p-value is smaller than α."
      : method === "crit" ? `Reject H₀ when ${S} falls beyond the critical value, in the tail named by H_A.`
      : `Reject H₀ when the p-value is smaller than α, which is the same as ${S} falling beyond the critical value.`,
  };
}

const DIR_WORD: Record<Null, string> = { le: "more than", eq: "different from", ge: "less than" };
export const NULL_OPTIONS = (mu0: string) => NULLS.map((nl) => nl.h0.replace("μ₀", mu0));

function hypothesis(rng: Rng, caseKey?: string, full = false): Draft {
  const drawn = TWELVE[Math.floor(rng() * TWELVE.length)];
  const c = caseKey === undefined ? drawn : TWELVE.find((x) => x.key === caseKey);
  if (!c) throw new Error(`Unknown case "${caseKey}"`);
  const h0: Null = c.h0, sigma: Sigma = c.sigma, method: Method = c.method;
  const sc = pick(rng, SCENARIOS);
  const mu0 = draw(rng, sc.mu), sdPop = draw(rng, sc.sd);
  const alpha = pick(rng, [0.01, 0.05, 0.1]);
  const known = sigma === "known";
  const useData = !known || rng() < 0.35;
  const n = useData ? (known ? randInt(rng, 8, 15) : randInt(rng, 6, 14)) : randInt(rng, 10, 50);
  const dir = h0 === "le" ? 1 : h0 === "ge" ? -1 : rng() < 0.5 ? 1 : -1;
  const strong = rng() < 0.5;
  const delta = dir * (strong ? uniform(rng, 2.2, 3.8) : uniform(rng, -0.6, 1));
  const center = mu0 + (delta * sdPop) / Math.sqrt(n);

  let data: number[] | undefined, xbar: number, xF: string;
  if (useData) {
    data = sample(rng, sc, center, sdPop, n);
    xbar = mean(data);
    xF = `AVERAGE(${list(sc, data)})`;
  } else {
    xbar = roundTo(center + (gauss(rng) * sdPop) / Math.sqrt(n), Math.min(sc.dp + 1, 3));
    xF = fmt(xbar);
  }
  const sd = known ? sdPop : stdevS(data!);
  const sF = known ? fmt(sdPop) : `STDEV.S(${list(sc, data!)})`;
  const res = runTest({ h0, sigma, xbar, mu0, sd, n, alpha });
  const S = res.statName;
  const df = n - 1;
  const statF = `(${xF}-${fmt(mu0)})/(${sF}/SQRT(${n}))`;
  const D = (x: string) => (known ? `NORM.S.DIST(${x},TRUE)` : `T.DIST(${x},${df},TRUE)`);
  const mu0s = fmt(mu0);
  const options = NULL_OPTIONS(mu0s);
  const nl = NULLS.find((x) => x.id === h0)!;
  const nullAns = nl.h0.replace("μ₀", mu0s);
  const ha = nl.ha.replace("μ₀", mu0s);

  const parts: P[] = [{
    label: "Which null hypothesis?", kind: "choice", answer: nullAns, options,
    excel: `"${DIR_WORD[h0]} ${mu0s}" is the claim to show, so H_A: ${ha.slice(5)} and ${nullAns}`,
    explain: `The question asks whether μ is ${DIR_WORD[h0]} ${mu0s}; that goes in H_A (${ha}). H₀ is the opposite and always contains the equals sign.`,
  }];
  if (useData) {
    const se = sd / Math.sqrt(n);
    parts.push(num("Sample mean x̄", xbar, `=${xF}`, tolSE(se), "num", "x̄ is the AVERAGE of the sample data.", unitOf(sc)));
    if (!known) parts.push(num("Sample standard deviation s", sd, `=${sF}`, Math.max(0.0005, 0.01 * sd), "num", "σ is unknown, so estimate it with s = STDEV.S of the data.", unitOf(sc)));
  }
  const statTrap: Trap[] = [{ value: (xbar - mu0) / sd, why: `Divided by ${known ? "σ" : "s"} instead of the standard error ${known ? "σ" : "s"}/√n.` }];
  parts.push({ ...num(`What is the test statistic ${S}?`, res.stat, `=${statF}`, TOL_STAT, "num",
    known ? "σ is known, so Z = (x̄ − μ₀)/(σ/√n)." : `σ is unknown, so T = (x̄ − μ₀)/(s/√n), with ν = n − 1 = ${df}.`), traps: statTrap });

  // Likely slips, named in the review when a student's value matches one.
  const cdfOther = (x: number) => (known ? tCdf(x, df) : normCdf(x));
  const invOther = (p: number) => (known ? tInv(p, df) : normInv(p));
  const pOf = (cdf: (x: number) => number) => h0 === "le" ? 1 - cdf(res.stat) : h0 === "ge" ? cdf(res.stat) : res.stat < 0 ? 2 * cdf(res.stat) : 2 * (1 - cdf(res.stat));
  const pTraps: Trap[] = [
    { value: pOf(cdfOther), why: known ? "Used T.DIST, but σ is known, so the statistic is Z: use NORM.S.DIST." : "Used NORM.S.DIST, but σ is unknown, so the statistic is T: use T.DIST with ν = n − 1." },
    ...(h0 === "eq"
      ? [{ value: res.pValue / 2, why: "Gave one tail only. H₀ has an equals sign, so the test is two-tailed: double the tail area." },
         { value: 1 - res.pValue / 2, why: "Took the area on the wrong side of the statistic. Double the tail that the statistic points into." }]
      : [{ value: 1 - res.pValue, why: `Took the wrong tail. H_A: ${ha.slice(5)} points ${h0 === "le" ? "right, so the p-value is the area to the right: 1 − .DIST" : "left, so the p-value is the area to the left: .DIST"}.` },
         { value: 2 * Math.min(res.pValue, 1 - res.pValue), why: "Doubled the tail, but this is a one-tailed test: don't multiply by 2." }]),
  ];
  const crit1 = h0 === "eq" ? res.crit[1] : res.crit[0];
  const cTraps: Trap[] = [
    { value: h0 === "eq" ? invOther(1 - alpha / 2) : h0 === "le" ? invOther(1 - alpha) : invOther(alpha), why: known ? "Used T.INV, but σ is known: the critical value comes from NORM.S.INV." : "Used NORM.S.INV, but σ is unknown: use T.INV with ν = n − 1." },
    ...(h0 === "eq"
      ? [{ value: res.crit[1] === 0 ? NaN : (known ? normInv(1 - alpha) : tInv(1 - alpha, df)), why: "Used α instead of α/2. Two tails split α in half: .INV(1 − α/2)." }]
      : [{ value: -crit1, why: h0 === "ge" ? "Wrong sign: a left-tail critical value is negative, .INV(α)." : "Wrong sign: a right-tail critical value is positive, .INV(1 − α)." },
         { value: h0 === "le" ? (known ? normInv(1 - alpha / 2) : tInv(1 - alpha / 2, df)) : (known ? normInv(alpha / 2) : tInv(alpha / 2, df)), why: "Used α/2, but this is a one-tailed test: all of α goes in one tail." }]),
  ];
  const pPart = (): P => {
    const pF = h0 === "le" ? `=1-${D(statF)}` : h0 === "ge" ? `=${D(statF)}` : res.stat < 0 ? `=2*${D(statF)}` : `=2*(1-${D(statF)})`;
    const ex = h0 === "le" ? `Right-tailed test (H_A: μ > ${mu0s}): the p-value is the area to the right of ${S}, 1 − .DIST(${S}).`
      : h0 === "ge" ? `Left-tailed test (H_A: μ < ${mu0s}): the p-value is the area to the left of ${S}, .DIST(${S}).`
      : res.stat < 0 ? `Two-tailed test and ${S} is negative, so double the left tail: 2·.DIST(${S}).`
      : `Two-tailed test and ${S} is positive, so double the right tail: 2·(1 − .DIST(${S})).`;
    return { ...num("What is the p-value?", res.pValue, pF, tolProb(res.pValue), "prob", ex), traps: pTraps };
  };
  const critPart = (): P => {
    const label = h0 === "eq" ? `What is the positive critical value? (two tails: ±this value${known ? "" : `, ν = ${df}`})`
      : h0 === "ge" ? `What is the critical value? (left tail, so it is negative${known ? "" : `; ν = ${df}`})`
      : `What is the critical value?${known ? "" : ` (ν = ${df})`}`;
    const ex = h0 === "le" ? "Right tail: all of α sits on the right, so the cutoff is .INV(1 − α)."
      : h0 === "ge" ? "Left tail: all of α sits on the left, so the cutoff is .INV(α), a negative number."
      : "Two tails: α is split in half, so the cutoffs are ±.INV(1 − α/2).";
    return { ...num(label, crit1, res.excel.crit, TOL_CRIT, "num", ex), traps: cTraps };
  };

  const st = r4(res.stat), cv = r4(crit1);
  const critRule = h0 === "le" ? `${S} = ${st} ${res.reject ? ">" : "≤"} ${cv}`
    : h0 === "ge" ? `${S} = ${st} ${res.reject ? "<" : "≥"} ${cv}`
    : res.reject ? `${S} = ${st} is ${res.stat < 0 ? `below −${cv}` : `above ${cv}`}` : `${S} = ${st} is between −${cv} and ${cv}`;
  const pRule = `p-value ${r4(res.pValue)} ${res.reject ? "<" : "≥"} α = ${fmt(alpha)}`;
  let rule: string;
  if (full) { parts.push(critPart(), pPart()); rule = `${pRule}; ${critRule}`; }
  else if (method === "p") { parts.push(pPart()); rule = pRule; }
  else { parts.push(critPart()); rule = critRule; }
  parts.push(decisionPart(res.reject, alpha, rule, full ? "both" : method, S));

  const sigmaText = known ? `The population standard deviation is known to be σ = ${u(sc, fmt(sdPop))}.` : "The population standard deviation is unknown.";
  const sampleText = useData ? `A random sample of ${n} ${sc.items} gave the values below.` : `A random sample of ${n} ${sc.items} has mean x̄ = ${u(sc, fmt(xbar))}.`;
  const given = [
    { label: "μ₀", value: mu0s },
    ...(known ? [{ label: "σ", value: fmt(sdPop) }] : []),
    { label: "n", value: String(n) },
    ...(useData ? [] : [{ label: "x̄", value: fmt(xbar) }]),
    { label: "α", value: fmt(alpha) },
  ];
  return {
    title: `${h0 === "eq" ? "Two-tailed" : h0 === "le" ? "Right-tailed" : "Left-tailed"} ${known ? "Z" : "t"}-test${full ? "" : `, ${method === "p" ? "p-value" : "critical value"}`}`,
    prompt: `${sc.owner} wants to know whether the mean ${sc.quantity} is ${DIR_WORD[h0]} ${u(sc, mu0s)}. ${sigmaText} ${sampleText} ` +
      (full ? `Test the null hypothesis at α = ${fmt(alpha)}: give the test statistic, the critical value, the p-value and your decision.` : `Test at α = ${fmt(alpha)} using the ${method === "p" ? "p-value" : "critical value"} method.`),
    data,
    given,
    caseKey: c.key,
    parts,
  };
}

// ---------- Lesson 18 and Exam-3-style questions ----------
const TAIL_OF: Record<Null, "right" | "two" | "left"> = { le: "right", eq: "two", ge: "left" };
const pickNull = (rng: Rng): Null => pick(rng, ["le", "eq", "ge"] as const);
/** p-value from a CDF and a statistic, following class: one-tail .DIST; two tails doubled on the side the statistic is on. */
function pFrom(h0: Null, cdfAtStat: number, leftSide: boolean): number {
  return h0 === "le" ? 1 - cdfAtStat : h0 === "ge" ? cdfAtStat : leftSide ? 2 * cdfAtStat : 2 * (1 - cdfAtStat);
}
function pFormula(h0: Null, distF: string, leftSide: boolean): string {
  return h0 === "le" ? `=1-${distF}` : h0 === "ge" ? `=${distF}` : leftSide ? `=2*${distF}` : `=2*(1-${distF})`;
}
const pExplain = (h0: Null, S: string, leftSide: boolean) => h0 === "le" ? `Right tail: the p-value is the area to the right of ${S}, 1 − .DIST.`
  : h0 === "ge" ? `Left tail: the p-value is the area to the left of ${S}, .DIST.`
  : leftSide ? `Two tails and ${S} is on the left side, so double the left tail: 2·.DIST.` : `Two tails and ${S} is on the right side, so double the right tail: 2·(1 − .DIST).`;
const wrongTail = (h0: Null, p: number): Trap[] => h0 === "eq"
  ? [{ value: p / 2, why: "Gave one tail only. H₀ has an equals sign, so double the tail area." }, { value: 1 - p / 2, why: "Doubled the wrong side. Double the tail the statistic points into." }]
  : [{ value: 1 - p, why: `Took the wrong tail. This is a ${TAIL_OF[h0]}-tailed test.` }, { value: 2 * Math.min(p, 1 - p), why: "Doubled the tail, but this is a one-tailed test." }];

// Chi-squared test for a variance (Lesson 18).
function varianceTest(rng: Rng): Draft {
  const sc = pick(rng, SCENARIOS);
  const mu = draw(rng, sc.mu), sd0 = draw(rng, sc.sd);
  const h0 = pickNull(rng);
  const alpha = pick(rng, [0.01, 0.05, 0.1, 0.2]);
  const n = randInt(rng, 8, 15);
  const df = n - 1;
  const strong = rng() < 0.5;
  const dir = h0 === "le" ? 1 : h0 === "ge" ? -1 : rng() < 0.5 ? 1 : -1;
  const factor = strong ? (dir > 0 ? uniform(rng, 1.5, 2) : uniform(rng, 0.45, 0.65)) : uniform(rng, 0.85, 1.15);
  const data = sample(rng, sc, mu, sd0 * factor, n);
  const v0 = roundTo(sd0 * sd0, 6);
  const s2 = stdevS(data) ** 2;
  const stat = (df * s2) / v0;
  const cdf = chisqCdf(stat, df);
  const leftSide = cdf < 0.5;
  const pValue = pFrom(h0, cdf, leftSide);
  const L = list(sc, data);
  const s2F = `VAR.S(${L})`;
  const statF = `(${n}-1)*${s2F}/${fmt(v0)}`;
  const distF = `CHISQ.DIST(${statF},${df},TRUE)`;
  const v0s = fmt(v0);
  const options = [`H₀: σ² ≤ ${v0s}`, `H₀: σ² = ${v0s}`, `H₀: σ² ≥ ${v0s}`];
  const nullAns = options[h0 === "le" ? 0 : h0 === "eq" ? 1 : 2];
  const word = h0 === "le" ? "more than" : h0 === "ge" ? "less than" : "different from";
  const parts: P[] = [
    { label: "Which null hypothesis?", kind: "choice", answer: nullAns, options, excel: `The claim to show is "variance ${word} ${v0s}", so it goes in H_A; H₀ is the opposite: ${nullAns}`,
      explain: "H_A is what you want to show; H₀ is its opposite and always contains the equals sign." },
    { ...num("Sample variance S²", s2, `=${s2F}`, Math.max(0.0005, 0.005 * s2), "num", "S² = VAR.S of the data (divides by n − 1, the unbiased estimate of σ²)."),
      traps: [{ value: (s2 * (n - 1)) / n, why: "Divided by n (VAR.P). The sample variance divides by n − 1." }, { value: Math.sqrt(s2), why: "That's S, not S². Use VAR.S (or STDEV.S squared)." }] },
    { ...num("Test statistic χ²", stat, `=${statF}`, Math.max(0.005, 0.002 * stat), "num", `χ² = (n − 1)·S²/σ₀² with σ₀² = ${v0s}.`),
      traps: [{ value: (df * s2) / sd0, why: `Divided by σ₀ = ${fmt(sd0)}. The formula uses the variance σ₀² = ${v0s}.` }, { value: (n * s2) / v0, why: "Used n instead of n − 1." }, { value: (df * Math.sqrt(s2)) / v0, why: "Used S instead of S²." }] },
  ];
  let crit: number[], critF: string[], reject: boolean;
  if (h0 === "le") { crit = [chisqInv(1 - alpha, df)]; critF = [`=CHISQ.INV(1-${fmt(alpha)},${df})`]; reject = stat > crit[0]; }
  else if (h0 === "ge") { crit = [chisqInv(alpha, df)]; critF = [`=CHISQ.INV(${fmt(alpha)},${df})`]; reject = stat < crit[0]; }
  else { crit = [chisqInv(alpha / 2, df), chisqInv(1 - alpha / 2, df)]; critF = [`=CHISQ.INV(${fmt(alpha)}/2,${df})`, `=CHISQ.INV(1-${fmt(alpha)}/2,${df})`]; reject = stat < crit[0] || stat > crit[1]; }
  if (h0 === "eq") {
    parts.push(
      { ...num(`Lower critical value (ν = ${df})`, crit[0], critF[0], TOL_CRIT, "num", "Two tails: α/2 on the left, CHISQ.INV(α/2, ν). Chi-squared isn't symmetric, so the two cutoffs are different numbers."),
        traps: [{ value: chisqInv(alpha, df), why: "Used α; two tails put α/2 on each side." }] },
      { ...num(`Upper critical value (ν = ${df})`, crit[1], critF[1], TOL_CRIT, "num", "Upper cutoff: CHISQ.INV(1 − α/2, ν)."),
        traps: [{ value: chisqInv(1 - alpha, df), why: "Used 1 − α; two tails put α/2 on each side." }, { value: -crit[0], why: "Chi-squared isn't symmetric: the upper cutoff isn't minus the lower one." }] },
    );
  } else {
    parts.push({ ...num(`Critical value (ν = ${df})`, crit[0], critF[0], TOL_CRIT, "num", h0 === "le" ? "Right tail: CHISQ.INV(1 − α, ν)." : "Left tail: CHISQ.INV(α, ν)."),
      traps: [{ value: h0 === "le" ? chisqInv(alpha, df) : chisqInv(1 - alpha, df), why: h0 === "le" ? "Used α: a right-tail cutoff has 1 − α to its left." : "Used 1 − α: a left-tail cutoff has α to its left." }, { value: h0 === "le" ? chisqInv(1 - alpha, n) : chisqInv(alpha, n), why: "Used ν = n. Degrees of freedom are n − 1." }] });
  }
  parts.push({ ...num("p-value", pValue, pFormula(h0, distF, leftSide), tolProb(pValue), "prob", pExplain(h0, "χ²", leftSide)), traps: wrongTail(h0, pValue) });
  parts.push(decisionPart(reject, alpha, `p-value ${r4(pValue)} ${reject ? "<" : "≥"} α = ${fmt(alpha)}`, "both", "χ²"));
  const ask = rng() < 0.5;
  return {
    title: `${h0 === "eq" ? "Two-tailed" : h0 === "le" ? "Right-tailed" : "Left-tailed"} test for a variance`,
    prompt: `${sc.pop} is normally distributed. ${ask ? `The standard deviation is supposed to be σ = ${u(sc, fmt(sd0))}, so the variance is σ² = ${v0s}.` : `The variance is supposed to be σ² = ${v0s}.`} ` +
      `${sc.owner} wants to know whether the variance is ${word} ${v0s}. A random sample of ${n} ${sc.items} gave the values below. Test at α = ${fmt(alpha)}.`,
    data,
    given: [{ label: "σ₀²", value: v0s }, { label: "n", value: String(n) }, { label: "α", value: fmt(alpha) }],
    parts,
  };
}

// Two independent samples (Lesson 18, Toolpak).
type TwoScenario = { a: string; b: string; quantity: string; who: string; unit: string; mu: Range; sd: Range; dp: number; owner: string };
const TWO_SCENARIOS: TwoScenario[] = [
  { a: "Section A", b: "Section B", quantity: "final exam score", who: "students", unit: "points", mu: [62, 80, 1], sd: [6, 12, 1], dp: 0, owner: "The course coordinator" },
  { a: "Line 1", b: "Line 2", quantity: "fill volume", who: "cans", unit: "ml", mu: [328, 332, 0.5], sd: [2, 4, 0.5], dp: 1, owner: "The bottling plant's engineer" },
  { a: "Store A", b: "Store B", quantity: "daily sales", who: "days", unit: "$", mu: [2200, 2800, 50], sd: [200, 350, 10], dp: 0, owner: "The regional manager" },
  { a: "Old process", b: "New process", quantity: "assembly time", who: "units", unit: "minutes", mu: [38, 46, 1], sd: [3, 6, 0.5], dp: 1, owner: "The operations team" },
  { a: "Supplier 1", b: "Supplier 2", quantity: "battery life", who: "batteries", unit: "hours", mu: [18, 24, 0.5], sd: [1.5, 3, 0.25], dp: 1, owner: "The purchasing manager" },
  { a: "Morning shift", b: "Evening shift", quantity: "orders packed per hour", who: "hours", unit: "orders", mu: [40, 55, 1], sd: [4, 8, 0.5], dp: 0, owner: "The warehouse supervisor" },
];
const tu = (sc: TwoScenario, v: number | string) => (sc.unit === "$" ? `$${v}` : `${v} ${sc.unit}`);
const tlist = (dp: number, xs: number[]) => xs.map((v) => v.toFixed(dp)).join(",");
function twoSamples(rng: Rng, sc: TwoScenario, sdA: number, sdB: number, h0: Null, n1: number, n2: number) {
  const mu = draw(rng, sc.mu);
  const se = Math.sqrt(sdA ** 2 / n1 + sdB ** 2 / n2);
  const dir = h0 === "le" ? 1 : h0 === "ge" ? -1 : rng() < 0.5 ? 1 : -1;
  const delta = dir * (rng() < 0.5 ? uniform(rng, 2.2, 3.6) : uniform(rng, -0.5, 1)) * se;
  const gen = (m: number, s: number, n: number) => Array.from({ length: n }, () => roundTo(Math.max(10 ** -sc.dp, m + s * gauss(rng)), sc.dp));
  return { a: gen(mu + delta / 2, sdA, n1), b: gen(mu - delta / 2, sdB, n2) };
}
const NULL2 = (h0: Null) => (h0 === "le" ? "H₀: μ₁ ≤ μ₂" : h0 === "ge" ? "H₀: μ₁ ≥ μ₂" : "H₀: μ₁ = μ₂");
const NULL2_OPTIONS = ["H₀: μ₁ ≤ μ₂", "H₀: μ₁ = μ₂", "H₀: μ₁ ≥ μ₂"];
const WORD2 = (h0: Null, sc: TwoScenario) => h0 === "le" ? `${sc.a} has a higher mean ${sc.quantity} than ${sc.b}` : h0 === "ge" ? `${sc.a} has a lower mean ${sc.quantity} than ${sc.b}` : `the mean ${sc.quantity} differs between ${sc.a} and ${sc.b}`;
function nullPart2(h0: Null, sc: TwoScenario): P {
  return { label: "Which null hypothesis? (μ₁ = " + sc.a + ", μ₂ = " + sc.b + ")", kind: "choice", answer: NULL2(h0), options: NULL2_OPTIONS,
    excel: `The claim "${WORD2(h0, sc)}" goes in H_A, so ${NULL2(h0)}`, explain: "H_A is what the question wants to show; H₀ is the opposite, with the equals sign." };
}

function twoZ(rng: Rng): Draft {
  const sc = pick(rng, TWO_SCENARIOS);
  const h0 = pickNull(rng);
  const alpha = pick(rng, [0.01, 0.05, 0.1, 0.2]);
  const sA = draw(rng, sc.sd), sB = draw(rng, sc.sd);
  const n1 = randInt(rng, 8, 14), n2 = randInt(rng, 8, 14);
  const { a, b } = twoSamples(rng, sc, sA, sB, h0, n1, n2);
  const z = (mean(a) - mean(b)) / Math.sqrt(sA ** 2 / n1 + sB ** 2 / n2);
  const zF = `(AVERAGE(${tlist(sc.dp, a)})-AVERAGE(${tlist(sc.dp, b)}))/SQRT(${fmt(sA)}^2/${n1}+${fmt(sB)}^2/${n2})`;
  const cdf = normCdf(z), left = z < 0;
  const p = pFrom(h0, cdf, left);
  const crit = h0 === "le" ? normInv(1 - alpha) : h0 === "ge" ? normInv(alpha) : normInv(1 - alpha / 2);
  const critF = h0 === "le" ? `=NORM.S.INV(1-${fmt(alpha)})` : h0 === "ge" ? `=NORM.S.INV(${fmt(alpha)})` : `=NORM.S.INV(1-${fmt(alpha)}/2)`;
  const reject = p < alpha;
  return {
    title: `Two samples, σ known: ${h0 === "eq" ? "two" : h0 === "le" ? "right" : "left"}-tailed z-test`,
    prompt: `${sc.owner} wants to know whether ${WORD2(h0, sc)}. The ${sc.quantity} is normal in both groups with known standard deviations σ₁ = ${tu(sc, fmt(sA))} (${sc.a}) and σ₂ = ${tu(sc, fmt(sB))} (${sc.b}). ` +
      `Independent random samples are below. Test at α = ${fmt(alpha)}. Tip: Data › Data Analysis › z-Test: Two Sample for Means (enter the variances σ², not σ).`,
    data: a, data2: b, dataLabels: [sc.a, sc.b],
    given: [{ label: "σ₁", value: fmt(sA) }, { label: "σ₂", value: fmt(sB) }, { label: "α", value: fmt(alpha) }],
    parts: [
      nullPart2(h0, sc),
      { ...num("Test statistic z", z, `=${zF}`, TOL_STAT, "num", "z = (x̄₁ − x̄₂)/√(σ₁²/n₁ + σ₂²/n₂). The Toolpak's \"z\" line."),
        traps: [{ value: (mean(a) - mean(b)) / Math.sqrt(sA / n1 + sB / n2), why: "Entered σ where the Toolpak (and the formula) wants the variance σ²." }, { value: -z, why: "Subtracted the other way round: Variable 1 is " + sc.a + "." }] },
      { ...num(h0 === "eq" ? "Positive critical value (±)" : "Critical value", crit, critF, TOL_CRIT, "num", h0 === "eq" ? "Two tails: ±NORM.S.INV(1 − α/2), the Toolpak's \"z Critical two-tail\"." : h0 === "le" ? "Right tail: NORM.S.INV(1 − α)." : "Left tail: NORM.S.INV(α), negative."),
        traps: h0 === "eq" ? [{ value: normInv(1 - alpha), why: "That's the one-tail cutoff; two tails use 1 − α/2." }] : [{ value: -crit, why: "Wrong sign for this tail." }, { value: normInv(1 - alpha / 2) * (h0 === "ge" ? -1 : 1), why: "Used α/2 in a one-tailed test." }] },
      { ...num("p-value", p, pFormula(h0, `NORM.S.DIST(${zF},TRUE)`, left), tolProb(p), "prob", pExplain(h0, "z", left) + " The Toolpak's one-tail line is always the smaller tail, so check it points the way H_A does."), traps: wrongTail(h0, p) },
      decisionPart(reject, alpha, `p-value ${r4(p)} ${reject ? "<" : "≥"} α = ${fmt(alpha)}`, "both", "z"),
    ],
  };
}

function twoT(rng: Rng): Draft {
  const sc = pick(rng, TWO_SCENARIOS);
  const h0 = pickNull(rng);
  const alpha = pick(rng, [0.01, 0.05, 0.1]);
  const s = draw(rng, sc.sd);
  const n1 = randInt(rng, 7, 13), n2 = randInt(rng, 7, 13);
  const { a, b } = twoSamples(rng, sc, s, s, h0, n1, n2);
  const df = n1 + n2 - 2;
  const v1 = stdevS(a) ** 2, v2 = stdevS(b) ** 2;
  const sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / df;
  const t = (mean(a) - mean(b)) / Math.sqrt(sp2 * (1 / n1 + 1 / n2));
  const LA = tlist(sc.dp, a), LB = tlist(sc.dp, b);
  const sp2F = `((${n1}-1)*VAR.S(${LA})+(${n2}-1)*VAR.S(${LB}))/(${n1}+${n2}-2)`;
  const tF = `(AVERAGE(${LA})-AVERAGE(${LB}))/SQRT(${sp2F}*(1/${n1}+1/${n2}))`;
  const cdf = tCdf(t, df), left = t < 0;
  const p = pFrom(h0, cdf, left);
  const crit = h0 === "le" ? tInv(1 - alpha, df) : h0 === "ge" ? tInv(alpha, df) : tInv(1 - alpha / 2, df);
  const critF = h0 === "le" ? `=T.INV(1-${fmt(alpha)},${df})` : h0 === "ge" ? `=T.INV(${fmt(alpha)},${df})` : `=T.INV(1-${fmt(alpha)}/2,${df})`;
  const reject = p < alpha;
  const welch = (mean(a) - mean(b)) / Math.sqrt(v1 / n1 + v2 / n2);
  return {
    title: `Two samples, equal variances: ${h0 === "eq" ? "two" : h0 === "le" ? "right" : "left"}-tailed t-test`,
    prompt: `${sc.owner} wants to know whether ${WORD2(h0, sc)}. The standard deviations are unknown but assumed equal. Independent random samples are below. ` +
      `Test at α = ${fmt(alpha)}. Tip: Data › Data Analysis › t-Test: Two-Sample Assuming Equal Variances.`,
    data: a, data2: b, dataLabels: [sc.a, sc.b],
    given: [{ label: "α", value: fmt(alpha) }],
    parts: [
      nullPart2(h0, sc),
      { ...num("Pooled variance S_p²", sp2, `=${sp2F}`, Math.max(0.0005, 0.005 * sp2), "num", "S_p² = ((n₁ − 1)S₁² + (n₂ − 1)S₂²)/(n₁ + n₂ − 2), the Toolpak's \"Pooled Variance\"."),
        traps: [{ value: (v1 + v2) / 2, why: "Averaged the two variances; pool them weighted by n − 1." }] },
      { ...num("Test statistic t", t, `=${tF}`, TOL_STAT, "num", "t = (x̄₁ − x̄₂)/√(S_p²(1/n₁ + 1/n₂)). The Toolpak's \"t Stat\"."),
        traps: [{ value: welch, why: "Used the unequal-variances formula. The question says assume equal variances: pool them." }, { value: -t, why: "Subtracted the other way round: Variable 1 is " + sc.a + "." }] },
      { ...num(`${h0 === "eq" ? "Positive critical value (±)" : "Critical value"} (ν = ${df})`, crit, critF, TOL_CRIT, "num", `ν = n₁ + n₂ − 2 = ${df}. ` + (h0 === "eq" ? "Two tails: ±T.INV(1 − α/2, ν)." : h0 === "le" ? "Right tail: T.INV(1 − α, ν)." : "Left tail: T.INV(α, ν), negative.")),
        traps: [{ value: h0 === "eq" ? tInv(1 - alpha / 2, Math.min(n1, n2) - 1) : h0 === "le" ? tInv(1 - alpha, Math.min(n1, n2) - 1) : tInv(alpha, Math.min(n1, n2) - 1), why: `Used ν = n − 1 of one sample. Pooled degrees of freedom are n₁ + n₂ − 2 = ${df}.` },
          ...(h0 === "eq" ? [{ value: tInv(1 - alpha, df), why: "That's the one-tail cutoff; two tails use 1 − α/2." }] : [{ value: -crit, why: "Wrong sign for this tail." }])] },
      { ...num("p-value", p, pFormula(h0, `T.DIST(${tF},${df},TRUE)`, left), tolProb(p), "prob", pExplain(h0, "t", left) + ` ν = ${df}.`), traps: wrongTail(h0, p) },
      decisionPart(reject, alpha, `p-value ${r4(p)} ${reject ? "<" : "≥"} α = ${fmt(alpha)}`, "both", "t"),
    ],
  };
}

// Paired data: before/after on the same subjects. D = second − first, then a one-sample t-test on D.
type PairScenario = { first: string; second: string; subjects: string; quantity: string; unit: string; base: Range; sd: Range; change: Range; question: string; up: boolean; dp: number };
const PAIR_SCENARIOS: PairScenario[] = [
  { first: "Exam 1", second: "Exam 2", subjects: "students", quantity: "score", unit: "points", base: [60, 85, 1], sd: [8, 14, 1], change: [2, 6, 0.5], question: "Have students improved?", up: true, dp: 0 },
  { first: "Before training", second: "After training", subjects: "employees", quantity: "tasks completed per hour", unit: "tasks", base: [14, 22, 1], sd: [2, 4, 0.5], change: [0.8, 2, 0.1], question: "Did the training raise output?", up: true, dp: 1 },
  { first: "Week 0", second: "Week 8", subjects: "participants", quantity: "weight", unit: "kg", base: [75, 90, 1], sd: [8, 12, 1], change: [1, 3, 0.2], question: "Did the diet lower weight?", up: false, dp: 1 },
  { first: "Old shoes", second: "New shoes", subjects: "runners", quantity: "5k time", unit: "minutes", base: [22, 30, 0.5], sd: [2.5, 4, 0.5], change: [0.3, 1, 0.1], question: "Are runners faster in the new shoes?", up: false, dp: 2 },
];
function paired(rng: Rng): Draft {
  const sc = pick(rng, PAIR_SCENARIOS);
  const n = randInt(rng, 7, 12);
  const alpha = pick(rng, [0.01, 0.05, 0.1]);
  const base = draw(rng, sc.base), sdB = draw(rng, sc.sd);
  const sdD = draw(rng, sc.change) * uniform(rng, 0.9, 1.4);
  const real = rng() < 0.6 ? draw(rng, sc.change) * (sc.up ? 1 : -1) : uniform(rng, -0.3, 0.3) * draw(rng, sc.change);
  const first = Array.from({ length: n }, () => roundTo(base + sdB * gauss(rng), sc.dp));
  const second = first.map((x) => roundTo(x + real + sdD * gauss(rng), sc.dp));
  const d = second.map((x, i) => roundTo(x - first[i], 6));
  // "Improved" (D > 0) is H_A, so H₀: μ_D ≤ 0; "lowered" (D < 0) gives H₀: μ_D ≥ 0. Exam 3 phrased it as the null itself.
  const h0: Null = sc.up ? "le" : "ge";
  const df = n - 1;
  const dbar = mean(d), sd = stdevS(d);
  const t = dbar / (sd / Math.sqrt(n));
  const DL = d.map((x) => fmt(x)).join(",");
  const tF = `AVERAGE(${DL})/(STDEV.S(${DL})/SQRT(${n}))`;
  const p = pFrom(h0, tCdf(t, df), t < 0);
  const crit = h0 === "le" ? tInv(1 - alpha, df) : tInv(alpha, df);
  const reject = p < alpha;
  const nullAns = h0 === "le" ? "H₀: μ_D ≤ 0" : "H₀: μ_D ≥ 0";
  const n1 = n, two = (() => { const v1 = stdevS(first) ** 2, v2 = stdevS(second) ** 2; const sp2 = ((n1 - 1) * (v1 + v2)) / (2 * n1 - 2); return (mean(second) - mean(first)) / Math.sqrt(sp2 * (2 / n1)); })();
  return {
    title: "Paired data: test on the differences",
    prompt: `${sc.question} The ${sc.quantity} of the same ${n} ${sc.subjects} was measured twice (below). Let D = ${sc.second} − ${sc.first} for each of them, ` +
      `and test whether the mean difference μ_D is ${sc.up ? "greater" : "less"} than 0 at α = ${fmt(alpha)}.`,
    data: first, data2: second, dataLabels: [sc.first, sc.second],
    given: [{ label: "α", value: fmt(alpha) }],
    parts: [
      { label: "Which null hypothesis?", kind: "choice", answer: nullAns, options: ["H₀: μ_D ≤ 0", "H₀: μ_D = 0", "H₀: μ_D ≥ 0"],
        excel: `"${sc.up ? "μ_D > 0" : "μ_D < 0"}" is the claim to show, so ${nullAns}`, explain: "The claim goes in H_A; H₀ is the opposite, with the equals sign." },
      { ...num("Mean difference d̄", dbar, `=AVERAGE(${DL})`, Math.max(0.0005, 0.01 * sd / Math.sqrt(n)), "num", "Make a column D = second − first, then AVERAGE it."),
        traps: [{ value: -dbar, why: `Subtracted the wrong way: D = ${sc.second} − ${sc.first}.` }] },
      { ...num("Standard deviation of D, s_D", sd, `=STDEV.S(${DL})`, Math.max(0.0005, 0.01 * sd), "num", "STDEV.S of the D column.") },
      { ...num(`Test statistic T (ν = ${df})`, t, `=${tF}`, TOL_STAT, "num", "T = d̄/(s_D/√n): a one-sample t-test on D with μ₀ = 0."),
        traps: [{ value: -t, why: `Subtracted the wrong way: D = ${sc.second} − ${sc.first}.` }, { value: two, why: "Ran a two-sample test. The same people were measured twice, so test the differences D." }] },
      { ...num("Critical value", crit, h0 === "le" ? `=T.INV(1-${fmt(alpha)},${df})` : `=T.INV(${fmt(alpha)},${df})`, TOL_CRIT, "num", h0 === "le" ? "Right tail: T.INV(1 − α, n − 1)." : "Left tail: T.INV(α, n − 1), negative."),
        traps: [{ value: -crit, why: "Wrong sign for this tail." }, { value: h0 === "le" ? tInv(1 - alpha, 2 * n - 2) : tInv(alpha, 2 * n - 2), why: "Used ν = 2n − 2. Paired data has ν = n − 1." }] },
      { ...num("p-value", p, pFormula(h0, `T.DIST(${tF},${df},TRUE)`, t < 0), tolProb(p), "prob", pExplain(h0, "T", t < 0)), traps: wrongTail(h0, p) },
      decisionPart(reject, alpha, `p-value ${r4(p)} ${reject ? "<" : "≥"} α = ${fmt(alpha)}`, "both", "T"),
    ],
  };
}

// 0/1 data (Exam 3's coin): E[X], the sample mean and S from counts, then a test on μ.
const BERN = [
  { thing: "I flip a coin", one: "heads", zero: "tails", p0: 0.5, claim: "the coin favours heads", n: [400, 1200, 100] as Range },
  { thing: "A website shows an ad", one: "a click", zero: "no click", p0: 0.04, claim: "the click rate is above 4%", n: [800, 2000, 100] as Range },
  { thing: "A factory checks a part", one: "defective", zero: "fine", p0: 0.1, claim: "more than 10% of parts are defective", n: [300, 900, 50] as Range },
  { thing: "A pollster asks a voter", one: "yes", zero: "no", p0: 0.5, claim: "most voters say yes", n: [400, 1500, 100] as Range },
];
function bernoulli(rng: Rng): Draft {
  const sc = pick(rng, BERN);
  const n = draw(rng, sc.n);
  const alpha = pick(rng, [0.01, 0.05, 0.1]);
  const se0 = Math.sqrt((sc.p0 * (1 - sc.p0)) / n);
  const shift = rng() < 0.5 ? uniform(rng, 2, 3.5) : uniform(rng, -0.5, 1.2);
  const k = Math.max(1, Math.min(n - 1, Math.round(n * (sc.p0 + shift * se0))));
  const xbar = k / n;
  const s = Math.sqrt((n / (n - 1)) * xbar * (1 - xbar));
  const df = n - 1;
  const t = (xbar - sc.p0) / (s / Math.sqrt(n));
  const p = 1 - tCdf(t, df);
  const pZ = 1 - normCdf(t);
  const reject = p < alpha;
  const sF = `SQRT(${k}/${n}*(1-${k}/${n})*${n}/(${n}-1))`;
  const tF = `(${k}/${n}-${fmt(sc.p0)})/(${sF}/SQRT(${n}))`;
  return {
    title: "0/1 data: testing a proportion as a mean",
    prompt: `${sc.thing}. If it's ${sc.one} I record X = 1, and if it's ${sc.zero} I record X = 0. Out of n = ${n} times I recorded ${k} ${sc.one === "heads" ? "heads" : `“${sc.one}”`} and ${n - k} ${sc.zero === "tails" ? "tails" : `“${sc.zero}”`}. ` +
      `(a) If the true chance of a 1 is ${fmt(sc.p0)}, what is E(X)? (b)–(c) Find the sample mean and sample standard deviation. (d)–(f) Test whether ${sc.claim}, H₀: μ ≤ ${fmt(sc.p0)}, at α = ${fmt(alpha)}.`,
    given: [{ label: "n", value: String(n) }, { label: "Number of 1s", value: String(k) }, { label: "μ₀", value: fmt(sc.p0) }, { label: "α", value: fmt(alpha) }],
    parts: [
      num("E(X) when the chance of a 1 is " + fmt(sc.p0), sc.p0, `=1*${fmt(sc.p0)}+0*(1-${fmt(sc.p0)})`, 1e-9, "num", "E(X) = 1·P(X = 1) + 0·P(X = 0), which is just the chance of a 1."),
      num("Sample mean x̄", xbar, `=${k}/${n}`, 0.0001, "num", "The average of k ones and n − k zeros is k/n."),
      { ...num("Sample standard deviation S", s, `=${sF}`, Math.max(0.0005, 0.01 * s), "num", "STDEV.S of the 0/1 column. Without the column: S = √(x̄(1 − x̄)·n/(n − 1))."),
        traps: [{ value: xbar * (1 - xbar), why: "That's the variance x̄(1 − x̄); take the square root." }] },
      { ...num(`Test statistic T (ν = ${df})`, t, `=${tF}`, TOL_STAT, "num", "σ is unknown, so T = (x̄ − μ₀)/(S/√n). With n this large T and Z are almost the same."),
        traps: [{ value: (xbar - sc.p0) / s, why: "Divided by S instead of S/√n." }] },
      { ...num("p-value", p, `=1-T.DIST(${tF},${df},TRUE)`, Math.max(tolProb(p), Math.abs(p - pZ) + 0.0002), "prob", "Right tail (H_A: μ > μ₀): 1 − T.DIST(T, n − 1, TRUE). 1 − NORM.S.DIST(T) is also accepted here, since n is large."),
        traps: [{ value: 1 - p, why: "Took the left tail; H_A: μ > μ₀ points right." }, { value: 2 * Math.min(p, 1 - p), why: "Doubled it, but this is a one-tailed test." }] },
      decisionPart(reject, alpha, `p-value ${r4(p)} ${reject ? "<" : "≥"} α = ${fmt(alpha)}`, "p", "T"),
    ],
  };
}

// Written questions: definitions and "explain" parts, as on the exams. Graded by Claude against the
// key points when a key is present; otherwise the student marks themselves against the model answer.
type Concept = { title: string; q: string; model: string; points: string[] };
export const CONCEPTS: Concept[] = [
  { title: "Type I error", q: "What is a Type I error, and which number in a hypothesis test is its probability?", model: "A Type I error is rejecting H₀ when H₀ is actually true. Its probability is the significance level α.", points: ["rejecting H₀", "when H₀ is true", "probability is α"] },
  { title: "Type II error", q: "What is a Type II error?", model: "A Type II error is not rejecting H₀ when H₀ is actually false (H_A is true).", points: ["not rejecting H₀", "when H₀ is false"] },
  { title: "The p-value", q: "Define the p-value of a hypothesis test.", model: "The p-value is the probability, assuming H₀ is true, of getting a test statistic at least as extreme as the one observed (in the direction of H_A). A small p-value means the data would be surprising if H₀ were true.", points: ["probability", "assuming H₀ is true", "at least as extreme as observed"] },
  { title: "Significance α", q: "What does the significance level α mean, and how do you use it to decide?", model: "α is a small probability we decide in advance to count as suspiciously small (for example 5%). We reject H₀ if the p-value is below α (equivalently, if the statistic falls beyond the critical value); otherwise we do not reject.", points: ["small probability chosen in advance", "reject if p-value < α"] },
  { title: "Why n − 1?", q: "Why does the sample variance S² divide by n − 1 and not n?", model: "Dividing by n − 1 makes S² an unbiased estimate of σ²: on average it equals the true variance. Dividing by n (the \"dumb variance\") is biased: on average it underestimates σ², because the data are measured from x̄ rather than the true μ.", points: ["unbiased", "on average equals σ²", "dividing by n underestimates / is biased"] },
  { title: "Biased estimate", q: "What does it mean for an estimate to be biased? Give an example from class.", model: "An estimate is biased if on average it is not equal to the true parameter it estimates. Example: the variance that divides by n is biased; the sample variance S² (divides by n − 1) is unbiased.", points: ["on average not equal to the true parameter", "example: dividing by n"] },
  { title: "t versus normal", q: "Describe how the t-distribution's shape compares with the standard normal.", model: "Both are bell-shaped and symmetric about 0, but the t-distribution has heavier (fatter) tails and a lower peak. It depends on the degrees of freedom ν = n − 1, and as ν grows it gets closer to the standard normal.", points: ["symmetric bell shape around 0", "heavier tails", "approaches normal as ν grows"] },
  { title: "Chi-squared shape", q: "Describe the chi-squared distribution used for the variance test.", model: "It only takes positive values, it is not symmetric but skewed to the right, and its shape depends on the degrees of freedom ν = n − 1. (n − 1)S²/σ² follows it for normal data.", points: ["only positive", "right-skewed / not symmetric", "depends on degrees of freedom n − 1"] },
  { title: "Central Limit Theorem", q: "State the Central Limit Theorem.", model: "For n independent, identically distributed random variables with mean μ and standard deviation σ, the Z-score of the sample mean, (X̄ − μ)/(σ/√n), is approximately standard normal N(0, 1) when n is large, even if the X's themselves aren't normal.", points: ["independent and identical", "Z-score of the sample mean", "approximately standard normal", "for large n"] },
  { title: "Standard error", q: "What is the standard error of the sample mean, and why is it smaller than σ?", model: "The standard error is σ/√n, the standard deviation of X̄. Averaging n values cancels out some of the randomness, so the sample mean varies less than one observation, and less as n grows.", points: ["σ/√n", "standard deviation of the sample mean", "averaging reduces spread"] },
  { title: "Z-test or t-test?", q: "When do you compute a Z-statistic and when a T-statistic?", model: "Use Z when the population standard deviation σ is known (Z follows the standard normal). Use T when σ is unknown and estimated by the sample standard deviation S (T follows a t-distribution with n − 1 degrees of freedom).", points: ["Z when σ known", "T when σ unknown, using S", "ν = n − 1"] },
  { title: "Must the Z and T tests agree?", q: "A Z-test (trusting a stated σ) and a T-test (using S) are run on the same sample and the same H₀. Must they reach the same decision? Explain.", model: "No. They use different standard deviations (σ versus S) and different distributions (normal versus t), so the statistic, p-value and critical value differ, and the decisions can differ. They often agree, but nothing forces it.", points: ["no", "different standard deviation (σ vs S)", "different distribution, so p-values differ"] },
  { title: "Outside the interval", q: "A student's sample mean falls outside the interval where it had a 95% chance of landing. Must the student have made a mistake? Explain.", model: "No. There was a 5% chance the sample mean would fall outside the interval just by randomness, so it can happen without any mistake. It is unusual, which may make us suspicious, but it is not proof.", points: ["no", "5% chance it falls outside anyway", "unusual is not impossible"] },
  { title: "Do not reject", q: "Why do we say \"do not reject H₀\" rather than \"accept H₀\"?", model: "Not finding enough evidence against H₀ doesn't prove H₀ is true; the data are just consistent with it. A Type II error is possible, so we only say we don't reject it.", points: ["lack of evidence is not proof", "data are consistent with H₀"] },
  { title: "Paired or two-sample?", q: "When should you use a paired test instead of a two-sample test?", model: "Use a paired test when each value in one sample is matched to one in the other, such as the same students before and after. Work with the differences D and do a one-sample t-test on them. Use a two-sample test when the two groups are independent, different people.", points: ["same subjects measured twice / matched pairs", "test the differences D", "two-sample for independent groups"] },
  { title: "One tail or two?", q: "Why does a two-tailed test use α/2 for its critical values while a one-tailed test uses α?", model: "In a two-tailed test, rejection can happen in either tail, so the total α is split into α/2 in each tail. In a one-tailed test, H_A points one way, so all of α goes in that one tail.", points: ["two tails split α into α/2 each", "one tail puts all of α on one side"] },
];
/** Seeds below 1000 pick CONCEPTS[seed] directly, so a set can ask for a particular idea. */
function concept(rng: Rng, seed: number): Draft {
  const c = seed < 1000 ? CONCEPTS[seed % CONCEPTS.length] : pick(rng, CONCEPTS);
  return {
    title: `Explain: ${c.title}`,
    prompt: `${c.q} Answer in a few sentences in the yellow cell.`,
    parts: [{ label: c.q, kind: "text", answer: c.model, keyPoints: c.points, excel: c.model, explain: `A full answer mentions: ${c.points.join("; ")}.` }],
  };
}

// ---------- public API ----------
const randomSeed = () => 1 + Math.floor(Math.random() * 999_999);

export function generate(kind: QuestionKind | "mixed", seed?: number): Question {
  const s = seed ?? randomSeed();
  if (kind === "mixed") { const pool = KINDS.filter((k) => k.id !== "concept"); return generate(pool[Math.floor(mulberry32(s ^ 0x5bd1e995)() * pool.length)].id, s); }
  const rng = mulberry32(s);
  let d: Draft;
  switch (kind) {
    case "normal-less": case "normal-more": case "normal-between": d = normalProb(kind, rng); break;
    case "normal-inverse": d = normalInverse(rng); break;
    case "zscore": d = zscore(rng); break;
    case "sample-mean": d = sampleMean(rng); break;
    case "xbar-range": d = xbarRange(rng); break;
    case "ci-z": d = ciZ(rng); break;
    case "ci-t": d = ciT(rng); break;
    case "ht": d = hypothesis(rng); break;
    case "ht-full": d = hypothesis(rng, undefined, true); break;
    case "var-test": d = varianceTest(rng); break;
    case "two-z": d = twoZ(rng); break;
    case "two-t": d = twoT(rng); break;
    case "paired": d = paired(rng); break;
    case "bernoulli": d = bernoulli(rng); break;
    case "concept": d = concept(rng, s); break;
    default: throw new Error(`Unknown kind "${kind as string}"`);
  }
  return finish(kind, s, d);
}

/** An "ht" question for one of the 12 whiteboard cells (TWELVE[].key, e.g. "eq-unknown-p"). */
export function generateCase(caseKey: string, seed?: number, full = false): Question {
  const s = seed ?? randomSeed();
  return finish(full ? "ht-full" : "ht", s, hypothesis(mulberry32(s), caseKey, full));
}

export function parseAnswer(input: string, ctx?: CellContext): { value: number | null; error?: string } {
  const raw = (input ?? "").trim();
  if (!raw) return { value: null, error: "Enter an answer" };
  if (raw.startsWith("=")) {
    try {
      return { value: evaluate(raw, ctx) };
    } catch (e) {
      return { value: null, error: e instanceof Error ? e.message : String(e) };
    }
  }
  let s = raw.replace(/[−–]/g, "-").replace(/\s+/g, "");
  let pct = false;
  if (s.endsWith("%")) { pct = true; s = s.slice(0, -1); }
  if (/^[+-]?\d{1,3}(,\d{3})+(\.\d*)?$/.test(s)) s = s.replace(/,/g, "");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) {
    return { value: null, error: "Not a number. Type something like 0.0312, 3.12% or a formula starting with =" };
  }
  const v = Number(s);
  return { value: pct ? v / 100 : v };
}

export function gradeNumber(input: string, part: Part, ctx?: CellContext): { ok: boolean; value: number | null; error?: string; roundedTo?: number } {
  const parsed = parseAnswer(input, ctx);
  if (parsed.value === null) return { ok: false, value: null, error: parsed.error };
  const ans = Number(part.answer);
  const tol = part.tol ?? (part.format === "prob" ? 0.001 : Math.max(0.01, 0.002 * Math.abs(ans)));
  const d = typedDecimals(input);
  const exact = Math.abs(parsed.value - ans) <= 1e-9 * Math.max(1, Math.abs(ans));
  // Graded on the underlying value, like class: a number typed by hand with 2 or fewer decimals
  // (0.99 for 0.9892, -1.64 for -1.6398) counts as rounded unless it is exactly the answer.
  const tooShort = d !== null && d <= 2 && !exact;
  const ok = !tooShort && Math.abs(parsed.value - ans) <= tol + 1e-12;
  if (ok) return { ok, value: parsed.value };
  // Wrong: say whether it's a rounding problem rather than a method problem.
  if (d !== null) {
    const f = 10 ** d;
    if (Math.abs(Math.round(ans * f) / f - parsed.value) < 0.5 / f && Math.abs(parsed.value - ans) <= 0.5 / f + 1e-12) return { ok, value: parsed.value, roundedTo: d };
  }
  return { ok, value: parsed.value };
}

/** Decimal places in a typed plain number ("0.92" → 2, "92%" → 2, "41" → 0); null for formulas. */
function typedDecimals(input: string): number | null {
  const s = (input ?? "").trim().replace(/,/g, "");
  if (!s || s.startsWith("=")) return null;
  const m = /^[+-]?\d*(?:\.(\d*))?(%?)$/.exec(s);
  if (!m) return null;
  return (m[1]?.length ?? 0) + (m[2] ? 2 : 0);
}
