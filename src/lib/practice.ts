// Seeded, offline practice-question generator for AQM 1000 Midterm 2.
// Every number part carries the Excel formula (with this question's numbers) that produces
// its answer exactly; practice.test.ts evaluates each formula and compares.
// Conventions: one-tail .DIST/.INV functions only (no T.DIST.2T, T.INV.2T, ABS, …).
import { normDist, normInvGeneral, normInv, tInv, mean, stdevS } from "./stats.ts";
import { evaluate, type CellContext } from "./excel.ts";
import { runTest, NULLS, TWELVE } from "./tests12.ts";
import type { Null, Sigma, Method } from "./tests12.ts";

export type TopicId = "normal" | "clt" | "ci-z" | "t" | "ht";
export type QuestionKind =
  | "normal-less" | "normal-more" | "normal-between" | "normal-inverse" | "zscore"
  | "sample-mean" | "xbar-range" | "ci-z" | "ci-t" | "ht";
export type Part = {
  id: string;
  label: string;
  kind: "number" | "choice";
  answer: number | string;
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
const SCENARIOS: Scenario[] = [
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
    parts: [num(`P(X ${less ? "<" : ">"} ${fmt(a)})`, ans, `=${less ? "" : "1-"}NORM.DIST(${fmt(a)},${args})`, tolProb(ans), "prob",
      less ? "NORM.DIST(a, μ, σ, TRUE) is the area to the left of a, which is exactly P(X < a)."
        : "NORM.DIST only gives the area to the left of a, so the area to the right is 1 minus it.")],
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
      parts: [num(`Cutoff for the ${variant} ${pct}%`, inv(left), f(left), tolSd(sd), "num",
        variant === "top"
          ? `NORM.INV needs the area to the LEFT of the answer. The top ${pct}% has ${fmt(left * 100)}% below it, so ${fmt(left)} goes in.`
          : `The bottom ${pct}% is the area to the left of the cutoff, so ${fmt(p)} goes straight into NORM.INV.`, unit)],
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
      num(`P(X̄ ${less ? "<" : ">"} ${fmt(a)})`, ans, `=${less ? "" : "1-"}NORM.DIST(${fmt(a)},${fmt(mu)},${seF},TRUE)`, tolProb(ans), "prob",
        `X̄ is normal with mean μ and standard deviation σ/√n, so use σ/√n (not σ) inside NORM.DIST${less ? "" : ", and 1 minus it for \"more than\""}.`),
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
    num("Lower limit", xbar - (z * sd) / Math.sqrt(n), `=${xF}-${zF}*${fmt(sd)}/SQRT(${n})`, tolSE(se), "num", "μ is unknown, so centre the interval on x̄: x̄ − Z_α/2 · σ/√n.", unitOf(sc)),
    num("Upper limit", xbar + (z * sd) / Math.sqrt(n), `=${xF}+${zF}*${fmt(sd)}/SQRT(${n})`, tolSE(se), "num", "Upper end: x̄ + Z_α/2 · σ/√n.", unitOf(sc)),
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
      num(`T_α/2 (ν = ${n - 1})`, t, `=${tF}`, TOL_CRIT, "num", `With s instead of σ, use the t distribution with ν = n − 1 = ${n - 1}: T.INV(1 − α/2, ν).`),
      num("Lower limit", xbar - (t * s) / Math.sqrt(n), `=${xF}-${tF}*${sF}/SQRT(${n})`, tolSE(se), "num", "x̄ − T_α/2 · s/√n.", unitOf(sc)),
      num("Upper limit", xbar + (t * s) / Math.sqrt(n), `=${xF}+${tF}*${sF}/SQRT(${n})`, tolSE(se), "num", "x̄ + T_α/2 · s/√n.", unitOf(sc)),
    ],
  };
}

const DIR_WORD: Record<Null, string> = { le: "more than", eq: "different from", ge: "less than" };
export const NULL_OPTIONS = (mu0: string) => NULLS.map((nl) => nl.h0.replace("μ₀", mu0));

