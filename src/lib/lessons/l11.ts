// Lesson 11: the review class before Exam 1 (Week 6, Wed 7 Oct).
// Built from "Lesson 11, notes.xlsx" (Sheet1: IQ ~ N(100, 15) and independence; Sheet2: a discrete random variable,
// 1000 simulated trials, percentiles, VLOOKUP) and the Monte Carlo questions on the Spring 2026 Exam 2 (Q4, taxi tips)
// and Spring 2026 Final (Q3, laptop inventory with =MAX(0,ROUND(x,0))).
import { Sheet, gauss, int, pick, round, tolFor, TOP, type BlockMaker, type Block, type Part, type Rng, type Trap } from "./kit.ts";
import type { Lesson } from "./types.ts";

// ---------- local helpers (independent of the site's formula engine) ----------
function erf(x: number): number {
  const ax = Math.abs(x);
  if (ax > 6) return Math.sign(x);
  let term = ax, sum = ax;
  for (let n = 1; n < 1000; n++) { term *= (2 * ax * ax) / (2 * n + 1); sum += term; if (term < 1e-17 * sum) break; }
  return (Math.sign(x) * 2 / Math.sqrt(Math.PI)) * Math.exp(-ax * ax) * sum;
}
const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
const ncdf = (x: number, mu: number, sd: number) => Phi((x - mu) / sd);
/** Excel's ROUND(x, 0): halves go away from zero. */
const xround = (x: number) => Math.sign(x) * Math.round(Math.abs(x));
function safe(p: Part): Part {
  const tol = tolFor(p);
  const ans = Number(p.answer);
  const traps = (p.traps ?? []).filter((t: Trap) => Number.isFinite(t.value) && Math.abs(t.value - ans) > tol * 2);
  return { ...p, traps: traps.length ? traps : undefined };
}
const ask = (S: Sheet, labelAt: string, p: Part) => S.ask(labelAt, safe(p));
const push = (S: Sheet, p: Part) => { S.parts.push(safe(p)); };
/** A normal draw with 2 decimals that never sits exactly on a half (so ROUND has no ties). */
function draw2(rng: Rng, mu: number, sd: number): number {
  let x = round(mu + sd * gauss(rng), 2);
  if (Math.abs(Math.abs(x % 1) - 0.5) < 1e-9) x = round(x + 0.01, 2);
  return x;
}

// ---------- Q1: normal probabilities and independence (Sheet1) ----------
type NCtx = { s: string; who: string; one: string; u: string; mu: number; sd: number; dp: number };
const NC: NCtx[] = [
  { s: "An IQ score", who: "people", one: "person", u: "points", mu: 100, sd: 15, dp: 0 },
  { s: "The amount of beer poured into a pint", who: "pints", one: "pint", u: "ml", mu: 568, sd: 12, dp: 0 },
  { s: "The length of a short video", who: "videos", one: "video", u: "seconds", mu: 30, sd: 10, dp: 0 },
  { s: "The number of hours a person sleeps", who: "people", one: "person", u: "hours", mu: 7, sd: 3, dp: 1 },
  { s: "The time a pizza delivery takes", who: "deliveries", one: "delivery", u: "minutes", mu: 45, sd: 8, dp: 0 },
  { s: "The battery life of a phone", who: "phones", one: "phone", u: "hours", mu: 20, sd: 4, dp: 1 },
];
const iq: BlockMaker = {
  key: "l11.iq",
  title: "Normal probabilities and independence: both of two, all of n, at least one",
  make(rng): Block {
    const ctx = pick(rng, NC);
    const { mu, sd } = ctx;
    const val = (z: number) => round(mu + z * sd, ctx.dp);
    const a = val(-pick(rng, [0.6, 0.9, 1.2, 1.4667, 1.75]));
    const b = val(-pick(rng, [0.5, 1, 2]));
    const c = val(pick(rng, [0.5, 1, 1.3333, 2]));
    const n = pick(rng, [3, 5, 6, 10, 15]);
    const S = new Sheet();
    S.header(`B${TOP}`, "Given").header(`C${TOP}`, "Value");
    S.label(`B${TOP + 1}`, "Mean").given(`C${TOP + 1}`, mu);
    S.label(`B${TOP + 2}`, "Standard deviation").given(`C${TOP + 2}`, sd);
    const M = `$C$${TOP + 1}`, SD = `$C$${TOP + 2}`;
    const q = TOP + 5;
    S.header(`B${q - 1}`, "Question").header(`C${q - 1}`, "x or n").header(`D${q - 1}`, "Second x").header(`E${q - 1}`, "Your answer");
    const Fa = ncdf(a, mu, sd), up = 1 - Fa;
    S.given(`C${q}`, a);
    ask(S, `B${q}`, {
      label: `Pr(X < ${a})`, cell: `E${q}`, answer: Fa, format: "prob", formula: `=NORM.DIST(C${q},${M},${SD},TRUE)`,
      explain: "NORM.DIST(x, mean, std_dev, TRUE) is the probability of being below x.",
      traps: [{ value: up, why: "That is Pr(X > x); 'less than' is NORM.DIST itself." }],
    });
    S.given(`C${q + 1}`, a);
    ask(S, `B${q + 1}`, {
      label: `Pr(X > ${a})`, cell: `E${q + 1}`, answer: up, format: "prob", formula: `=1-E${q}`,
      explain: "The two sides add up to 1, so Pr(X > x) = 1 − NORM.DIST(x, mean, std_dev, TRUE) (in class: =1-K6).",
      traps: [{ value: Fa, why: "Forgot the 1 −." }],
    });
    const Fb = ncdf(b, mu, sd), Fc = ncdf(c, mu, sd);
    S.given(`C${q + 2}`, b).given(`D${q + 2}`, c);
    ask(S, `B${q + 2}`, {
      label: `Pr(${b} < X < ${c})`, cell: `E${q + 2}`, answer: Fc - Fb, format: "prob",
      formula: `=NORM.DIST(D${q + 2},${M},${SD},TRUE)-NORM.DIST(C${q + 2},${M},${SD},TRUE)`,
      explain: "NORM.DIST of the upper value minus NORM.DIST of the lower value.",
      traps: [{ value: Fc, why: "Only found Pr(X < upper value)." }],
    });
    ask(S, `B${q + 3}`, {
      label: `Two ${ctx.who} are picked independently: Pr(both are above ${a})`, cell: `E${q + 3}`, answer: up * up, format: "prob", formula: `=E${q + 1}*E${q + 1}`,
      explain: "The product of the two probabilities, thanks to independence (in class: =I8*I8).",
      traps: [{ value: up, why: "That is for one of them; for both, multiply the two probabilities." }, { value: Fa * Fa, why: "Squared Pr(X < x); the question asks for both above." }],
    });
    S.given(`C${q + 4}`, n);
    ask(S, `B${q + 4}`, {
      label: `${n} ${ctx.who} are picked independently: Pr(all ${n} are above ${a})`, cell: `E${q + 4}`, answer: up ** n, format: "prob", formula: `=E${q + 1}^C${q + 4}`,
      explain: "Independence again: multiply the same probability n times, Pr^n.",
      traps: [{ value: Math.min(1, n * up), why: "Multiplied by n; for 'all of them' raise to the power n." }, { value: Fa ** n, why: "Used Pr(X < x)^n; the question asks for all above." }],
    });
    ask(S, `B${q + 5}`, {
      label: `Of the same ${n}, Pr(at least one is below ${a})`, cell: `E${q + 5}`, answer: 1 - up ** n, format: "prob", formula: `=1-E${q + 4}`,
      explain: "'At least one below' is the opposite of 'all above', so it is 1 − Pr(all above) (Spring 2026 Final: =1-(1-C13)^15).",
      traps: [{ value: Fa ** n, why: "That is Pr(all of them are below)." }, { value: Math.min(1, n * Fa), why: "Multiplied by n; use 1 − Pr(none below)." }],
    });
    return {
      tab: "Normal and independence", title: "Normal probabilities and independent picks",
      text: [
        `${ctx.s} is normally distributed with mean ${mu} and standard deviation ${sd} (${ctx.u}).`,
        "Answer in column E with formulas that point at the givens. You may point at your earlier answers.",
        `Each ${ctx.one} is picked independently, so probabilities of 'both' and 'all' are products.`,
      ],
      cells: S.cells, parts: S.parts,
    };
  },
};

