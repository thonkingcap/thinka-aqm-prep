// Unit 1 diagnostic, modelled on this term's Exam 1 (Fall 2026, 14 October): the same four tabs (Linear
// models, Random variables, Empirical probability, Charts), 42 points in one hour, the same kinds of
// question in the same order and the same cell layout as his key (Fall_2026_Exam1_solutions.xlsx).
// New scenarios and numbers throughout. Every number is fixed by mulberry32 seeds, so the paper is
// identical on every build.
import { qn, table, label, text, data, col, type DPaper, type DSection, type DPart, type Cell } from "./kit.ts";
import { mulberry32, gauss, int, pick, round } from "../lessons/kit.ts";
import { normCdf, mean, stdevS } from "../stats.ts";

// ---------------------------------------------------------------- 1. Linear models
// Marisol's smoothie stand: F = 4800 a month, V = 2.40, P = 6. Rival Theo: P = 9, 25 a day, and in truth
// F = 5400, V = 3 (so he loses 3240 a month at 12 a day and makes 8100 at 75 a day).
const F = 4800, V = 2.4, P = 6;
const TP = 9, TQ = 25;
const Q1d = 12, Pi1 = -3240, Q2d = 75, Pi2 = 8100;
const tVar = TP - (Pi2 - Pi1) / (30 * (Q2d - Q1d)); // 3
const tFix = 30 * Q1d * (TP - tVar) - Pi1; // 5400