function hypothesis(rng: Rng, caseKey?: string): Draft {
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
  parts.push(num(`What is the test statistic ${S}?`, res.stat, `=${statF}`, TOL_STAT, "num",
    known ? "σ is known, so Z = (x̄ − μ₀)/(σ/√n)." : `σ is unknown, so T = (x̄ − μ₀)/(s/√n), with ν = n − 1 = ${df}.`));

  let critShown = 0, rule: string;
  if (method === "p") {
    const pF = h0 === "le" ? `=1-${D(statF)}` : h0 === "ge" ? `=${D(statF)}` : res.stat < 0 ? `=2*${D(statF)}` : `=2*(1-${D(statF)})`;
    const ex = h0 === "le" ? `Right-tailed test (H_A: μ > ${mu0s}): the p-value is the area to the right of ${S}, 1 − .DIST(${S}).`
      : h0 === "ge" ? `Left-tailed test (H_A: μ < ${mu0s}): the p-value is the area to the left of ${S}, .DIST(${S}).`
      : res.stat < 0 ? `Two-tailed test and ${S} is negative, so double the left tail: 2·.DIST(${S}).`
      : `Two-tailed test and ${S} is positive, so double the right tail: 2·(1 − .DIST(${S})).`;
    parts.push(num("What is the p-value?", res.pValue, pF, tolProb(res.pValue), "prob", ex));
    rule = `p-value ${r4(res.pValue)} ${res.reject ? "<" : "≥"} α = ${fmt(alpha)}`;
  } else {
    critShown = h0 === "eq" ? res.crit[1] : res.crit[0];
    const label = h0 === "eq" ? `What is the positive critical value? (two tails: ±this value${known ? "" : `, ν = ${df}`})`
      : h0 === "ge" ? `What is the critical value? (left tail, so it is negative${known ? "" : `; ν = ${df}`})`
      : `What is the critical value?${known ? "" : ` (ν = ${df})`}`;
    const ex = h0 === "le" ? "Right tail: all of α sits on the right, so the cutoff is .INV(1 − α)."
      : h0 === "ge" ? "Left tail: all of α sits on the left, so the cutoff is .INV(α), a negative number."
      : "Two tails: α is split in half, so the cutoffs are ±.INV(1 − α/2).";
    parts.push(num(label, critShown, res.excel.crit, TOL_CRIT, "num", ex));
    const st = r4(res.stat), cv = r4(critShown);
    rule = h0 === "le" ? `${S} = ${st} ${res.reject ? ">" : "≤"} ${cv}`
      : h0 === "ge" ? `${S} = ${st} ${res.reject ? "<" : "≥"} ${cv}`
      : res.reject ? `${S} = ${st} is ${res.stat < 0 ? `below −${cv}` : `above ${cv}`}` : `${S} = ${st} is between −${cv} and ${cv}`;
  }
  const decision = res.reject ? "Reject H₀" : "Do not reject H₀";
  parts.push({
    label: "Decision at α = " + fmt(alpha), kind: "choice", answer: decision, options: ["Reject H₀", "Do not reject H₀"],
    excel: `${rule} → ${decision}`,
    explain: method === "p" ? "Reject H₀ when the p-value is smaller than α." : `Reject H₀ when ${S} falls beyond the critical value, in the tail named by H_A.`,
  });

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
    title: `${h0 === "eq" ? "Two-tailed" : h0 === "le" ? "Right-tailed" : "Left-tailed"} ${known ? "Z" : "t"}-test, ${method === "p" ? "p-value" : "critical value"}`,
    prompt: `${sc.owner} wants to know whether the mean ${sc.quantity} is ${DIR_WORD[h0]} ${u(sc, mu0s)}. ${sigmaText} ${sampleText} Test at α = ${fmt(alpha)} using the ${method === "p" ? "p-value" : "critical value"} method.`,
    data,
    given,
    caseKey: c.key,
    parts,
  };
}

// ---------- public API ----------
const randomSeed = () => 1 + Math.floor(Math.random() * 999_999);

export function generate(kind: QuestionKind | "mixed", seed?: number): Question {
  const s = seed ?? randomSeed();
  if (kind === "mixed") return generate(KINDS[Math.floor(mulberry32(s ^ 0x5bd1e995)() * KINDS.length)].id, s);
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
    default: throw new Error(`Unknown kind "${kind as string}"`);
  }
  return finish(kind, s, d);
}

/** An "ht" question for one of the 12 whiteboard cells (TWELVE[].key, e.g. "eq-unknown-p"). */
export function generateCase(caseKey: string, seed?: number): Question {
  const s = seed ?? randomSeed();
  return finish("ht", s, hypothesis(mulberry32(s), caseKey));
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