// ---------- Q2: a discrete random variable, 1000 simulated trials (Sheet2) ----------
type PCtx = { s: string; values: number[]; q: string };
const PC: PCtx[] = [
  { s: "A game: you pick a favourite number x and I give you x dollars.", values: [1, 2, 3, 4], q: "How many dollars do you win on average?" },
  { s: "A game: you spin a wheel and win the dollar amount it lands on.", values: [0, 1, 2, 5, 10], q: "How many dollars do you win on average?" },
  { s: "The percentage a customer tips on their bill.", values: [0, 10, 15, 20, 25], q: "What is the average tip percentage?" },
  { s: "The number of coffees a customer buys in one visit.", values: [1, 2, 3, 4, 5], q: "How many coffees does a customer buy on average?" },
  { s: "The number of days a parcel takes to arrive.", values: [1, 2, 3, 4], q: "How many days does a parcel take on average?" },
];
const pmfSim: BlockMaker = {
  key: "l11.pmf-sim",
  title: "A discrete random variable: E[X], Var[X] and 1000 simulated trials",
  make(rng): Block {
    const ctx = pick(rng, PC);
    const xs = ctx.values, k = xs.length;
    // Probabilities in twentieths (multiples of 0.05), each at least 0.05.
    const units = xs.map(() => 1);
    for (let i = 0; i < 20 - k; i++) units[int(rng, 0, k - 1)]++;
    const ps = units.map((u) => u / 20);
    const N = 1000;
    const sims: number[] = [];
    for (let i = 0; i < N; i++) {
      const u = rng() * 20;
      let acc = 0, j = 0;
      while (j < k - 1 && u >= acc + units[j]) { acc += units[j]; j++; }
      sims.push(xs[j]);
    }
    const EX = xs.reduce((s, x, i) => s + x * ps[i], 0);
    const VX = xs.reduce((s, x, i) => s + (x - EX) ** 2 * ps[i], 0);
    const S = new Sheet();
    S.header(`B${TOP}`, "x").header(`C${TOP}`, "Pr(X=x)").header(`D${TOP}`, "(x−E[X])²");
    const t1 = TOP + 1, tk = TOP + k;
    xs.forEach((x, i) => {
      const r = TOP + 1 + i;
      S.set(`B${r}`, x, "data").set(`C${r}`, ps[i], "data");
      push(S, {
        label: `(x−E[X])² for x = ${x}`, cell: `D${r}`, answer: (x - EX) ** 2, tol: Math.max(1e-6, (x - EX) ** 2 * 1e-6), formula: `=(B${r}-$G$${TOP + 1})^2`,
        explain: "Squared distance of each value from E[X]; $ on the E[X] cell so the formula copies down.",
      });
    });
    S.header(`F${TOP}`, "Measure").header(`G${TOP}`, "Your answer");
    ask(S, `F${TOP + 1}`, {
      label: "E[X]", cell: `G${TOP + 1}`, answer: EX, tol: 1e-6, formula: `=SUMPRODUCT(B${t1}:B${tk},C${t1}:C${tk})`,
      explain: "E[X] = SUMPRODUCT of values and probabilities (or written out, =B9*C9+B10*C10+…).",
      traps: [{ value: xs.reduce((s, x) => s + x, 0) / k, why: "Averaged the values as if they were equally likely; weight each by its probability." }],
    });
    ask(S, `F${TOP + 2}`, {
      label: "Var[X]", cell: `G${TOP + 2}`, answer: VX, tol: 1e-6, formula: `=SUMPRODUCT(D${t1}:D${tk},C${t1}:C${tk})`,
      explain: "Var[X] = SUMPRODUCT of the (x − E[X])² column and the probabilities.",
      traps: [{ value: xs.reduce((s, x) => s + (x - EX) ** 2, 0), why: "Added the (x − E[X])² column without weighting by the probabilities." }],
    });
    ask(S, `F${TOP + 3}`, {
      label: "Standard deviation of X", cell: `G${TOP + 3}`, answer: Math.sqrt(VX), tol: 1e-6, formula: `=SQRT(G${TOP + 2})`,
      explain: "Square root of the variance.",
      traps: [{ value: VX, why: "Gave the variance; take its square root." }],
    });
    const sim = S.table("I", TOP, ["Trial", "Outcome"], sims.map((v, i) => [i + 1, v]));
    const data = `J${sim.first}:J${sim.last}`, dataAbs = `$J$${sim.first}:$J$${sim.last}`;
    const f0 = TOP + k + 3;
    S.header(`B${f0}`, "Values").header(`C${f0}`, "Freq");
    xs.forEach((x, i) => {
      const r = f0 + 1 + i;
      S.set(`B${r}`, x, "data");
      push(S, {
        label: `Frequency of ${x}`, cell: `C${r}`, answer: sims.filter((v) => v === x).length, tol: 0, formula: `=COUNTIF(${dataAbs},B${r})`,
        explain: "COUNTIF counts the trials with this outcome; the frequencies add up to 1000. Each should be near 1000 × Pr(X = x).",
      });
    });
    const mean = sims.reduce((s, v) => s + v, 0) / N;
    const varS = sims.reduce((s, v) => s + (v - mean) ** 2, 0) / (N - 1);
    ask(S, `F${TOP + 5}`, {
      label: `Sample mean (${ctx.q})`, cell: `G${TOP + 5}`, answer: mean, tol: Math.max(1e-6, Math.abs(mean) * 1e-4), formula: `=AVERAGE(${data})`,
      explain: "The simulation's answer is the sample mean of the 1000 trials: AVERAGE. Compare it with E[X].",
      traps: [{ value: EX, why: "That is E[X]; the question asks what the simulation gives." }],
    });
    ask(S, `F${TOP + 6}`, {
      label: "Sample variance", cell: `G${TOP + 6}`, answer: varS, tol: Math.max(1e-6, varS * 2e-4), formula: `=VAR.S(${data})`,
      explain: "Sample variance with n − 1: VAR.S. Compare it with Var[X].",
      traps: [{ value: (varS * (N - 1)) / N, why: "Used VAR.P; a sample uses VAR.S (divide by n − 1)." }, { value: VX, why: "That is Var[X]; the question asks for the simulated sample." }],
    });
    const vi = k - 2, v = xs[vi], vRow = TOP + 1 + vi;
    const exact = ps[vi] + ps[k - 1];
    ask(S, `F${TOP + 7}`, {
      label: `Pr(X ≥ ${v}) from the distribution`, cell: `G${TOP + 7}`, answer: exact, format: "prob", formula: `=SUM(C${vRow}:C${tk})`,
      explain: `Add the probabilities of the outcomes that are at least ${v}.`,
      traps: [{ value: ps[vi], why: `Only took Pr(X = ${v}); 'at least' includes the larger values too.` }],
    });
    const prop = sims.filter((s) => s >= v).length / N;
    ask(S, `F${TOP + 8}`, {
      label: `Proportion of the 1000 trials with X ≥ ${v}`, cell: `G${TOP + 8}`, answer: prop, format: "prob", tol: 1e-9, formula: `=COUNTIF(${data},">="&B${vRow})/1000`,
      explain: "Empirical probability from the simulation: count the trials that qualify and divide by the number of trials.",
      traps: [{ value: sims.filter((s) => s > v).length / N, why: `Counted X > ${v}; 'at least' means ≥.` }],
    });
    const sorted = [...sims].sort((x, y) => x - y);
    const pctExc = (kk: number) => { const h = kk * (N + 1); const lo = Math.floor(h); return sorted[lo - 1] + (h - lo) * ((sorted[lo] ?? sorted[lo - 1]) - sorted[lo - 1]); };
    const pctInc = (kk: number) => { const h = kk * (N - 1); const lo = Math.floor(h); return sorted[lo] + (h - lo) * ((sorted[lo + 1] ?? sorted[lo]) - sorted[lo]); };
    ([[0.1, "10th"], [0.77, "77th"]] as const).forEach(([kk, name], i) => {
      const exc = pctExc(kk), inc = pctInc(kk);
      ask(S, `F${TOP + 10 + i}`, {
        label: `${name} percentile of the 1000 trials`, cell: `G${TOP + 10 + i}`, answer: exc, tol: 1e-9, formula: `=PERCENTILE.EXC(${data},${kk})`,
        explain: `As in class: PERCENTILE.EXC(range, k) with k = ${kk} for the ${name} percentile.${Math.abs(inc - exc) > 1e-9 ? " PERCENTILE.INC is also accepted." : ""}`,
        alts: Math.abs(inc - exc) > 1e-9 ? [inc] : undefined,
      });
    });
    return {
      tab: "Simulate 1000 trials", title: "Simulate a discrete random variable",
      text: [
        `${ctx.s} It is a random variable X with the probabilities in the table. Column J holds 1000 simulated trials.`,
        "Complete the (x−E[X])² column and find E[X], Var[X] and the standard deviation.",
        "Make the frequency table with COUNTIF, find the sample mean and variance of the trials and compare, then the 10th and 77th percentiles with PERCENTILE.EXC as in class.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        `Simulate your own 1000 trials: Data > Data Analysis > Random Number Generation, Distribution "Discrete", Value and Probability Input Range B${t1}:C${tk}. Self-check: your sample mean is within about 0.1 × the standard deviation of E[X] (it will rarely be exactly equal).`,
      ],
    };
  },
};