const linear: DSection = (() => {
  const c: Record<string, Cell> = {};
  label(c, "I3", "Fixed cost"); data(c, "J3", F);
  label(c, "I4", "Variable cost"); data(c, "J4", V);
  label(c, "I5", "Price"); data(c, "J5", P);
  label(c, "I8", "Theo's price"); data(c, "J8", TP);
  label(c, "I9", "Theo's daily sales"); data(c, "J9", TQ);
  label(c, "I12", "quantity (daily)"); label(c, "J12", "profit");
  data(c, "I13", Q1d); data(c, "J13", Pi1);
  data(c, "I14", Q2d); data(c, "J14", Pi2);
  qn(c, 1, 3); qn(c, 2, 5); qn(c, 3, 7); qn(c, 4, 9); qn(c, 5, 11);
  text(c, "D7", "Paste your chart into the Charts sheet");
  label(c, "F11", "fixed cost"); label(c, "F13", "variable cost");
  return {
    tab: "Linear models", title: "Linear models",
    items: [
      { kind: "lead", text: "Marisol runs a smoothie stand at the town market. She has fixed costs of $4800 a month and sells each smoothie for $6. The cost of making each smoothie is $2.40. For these questions assume there are 30 days in a month." },
      { kind: "q", n: 1, text: "If Marisol sells 40 smoothies every day how much money does she make or lose each month? If the answer is a loss, make sure your answer is negative.", points: 2 },
      { kind: "q", n: 2, text: "What is the least number of smoothies Marisol must sell a month in order to make a profit?", points: 3 },
      { kind: "q", n: 3, text: "Produce a chart with two separate lines for the total revenue and cost for the smoothie stand. The number of smoothies sold should range from 0 to 3000 a month. Paste your chart into the “Charts” sheet in the space provided.", points: 3 },
      { kind: "lead", text: "Marisol has a rival, Theo, who runs a juice bar across the square and sells his smoothies for $9. Theo’s bar is quieter: it only sells 25 smoothies each day." },
      { kind: "q", n: 4, text: "Marisol assumes that Theo is only just breaking even. If she assumes that Theo has the same fixed costs as herself, then how much does each smoothie cost Theo to make?", points: 2 },
      { kind: "q", n: 5, text: "Theo tells Marisol that he loses $3240 each month when he only sells 12 smoothies a day but makes a profit of $8100 when he sells 75 smoothies a day. Marisol can now work out her rival’s fixed and variable costs: what are they?", points: 4 },
    ],
    cells: c,
    questions: [
      { n: 1, points: 2, lesson: 8, title: "Monthly profit or loss", parts: [{
        label: "Monthly profit", cell: "D3", tone: "blue", answer: 30 * 40 * (P - V) - F, formula: "=30*40*(J5-J4)-J3",
        explain: "Profit = q(P − V) − F with q = 30 × 40 = 1200 smoothies a month: 1200 × 3.60 − 4800 = −480, a loss, so negative.",
        traps: [{ value: 40 * (P - V) - F, why: "Used 40 a month: the 40 is per day, so multiply by 30 days." }, { value: 30 * 40 * P - F, why: "Left out the variable cost: profit = q(P − V) − F." }],
      }] },
      { n: 2, points: 3, lesson: 8, title: "Least number for a profit", parts: [{
        label: "Least number a month", cell: "D5", tone: "blue", answer: 1334, tol: 0, formula: "=ROUNDUP(J3/(J5-J4),0)",
        explain: "Breakeven q = F/(P − V) = 4800/3.60 = 1333.33, so the least whole number with a profit is 1334 (ROUNDUP, or INT(…)+1).",
        traps: [{ value: 1333, why: "Rounded the breakeven down: 1333 smoothies still make a loss." }],
      }] },
      { n: 3, points: 3, lesson: 8, title: "Revenue and cost chart", parts: [],
        unmarked: "Make a small table with q = 0 and q = 3000, revenue = q × $J$5 and cost = $J$3 + q × $J$4, and chart the two as separate straight lines (scatter with lines). Revenue runs from $0 to $18,000, cost from $4,800 to $12,000, and they cross at the breakeven, q ≈ 1333. Needs a chart title, axis titles (smoothies a month, $) and a legend." },
      { n: 4, points: 2, lesson: 8, title: "Rival's cost per smoothie", parts: [{
        label: "Theo's cost per smoothie", cell: "D9", tone: "blue", answer: TP - F / (30 * TQ), formula: "=J8-J3/(30*J9)",
        explain: "Breaking even: 30 × 25 × (9 − V) = 4800, so V = 9 − 4800/750 = 2.60.",
        traps: [{ value: F / (30 * TQ), why: "That is the fixed cost per smoothie; the cost to make one is the price minus it." }, { value: TP - F / TQ, why: "Used 25 a month: Theo sells 25 a day, so 750 a month." }],
      }] },
      { n: 5, points: 4, lesson: 8, title: "Fixed and variable cost from two points", parts: [
        { label: "Theo's fixed cost", cell: "D11", tone: "blue", answer: tFix, formula: "=30*I13*(J8-D13)-J13",
          explain: "Back out F from either point: −3240 = 360 × (9 − 3) − F, so F = 2160 + 3240 = 5400.",
          traps: [{ value: Q1d * (TP - tVar) - Pi1, why: "Used 12 a month: the quantities are per day, so multiply by 30." }] },
        { label: "Theo's variable cost", cell: "D13", tone: "blue", answer: tVar, formula: "=J8-(J14-J13)/(30*(I14-I13))",
          explain: "Profit rises by (P − V) per extra smoothie: (8100 − (−3240))/(30 × (75 − 12)) = 11340/1890 = 6 = 9 − V, so V = 3.",
          traps: [{ value: (Pi2 - Pi1) / (30 * (Q2d - Q1d)), why: "That 6 is the margin P − V; the variable cost is 9 − 6." }] },
      ] },
    ],
  };
})();

