// Lesson 14: Confidence intervals, part 2 (Week 9, Mon 26 Oct).
// Built from "Lesson 14, notes.xlsx": Sampling (population, parameters, statistics, estimates, point estimates,
// confidence intervals), Confidence int 1 (μ and σ known: an interval for the sample mean) and
// Confidence int 2 (σ known: a Z interval for the true mean).
import { Sheet, pick, round, shuffle, tolFor, TOP, normals, type Block, type BlockMaker } from "./kit.ts";
import { normInv } from "../stats.ts";
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
const pct = (alpha: number) => `${Math.round((1 - alpha) * 100)}%`;
/** "a 95%" / "an 80%". */
const aPct = (alpha: number) => `${Math.round((1 - alpha) * 100) === 80 ? "an" : "a"} ${pct(alpha)}`;
const ALPHAS = [0.2, 0.1, 0.05, 0.01];
const INOUT = ["Inside", "Outside"];

// ---------- Q1: level 1, μ and σ known: where the sample mean will land ----------
type Pop = { what: string; unit: string; mu: number; sd: number; d: number };
const POPS: Pop[] = [
  { what: "The heights of 18 year old males", unit: "inches", mu: 68, sd: 3, d: 1 },
  { what: "IQ scores", unit: "points", mu: 100, sd: 15, d: 0 },
  { what: "The battery life of a phone model", unit: "hours", mu: 40, sd: 4, d: 1 },
  { what: "Delivery times for a pizza shop", unit: "minutes", mu: 30, sd: 6, d: 1 },
  { what: "Weekly grocery bills of households in a town", unit: "dollars", mu: 180, sd: 35, d: 2 },
  { what: "The weight of apples from an orchard", unit: "g", mu: 150, sd: 20, d: 1 },
];
const level1: BlockMaker = {
  key: "l14.ci-known",
  title: "μ and σ known: the interval for the sample mean",
  make(rng): Block {
    const p = pick(rng, POPS);
    const n = pick(rng, [5, 6, 8, 10, 12, 15]);
    const alpha = pick(rng, ALPHAS);
    const se = p.sd / Math.sqrt(n);
    const z = normInv(1 - alpha / 2);
    const lo = p.mu - se * z, hi = p.mu + se * z;
    // Your RNG sample: usually from the right population, sometimes drawn from a shifted one.
    const shift = rng() < 0.35 ? pick(rng, [-1, 1]) * pick(rng, [2.5, 3, 3.5]) * se : 0;
    const xs = normals(rng, n, p.mu + shift, p.sd, p.d);
    const xbar = avg(xs);
    const inside = xbar >= lo && xbar <= hi;

    const S = new Sheet();
    const t = S.table("B", TOP, ["Trial", p.unit[0].toUpperCase() + p.unit.slice(1)], xs.map((x, i) => [i + 1, x]));
    const data = t.cols[Object.keys(t.cols)[1]].range;
    const r = (i: number) => TOP + i;
    S.header(`E${r(0)}`, "Given").header(`F${r(0)}`, "Value");
    S.label(`E${r(1)}`, "mu, μ").given(`F${r(1)}`, p.mu);
    S.label(`E${r(2)}`, "sigma, σ").given(`F${r(2)}`, p.sd);
    S.label(`E${r(3)}`, "n").given(`F${r(3)}`, n);
    S.label(`E${r(4)}`, "alpha, α").given(`F${r(4)}`, alpha);
    S.header(`H${r(0)}`, "Question").header(`K${r(0)}`, "Your answer");
    S.ask(`H${r(1)}`, {
      label: "Z_α/2", cell: `K${r(1)}`, answer: z, formula: `=NORM.S.INV(1-F${r(4)}/2)`,
      explain: "The Z value with 1 − α/2 to its left (his L11/M11: =NORM.S.INV(0.95) for 90%).",
      traps: [{ value: normInv(1 - alpha), why: "Used 1 − α: a two-sided interval puts α/2 in each tail." }, { value: normInv(alpha / 2), why: "That is the negative Z value: use 1 − α/2." }],
    });
    S.ask(`H${r(2)}`, {
      label: "Standard error", cell: `K${r(2)}`, answer: se, formula: `=F${r(2)}/SQRT(F${r(3)})`,
      explain: "σ/√n (his L12: =L8/SQRT(L9)).", traps: [{ value: p.sd / n, why: "Divided by n instead of √n." }],
    });
    S.ask(`H${r(3)}`, {
      label: "lower limit", cell: `K${r(3)}`, answer: lo, formula: `=F${r(1)}-K${r(2)}*K${r(1)}`,
      explain: "μ − Z_α/2 × standard error (his P7: =L7-L12*L11).",
      traps: [{ value: p.mu - p.sd * z, why: "Used σ instead of the standard error." }, { value: p.mu - se * normInv(1 - alpha), why: "Used Z for 1 − α instead of 1 − α/2." }],
    });
    S.ask(`H${r(4)}`, {
      label: "upper limit", cell: `K${r(4)}`, answer: hi, formula: `=F${r(1)}+K${r(2)}*K${r(1)}`,
      explain: "μ + Z_α/2 × standard error (his P8: =L7+L11*L12).",
      traps: [{ value: p.mu + p.sd * z, why: "Used σ instead of the standard error." }],
    });
    S.ask(`H${r(6)}`, {
      label: "Sample mean of your RNG sample", cell: `K${r(6)}`, answer: xbar, formula: `=AVERAGE(${data})`,
      explain: "His K5 / I15: =AVERAGE of the sample.",
    });
    S.ask(`H${r(7)}`, {
      label: "Is your sample mean inside or outside the interval?", cell: `K${r(7)}`, answer: inside ? "Inside" : "Outside", options: INOUT,
      formula: `=IF(AND(K${r(6)}>=K${r(3)},K${r(6)}<=K${r(4)}),"Inside","Outside")`,
      explain: `It should land inside ${pct(alpha)} of the time. \"In a class of 27 we found 2 people got outside the interval. This is not a surprise\" (for a 90% interval).`,
    });
    tidy(S);
    return {
      tab: "Mu and sigma known", title: "Confidence interval 1: μ and σ known",
      text: [
        `${p.what} are normally distributed with mean ${p.mu} ${p.unit} and standard deviation ${p.sd} ${p.unit}.`,
        `If I select ${n} at random, inside what range is there ${aPct(alpha)} chance the sample mean will belong?`,
        `Column C holds one simulated sample of ${n}. Is its sample mean inside or outside? Use formulas that point at the givens.`,
      ],
      cells: S.cells, parts: S.parts,
      manual: [`Use the RNG (Normal, mean ${p.mu}, sd ${p.sd}) to simulate your own ${n} values and check your sample mean against the interval. Self-check: it is outside only ${Math.round(alpha * 100)}% of the time.`],
    };
  },
};