// ---------- Q3: Monte Carlo inventory simulation (Spring 2026 Final Q3) ----------
type ICtx = { item: string; price: number; hold: number; loss: number };
const IC: ICtx[] = [
  { item: "laptop", price: 3200, hold: 50, loss: 1000 },
  { item: "bike", price: 900, hold: 20, loss: 300 },
  { item: "espresso machine", price: 1200, hold: 30, loss: 400 },
  { item: "television", price: 1500, hold: 40, loss: 500 },
  { item: "e-scooter", price: 800, hold: 25, loss: 250 },
];
const inventory: BlockMaker = {
  key: "l11.inventory",
  title: "Monte Carlo inventory simulation with =MAX(0,ROUND(x,0)), restocking each week",
  make(rng): Block {
    const ctx = pick(rng, IC);
    const R = pick(rng, [1, 2, 3]);
    const I1 = pick(rng, [1, 2]);
    const mu = pick(rng, [2, 3, 4]);
    const sd = pick(rng, [1.5, 2, 2.5]);
    const W = 8;
    const xs = Array.from({ length: W }, () => draw2(rng, mu, sd));
    if (!xs.some((x) => x < 0)) xs[int(rng, 1, W - 1)] = -round(0.6 + rng() * 1.2, 2);
    const S = new Sheet();
    S.header(`B${TOP}`, "Given").header(`C${TOP}`, "Value");
    S.label(`B${TOP + 1}`, `Price of one ${ctx.item} ($)`).given(`C${TOP + 1}`, ctx.price);
    S.label(`B${TOP + 2}`, `Cost to store one ${ctx.item} for a week ($)`).given(`C${TOP + 2}`, ctx.hold);
    S.label(`B${TOP + 3}`, "Loss per customer with no stock ($)").given(`C${TOP + 3}`, ctx.loss);
    S.label(`B${TOP + 4}`, "Restock each week").given(`C${TOP + 4}`, R);
    S.label(`B${TOP + 5}`, "Inventory at the start of week 1").given(`C${TOP + 5}`, I1);
    S.label(`B${TOP + 6}`, "Weekly customers: mean").given(`C${TOP + 6}`, mu);
    S.label(`B${TOP + 7}`, "Weekly customers: standard deviation").given(`C${TOP + 7}`, sd);
    const cP = `$C$${TOP + 1}`, cH = `$C$${TOP + 2}`, cL = `$C$${TOP + 3}`, cR = `$C$${TOP + 4}`;
    const T0 = TOP + 9; // header row of the table
    ["Week", "Random number", "Simulated demand", "Inventory", "Units sold", "Shortage", "Net revenue"].forEach((h, j) => S.header(`${"BCDEFGH"[j]}${T0}`, h));
    let inv = I1, prevInv = 0, prevSold = 0;
    const nets: number[] = [], shorts: number[] = [];
    for (let t = 1; t <= W; t++) {
      const r = T0 + t;
      const x = xs[t - 1];
      S.set(`B${r}`, t, "data").set(`C${r}`, x, "data");
      const D = Math.max(0, xround(x));
      push(S, {
        label: `Week ${t}: simulated demand`, cell: `D${r}`, answer: D, tol: 0, formula: `=MAX(0,ROUND(C${r},0))`,
        explain: "You can't have a decimal or a negative number of customers: round to a whole number, and anything below 0 becomes 0.",
        traps: [
          ...(x < 0 ? [{ value: xround(x), why: "Rounded but forgot MAX(0, …): a negative number of customers is impossible." }] : []),
          { value: Math.trunc(x), why: "Cut off the decimals (INT/ROUNDDOWN) instead of rounding to the nearest whole number." },
        ],
      });
      if (t === 1) {
        S.set(`E${r}`, I1, "given");
      } else {
        inv = R + (prevInv - prevSold);
        push(S, {
          label: `Week ${t}: inventory`, cell: `E${r}`, answer: inv, tol: 0, formula: `=${cR}+(E${r - 1}-F${r - 1})`,
          explain: "This week's inventory = the restock + what was left last week (last week's inventory − units sold).",
          traps: [{ value: R, why: "Forgot the stock left over from last week." }],
        });
      }
      const sold = Math.min(D, inv), short = D - sold;
      push(S, {
        label: `Week ${t}: units sold`, cell: `F${r}`, answer: sold, tol: 0, formula: `=MIN(D${r},E${r})`,
        explain: "You can only sell what is wanted and what you have: the smaller of demand and inventory.",
      });
      push(S, {
        label: `Week ${t}: shortage`, cell: `G${r}`, answer: short, tol: 0, formula: `=D${r}-F${r}`,
        explain: "Customers who wanted one but found no stock: demand − units sold.",
      });
      const net = ctx.price * sold - ctx.hold * inv - ctx.loss * short;
      push(S, {
        label: `Week ${t}: net revenue`, cell: `H${r}`, answer: net, formula: `=${cP}*F${r}-${cH}*E${r}-${cL}*G${r}`,
        explain: "Net revenue = revenue (price × units sold) − inventory cost (storage × inventory) − shortage cost (loss × shortage).",
        traps: [{ value: ctx.price * sold - ctx.hold * inv, why: "Forgot to subtract the shortage cost." }, { value: ctx.price * sold - ctx.loss * short, why: "Forgot to subtract the inventory (storage) cost." }],
      });
      nets.push(net); shorts.push(short);
      prevInv = inv; prevSold = sold;
    }
    const first = T0 + 1, last = T0 + W;
    S.header(`J${T0}`, "Summary").header(`K${T0}`, "Your answer");
    const avg = nets.reduce((s, v) => s + v, 0) / W;
    ask(S, `J${T0 + 1}`, {
      label: "Average weekly net revenue", cell: `K${T0 + 1}`, answer: avg, formula: `=AVERAGE(H${first}:H${last})`,
      explain: "The Monte Carlo estimate is the average over the simulated weeks (Spring 2026 Final: =AVERAGE(K6:K105)).",
    });
    ask(S, `J${T0 + 2}`, {
      label: "Proportion of weeks with a shortage", cell: `K${T0 + 2}`, answer: shorts.filter((v) => v > 0).length / W, format: "prob", tol: 1e-9,
      formula: `=COUNTIF(G${first}:G${last},">0")/${W}`,
      explain: "Empirical probability from the simulation: weeks with a shortage divided by the number of weeks.",
    });
    return {
      tab: "Inventory simulation", title: `Restocking ${R} ${ctx.item}${R > 1 ? "s" : ""} a week`,
      text: [
        `A store sells ${ctx.item}s for $${ctx.price}. Storing one ${ctx.item} costs $${ctx.hold} a week, and the store loses $${ctx.loss} for each customer who wants one when none is in stock.`,
        `It has ${I1} in stock at the start of week 1 and restocks ${R} every week. Weekly customers are normally distributed with mean ${mu} and standard deviation ${sd}; column C holds simulated values.`,
        "Simulated demand: use =MAX(0,ROUND(simulated_number,0)), since a decimal or negative number of customers is unrealistic.",
        "Inventory = restock + (last week's inventory − last week's units sold). Units sold = the smaller of demand and inventory. Shortage = demand − units sold.",
        "Net revenue = price × units sold − storage cost × inventory − loss × shortage. Then answer the summary questions.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        `Run it yourself for 100 weeks: Random Number Generation, Distribution "Normal", mean ${mu}, standard deviation ${sd}, 100 numbers; copy the formulas down. Then build a second table restocking ${R + 1} a week and compare the average net revenues. Self-check: the policy with the higher average is the better one (on the Spring 2026 Final, restocking 2 laptops averaged $4111 against $9 for 1).`,
        "Make a histogram of your 100 net revenues with the Data Analysis Toolpak (20 to 40 evenly spaced bins, as the Final asked). Self-check: the frequencies add up to 100.",
      ],
    };
  },
};