// ---------------------------------------------------------------- 2. Random variables
// Priya's cashback credit card: the cashback rate X on a purchase, and the cashback = purchase × X
// (the same shape as his tip % × tab). Rates like 1.5% on amounts in cents give cashback values with
// 3–5 decimals, so a QUARTILE.INC answer is never mistaken for a rounded one (see the quartile note).
const XS = [0.01, 0.015, 0.02, 0.03, 0.05];
const PS = [0.4, 0.25, 0.2, 0.1, 0.05];
const EX = XS.reduce((s, x, i) => s + x * PS[i], 0); // 0.01725
const VX = XS.reduce((s, x, i) => s + PS[i] * (x - EX) ** 2, 0); // 0.0000936875
const N_BUYS = 1000;
const R0 = 16; // first data row of Table 3
const R1 = R0 + N_BUYS - 1; // 1015
const BUYS: number[] = (() => {
  const rng = mulberry32(110126);
  return Array.from({ length: N_BUYS }, () => Math.min(649.99, Math.max(2.49, round(Math.exp(Math.log(42) + 0.8 * gauss(rng)), 2))));
})();
// One example run of the RNG (the key's values; students make their own).
const SIM: number[] = (() => {
  const rng = mulberry32(140126);
  return Array.from({ length: N_BUYS }, () => {
    const u = rng();
    let acc = 0;
    for (let k = 0; k < XS.length; k++) { acc += PS[k]; if (u < acc) return XS[k]; }
    return XS[XS.length - 1];
  });
})();
const CASH = BUYS.map((b, i) => round(b * SIM[i], 6));

function percentileExc(xs: number[], p: number) {
  const s = [...xs].sort((a, b) => a - b);
  const h = p * (s.length + 1) - 1;
  const lo = Math.floor(h);
  return s[lo] + (h - lo) * (s[lo + 1] - s[lo]);
}