// ---------- Q2: level 2, σ known: Z interval for the true mean ----------
type Claim = { what: string; unit: string; claim: number; sd: number; d: number; story: string };
const CLAIMS: Claim[] = [
  { what: "number of online orders a store processes a day", unit: "orders", claim: 700, sd: 156, d: 0, story: "The store believes it averages 700 orders a day." },
  { what: "weight of a box of cereal from the XL-22 machine", unit: "g", claim: 525, sd: 15, d: 2, story: "The machine is supposed to dispense 525 g." },
  { what: "amount of beer poured into a pint at a pub", unit: "ml", claim: 568, sd: 15, d: 1, story: "A pint should be 568 ml." },
  { what: "distance a mortar shot travels", unit: "miles", claim: 2, sd: 0.1, d: 3, story: "The mortar is designed to strike at 2 miles, but someone bumped into it." },
  { what: "volume of liquid a machine dispenses into a can", unit: "ml", claim: 330, sd: 3, d: 0, story: "The machine is designed to dispense 330 ml." },
  { what: "time to assemble a chair at a factory", unit: "minutes", claim: 45, sd: 5, d: 1, story: "The factory plans on 45 minutes a chair." },
];
const level2: BlockMaker = {
  key: "l14.ci-sigma",
  title: "σ known: Z interval for the true mean (two confidence levels)",
  make(rng): Block {
    const c = pick(rng, CLAIMS);
    const n = pick(rng, [8, 10, 12, 15, 17, 20]);
    const [a1, a2] = shuffle(rng, ALPHAS).slice(0, 2);
    const se = c.sd / Math.sqrt(n);
    const shift = pick(rng, [0, 0, 1, -1, 2.5, -2.5, 3.5, -3.5]) * se;
    const xs = normals(rng, n, c.claim + shift, c.sd, c.d);
    const xbar = avg(xs);
    const z1 = normInv(1 - a1 / 2), z2 = normInv(1 - a2 / 2);
    const lo1 = xbar - se * z1, hi1 = xbar + se * z1;
    const lo2 = xbar - se * z2, hi2 = xbar + se * z2;
    const claimIn = c.claim >= lo1 && c.claim <= hi1;
    const ltol = Math.max(0.0001, 0.004 * se);

    const S = new Sheet();
    const t = S.table("C", TOP, ["Day", "Value"], xs.map((x, i) => [i + 1, x]));
    const data = t.cols.Value.range;
    const r = (i: number) => TOP + i;
    S.header(`F${r(0)}`, "Given").header(`H${r(0)}`, "Value");
    S.label(`F${r(1)}`, "sigma σ").given(`H${r(1)}`, c.sd);
    S.label(`F${r(2)}`, "alpha (first interval)").given(`H${r(2)}`, a1);
    S.label(`F${r(3)}`, "alpha (second interval)").given(`H${r(3)}`, a2);
    S.label(`F${r(4)}`, "claimed mean").given(`H${r(4)}`, c.claim);
    S.header(`J${r(0)}`, "Question").header(`M${r(0)}`, "Your answer");
    S.ask(`J${r(1)}`, { label: "sample mean (the point estimate)", cell: `M${r(1)}`, answer: xbar, formula: `=AVERAGE(${data})`, explain: "His J9: =AVERAGE(D6:D15). The point estimate of the true mean.", tol: ltol });
    S.ask(`J${r(2)}`, { label: "n", cell: `M${r(2)}`, answer: n, tol: 0, formula: `=COUNT(${data})`, explain: "Count the sample (he typed 10; COUNT is safer)." });
    S.ask(`J${r(3)}`, {
      label: "Standard error", cell: `M${r(3)}`, answer: se, formula: `=H${r(1)}/SQRT(M${r(2)})`,
      explain: "σ/√n, with the known σ (his J14: =J10/SQRT(J12)).", traps: [{ value: c.sd / n, why: "Divided by n instead of √n." }], tol: Math.max(0.0001, 0.002 * se),
    });
    const zAsk = (row: number, al: number, alphaCell: string, zz: number) => S.ask(`J${row}`, {
      label: `Z_α/2 for ${pct(al)}`, cell: `M${row}`, answer: zz, formula: `=NORM.S.INV(1-${alphaCell}/2)`,
      explain: "His J13 / J25: =NORM.S.INV(1-J23/2).",
      traps: [{ value: normInv(1 - al), why: "Used 1 − α instead of 1 − α/2." }],
    });
    const limAsk = (row: number, which: "lower" | "upper", zCell: string, val: number, al: number) => S.ask(`J${row}`, {
      label: `${which} limit (${pct(al)})`, cell: `M${row}`, answer: val, tol: ltol,
      formula: `=M${r(1)}${which === "lower" ? "-" : "+"}M${r(3)}*${zCell}`,
      explain: `Sample mean ${which === "lower" ? "−" : "+"} standard error × Z_α/2 (his N9/N10: =J9-J14*J13 and =J9+J14*J13).`,
      traps: [
        { value: xbar + (which === "lower" ? -1 : 1) * c.sd * normInv(1 - al / 2), why: "Used σ instead of the standard error." },
        { value: xbar + (which === "lower" ? -1 : 1) * se * normInv(1 - al), why: "Used Z for 1 − α instead of 1 − α/2." },
        { value: c.claim + (which === "lower" ? -1 : 1) * se * normInv(1 - al / 2), why: "Centred on the claimed mean: the true mean is unknown, centre on the sample mean." },
      ],
    });
    zAsk(r(5), a1, `H${r(2)}`, z1);
    limAsk(r(6), "lower", `M${r(5)}`, lo1, a1);
    limAsk(r(7), "upper", `M${r(5)}`, hi1, a1);
    zAsk(r(9), a2, `H${r(3)}`, z2);
    limAsk(r(10), "lower", `M${r(9)}`, lo2, a2);
    limAsk(r(11), "upper", `M${r(9)}`, hi2, a2);
    S.ask(`J${r(13)}`, {
      label: `Is the claimed mean inside the ${pct(a1)} interval?`, cell: `M${r(13)}`, answer: claimIn ? "Inside" : "Outside", options: INOUT,
      formula: `=IF(AND(H${r(4)}>=M${r(6)},H${r(4)}<=M${r(7)}),"Inside","Outside")`,
      explain: "Inside: the claim is believable. Outside: we doubt the claim, but it isn't proof: the true mean could still be the claimed one.",
    });
    tidy(S);
    return {
      tab: "Sigma known", title: "Confidence interval 2: σ known, true mean unknown",
      text: [
        `The ${c.what} has standard deviation ${c.sd} ${c.unit}. The true mean is unknown. ${c.story}`,
        `A sample of ${n} is shown in column D. Inside what interval is there ${aPct(a1)} chance the true mean belongs? And ${aPct(a2)} chance?`,
        "Fill the yellow cells with formulas that point at the data and the givens.",
      ],
      cells: S.cells, parts: S.parts,
    };
  },
};