// ---------- Q4: Monte Carlo with uniform, normal and discrete inputs (Spring 2026 Exam 2 Q4) ----------
const TIPS: [number, number][][] = [
  [[0, 0.4], [0.15, 0.3], [0.2, 0.2], [0.25, 0.1]],
  [[0, 0.3], [0.1, 0.2], [0.15, 0.3], [0.2, 0.2]],
  [[0, 0.25], [0.1, 0.25], [0.2, 0.35], [0.25, 0.15]],
  [[0, 0.5], [0.15, 0.2], [0.2, 0.2], [0.3, 0.1]],
];
const taxi: BlockMaker = {
  key: "l11.taxi",
  title: "Monte Carlo simulation of a taxi driver's tips (uniform, normal and discrete inputs)",
  make(rng): Block {
    const fare = pick(rng, [2.5, 3, 3.5, 4]);
    const U = pick(rng, [20, 25, 30]);
    const mu = pick(rng, [6, 8, 10]);
    const sd = pick(rng, [1.5, 2, 2.5]);
    const pmf = pick(rng, TIPS);
    const x0 = int(rng, 8, 20), y0 = int(rng, 4, 12), t0 = pick(rng, [0.1, 0.15, 0.2, 0.25]);
    const days = 365;
    const X: number[] = [], Y: number[] = [], Z: number[] = [];
    for (let i = 0; i < days; i++) {
      X.push(round(rng() * U, 2));
      let y = round(mu + sd * gauss(rng), 2);
      while (y < 0.5) y = round(mu + sd * gauss(rng), 2);
      Y.push(y);
      const u = rng();
      let acc = 0, j = 0;
      while (j < pmf.length - 1 && u >= acc + pmf[j][1]) { acc += pmf[j][1]; j++; }
      Z.push(pmf[j][0]);
    }
    const S = new Sheet();
    S.header(`B${TOP}`, "Given").header(`C${TOP}`, "Value");
    S.label(`B${TOP + 1}`, "Fare per mile ($)").given(`C${TOP + 1}`, fare);
    S.label(`B${TOP + 2}`, "One day: journeys").given(`C${TOP + 2}`, x0);
    S.label(`B${TOP + 3}`, "One day: average length (miles)").given(`C${TOP + 3}`, y0);
    S.label(`B${TOP + 4}`, "One day: tip").given(`C${TOP + 4}`, t0, true);
    const z0 = TOP + 6;
    S.header(`B${z0}`, "z (tip)").header(`C${z0}`, "Pr(Z=z)");
    pmf.forEach(([z, p], i) => { S.set(`B${z0 + 1 + i}`, z, "data", { pct: true }).set(`C${z0 + 1 + i}`, p, "data"); });
    const zLast = z0 + pmf.length;
    const sim = S.table("F", TOP, ["Day", "Number of trips", "Average trip length", "Avg. tip", "Fare total", "Tip total"],
      X.map((x, i) => [i + 1, x, Y[i], Z[i]]));
    // the last two columns are for the student's own working (blank)
    const gx = `G${sim.first}:G${sim.last}`, hy = `H${sim.first}:H${sim.last}`, iz = `I${sim.first}:I${sim.last}`;
    const q = zLast + 3;
    S.header(`B${q - 1}`, "Question").header(`C${q - 1}`, "Your answer");
    const F = `$C$${TOP + 1}`;
    ask(S, `B${q}`, {
      label: "Tips on the one day described (in $)", cell: `C${q}`, answer: x0 * y0 * fare * t0, formula: `=C${TOP + 2}*C${TOP + 3}*${F}*C${TOP + 4}`,
      explain: "Fare total = journeys × miles × fare per mile; the tips are that times the tip percentage (Spring 2026: =12*7*3*0.2).",
      traps: [{ value: x0 * y0 * t0, why: "Forgot the fare per mile." }, { value: x0 * y0 * fare, why: "Gave the fare total, not the tips." }],
    });
    const EZ = pmf.reduce((s, [z, p]) => s + z * p, 0);
    ask(S, `B${q + 1}`, {
      label: "E[Z], the expected tip percentage", cell: `C${q + 1}`, answer: EZ, tol: 1e-6, formula: `=SUMPRODUCT(B${z0 + 1}:B${zLast},C${z0 + 1}:C${zLast})`,
      explain: "SUMPRODUCT of the tip percentages and their probabilities.",
    });
    let fareSum = 0, tipSum = 0, zeros = 0;
    for (let i = 0; i < days; i++) { const f = fare * X[i] * Y[i]; fareSum += f; tipSum += f * Z[i]; if (Z[i] === 0) zeros++; }
    ask(S, `B${q + 2}`, {
      label: "Simulation: average fare total per day", cell: `C${q + 2}`, answer: fareSum / days, formula: `=${F}*SUMPRODUCT(${gx},${hy})/365`,
      explain: "In class you fill a Fare total column (=fare*trips*length) and take its AVERAGE; this one-cell formula gives the same number.",
    });
    ask(S, `B${q + 3}`, {
      label: "Simulation: average amount made in tips per day", cell: `C${q + 3}`, answer: tipSum / days, formula: `=${F}*SUMPRODUCT(${gx},${hy},${iz})/365`,
      explain: "Tip total = Fare total × Avg. tip for each day; the answer is the AVERAGE of that column (Spring 2026: =AVERAGE(I6:I370)). This one-cell formula gives the same number.",
      traps: [{ value: fareSum / days, why: "Averaged the fare totals; multiply each day's fare by that day's tip percentage." }, { value: (fareSum / days) * EZ, why: "Used E[Z] for every day instead of the simulated tip percentages." }],
    });
    ask(S, `B${q + 4}`, {
      label: "Simulation: probability the driver makes no money in tips on a day", cell: `C${q + 4}`, answer: zeros / days, format: "prob", tol: 1e-9,
      formula: `=COUNTIF(${iz},0)/365`,
      explain: "Count the days with zero tips and divide by the number of days (Spring 2026: =COUNTIF(I6:I370,0)/365).",
      traps: [{ value: pmf[0][1], why: "That is Pr(Z = 0) from the distribution; the question asks what your simulation gives." }],
    });
    return {
      tab: "Taxi tips simulation", title: "Monte Carlo: a taxi driver's tips",
      text: [
        `A taxi driver completes X journeys a day with an average length of Y miles. The fare is $${fare.toFixed(2)} per mile.`,
        `X is uniformly distributed between 0 and ${U}, Y is normally distributed with mean ${mu} and standard deviation ${sd}, and the average tip Z on a day is discrete with the probabilities in the table.`,
        "Columns G to I hold 365 days of simulated X, Y and Z (journeys are left as decimals, not whole numbers, as in the exam). Fill Fare total and Tip total yourself, then answer.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        `Make your own 365 days with Random Number Generation: Uniform between 0 and ${U}; Normal with mean ${mu} and standard deviation ${sd}; Discrete with the z and Pr(Z=z) table. Self-check: your average trips is near ${U / 2}, your average length near ${mu}, and the share of zero-tip days near ${pmf[0][1]}.`,
      ],
    };
  },
};