const rv: DSection = (() => {
  const c: Record<string, Cell> = {};
  table(c, "D2", "Table 1"); table(c, "H2", "Table 2"); table(c, "M2", "Table 4");
  qn(c, 6, 3);
  label(c, "D3", "x"); label(c, "E3", "Pr(X=x)"); label(c, "F3", "(x-E[X])^2");
  col(c, "D", 4, XS); col(c, "E", 4, PS);
  label(c, "H3", "E[X]"); label(c, "H4", "Var[X]");
  c.K2 = { v: 9, role: "title" };
  const MEAS = ["Min", "Max", "Mean", "Standard deviation", "Q1", "Q2", "Q3", "IQR"];
  MEAS.forEach((m, i) => label(c, `M${3 + i}`, m));
  qn(c, 7, 11);
  c.K13 = { v: 10, role: "title" }; text(c, "M13", "Paste your chart into the Charts sheet");
  qn(c, 8, 14);
  table(c, "D14", "Table 3");
  label(c, "D15", "Purchase"); label(c, "E15", "Cashback %"); label(c, "F15", "Cashback");
  col(c, "D", R0, BUYS);
  const example: Record<string, Cell> = {};
  SIM.forEach((x, i) => { example[`E${R0 + i}`] = { v: x, role: "data" }; });
  CASH.forEach((y, i) => { example[`F${R0 + i}`] = { v: y, role: "data", f: `=D${R0 + i}*E${R0 + i}` }; });
  const R = `F${R0}:F${R1}`;
  const sorted = [...CASH].sort((a, b) => a - b);
  const q1 = percentileExc(CASH, 0.25), q2 = percentileExc(CASH, 0.5), q3 = percentileExc(CASH, 0.75);
  // Bands: where a correct simulation of 1000 purchases lands, from 200,000 numpy runs on these purchase
  // amounts (each band holds every one of those runs, with a little room). Quartiles are keyed with
  // QUARTILE.EXC as on his Fall 2026 key; QUARTILE.INC is accepted too (altFormulas: the site evaluates both on the
  // student's own numbers). Cashback amounts have 3–5 decimals, so an exact .INC value is never mistaken for a
  // hand-rounded one.
  const INC_TOO = "The key uses QUARTILE.EXC, as his Fall 2026 key does; QUARTILE.INC is also accepted (the site checks your answer against both, on your own numbers).";
  const meas: DPart[] = [
    { label: "Min", cell: "N3", tone: "blue", live: true, requires: "N5", band: [0.035, 0.09], answer: sorted[0], formula: `=MIN(${R})`, explain: "MIN of your cashback amounts in column F (the smallest purchase, $3.52, at 1% is $0.0352; yours is a few cents)." },
    { label: "Max", cell: "N4", tone: "blue", live: true, requires: "N5", band: [5.5, 23], answer: sorted[sorted.length - 1], formula: `=MAX(${R})`, explain: "MAX of your cashback amounts (one of the biggest purchases at a high rate)." },
    { label: "Mean", cell: "N5", tone: "blue", live: true, band: [0.87, 1.13], answer: mean(CASH), formula: `=AVERAGE(${R})`, explain: "AVERAGE of your cashback amounts: near E[X] × the average purchase, 0.01725 × $57.47 ≈ $0.99." },
    { label: "Standard deviation", cell: "N6", tone: "blue", live: true, band: [0.82, 1.8], answer: stdevS(CASH), formula: `=STDEV.S(${R})`, explain: "STDEV.S (a sample: your 1000 simulated purchases)." },
    { label: "Q1", cell: "N7", tone: "blue", live: true, band: [0.28, 0.37], tol: 0.0005, answer: q1, formula: `=QUARTILE.EXC(${R},1)`, altFormulas: [`=QUARTILE.INC(${R},1)`], explain: `First quartile of your cashback amounts. ${INC_TOO}` },
    { label: "Q2", cell: "N8", tone: "blue", live: true, band: [0.54, 0.71], answer: q2, formula: `=QUARTILE.EXC(${R},2)`, explain: "The median of your cashback amounts (QUARTILE.INC, QUARTILE.EXC and MEDIAN all agree on 1000 numbers)." },
    { label: "Q3", cell: "N9", tone: "blue", live: true, band: [1.02, 1.38], tol: 0.0005, answer: q3, formula: `=QUARTILE.EXC(${R},3)`, altFormulas: [`=QUARTILE.INC(${R},3)`], explain: `Third quartile of your cashback amounts. ${INC_TOO}` },
    { label: "IQR", cell: "N10", tone: "blue", live: true, band: [0.69, 1.06], tol: 0.0005, answer: q3 - q1, formula: `=QUARTILE.EXC(${R},3)-QUARTILE.EXC(${R},1)`, altFormulas: [`=QUARTILE.INC(${R},3)-QUARTILE.INC(${R},1)`], explain: "IQR = Q3 − Q1 (=N9-N7 on your sheet), from your own cashback amounts; .INC quartiles also count." },
  ];
  const pc = (x: number) => `${round(x * 100, 1)}%`;
  return {
    tab: "Random variables", title: "Random variables",
    items: [
      { kind: "lead", text: `Priya pays for everything with a cashback credit card. The cashback rate on a purchase depends on the type of shop, and is a random variable X with sample space {${XS.map(pc).join(", ")}} with probabilities` },
      ...XS.map((x, i) => ({ kind: "lead" as const, text: `Pr(X=${pc(x)}) = ${PS[i]}` })),
      { kind: "q", n: 6, text: "Complete the entries in Table 1 and use this to find the expectation and variance of X and insert your answers into Table 2.", points: 4 },
      { kind: "q", n: 7, text: "If every purchase Priya makes is $80, what is the average amount of cashback she earns per purchase?", points: 1 },
      { kind: "lead", text: "Table 3 shows the list of purchases that Priya made on the card in the last year." },
      { kind: "q", n: 8, text: "Use the random number generator to simulate 1000 trials of the cashback rate X and input these results into the second column of Table 3. Use these numbers to calculate the actual cashback earned on each purchase and enter these into the third column.", points: 2 },
      { kind: "q", n: 9, text: "For the actual cashback amounts find and enter the corresponding numerical descriptive measures into Table 4.", points: 4 },
      // [3], not the real paper's [4]: his Random variables questions add to 15 under a "[14 points]" heading, so one
      // point comes off the (unmarked) histogram to keep the section at 14 and the paper at 42.
      { kind: "q", n: 10, text: "Use the Data Analysis Toolpak to produce a histogram of the cashback amounts and paste this image into the “Charts” sheet in the space provided. In the space near your chart describe the shape. (If you do not have an answer to question 8 then you can obtain half credit by producing a histogram of the purchase amounts instead.)", points: 3 },
    ],
    cells: c, example,
    questions: [
      { n: 6, points: 4, lesson: 9, title: "Expectation and variance", parts: [
        ...XS.map((x, i): DPart => ({
          label: `(x-E[X])^2 for x = ${pc(x)}`, cell: `F${4 + i}`, tone: "blue", answer: (x - EX) ** 2, tol: 1e-9, formula: `=(D${4 + i}-$I$3)^2`,
          explain: i === 0 ? "Each squared deviation from the mean E[X] = 0.01725, with $I$3 fixed so it fills down." : `(${x} − 0.01725)^2.`,
        })),
        { label: "E[X]", cell: "I3", tone: "blue", answer: EX, tol: 1e-9, formula: "=SUMPRODUCT(D4:D8,E4:E8)",
          explain: "E[X] = Σ x·Pr(X=x) = 0.01725, i.e. 1.725% back on an average purchase.", traps: [{ value: mean(XS), why: "That is the plain average of the five rates; weight each by its probability." }] },
        { label: "Var[X]", cell: "I4", tone: "blue", answer: VX, tol: 1e-11, formula: "=SUMPRODUCT(E4:E8,F4:F8)",
          explain: "Var[X] = Σ Pr(X=x)·(x − E[X])^2 = 0.0000936875 (small, because X is a rate).", traps: [{ value: Math.sqrt(VX), why: "That is the standard deviation; the variance is its square." }] },
      ] },
      { n: 7, points: 1, lesson: 9, title: "Average cashback", parts: [{
        label: "Average cashback", cell: "D11", tone: "blue", answer: 80 * EX, tol: 1e-6, formula: "=80*I3",
        explain: "Cashback = 80X, so E[80X] = 80 × E[X] = 80 × 0.01725 = $1.38.",
        traps: [{ value: 80 * mean(XS), why: "Used the plain average of the rates instead of E[X]." }],
      }] },
      { n: 8, points: 2, lesson: 9, title: "Simulate the cashback rate", parts: [],
        unmarked: "Data › Data Analysis › Random Number Generation: 1 variable, 1000 numbers, Distribution Discrete, Value and Probability Input Range D4:E8, output E16. About 40% of your rates should be 0.01 and about 5% should be 0.05, with an average near 0.01725. Then F16 = D16*E16 filled down to F1015." },
      { n: 9, points: 4, lesson: 4, title: "Descriptive measures of the cashback", parts: meas },
      { n: 10, points: 3, lesson: 6, title: "Histogram and shape of the cashback", parts: [],
        unmarked: "A Toolpak histogram of F16:F1015 with a bin column you made (e.g. $0.25 wide from 0 to about $5, then a 'More' bin), gaps removed, a title and axis titles. Shape: unimodal, right (positive) skew, with a long tail of big purchases at high rates. (The purchase amounts give the same shape, for half credit.)" },
    ],
  };
})();