// ---------- Q3: parameter or statistic? ----------
const ITEMS: [string, "Parameter" | "Statistic"][] = [
  ["The true average height of all adult males in the US", "Parameter"],
  ["The average height of the 5 students I selected at random", "Statistic"],
  ["The standard deviation of the weights of the 10 cereal boxes we weighed", "Statistic"],
  ["The true standard deviation σ of the amount a machine dispenses", "Parameter"],
  ["The sample variance of 20 exam scores", "Statistic"],
  ["The median income of every household in Massachusetts", "Parameter"],
  ["The mean of 1000 simulated averages in your spreadsheet", "Statistic"],
  ["The proportion of all Babson students who own a car", "Parameter"],
  ["The proportion of the 40 students you asked who own a car", "Statistic"],
  ["μ, the true mean IQ score of the population", "Parameter"],
  ["The average number of orders over ten sampled days (691.8)", "Statistic"],
  ["The true mean distance the bumped mortar now fires", "Parameter"],
];
const paramStat: BlockMaker = {
  key: "l14.param-stat",
  title: "Parameter or statistic?",
  make(rng): Block {
    // Always at least two of each, in a shuffled order.
    const params = shuffle(rng, ITEMS.filter((i) => i[1] === "Parameter"));
    const stats = shuffle(rng, ITEMS.filter((i) => i[1] === "Statistic"));
    const k = pick(rng, [2, 3, 4]);
    const chosen = shuffle(rng, [...params.slice(0, k), ...stats.slice(0, 6 - k)]);
    const S = new Sheet();
    S.header(`B${TOP}`, "The number described").header(`I${TOP}`, "Parameter or Statistic?");
    chosen.forEach(([txt, ans], i) => {
      const row = TOP + 1 + i;
      S.text(`B${row}`, txt);
      S.parts.push({
        label: txt, cell: `I${row}`, answer: ans, options: ["Parameter", "Statistic"], formula: `"${ans}"`,
        explain: ans === "Parameter" ? "A true number about the whole population: a parameter (usually unknown)." : "A number computed from a sample: a statistic (it changes from sample to sample).",
      });
    });
    return {
      tab: "Parameter or statistic", title: "Parameters and statistics",
      text: [
        "Definition: true numbers about a population (such as the mean, standard deviation, median) are parameters. Numbers computed from a sample are statistics.",
        "Type Parameter or Statistic in each yellow cell.",
      ],
      cells: S.cells, parts: S.parts,
    };
  },
};
void round;