export const LESSON_11: Lesson = {
  n: 11,
  title: "Review: normal probabilities, independence and Monte Carlo simulation",
  unit: 1,
  week: "Week 6 · Wed 7 Oct · Review (before Exam 1 on Wed 14 Oct)",
  sources: ["Lesson 11, notes.xlsx", "Final.docx (Spring 2026 Final paper)", "S26_Final, solutions.xlsx", "S26_Exam 2.docx", "S26_Exam2_solutions.xlsx", "Fall_2026_Exam1_solutions.xlsx", "Exam_2_practice_solutions.xlsx", "Midterm 2 announcement.docx (Spring 2026)"],
  summary:
    "The review class works through normal probabilities with IQ scores (mean 100, standard deviation 15), uses independence to combine them (both of two people), and repeats simulating 1000 trials of a discrete random variable with a frequency table. The same tools run a Monte Carlo simulation in a business setting, like the Spring 2026 Final's laptop inventory question with =MAX(0,ROUND(x,0)).",
  defs: [
    { term: "Half of a normal is below the mean", text: "If X is normal with mean 100, Pr(X<100) = 0.5: the curve is symmetric about its mean.", source: "Lesson 11, notes › Sheet1 B2:B4" },
    { term: "Less than", text: "Pr(X<78) = NORM.DIST(x=78, mean=100, std_dev=15, TRUE) = 0.0712.", source: "Lesson 11, notes › Sheet1 B6:K6" },
    { term: "Greater than", text: "Pr(X>78) = 1 − NORM.DIST(78,100,15,TRUE) = 0.9288 (in the sheet: =1-K6).", source: "Lesson 11, notes › Sheet1 B8:I8" },
    { term: "Between", text: "Pr(70<X<120) = NORM.DIST(120,100,15,TRUE) − NORM.DIST(70,100,15,TRUE) = 0.8860.", source: "Lesson 11, notes › Sheet1 B10:N10" },
    { term: "Independent selections multiply", text: "You randomly (independently) select 2 people and give them an IQ test. The probability both have IQ > 78 is the product of the two probabilities thanks to independence: =I8*I8 = 0.8626.", source: "Lesson 11, notes › Sheet1 B13:P15" },
    { term: "All of n and at least one (key fact)", text: "For n independent picks, Pr(all n do it) = p^n, and Pr(at least one doesn't) = 1 − p^n. Spring 2026 Final: all 15 sleep under 10 hours = NORM.DIST(10,7,3,TRUE)^15; at least one gets no sleep = 1 − (1 − Pr(no sleep))^15.", source: "S26_Final, solutions › Normal distribution C13:C19" },
    { term: "Expectation, two ways", text: "E[X] = SUMPRODUCT(values, probabilities), or written out =C3*D3+C4*D4+C5*D5+C6*D6. For his favourite-number game (1, 2, 3, 4 with probabilities 0.5, 0.1, 0.2, 0.2) E[X] = 2.1.", source: "Lesson 11, notes › Sheet2 C2:K4" },
    { term: "Variance and standard deviation of X", text: "Var[X] = SUMPRODUCT of the (x − E[X])² column and the probabilities = 1.49; std_dev = SQRT(Var[X]) = 1.2207.", source: "Lesson 11, notes › Sheet2 E2:K7" },
    { term: "Simulating 1000 trials", text: "Task: simulate 1000 trials of this random variable and make a frequency table. What is your sample mean? How many dollars do you win on average? His 1000 trials: sample mean 2.1, sample variance (VAR.S) 1.4615, against E[X] = 2.1 and Var[X] = 1.49.", source: "Lesson 11, notes › Sheet2 C8:G13" },
    { term: "Percentiles", text: "The k-th percentile with PERCENTILE.EXC(range, k): 10th percentile (k = 0.1) of his trials = 1, 77th percentile (k = 0.77) = 3.", source: "Lesson 11, notes › Sheet2 E15:I16" },
    { term: "VLOOKUP with lower limits", text: "VLOOKUP(value, table, 2, TRUE) finds the row with the largest lower limit that is ≤ the value and returns its second column. A value below the first lower limit gives #N/A (his example: looking up 3 in a table starting at 4).", source: "Lesson 11, notes › Sheet2 E21:G25" },
    { term: "Monte Carlo simulation (key fact)", text: "Use the random number generator to produce numbers from a discrete, uniform or normal distribution, work out the business outcome for each trial row by row, then AVERAGE over the trials for an average, or COUNTIF ÷ number of trials for a probability.", source: "Midterm 2 announcement (Spring 2026); S26_Exam2_solutions › Simulation D372:D374" },
    { term: "Realistic simulated numbers", text: "It is unrealistic to have a decimal number of customers or a negative number of customers, so use =MAX(0,ROUND(simulated_number,0)).", source: "Final.docx (Spring 2026 Final Q3); S26_Final, solutions › Simulation D9" },
    { term: "Inventory bookkeeping", text: "Units sold = MIN(demand, inventory); shortage = demand − units sold; next week's inventory = restock + (inventory − units sold); net revenue = revenue − inventory cost − shortage cost.", source: "S26_Final, solutions › Simulation E9:K9, P9" },
  ],
  examples: [
    {
      title: "IQ scores: normal probabilities and two independent people",
      setup: "A random variable X is normally distributed with mean 100 and standard deviation 15. Find Pr(X<78), Pr(X>78), Pr(70<X<120), and the probability that two independently selected people both have an IQ above 78.",
      steps: [
        { say: "Less than 78.", formula: "=NORM.DIST(78,100,15,TRUE)", result: "0.0712" },
        { say: "Greater than 78: one minus the answer above (in K6).", formula: "=1-K6", result: "0.9288" },
        { say: "Between 70 and 120.", formula: "=NORM.DIST(120,100,15,TRUE)-NORM.DIST(70,100,15,TRUE)", result: "0.8860" },
        { say: "Both people above 78: multiply, thanks to independence (I8 holds Pr(X>78)).", formula: "=I8*I8", result: "0.8626" },
      ],
      takeaway: "NORM.DIST for one person; multiply for independent people.",
      source: "Lesson 11, notes › Sheet1",
    },
    {
      title: "Favourite number: E[X], Var[X] and 1000 simulated trials",
      setup: "X takes the values 1, 2, 3, 4 with probabilities 0.5, 0.1, 0.2, 0.2 (you win x dollars). Find E[X], Var[X] and the standard deviation, then simulate 1000 trials and compare.",
      table: { head: ["x", "Pr(X=x)", "(x−E[X])²", "Frequency in his 1000 trials"], rows: [[1, 0.5, 1.21, 493], [2, 0.1, 0.01, 106], [3, 0.2, 0.81, 209], [4, 0.2, 3.61, 192]] },
      steps: [
        { say: "Expectation with SUMPRODUCT (or written out, =C3*D3+C4*D4+C5*D5+C6*D6).", formula: "=SUMPRODUCT(C3:C6,D3:D6)", result: "2.1" },
        { say: "Squared distances from E[X] (in K2), copied down.", formula: "=(C3-$K$2)^2", result: "1.21 (for x = 1)" },
        { say: "Variance.", formula: "=SUMPRODUCT(E3:E6,D3:D6)", result: "1.49" },
        { say: "Standard deviation.", formula: "=SQRT(K6)", result: "1.2207" },
        { say: "Sample mean of the 1000 trials in C12:C1011: how many dollars you win on average.", formula: "=AVERAGE(C12:C1011)", result: "2.1" },
        { say: "Sample variance.", formula: "=VAR.S(C12:C1011)", result: "1.4615" },
        { say: "10th and 77th percentiles of the trials.", formula: "=PERCENTILE.EXC(C12:C1011,0.1)", result: "1 (and 3 for k = 0.77)" },
      ],
      takeaway: "The simulation estimates E[X] and Var[X]; the frequencies are near 1000 × Pr(X = x).",
      source: "Lesson 11, notes › Sheet2 (frequencies counted from his 1000 trials)",
    },
    {
      title: "Spring 2026 Final Q3: restocking laptops",
      setup: "A store sells laptops for $3200. Storing one laptop costs $50 a week, and the store loses $1000 for each customer with no laptop in stock. It starts with 1 laptop and restocks 1 (Table 4) or 2 (Table 5) a week. Weekly customers are normal with mean 4 and standard deviation 2.",
      steps: [
        { say: "Week 4's random number is 5.8577. Make it a realistic number of customers.", formula: "=MAX(0,ROUND(C9,0))", result: "6" },
        { say: "Inventory (restock 1): restock + last week's leftover.", formula: "=1+(E8-F8)", result: "1" },
        { say: "Units sold: the smaller of demand and inventory.", formula: "=MIN(D9,E9)", result: "1" },
        { say: "Shortage: demand − units sold.", formula: "=D9-F9", result: "5" },
        { say: "Net revenue = revenue − inventory cost − shortage cost (H9 = F9*3200, I9 = 50*E9, J9 = 1000*G9).", formula: "=H9-I9-J9", result: "3200 − 50 − 5000 = −1850" },
        { say: "Restock 2, week 3: inventory = 2 + (2 − 1) = 3, demand 2, so 2 sold.", formula: "=S8-T8-U8", result: "6400 − 150 − 0 = 6250" },
        { say: "Average over 100 weeks for each policy.", formula: "=AVERAGE(K6:K105)", result: "$9 (restock 1) against $4111 (restock 2, =AVERAGE(V6:V105))" },
      ],
      takeaway: "Simulate, round sensibly, do the bookkeeping row by row, then average: restocking 2 a week is far better.",
      source: "S26_Final, solutions › Simulation",
    },
  ],
  quiz: [
    { q: "IQ is normal with mean 100 and standard deviation 15. What is Pr(X < 100)?", options: ["0.5", "0.15", "1", "0"], answer: 0, why: "The normal curve is symmetric about its mean, so exactly half is below 100." },
    { q: "Which formula gives Pr(IQ > 78)?", options: ["=NORM.DIST(78,100,15,TRUE)", "=1-NORM.DIST(78,100,15,TRUE)", "=NORM.DIST(78,100,15,FALSE)", "=NORM.INV(0.78,100,15)"], answer: 1, why: "NORM.DIST(…,TRUE) is the area below 78; the area above is one minus it (0.9288)." },
    { q: "Which formula gives Pr(70 < IQ < 120)?", options: ["=NORM.DIST(120,100,15,TRUE)-NORM.DIST(70,100,15,TRUE)", "=NORM.DIST(120,100,15,TRUE)+NORM.DIST(70,100,15,TRUE)", "=NORM.DIST(50,100,15,TRUE)", "=1-NORM.DIST(120,100,15,TRUE)"], answer: 0, why: "Area below the upper value minus area below the lower value = 0.8860." },
    { q: "Pr(IQ > 78) = 0.9288. Two people are selected independently. What is the probability both have IQ > 78?", options: ["0.9288", "0.9288 × 2", "0.9288²", "1 − 0.9288²"], answer: 2, why: "The product of the two probabilities, thanks to independence: 0.9288 × 0.9288 = 0.8626." },
    { q: "Each of 15 people independently sleeps under 10 hours with probability p. What is the probability all 15 do?", options: ["15p", "p^15", "1 − p^15", "p/15"], answer: 1, why: "Independent events multiply: p × p × … × p = p^15 (Spring 2026 Final: =NORM.DIST(10,7,3,TRUE)^15)." },
    { q: "Each of 15 people independently gets no sleep with probability q. What is the probability at least one of them gets no sleep?", options: ["15q", "q^15", "1 − (1 − q)^15", "1 − q^15"], answer: 2, why: "'At least one' is the opposite of 'none': 1 − Pr(none) = 1 − (1 − q)^15." },
    { q: "Why does the Spring 2026 Final use =MAX(0,ROUND(x,0)) on the simulated demand?", options: ["To make the simulation faster", "A number of customers must be a whole number and can't be negative", "To turn the normal distribution into a uniform one", "To round money to the nearest dollar"], answer: 1, why: "It is unrealistic to have a decimal or negative number of customers: ROUND makes it whole, MAX(0, …) stops it going below 0." },
    { q: "A store restocks 2 a week. This week it had 3 in inventory and sold 2. What is next week's inventory?", options: ["2", "3", "5", "1"], answer: 1, why: "Inventory = restock + (inventory − units sold) = 2 + (3 − 2) = 3." },
    { q: "You simulate 1000 trials of X with E[X] = 2.1. What do you expect the sample mean to be?", options: ["Exactly 2.1 every time", "Close to 2.1, but it changes from simulation to simulation", "Exactly 2.1 × 1000", "Unrelated to E[X]"], answer: 1, why: "The sample mean estimates E[X]. It is close (his run happened to give 2.1) but a new simulation gives a slightly different value." },
    { q: "A table has lower limits 4, 5, 6 in its first column. What does =VLOOKUP(3,table,2,TRUE) return?", options: ["The row for 4", "The row for 6", "#N/A", "0"], answer: 2, why: "With TRUE, VLOOKUP looks for the largest lower limit ≤ 3. There isn't one, so it returns #N/A (his example in the notes)." },
  ],
  excel: [
    { fn: "NORM.DIST(x, mean, std_dev, TRUE)", use: "Pr(X < x). Pr(X > x) = 1 − NORM.DIST(...) (he points at the earlier answer: =1-K6). Between: NORM.DIST(upper) − NORM.DIST(lower)." },
    { fn: "Products and powers for independence", use: "Both of two: =I8*I8. All of n: =p^n (=E18^10). At least one: =1-(1-p)^n." },
    { fn: "SUMPRODUCT / SQRT", use: "E[X] = SUMPRODUCT(values, probabilities); Var[X] = SUMPRODUCT((x − E[X])² column, probabilities); std_dev = SQRT(Var[X])." },
    { fn: "Random Number Generation (Data Analysis Toolpak)", use: "Discrete: point the Value and Probability Input Range at the distribution table. Uniform: between a and b. Normal: mean and standard deviation. Choose the number of random numbers (1000 trials, 365 days, 100 weeks)." },
    { fn: "COUNTIF", use: "Frequency tables (=COUNTIF($C$12:$C$1011,F13)) and probabilities from a simulation (=COUNTIF(I6:I370,0)/365)." },
    { fn: "AVERAGE / VAR.S", use: "The sample mean and variance of simulated trials; AVERAGE over the trials is the Monte Carlo answer (=AVERAGE(K6:K105))." },
    { fn: "PERCENTILE.EXC(range, k)", use: "Percentiles of the simulated trials, k as a decimal (0.1 for the 10th, 0.77 for the 77th). He uses the .EXC version in Lesson 11 (=PERCENTILE.EXC(C12:C1011,0.1))." },
    { fn: "MAX(0,ROUND(x,0)) and MIN", use: "Turn a simulated normal number into a realistic whole, non-negative count; units sold = MIN(demand, inventory)." },
    { fn: "VLOOKUP(value, table, 2, TRUE)", use: "Look up a category or price from a table of lower limits (price breaks, age groups). Values below the first lower limit give #N/A." },
    { fn: "Histogram (Data Analysis Toolpak)", use: "Histogram of simulated results with your own bins; the Spring 2026 Final asked for 20 to 40 evenly spaced bins." },
  ],
  watch: [
    "Spring 2026 Final Q3 (laptops): simulate weekly demand with the RNG (normal, mean 4, standard deviation 2), convert with =MAX(0,ROUND(x,0)), then inventory =1+(E8-F8) or =2+(P8-Q8), units sold =MIN(D9,E9), shortage =D9-F9, net revenue = 3200·sold − 50·inventory − 1000·shortage. Averages over 100 weeks: $9 (restock 1) against $4111 (restock 2). Then Toolpak histograms with 20 to 40 bins.",
    "Spring 2026 Exam 2 Q4 (taxi): X uniform 0–25 journeys (not rounded), Y normal (8, 2) miles, Z a discrete tip percentage. Fare total =3*E6*F6, tip total =G6*H6, average tip =AVERAGE(I6:I370) = $28.61 in his run, Pr(no tips) =COUNTIF(I6:I370,0)/365 = 0.4575. Q1 was the warm-up =12*7*3*0.2 = $50.40.",
    "Fall 2026 Exam 1 Section 2 (Random variables): tip percentage X with a table of probabilities; E[X] and Var[X] with a (x − E[X])² column, average tip on a $25 tab = 25·E[X] = $4.625; simulate 1000 tip percentages with the RNG, tip amount = tab × tip %, then the descriptive measures (his solution uses QUARTILE.EXC) and a Toolpak histogram.",
    "Normal + independence shows up every time: Fall 2026 Exam 1 Section 3 (Empirical probability) (5 videos all over 20 s = (1 − 0.1587)^5 = 0.4216); Spring 2026 Final Q4 (6 pints all within one standard deviation = (NORM.S.DIST(1,TRUE) − NORM.S.DIST(−1,TRUE))^6 = 0.1012; all 15 sleep under 10 hours = 0.0749; at least one of 15 gets no sleep = 1 − (1 − 0.0098)^15 = 0.1375).",
    "Spring 2026 Final Q4 also asked for x with 90% of sleep times between 7 − x and 7 + x: by symmetry 5% is in each tail, so x = NORM.INV(0.95,7,3) − 7 = 4.93.",
    "Read the rounding instruction: the Spring 2026 Final said to use =MAX(0,ROUND(x,0)), but the Fall 2025 Final airline simulation said 'do not round values manually', and the Spring 2026 taxi question left the uniform journeys unrounded.",
    "Exam 2 practice file (bike wholesaler): unit price from a table of lower order-size limits with =VLOOKUP(H21,$D$21:$E$23,2,TRUE), order cost = price × size, and Pr(order < $150,000) = COUNTIF(J21:J120,\"<150000\")/100.",
    "Common slips: forgetting MAX(0, …) (negative customers), using last week's restock but not the leftover stock, forgetting the shortage cost, reporting Pr(Z = 0) from the table when the question asks what the simulation gives, and multiplying by n instead of raising to the power n.",
  ],
  makers: [iq, pmfSim, inventory, taxi],
};