// ---------------------------------------------------------------- 3. Empirical probability
// A food-delivery app: platform (App/Website) × cuisine (Pizza/Sushi/Tacos), with age bands
// student ≤ 22, young professional ≤ 34, established > 34.
const N_ORD = 800;
const T0 = 4, T1 = T0 + N_ORD - 1; // 4..803
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const CUIS = ["Pizza", "Sushi", "Tacos"] as const;
type Order = { platform: "App" | "Website"; cuisine: string; age: number; day: string; mins: number };
const ORDERS: Order[] = (() => {
  const rng = mulberry32(220126);
  const W: Record<"App" | "Website", number[][]> = {
    App: [[0.5, 0.15, 0.35], [0.33, 0.32, 0.35], [0.28, 0.4, 0.32]],
    Website: [[0.55, 0.1, 0.35], [0.38, 0.27, 0.35], [0.3, 0.36, 0.34]],
  };
  return Array.from({ length: N_ORD }, () => {
    const platform = rng() < 0.6 ? "App" as const : "Website" as const;
    const r = rng();
    const age = r < 0.27 ? int(rng, 18, 22) : r < 0.67 ? int(rng, 23, 34) : Math.min(72, 35 + Math.floor(-12 * Math.log(1 - rng())));
    const band = age <= 22 ? 0 : age <= 34 ? 1 : 2;
    const u = rng(), w = W[platform][band];
    const cuisine = u < w[0] ? CUIS[0] : u < w[0] + w[1] ? CUIS[1] : CUIS[2];
    const day = pick(rng, DAYS);
    const mins = Math.min(70, Math.max(9, Math.round(34 + 8 * gauss(rng))));
    return { platform, cuisine, age, day, mins };
  });
})();
const cnt = (f: (o: Order) => boolean) => ORDERS.filter(f).length;