export const LESSON_14: Lesson = {
  n: 14,
  title: "Confidence intervals: parameters, statistics, μ and σ known, σ known",
  unit: 2,
  week: "Week 9 · Mon 26 Oct · Confidence intervals",
  sources: ["Lesson 14, notes.xlsx", "F25_Exam 2 and solutions", "Exam 3 (Spring 2026)", "S26_Final and solutions", "F25_Final"],
  summary:
    "In practice you never know everything about a population, so you estimate its parameters from a sample: a point estimate gives one number, a confidence interval gives a range you are sure, with a given probability, contains the parameter. This lesson builds the first two of his three scenarios: μ and σ known (an interval for the sample mean) and σ known (a Z interval for the unknown true mean).",
  defs: [
    { term: "Population", text: "Population = the collection of all the data that you're interested in (shoe sizes of adult males, etc.). In practice you never know everything about the population, e.g. the true average adult male height.", source: "Lesson 14, notes › Sampling B6–B8" },
    { term: "Parameter", text: "True numbers about a population (such as the mean, standard deviation, median, etc.) are parameters.", source: "Lesson 14, notes › Sampling B10" },
    { term: "Statistic", text: "Numbers computed from a sample are statistics. Often the statistic is supposed to approximate a population parameter, e.g. the sample mean is designed to approximate the true mean.", source: "Lesson 14, notes › Sampling B14–B18" },
    { term: "Estimate", text: "An estimate is a statistic which is designed to estimate a population parameter (sample mean → true mean).", source: "Lesson 14, notes › Sampling B20" },
    { term: "Point estimate", text: "A point estimate is a single number designed to approximate a population parameter.", source: "Lesson 14, notes › Sampling B22" },
    { term: "Confidence interval", text: "A confidence interval is a range of values (an interval with an upper and lower limit) inside which you are sure with a given probability that the population parameter belongs.", source: "Lesson 14, notes › Sampling B23–B24" },
    { term: "Z_α/2 (key fact)", text: "The Z value for a (1 − α) interval is Z_α/2 = NORM.S.INV(1 − α/2), e.g. =NORM.S.INV(0.95) for 90%, =NORM.S.INV(0.975) for 95%. =NORM.INV(0.95,0,1) gives the same.", source: "Lesson 14, notes › Confidence int 1 L11–M11, Confidence int 2 J25" },
    { term: "Scenario 1: μ and σ known (key fact)", text: "Inside what range is there a (1 − α) chance the sample mean will belong? lower limit = μ − standard error × Z_α/2, upper limit = μ + standard error × Z_α/2, with standard error σ/√n.", source: "Lesson 14, notes › Confidence int 1 P7–P8" },
    { term: "Scenario 2: σ known, μ unknown (key fact)", text: "Inside what interval is there a (1 − α) chance the true mean belongs? lower limit = x̄ − standard error × Z_α/2, upper limit = x̄ + standard error × Z_α/2. Point estimate: the average is 692; better, the confidence interval: we are 95% sure the true average is in between 595 and 788.", source: "Lesson 14, notes › Confidence int 2 N9–N10, L12–L14" },
    { term: "Landing outside is not a surprise", text: "In a class of 27 we found 2 people got outside the (90%) interval. This is not a surprise, because this happens 10% of the time.", source: "Lesson 14, notes › Confidence int 1 K15–K17" },
  ],
  examples: [
    {
      title: "Confidence interval 1: heights (μ and σ known)",
      setup: "The heights of 18 year old males are normal with mean 68 inches and standard deviation 3 inches. If I select 5 of you at random, inside what range of heights is there a 90% chance the sample mean will belong?",
      table: { head: ["Student", "1", "2", "3", "4", "5"], rows: [["Height", 68, 71, 70, 63, 73]] },
      steps: [
        { say: "α for 90%", result: "0.1" },
        { say: "Z_α/2 (L11)", formula: "=NORM.S.INV(0.95)", result: "1.64485" },
        { say: "Standard error (L12): σ in L8, n in L9", formula: "=L8/SQRT(L9)", result: "1.34164" },
        { say: "lower limit (P7): μ in L7", formula: "=L7-L12*L11", result: "65.79320" },
        { say: "upper limit (P8)", formula: "=L7+L11*L12", result: "70.20680" },
        { say: "Our sample mean (K5)", formula: "=AVERAGE(B6:F6)", result: "69: inside the range" },
      ],
      takeaway: "Both μ and σ known: centre on μ, spread Z_α/2 standard errors each way. It is a range for the SAMPLE mean.",
      source: "Lesson 14, notes › Confidence int 1",
    },
    {
      title: "Confidence interval 2: online orders (σ known)",
      setup: "The number of online orders a store processes a day has standard deviation 156. The true mean is unknown. A sample of ten days: 884, 645, 248, 648, 569, 1024, 945, 399, 871, 685. Inside what interval is there a 95% chance the true mean belongs? And a 75% chance?",
      steps: [
        { say: "Sample mean (J9), the point estimate", formula: "=AVERAGE(D6:D15)", result: "691.8" },
        { say: "Z_α/2 for α = 0.05 (J13)", formula: "=NORM.S.INV(0.975)", result: "1.95996" },
        { say: "Standard error (J14): σ in J10, n in J12", formula: "=J10/SQRT(J12)", result: "49.33153" },
        { say: "95% lower limit (N9)", formula: "=J9-J14*J13", result: "595.11197" },
        { say: "95% upper limit (N10)", formula: "=J9+J14*J13", result: "788.48803" },
        { say: "For 75%: α = 0.25 in J23, Z_α/2 (J25)", formula: "=NORM.S.INV(1-J23/2)", result: "1.15035" },
        { say: "75% limits (N21, N22)", formula: "=J21-J26*J25  and  =J21+J26*J25", result: "635.05150 to 748.54850" },
      ],
      takeaway: "σ known, μ unknown: centre on the sample mean. Less confidence (75%) gives a narrower interval.",
      source: "Lesson 14, notes › Confidence int 2",
    },
  ],
  quiz: [
    { q: "The true average height of all adult males is a…", options: ["Parameter", "Statistic", "Point estimate", "Confidence interval"], answer: 0, why: "True numbers about a population are parameters." },
    { q: "The sample mean and sample variance are…", options: ["Statistics", "Parameters", "Fixed numbers that never change", "Population values"], answer: 0, why: "Numbers computed from a sample are statistics; they depend on the sample (F25 Exam 2 MC Q8)." },
    { q: "\"The average number of orders is about 692\" is a…", options: ["Point estimate", "Confidence interval", "Parameter", "Significance"], answer: 0, why: "A single number designed to approximate a population parameter is a point estimate." },
    { q: "Z_α/2 for a 90% interval is…", options: ["=NORM.S.INV(0.95)", "=NORM.S.INV(0.90)", "=NORM.S.INV(0.10)", "=NORM.S.INV(0.05)"], answer: 0, why: "α = 0.1, so 1 − α/2 = 0.95 (his L11)." },
    { q: "σ is known but μ is unknown. The interval for the true mean is centred on…", options: ["The sample mean", "The claimed mean", "Zero", "σ"], answer: 0, why: "We don't know μ, so centre on the point estimate x̄: lower = x̄ − SE·Z, upper = x̄ + SE·Z." },
    { q: "μ = 68 and σ = 3 are both known and n = 5. The 90% interval 65.79 to 70.21 is an interval for…", options: ["The sample mean", "The true mean μ", "A single height", "σ"], answer: 0, why: "When μ is known there is nothing to estimate: the interval says where the sample mean will land." },
    { q: "Going from a 95% to a 75% interval (same data), the interval…", options: ["Gets narrower", "Gets wider", "Stays the same", "Moves to the right"], answer: 0, why: "Z_α/2 drops from 1.96 to 1.15, so the limits move in (595–788 became 635–749)." },
    { q: "From ten days of orders (σ = 156 known) the 95% interval is 595 to 788. What does it mean?", options: ["We are 95% sure the true average number of orders is between 595 and 788", "95% of days have between 595 and 788 orders", "The true average is exactly 691.8", "The sample mean has a 95% chance of being between 595 and 788"], answer: 0, why: "His interpretation: \"we are 95% sure the true average is in between 595 and 788\". It is about the true mean, not single days." },
  ],
  excel: [
    { fn: "NORM.S.INV(1 − α/2)", use: "Z_α/2 for a (1 − α) interval, in its own cell (=NORM.S.INV(0.95) for 90%, =NORM.S.INV(1-J23/2) in general)." },
    { fn: "SQRT", use: "Standard error =σ/SQRT(n)." },
    { fn: "AVERAGE", use: "The sample mean (point estimate)." },
    { fn: "Arithmetic", use: "lower =centre − SE*Z, upper =centre + SE*Z, where the centre is μ (scenario 1) or x̄ (scenario 2)." },
    { fn: "COUNT", use: "n from the data, so you don't miscount." },
  ],
  watch: [
    "Midterm 3 (Spring 2026) announcement: \"For a given significance alpha construct a confidence interval for the three scenarios: true mean and standard deviation known; standard deviation known; nothing known. Be able to interpret what this confidence interval means.\"",
    "S26 Exam 3 Q1 (scenario 1: μ = 55, σ = 5, n = 5, 95%) and Q4 (scenario 2: σ = 5 known, the student forgot μ: an 80% interval for their true mean, centred on the sample mean of Table 1). Answer cells: alpha, n, Z, sigma, mu or X^bar, lower limit, upper limit.",
    "F25 Exam 2 Q2 and S26 Final Q33 are scenario 2: =AVERAGE(C12:C28)-F10*NORM.S.INV(0.95) (90%) and =E11-(2/SQRT(COUNTA(C8:C15)))*NORM.S.INV(1-0.01/2) (99%). F25 Final CI Q2: pints of beer, σ = 15, 95%.",
    "Read the question for WHICH mean: \"the sample mean will belong\" (centre μ, scenario 1) versus \"the true mean belongs\" (centre x̄, scenario 2).",
    "Slips: NORM.S.INV(1 − α) instead of NORM.S.INV(1 − α/2); σ instead of σ/√n; centring a scenario 2 interval on the claimed μ.",
  ],
  makers: [level1, level2, paramStat],
};