const emp: DSection = (() => {
  const c: Record<string, Cell> = {};
  table(c, "D2", "Table 6"); table(c, "J2", "Table 5");
  qn(c, 11, 3);
  CUIS.forEach((k, i) => label(c, `${"EFG"[i]}3`, k)); label(c, "H3", "Total");
  label(c, "D4", "App"); label(c, "D5", "Website"); label(c, "D6", "Total");
  ["Order", "Platform", "Cuisine", "Age", "Day", "Delivery (min)", "Age classification"].forEach((h, i) => label(c, `${"JKLMNOP"[i]}3`, h));
  ORDERS.forEach((o, i) => {
    const r = T0 + i;
    data(c, `J${r}`, i + 1); data(c, `K${r}`, o.platform, "left"); data(c, `L${r}`, o.cuisine, "left");
    data(c, `M${r}`, o.age); data(c, `N${r}`, o.day, "left"); data(c, `O${r}`, o.mins);
  });
  qn(c, 12, 8); text(c, "D8", "Paste your chart into the Charts sheet");
  table(c, "D11", "Table 7");
  CUIS.forEach((k, i) => label(c, `${"EFG"[i]}12`, k)); label(c, "H12", "Total");
  label(c, "D13", "Student"); label(c, "D14", "Young professional"); label(c, "D15", "Established"); label(c, "D16", "Total");
  [13, 14, 15, 16, 17, 18, 19].forEach((n, i) => qn(c, n, 19 + 2 * i));

  const K = `$K$${T0}:$K$${T1}`, L = `$L$${T0}:$L$${T1}`, M = `$M$${T0}:$M$${T1}`;
  const t6: DPart[] = [];
  (["App", "Website"] as const).forEach((pl, ri) => {
    CUIS.forEach((cu, ci) => t6.push({
      label: `${pl}, ${cu}`, cell: `${"EFG"[ci]}${4 + ri}`, tone: "blue", answer: cnt((o) => o.platform === pl && o.cuisine === cu), tol: 0,
      formula: `=COUNTIFS(${K},"${pl}",${L},"${cu}")`,
      explain: ri === 0 && ci === 0 ? "COUNTIFS on two columns: platform and cuisine (absolute ranges so it fills across and down)." : `COUNTIFS: platform ${pl} and cuisine ${cu}.`,
    }));
    t6.push({ label: `${pl}, Total`, cell: `H${4 + ri}`, tone: "blue", answer: cnt((o) => o.platform === pl), tol: 0, formula: `=COUNTIF(${K},"${pl}")`, explain: `COUNTIF of ${pl} in the platform column (or SUM across the row).` });
  });
  CUIS.forEach((cu, ci) => t6.push({ label: `Total, ${cu}`, cell: `${"EFG"[ci]}6`, tone: "blue", answer: cnt((o) => o.cuisine === cu), tol: 0, formula: `=COUNTIF(${L},"${cu}")`, explain: `COUNTIF of ${cu} in the cuisine column (or SUM down the column).` }));
  t6.push({ label: "Total, Total", cell: "H6", tone: "blue", answer: N_ORD, tol: 0, formula: `=COUNTA(K${T0}:K${T1})`, explain: "All 800 orders (COUNTA, or the sum of the table)." });

  const nApp = cnt((o) => o.platform === "App"), nWeb = N_ORD - nApp;
  const nSushi = cnt((o) => o.cuisine === "Sushi"), nTacos = cnt((o) => o.cuisine === "Tacos");
  const webTacos = cnt((o) => o.platform === "Website" && o.cuisine === "Tacos");
  const nStu = cnt((o) => o.age <= 22), stuPizza = cnt((o) => o.age <= 22 && o.cuisine === "Pizza");
  const notStu = N_ORD - nStu, notStuST = cnt((o) => o.age > 22 && o.cuisine !== "Pizza");
  const z = (45 - 34) / 8;
  const pLate = 1 - normCdf(z);
  const pr = (label: string, cell: string, answer: number, formula: string, explain: string, traps?: { value: number; why: string }[]): DPart =>
    ({ label, cell, tone: "blue", answer, formula, explain, format: "prob", ...(traps ? { traps } : {}) });

  return {
    tab: "Empirical probability", title: "Empirical Probability and data handling",
    items: [
      { kind: "lead", text: "Table 5 contains a sample of orders taken from a food-delivery company showing the cuisine ordered by different customers and whether they ordered on the app or the website." },
      { kind: "lead", text: "In the following questions you are encouraged to use blank space in the spreadsheet to make full use of Excel’s functionality. Please however, do not alter the location of the answer cells." },
      { kind: "q", n: 11, text: "Complete the entries in Table 6 to show the number of app and website orders for each cuisine.", points: 3 },
      { kind: "q", n: 12, text: "Produce a single chart which appropriately displays the data presented in Table 6. Paste this image into the “Charts” sheet in the space provided.", points: 3 },
      { kind: "lead", text: "A customer is classed as: a student if their age is ≤22; or a young professional if their age is ≤34; or established if their age is >34." },
      { kind: "lead", text: "In the following questions you are to use the empirical probabilities implied by the sample. You are encouraged, but not required, to fill in Table 7." },
      { kind: "q", n: 13, text: "What is the probability an order is placed on the app?", points: 1 },
      { kind: "q", n: 14, text: "What is the probability an order is for sushi?", points: 1 },
      { kind: "q", n: 15, text: "What is the probability an order is for tacos given that it was placed on the website?", points: 1 },
      { kind: "q", n: 16, text: "What is the probability an order is for pizza given that the customer is a student?", points: 2 },
      { kind: "q", n: 17, text: "What is the probability that a customer who is not a student orders sushi or tacos?", points: 1 },
      { kind: "lead", text: "You are told that the delivery time of an order is normally distributed with mean 34 minutes and standard deviation 8 minutes." },
      { kind: "q", n: 18, text: "What is the probability an order takes more than 45 minutes to arrive?", points: 1 },
      { kind: "q", n: 19, text: "If you order a delivery 6 times this month, what is the probability that every one of them arrives within 45 minutes (assume each delivery is independent from the rest)?", points: 1 },
    ],
    cells: c,
    questions: [
      { n: 11, points: 3, lesson: 2, title: "Two-way table with COUNTIFS", parts: t6 },
      { n: 12, points: 3, lesson: 3, title: "Chart of the two-way table", parts: [],
        unmarked: "One clustered column (bar) chart of Table 6's counts without the totals: the three cuisines along the axis and one series each for app and website (or the other way round), with a chart title, axis titles and a legend. Not a pie chart: there are two groups to compare." },
      { n: 13, points: 1, lesson: 8, title: "Marginal probability (platform)", parts: [pr("Pr(app)", "D19", nApp / N_ORD, "=H4/H6", `App orders over all orders: ${nApp}/800.`)] },
      { n: 14, points: 1, lesson: 8, title: "Marginal probability (cuisine)", parts: [pr("Pr(sushi)", "D21", nSushi / N_ORD, "=F6/H6", `Sushi orders over all orders: ${nSushi}/800.`)] },
      { n: 15, points: 1, lesson: 8, title: "Conditional probability (given the platform)", parts: [pr("Pr(tacos | website)", "D23", webTacos / nWeb, "=G5/H5",
        `Given the website, the sample shrinks to the ${nWeb} website orders: ${webTacos}/${nWeb}.`,
        [{ value: webTacos / nTacos, why: "That is Pr(website | tacos): divide by the website total, not the tacos total." }, { value: webTacos / N_ORD, why: "That is Pr(website and tacos): divide by the website total." }])] },
      { n: 16, points: 2, lesson: 8, title: "Conditional probability (given an age band)", parts: [pr("Pr(pizza | student)", "D25", stuPizza / nStu,
        `=COUNTIFS(${L},"Pizza",${M},"<=22")/COUNTIF(${M},"<=22")`,
        `Classify each age (VLOOKUP on a band table 0 / 23 / 35, or IF), then pizza students over all students: ${stuPizza}/${nStu}. COUNTIFS with "<=22" on the ages gives the same.`,
        [{ value: stuPizza / cnt((o) => o.cuisine === "Pizza"), why: "That is Pr(student | pizza): divide by the number of students." }])] },
      { n: 17, points: 1, lesson: 8, title: "Not … or …", parts: [pr("Pr(sushi or tacos | not student)", "D27", notStuST / notStu,
        `=(COUNTIFS(${L},"Sushi",${M},">22")+COUNTIFS(${L},"Tacos",${M},">22"))/COUNTIF(${M},">22")`,
        `Given not a student, keep the ${notStu} young professionals and established customers; ${notStuST} of them ordered sushi or tacos (from Table 7: SUM of the sushi and tacos counts in those two rows over their totals).`,
        [{ value: (nSushi + nTacos) / N_ORD, why: "That is Pr(sushi or tacos) for everyone: the question only asks about customers who are not students." }])] },
      { n: 18, points: 1, lesson: 10, title: "Normal probability", parts: [pr("Pr(delivery > 45)", "D29", pLate, "=1-NORM.DIST(45,34,8,TRUE)",
        "NORM.DIST gives the area to the left of 45, so more than 45 minutes is 1 minus it.",
        [{ value: 1 - pLate, why: "That is Pr(less than 45): more than 45 is 1 − NORM.DIST(…)." }])] },
      { n: 19, points: 1, lesson: 11, title: "Independence: all of n", parts: [pr("Pr(all 6 within 45)", "D31", (1 - pLate) ** 6, "=(1-D29)^6",
        "Each delivery is within 45 minutes with probability 1 − Pr(> 45); independent, so multiply: (1 − p)^6.",
        [{ value: 1 - pLate ** 6, why: "Raised the wrong probability: each delivery must be within 45, so (1 − p)^6." }, { value: 6 * (1 - pLate), why: "Added instead of multiplied: for independent events 'all of them' multiplies." }])] },
    ],
  };
})();

// ---------------------------------------------------------------- 4. Charts
const charts: DSection = (() => {
  const c: Record<string, Cell> = {};
  qn(c, 3, 3); qn(c, 10, 16); qn(c, 12, 29);
  text(c, "K16", "Insert your comments here");
  return {
    tab: "Charts", title: "Charts",
    items: [
      { kind: "lead", text: "In this sheet please include your answers to questions 3, 10, and 12." },
    ],
    cells: c, questions: [],
  };
})();

export const DIAG_U1: DPaper = {
  id: "dx:u1",
  title: "Unit 1 diagnostic",
  header: "AQM1000, Fall 2026, Unit 1 diagnostic (AQM Prep)",
  file: "AQM-Unit-1-diagnostic",
  minutes: 60,
  instructions: [
    "This exam is 1 hour long.",
    "You are permitted to bring a single side of prepared handwritten notes on standard letter size paper.",
    "Your answers are to be inputted in the Excel file provided.",
    "No window other than the Excel file should be open on your screen for the duration of the exam.",
    "Answers should be inputted into the designated cells. Do not move the location of an answer cell in the spreadsheet.",
    "Do not rename sheets.",
    "Do not round numerical answers, leave them as exact as possible.",
    "Blue answer cells need to contain an Excel formula to receive credit.",
    "Paste your charts and histogram into the “Charts” sheet in the space provided.",
    "Failure to adhere to the above instructions will result in you losing points.",
  ],
  sections: [linear, rv, emp, charts],
};
