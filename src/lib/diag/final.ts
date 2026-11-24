// The final practice test: all three units, modelled on the Spring 2026 Final (Final.txt, S26_Final.md and
// his key "S26_Final, solutions.md"): the same eight sections, tabs, points, question types and order, with
// new scenarios and numbers (some contexts varied after F25_Final.md). 2 hours, 90 points.
//   1 Visualization [14]  2 Supply and demand [8]  3 Simulation [10]  4 The normal distribution [9]
//   5 Probability [21]  6 Confidence intervals [6]  7 Hypothesis testing [12]  8 Regression [10] (not taught yet: paper flagged beta)
import { qn, table, label, hint, data, col, DECISIONS, type DPaper, type DSection, type DPart, type Cell } from "./kit.ts";
import { mulberry32, gauss, round } from "../lessons/kit.ts";

// ---------- local helpers (independent of the site's formula engine) ----------
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const mean = (xs: number[]) => sum(xs) / xs.length;
const sdS = (xs: number[]) => { const m = mean(xs); return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1)); };
function erf(x: number): number {
  const ax = Math.abs(x);
  if (ax > 6) return Math.sign(x);
  let term = ax, s = ax;
  for (let n = 1; n < 2000; n++) { term *= (2 * ax * ax) / (2 * n + 1); s += term; if (term < 1e-17 * s) break; }
  return (Math.sign(x) * 2 / Math.sqrt(Math.PI)) * Math.exp(-ax * ax) * s;
}
const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
function PhiInv(p: number): number { let lo = -12, hi = 12; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (Phi(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; }
// Student t CDF by Simpson's rule on the density (accurate to ~1e-10 for the df used here).
function lgamma(z: number): number {
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1; let a = c[0]; const t = z + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}
function tCdf(t: number, df: number): number {
  const k = Math.exp(lgamma((df + 1) / 2) - lgamma(df / 2)) / Math.sqrt(df * Math.PI);
  const f = (x: number) => k * Math.pow(1 + (x * x) / df, -(df + 1) / 2);
  const a = 0, b = Math.abs(t), n = 4000, h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
  const half = (s * h) / 3;
  return t >= 0 ? 0.5 + half : 0.5 - half;
}
function tInv(p: number, df: number): number { let lo = -60, hi = 60; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (tCdf(m, df) < p) lo = m; else hi = m; } return (lo + hi) / 2; }
/** Excel's ROUND(x, 0): halves go away from zero. */
const xround = (x: number) => Math.sign(x) * Math.round(Math.abs(x));
const R = DECISIONS[0], DR = DECISIONS[1];
const dec = (reject: boolean) => (reject ? R : DR);
const ID = ["I", "D"];

// =====================================================================================================
// 1. Visualization [14]  (S26 Final §1: a % column and three charts)
// =====================================================================================================
const HOSP = ["Riverside", "Lakeview", "Hillcrest", "Bayfront"];
const YEARS = [2019, 2020, 2021, 2022, 2023, 2024];
const viz: DSection = (() => {
  const rng = mulberry32(20261201);
  const c: Record<string, Cell> = {};
  const parts: DPart[] = [];
  qn(c, 1, 3); table(c, "C3", "Table 1"); table(c, "C4", "Year");
  col(c, "C", 5, YEARS);
  const base = [38.4, 52.1, 24.7, 61.3], rate = [0.142, 0.171, 0.118, 0.156], trend = [-0.004, 0.003, 0.006, -0.002];
  HOSP.forEach((h, j) => {
    const L = (k: number) => String.fromCharCode(68 + 3 * j + k); // D,E,F | G,H,I | J,K,L | M,N,O
    table(c, `${L(0)}4`, h);
    YEARS.forEach((y, i) => {
      const covid = y === 2020 ? 0.88 : y === 2021 ? 0.95 : 1;
      const adm = round(base[j] * (1 + 0.021 * i) * covid * (1 + 0.025 * gauss(rng)), 2);
      const re = round(adm * (rate[j] + trend[j] * i + (y === 2020 ? 0.011 : 0)) * (1 + 0.04 * gauss(rng)), 2);
      const r = 5 + i;
      data(c, `${L(0)}${r}`, adm); data(c, `${L(1)}${r}`, re);
      const v = re / adm;
      parts.push({
        label: `${h} ${y}: readmissions as a % of admissions`, cell: `${L(2)}${r}`, tone: "blue", answer: v, tol: 0.0005, alts: [100 * v],
        formula: `=${L(1)}${r}/${L(0)}${r}`,
        explain: `Readmitted ÷ admitted = ${re} / ${adm} (his key leaves it as a decimal, e.g. 0.15 = 15%; ×100 is accepted too).`,
      });
    });
  });
  qn(c, 2, 13); hint(c, "C13", "Insert the chart for Question 2 here.");
  // Table 2: online and in-store sales by category (thousands of units)
  const CATS = ["Electronics", "Home and kitchen", "Clothing", "Shoes", "Toys and games", "Books", "Beauty and personal care", "Sports and outdoors", "Groceries", "Garden", "Office supplies", "Pet supplies"];
  const online = [412, 268, 535, 197, 236, 318, 289, 174, 143, 61, 122, 207];
  const store = [298, 341, 486, 233, 158, 96, 367, 205, 1184, 152, 87, 239];
  table(c, "C33", "Table 2"); table(c, "D34", "Online", "center"); table(c, "E34", "In store", "center");
  col(c, "C", 35, CATS, "left"); col(c, "D", 35, online); col(c, "E", 35, store);
  qn(c, 3, 48); hint(c, "C48", "Insert the chart for Question 3 here.");
  // Table 3: temperature and iced coffees sold on 100 days
  table(c, "C67", "Table 3"); table(c, "C68", "Day"); table(c, "D68", "Temperature"); table(c, "E68", "Iced coffees");
  for (let i = 0; i < 100; i++) {
    const t = 48 + Math.floor(rng() * 49);
    const s = Math.max(0, Math.round(-95 + 3.4 * t + 22 * gauss(rng)));
    data(c, `C${69 + i}`, i + 1); data(c, `D${69 + i}`, t); data(c, `E${69 + i}`, s);
  }
  qn(c, 4, 170); hint(c, "C170", "Insert the chart for Question 4 here.");
  return {
    tab: "Visualization", title: "Visualization",
    items: [
      { kind: "lead", text: "Table 1 shows data for four hospitals for the years 2019—2024. For each hospital the first column shows the number of patients admitted and the second shows the number of patients readmitted within 30 days of leaving, both in thousands." },
      { kind: "q", n: 1, text: "Complete the third column for each hospital which shows the readmissions as a percentage of admissions.", points: 3 },
      { kind: "q", n: 2, text: "Insert an appropriate chart in the space provided which shows the readmissions as a percentage of admissions for each of the hospitals from 2019 to 2024.", points: 5 },
      { kind: "lead", text: "Table 2 shows the number of units (in thousands) a retailer sold online and in store in 2025 by product category." },
      { kind: "q", n: 3, text: "Insert an appropriate chart in the space provided which displays the data in Table 2.", points: 3 },
      { kind: "lead", text: "Table 3 shows the highest temperature (°F) and the number of iced coffees a café sold on 100 days." },
      { kind: "q", n: 4, text: "Insert an appropriate chart in the space provided which shows how iced coffee sales depend on temperature.", points: 3 },
    ],
    cells: c,
    widths: { 2: 24 },
    questions: [
      { n: 1, points: 3, lesson: 2, title: "Readmissions as a percentage of admissions", parts },
      { n: 2, points: 5, lesson: 3, title: "Line chart of the percentages", parts: [], unmarked: "A line chart (years 2019–2024 on the horizontal axis, one line per hospital, 4 lines) of the percentage column only, with a title, axis titles and a legend naming the hospitals. Not a bar chart of the raw numbers." },
      { n: 3, points: 3, lesson: 3, title: "Chart of two groups by category", parts: [], unmarked: "A clustered column or bar chart: the 12 categories on the category axis, two bars each (Online and In store), legend, title and axis title (thousands of units). Not a pie chart (two series) and not a line chart (categories have no order)." },
      { n: 4, points: 3, lesson: 3, title: "Scatter chart of sales against temperature", parts: [], unmarked: "A scatter (XY) chart with temperature on the horizontal axis (the variable sales depend on) and iced coffees on the vertical axis, markers only, no lines, axis titles and a title. It should show sales rising with temperature." },
    ],
  };
})();

// =====================================================================================================
// 2. Supply and demand [8]  (S26 Final §2)
// =====================================================================================================
const sd: DSection = (() => {
  const c: Record<string, Cell> = {};
  qn(c, 5, 3); label(c, "C3", "Supply y-intercept"); label(c, "C5", "Supply slope"); label(c, "C7", "Demand y-intercept"); label(c, "C9", "Demand slope");
  qn(c, 6, 12); label(c, "C12", "Equilibrium price"); label(c, "C14", "Demand at equilibrium");
  // $25: supply 150, demand 1300.  $100: supply 750, demand 400.
  const sm = (750 - 150) / (100 - 25), sb = 150 - 25 * sm, dm = (400 - 1300) / (100 - 25), db = 1300 - 25 * dm;
  const pe = (db - sb) / (sm - dm), qe = db + dm * pe;
  return {
    tab: "Supply and demand", title: "Supply and demand",
    items: [
      { kind: "lead", text: "When a product is sold at $25 the supply is 150 units and the demand is 1300 units. When the product is sold at $100 the supply increases to 750 units and the demand falls to 400 units." },
      { kind: "q", n: 5, text: "Assuming a linear model for supply and demand in terms of price, find the y-intercept and slope for the supply and demand equations.", points: 4 },
      { kind: "q", n: 6, text: "Using your answers from the previous question, find the equilibrium price for the product and the demand at equilibrium.", points: 4 },
    ],
    cells: c, widths: { 2: 22 },
    questions: [
      { n: 5, points: 4, lesson: 8, title: "Supply and demand lines from two prices", parts: [
        { label: "Supply y-intercept", cell: "D3", tone: "blue", answer: sb, formula: "=150-25*D5", explain: "Supply = intercept + slope × price passes through (25, 150): 150 − 25 × 8 = −50.", traps: [{ value: 150, why: "Gave the supply at $25, not at a price of $0." }] },
        { label: "Supply slope", cell: "D5", tone: "blue", answer: sm, formula: "=(750-150)/(100-25)", explain: "Rise over run: (750 − 150)/(100 − 25) = 600/75 = 8 units per dollar.", traps: [{ value: 1 / sm, why: "Divided price by quantity; the slope is change in quantity over change in price." }] },
        { label: "Demand y-intercept", cell: "D7", tone: "blue", answer: db, formula: "=1300-25*D9", explain: "Through (25, 1300) with slope −12: 1300 + 25 × 12 = 1600." },
        { label: "Demand slope", cell: "D9", tone: "blue", answer: dm, formula: "=(400-1300)/(100-25)", explain: "(400 − 1300)/(100 − 25) = −900/75 = −12: demand falls as price rises.", traps: [{ value: -dm, why: "Lost the minus sign: demand falls as price rises." }] },
      ] },
      { n: 6, points: 4, lesson: 8, title: "Equilibrium price and quantity", parts: [
        { label: "Equilibrium price", cell: "D12", tone: "blue", answer: pe, formula: "=(D7-D3)/(D5-D9)", explain: "Set supply = demand: −50 + 8P = 1600 − 12P, so P = 1650/20 = $82.50.", traps: [{ value: (db + sb) / (sm - dm), why: "Added the intercepts; subtract them: P = (b_D − b_S)/(m_S − m_D)." }] },
        { label: "Demand at equilibrium", cell: "D14", tone: "blue", answer: qe, formula: "=D7+D12*D9", explain: "Demand at P = 82.5: 1600 − 12 × 82.5 = 610 (supply gives the same, −50 + 8 × 82.5).", traps: [{ value: pe, why: "Gave the price again; this is the quantity at that price." }] },
      ] },
    ],
  };
})();

// =====================================================================================================
// 3. Simulation [10]  (S26 Final §3: inventory and restocking, =MAX(0,ROUND(x,0)), two policies)
// =====================================================================================================
// An e-bike shop: price $1800, storage $30 per bike in stock per week, $400 lost per customer turned away,
// 2 bikes in stock at the start, restock 2 (Table 4) or 3 (Table 5) bikes a week, demand ~ N(4.5, 2).
export const SIM = { price: 1800, hold: 30, short: 400, start: 2, restock: [2, 3] as const, mu: 4.5, sd: 2, rows: 100, given: [5.6, 0.8, 1.7] };
// Q10 bands (lo, hi for restocking 2, then 3) and the typical values; see the numpy check in the report.
const BAND10 = [2195, 2905, 4335, 5020] as const, ABOUT10 = [2550, 4680] as const;
const FIRST = 6; // trials in rows 6..105
/** One run of both tables from 100 random numbers (the first three are the given ones). */
export function simRun(xs: number[]) {
  return SIM.restock.map((rs) => {
    const rows: { x: number; d: number; e: number; f: number; g: number; h: number; i: number; j: number; k: number }[] = [];
    xs.forEach((x, t) => {
      const d = Math.max(0, xround(x));
      const e = t === 0 ? SIM.start : rs + (rows[t - 1].e - rows[t - 1].f);
      const f = Math.min(d, e), g = d - f;
      const h = SIM.price * f, i = SIM.hold * e, j = SIM.short * g;
      rows.push({ x, d, e, f, g, h, i, j, k: h - i - j });
    });
    return rows;
  });
}
const sim: DSection = (() => {
  const rng = mulberry32(20261203);
  const xs: number[] = [...SIM.given];
  while (xs.length < SIM.rows) {
    let x = round(SIM.mu + SIM.sd * gauss(rng), 6);
    if (Math.abs(Math.abs(x % 1) - 0.5) < 1e-9) x = round(x + 0.000001, 6);
    xs.push(x);
  }
  const [t4, t5] = simRun(xs);
  const c: Record<string, Cell> = {};
  hint(c, "B2", "Questions 7, 8 and 9: fill in Tables 4 and 5. The first 3 weeks have been completed for you.");
  table(c, "B4", "Table 4: Restock 2 e-bikes per week"); table(c, "M4", "Table 5: Restock 3 e-bikes per week");
  const HEAD = ["Trial", "Random number", "Simulated demand", "Inventory", "Units sold", "Shortage", "Revenue", "Inventory cost", "Shortage cost", "Net revenue"];
  const L4 = "BCDEFGHIJK".split(""), L5 = "MNOPQRSTUV".split("");
  HEAD.forEach((h, k) => { table(c, `${L4[k]}5`, h, "center"); table(c, `${L5[k]}5`, h, "center"); });
  // Marked cells (the parts) stay out of `cells` and `example`.
  const marked = new Set(["D105", "O105", "K8", "V8", "E9", "P9", "E30", "E55", "E80", "E105", "P30", "P55", "P80", "P105", "G105", "K105", "R105", "V105"]);
  const example: Record<string, Cell> = {};
  const blue = (a: string) => { if (!marked.has(a)) c[a] = { role: "answer", tone: "blue" }; };
  [[L4, t4, 2], [L5, t5, 3]].forEach(([L, rows, rs]) => {
    const Ls = L as string[], tb = rows as ReturnType<typeof simRun>[0], restock = rs as number;
    tb.forEach((w, t) => {
      const r = FIRST + t;
      const A = (k: number) => `${Ls[k]}${r}`;
      data(c, A(0), t + 1);
      const fs: [number, string, number][] = [
        [2, `=MAX(0,ROUND(${A(1)},0))`, w.d],
        [3, `=${restock}+(${Ls[3]}${r - 1}-${Ls[4]}${r - 1})`, w.e],
        [4, `=MIN(${A(2)},${A(3)})`, w.f],
        [5, `=${A(2)}-${A(4)}`, w.g],
        [6, `=${SIM.price}*${A(4)}`, w.h],
        [7, `=${SIM.hold}*${A(3)}`, w.i],
        [8, `=${SIM.short}*${A(5)}`, w.j],
        [9, `=${A(6)}-${A(7)}-${A(8)}`, w.k],
      ];
      if (t < 3) {
        // The first three weeks are given (random number, demand, inventory, units sold, shortage), as on his paper.
        data(c, A(1), w.x); data(c, A(2), w.d); data(c, A(3), w.e); data(c, A(4), w.f); data(c, A(5), w.g);
        for (const [k, f, v] of fs.slice(4)) { blue(A(k)); if (!marked.has(A(k))) example[A(k)] = { role: "answer", tone: "blue", f, v }; }
      } else {
        c[A(1)] = { role: "answer", tone: "purple" };
        example[A(1)] = { role: "answer", tone: "purple", v: w.x };
        for (const [k, f, v] of fs) { blue(A(k)); if (!marked.has(A(k))) example[A(k)] = { role: "answer", tone: "blue", f, v }; }
      }
    });
  });
  qn(c, 7, 107);
  label(c, "D107", "Mean of your 97 simulated numbers"); label(c, "D108", "Standard deviation of your 97 simulated numbers");
  label(c, "O107", "Mean of your 97 simulated numbers"); label(c, "O108", "Standard deviation of your 97 simulated numbers");
  qn(c, 10, 110); label(c, "D110", "Average weekly net revenue restocking two e-bikes a week"); label(c, "D112", "Average weekly net revenue restocking three e-bikes a week");
  qn(c, 11, 115); label(c, "C115", "Histogram for restocking two e-bikes"); label(c, "L115", "Histogram for restocking three e-bikes");
  const sims = xs.slice(3);
  const last4 = t4[SIM.rows - 1], last5 = t5[SIM.rows - 1];
  // Live parts are only marked once the student's own 97 random numbers are in (a blank or constant column
  // gives −999999, outside every band), so filled-down formulas on an empty column score nothing.
  const gate = (L: string, inner: string) => `=IF(AND(COUNT(${L}9:${L}105)=97,STDEV.S(${L}9:${L}105)>1),${inner},-999999)`;
  const GATE = " (The IF only checks that your 97 random numbers are in: without them this part can't be marked.)";
  const k1 = (r: number, L: string[]) => `${SIM.price}*MIN(${L[2]}${r},${L[3]}${r})-${SIM.hold}*${L[3]}${r}-${SIM.short}*(${L[2]}${r}-MIN(${L[2]}${r},${L[3]}${r}))`;
  const avg4 = mean(t4.map((w) => w.k)), avg5 = mean(t5.map((w) => w.k));
  const inv = (tb: typeof t4, L: string[], rs: number, week: number): DPart => {
    const r = FIRST + week - 1;
    return { label: `Table ${rs === 2 ? 4 : 5}, week ${week}: inventory`, cell: `${L[3]}${r}`, tone: "blue", live: true, band: [rs, 40], answer: tb[week - 1].e, tol: 0,
      formula: gate(L[1], `${rs}+(${L[3]}${r - 1}-${L[4]}${r - 1})`), explain: `This week's stock = the ${rs} restocked + last week's leftover (inventory − units sold), as in his key =1+(E8-F8).${GATE}` };
  };
  return {
    tab: "Simulation", title: "Simulation",
    items: [
      { kind: "lead", text: "A shop sells e-bikes. It costs $30 to store a single e-bike in inventory per week. E-bikes are sold to customers for $1800. The shop incurs a loss of $400 if there is a customer but no e-bike in stock." },
      { kind: "lead", text: "The shop initially has 2 e-bikes in its inventory and wants to decide whether to restock 2 or 3 e-bikes per week. The number of customers per week is modelled as a random variable which is normally distributed with mean 4.5 and standard deviation 2." },
      { kind: "q", n: 7, text: "Use the random number generator to simulate the demand for 97 weeks and insert your answer into the second column of Tables 4 and 5. Underneath each table give the mean and standard deviation of your 97 simulated numbers.", points: 2 },
      { kind: "lead", text: "It is unrealistic to have a decimal number of customers or a negative number of customers. Therefore:" },
      { kind: "q", n: 8, text: "In the third column of Tables 4 and 5 use the Excel formula =MAX(0,ROUND(simulated_number,0)) to change your simulated numbers to realistic numbers.", points: 1 },
      { kind: "q", n: 9, text: "Complete the remaining entries in Tables 4 and 5. Note that the first 3 weeks have been completed for you.", points: 4 },
      { kind: "q", n: 10, text: "Find the average weekly net revenue for the simulations.", points: 1 },
      { kind: "q", n: 11, text: "For both simulations produce a histogram of weekly net revenues using the Data Analysis Toolpak and insert them in the space provided (underneath Tables 4 and 5). Your histograms should have between 20 and 40 evenly spaced bins.", points: 2 },
    ],
    cells: c, example,
    widths: { 2: 10, 3: 11, 13: 10, 14: 11 },
    questions: [
      // Bands: the 97 draws of a correct simulation, 1,000,000 numpy runs: mean 4.5 ± 0.203, SD 2 ± 0.144;
      // [3.6, 5.4] and [1.35, 2.65] held all but 9 and 6 of the 1,000,000 runs.
      { n: 7, points: 2, lesson: 11, title: "Simulate the weekly demand", parts: [
        { label: "Table 4: mean of the 97 simulated numbers", cell: "H107", tone: "blue", live: true, band: [3.6, 5.4], answer: mean(sims), formula: "=AVERAGE(C9:C105)", explain: "AVERAGE of your 97 values from Data → Data Analysis → Random Number Generation (Normal, mean 4.5, standard deviation 2): about 4.5." },
        { label: "Table 4: standard deviation of the 97 simulated numbers", cell: "H108", tone: "blue", live: true, band: [1.35, 2.65], answer: sdS(sims), formula: "=STDEV.S(C9:C105)", explain: "STDEV.S of your 97 simulated values: about 2. Far from 2 means the generator's settings were wrong (e.g. variance 4 typed as the standard deviation)." },
        { label: "Table 5: mean of the 97 simulated numbers", cell: "S107", tone: "blue", live: true, band: [3.6, 5.4], answer: mean(sims), formula: "=AVERAGE(N9:N105)", explain: "Table 5 uses the same 97 random numbers as Table 4, so the same mean (about 4.5)." },
        { label: "Table 5: standard deviation of the 97 simulated numbers", cell: "S108", tone: "blue", live: true, band: [1.35, 2.65], answer: sdS(sims), formula: "=STDEV.S(N9:N105)", explain: "STDEV.S of the same 97 values: about 2." },
      ] },
      { n: 8, points: 1, lesson: 11, title: "Realistic demand with MAX and ROUND", parts: [
        { label: "Table 4, week 100: simulated demand", cell: "D105", tone: "blue", live: true, band: [0, 20], answer: last4.d, tol: 0, formula: gate("C", "MAX(0,ROUND(C105,0))"), explain: `=MAX(0,ROUND(C105,0)) on your own random number: round to a whole customer and never below 0.${GATE}` },
        { label: "Table 5, week 100: simulated demand", cell: "O105", tone: "blue", live: true, band: [0, 20], answer: last5.d, tol: 0, formula: gate("N", "MAX(0,ROUND(N105,0))"), explain: `The same formula in Table 5, on the same random number.${GATE}` },
      ] },
      { n: 9, points: 4, lesson: 11, title: "Complete the inventory tables", parts: [
        { label: "Table 4, week 3: net revenue", cell: "K8", tone: "blue", answer: t4[2].k, formula: "=H8-I8-J8", explain: `Revenue − inventory cost − shortage cost = 1800 × ${t4[2].f} − 30 × ${t4[2].e} − 400 × ${t4[2].g} = ${t4[2].k}.`, traps: [{ value: SIM.price * t4[2].f - SIM.hold * t4[2].f - SIM.short * t4[2].g, why: "Charged storage on the units sold; the inventory cost is on all the stock held that week." }] },
        { label: "Table 5, week 3: net revenue", cell: "V8", tone: "blue", answer: t5[2].k, formula: "=S8-T8-U8", explain: `1800 × ${t5[2].f} − 30 × ${t5[2].e} − 400 × ${t5[2].g} = ${t5[2].k}.` },
        { label: "Table 4, week 4: inventory", cell: "E9", tone: "blue", answer: t4[3].e, tol: 0, formula: "=2+(E8-F8)", explain: `2 restocked + the ${t4[2].e - t4[2].f} left over from week 3 (inventory ${t4[2].e} − sold ${t4[2].f}) = ${t4[3].e}.`, traps: [{ value: 2, why: "Forgot last week's leftover stock: inventory = restock + (last inventory − last units sold)." }] },
        { label: "Table 5, week 4: inventory", cell: "P9", tone: "blue", answer: t5[3].e, tol: 0, formula: "=3+(P8-Q8)", explain: `3 restocked + the ${t5[2].e - t5[2].f} left over from week 3 (inventory ${t5[2].e} − sold ${t5[2].f}) = ${t5[3].e}.`, traps: [{ value: 3, why: "Forgot last week's leftover stock: inventory = restock + (last inventory − last units sold)." }] },
        inv(t4, L4, 2, 25), inv(t4, L4, 2, 50), inv(t4, L4, 2, 75), inv(t4, L4, 2, 100),
        inv(t5, L5, 3, 25), inv(t5, L5, 3, 50), inv(t5, L5, 3, 75), inv(t5, L5, 3, 100),
        { label: "Table 4, week 100: shortage", cell: "G105", tone: "blue", live: true, band: [0, 20], answer: last4.g, tol: 0, formula: gate("C", "D105-MIN(D105,E105)"), explain: `Customers turned away = demand − units sold, where units sold = MIN(demand, inventory).${GATE}` },
        { label: "Table 4, week 100: net revenue", cell: "K105", tone: "blue", live: true, band: [-20000, 40000], answer: last4.k, formula: gate("C", k1(105, L4)), explain: `1800 × units sold − 30 × inventory − 400 × shortage, from your demand and inventory for that week.${GATE}` },
        { label: "Table 5, week 100: shortage", cell: "R105", tone: "blue", live: true, band: [0, 20], answer: last5.g, tol: 0, formula: gate("N", "O105-MIN(O105,P105)"), explain: `Demand − units sold, where units sold = MIN(demand, inventory).${GATE}` },
        { label: "Table 5, week 100: net revenue", cell: "V105", tone: "blue", live: true, band: [-20000, 40000], answer: last5.k, formula: gate("N", k1(105, L5)), explain: `1800 × units sold − 30 × inventory − 400 × shortage, from your demand and inventory for that week.${GATE}` },
      ] },
      { n: 10, points: 1, lesson: 11, title: "Average weekly net revenue", parts: [
        // Bands: mean ± 4.5 SD of the average over 400,000 numpy runs (first three weeks fixed): 2549 ± 78 and 4678 ± 75.
        { label: "Average weekly net revenue, restocking 2", cell: "J110", tone: "blue", live: true, band: [BAND10[0], BAND10[1]], answer: avg4, formula: "=AVERAGE(K6:K105)", explain: `AVERAGE of the whole Net revenue column of Table 4, including the 3 given weeks (about ${ABOUT10[0]} for a correct simulation).` },
        { label: "Average weekly net revenue, restocking 3", cell: "J112", tone: "blue", live: true, band: [BAND10[2], BAND10[3]], answer: avg5, formula: "=AVERAGE(V6:V105)", explain: `AVERAGE of the Net revenue column of Table 5 (about ${ABOUT10[1]} for a correct simulation): restocking 3 a week earns more.` },
      ] },
      { n: 11, points: 2, lesson: 6, title: "Histograms of net revenue", parts: [], unmarked: "Two Toolpak histograms (Data Analysis → Histogram) of the Net revenue columns, each with a bin range you typed of 20–40 evenly spaced values from just below the MIN to just above the MAX (e.g. steps of 200), output placed under Tables 4 and 5 with the chart output ticked." },
    ],
  };
})();

// =====================================================================================================
// 4. The normal distribution [9]  (S26 Final §4)
// =====================================================================================================
const normal: DSection = (() => {
  const c: Record<string, Cell> = {};
  for (let n = 12; n <= 20; n++) qn(c, n, 3 + 2 * (n - 12));
  label(c, "D3", "mean"); c.E3 = { v: 340, role: "given" }; label(c, "D4", "standard deviation"); c.E4 = { v: 6, role: "given" };
  label(c, "D13", "mean"); c.E13 = { v: 4, role: "given" }; label(c, "D14", "standard deviation"); c.E14 = { v: 2.5, role: "given" };
  const N = (x: number) => Phi((x - 340) / 6), S = (x: number) => Phi((x - 4) / 2.5);
  const p17 = S(0);
  return {
    tab: "Normal distribution", title: "The normal distribution",
    items: [
      { kind: "lead", text: "The amount of coffee a machine puts into a bag is normally distributed with mean 340g and standard deviation 6g." },
      { kind: "q", n: 12, text: "What is the probability that a bag will have less than 330g?", points: 1 },
      { kind: "q", n: 13, text: "A bag cannot be sealed if it contains more than 352g. What is the probability that a filled bag cannot be sealed?", points: 1 },
      { kind: "q", n: 14, text: "What is the probability that a bag will have between 335g and 348g?", points: 1 },
      { kind: "q", n: 15, text: "Under what amount are 90 percent of bags less than?", points: 1 },
      { kind: "q", n: 16, text: "Maria buys 5 bags. Each bag is independent from the others. What is the probability that all 5 bags are within two standard deviations from 340g?", points: 1 },
      { kind: "lead", text: "The number of hours a student spends on their phone each day is approximately normally distributed with mean 4 and standard deviation 2.5." },
      { kind: "q", n: 17, text: "What is the probability that a student spends a negative amount of time on their phone? I.e. the probability that the number of hours is less than zero.", points: 1 },
      { kind: "q", n: 18, text: "What is the value of x for which 80% of phone times are between 4−x and 4+x hours?", points: 1 },
      { kind: "lead", text: "Suppose we record the phone time of 12 students on one day. The time each student spends is independent from anyone else." },
      { kind: "q", n: 19, text: "What is the probability all 12 students spend fewer than 6 hours on their phones?", points: 1 },
      { kind: "q", n: 20, text: "What is the probability that at least one of the 12 students has a negative phone time that day?", points: 1 },
    ],
    cells: c, widths: { 3: 18 },
    questions: [
      { n: 12, points: 1, lesson: 10, title: "Probability below a value", parts: [{ label: "Pr(X < 330)", cell: "C3", tone: "blue", format: "prob", answer: N(330), formula: "=NORM.DIST(330,E3,E4,TRUE)", explain: "Left tail: NORM.DIST(330, 340, 6, TRUE).", traps: [{ value: 1 - N(330), why: "Took the right tail; 'less than' is the left tail." }] }] },
      { n: 13, points: 1, lesson: 10, title: "Probability above a value", parts: [{ label: "Pr(X > 352)", cell: "C5", tone: "blue", format: "prob", answer: 1 - N(352), formula: "=1-NORM.DIST(352,E3,E4,TRUE)", explain: "Right tail: 1 − NORM.DIST(352, 340, 6, TRUE).", traps: [{ value: N(352), why: "Gave Pr(X < 352); 'more than' needs 1 − NORM.DIST." }] }] },
      { n: 14, points: 1, lesson: 10, title: "Probability between two values", parts: [{ label: "Pr(335 < X < 348)", cell: "C7", tone: "blue", format: "prob", answer: N(348) - N(335), formula: "=NORM.DIST(348,E3,E4,TRUE)-NORM.DIST(335,E3,E4,TRUE)", explain: "Pr(X < 348) − Pr(X < 335)." }] },
      { n: 15, points: 1, lesson: 10, title: "The 90th percentile", parts: [{ label: "90th percentile", cell: "C9", tone: "blue", answer: 340 + 6 * PhiInv(0.9), formula: "=NORM.INV(0.9,E3,E4)", explain: "NORM.INV(0.9, 340, 6): 90% of bags are below it.", traps: [{ value: 340 + 6 * PhiInv(0.1), why: "Used 0.1; 90% below means NORM.INV(0.9, …)." }] }] },
      { n: 16, points: 1, lesson: 11, title: "Independence: all five within 2 SD", parts: [{ label: "Pr(all 5 within 2σ)", cell: "C11", tone: "blue", format: "prob", answer: (Phi(2) - Phi(-2)) ** 5, formula: "=(NORM.S.DIST(2,TRUE)-NORM.S.DIST(-2,TRUE))^5", explain: "Within two SD of the mean has probability Φ(2) − Φ(−2) ≈ 0.9545 for each bag; independent, so raise it to the 5th power.", traps: [{ value: Phi(2) - Phi(-2), why: "That's one bag; for all 5 independent bags raise it to the power 5." }] }] },
      { n: 17, points: 1, lesson: 10, title: "Probability of a negative value", parts: [{ label: "Pr(X < 0)", cell: "C13", tone: "blue", format: "prob", answer: p17, formula: "=NORM.DIST(0,E13,E14,TRUE)", explain: "NORM.DIST(0, 4, 2.5, TRUE): the normal model puts some probability below zero." }] },
      { n: 18, points: 1, lesson: 10, title: "Symmetric interval around the mean", parts: [{ label: "x", cell: "C15", tone: "blue", answer: 2.5 * PhiInv(0.9), formula: "=NORM.INV(0.9,4,2.5)-4", explain: "80% in the middle leaves 10% in each tail, so 4 + x is the 90th percentile: NORM.INV(0.9, 4, 2.5) − 4.", traps: [{ value: 2.5 * PhiInv(0.8), why: "Used 0.8; the middle 80% leaves 10% in each tail, so use 0.9." }] }] },
      { n: 19, points: 1, lesson: 11, title: "Independence: all twelve below 6", parts: [{ label: "Pr(all 12 < 6)", cell: "C17", tone: "blue", format: "prob", answer: S(6) ** 12, formula: "=NORM.DIST(6,4,2.5,TRUE)^12", explain: "Each student: NORM.DIST(6, 4, 2.5, TRUE); independent, so multiply 12 times." }] },
      { n: 20, points: 1, lesson: 11, title: "At least one of twelve", parts: [{ label: "Pr(at least one < 0)", cell: "C19", tone: "blue", format: "prob", answer: 1 - (1 - p17) ** 12, formula: "=1-(1-C13)^12", explain: "1 − Pr(none of the 12 is negative) = 1 − (1 − Pr(X < 0))^12.", traps: [{ value: 12 * p17, why: "Multiplied by 12; use 1 − Pr(none)." }, { value: p17 ** 12, why: "That's all 12 negative; at least one is 1 − (1 − p)^12." }] }] },
    ],
  };
})();

// =====================================================================================================
// 5. Probability [21]  (S26 Final §5: a game of chance, I/D table, two-dice sum, piecewise-linear pdf)
// =====================================================================================================
const prob: DSection = (() => {
  const c: Record<string, Cell> = {};
  qn(c, 21, 3); hint(c, "E3", "Keep your answers exact as possible. Do not round.");
  qn(c, 22, 5); qn(c, 23, 7); qn(c, 24, 9);
  qn(c, 25, 11); table(c, "C11", "Table 6"); hint(c, "H11", "Just write I or D in the pink cells only");
  ["H", "F", "E"].forEach((e, k) => { table(c, `${"DEF"[k]}12`, e, "center"); table(c, `C${13 + k}`, e, "center"); });
  // Two dice: a dodecahedral die (rows, 1–12) and a standard die (columns, 1–6).
  const DC = "DEFGHI";
  qn(c, 26, 18); table(c, "C18", "Table 7");
  for (let j = 1; j <= 6; j++) c[`${DC[j - 1]}19`] = { v: j, role: "header", align: "center" };
  for (let i = 1; i <= 12; i++) c[`C${19 + i}`] = { v: i, role: "header", align: "center" };
  qn(c, 27, 33); table(c, "C34", "Table 8"); table(c, "C35", "x", "center"); table(c, "D35", "Pr(X=x)", "center");
  qn(c, 28, 54); label(c, "C54", "Expectation of X"); label(c, "C56", "Variance of X"); hint(c, "G54", "Keep your answers exact as possible. Do not round.");
  qn(c, 29, 58); qn(c, 30, 60); label(c, "C60", "y-intercept"); label(c, "C62", "slope"); qn(c, 31, 64);
  const sumParts: DPart[] = [];
  for (let i = 1; i <= 12; i++) for (let j = 1; j <= 6; j++) {
    const L = DC[j - 1];
    sumParts.push({ label: `Sum: 12-sided die ${i}, 6-sided die ${j}`, cell: `${L}${19 + i}`, tone: "blue", answer: i + j, tol: 0, formula: `=$C${19 + i}+${L}$19`, explain: "Row value + column value, e.g. =$C20+D$19 filled across and down." });
  }
  const xs = Array.from({ length: 17 }, (_, k) => k + 2); // 2..18
  const pr = (x: number) => { let n = 0; for (let i = 1; i <= 12; i++) for (let j = 1; j <= 6; j++) if (i + j === x) n++; return n / 72; };
  const distParts: DPart[] = [];
  xs.forEach((x, k) => distParts.push({ label: `x in row ${k + 1}`, cell: `C${36 + k}`, tone: "pink", answer: x, tol: 0, formula: `=${x}`, explain: "The possible sums run from 1 + 1 = 2 to 12 + 6 = 18." }));
  xs.forEach((x, k) => distParts.push({ label: `Pr(X = ${x})`, cell: `D${36 + k}`, tone: "blue", format: "prob", answer: pr(x), tol: 1e-6, formula: `=COUNTIF($D$20:$I$31,C${36 + k})/72`, explain: `Count the sums equal to ${x} in Table 7 and divide by the 12 × 6 = 72 equally likely outcomes: ${Math.round(pr(x) * 72)}/72.` }));
  const E = sum(xs.map((x) => x * pr(x))), V = sum(xs.map((x) => (x - E) ** 2 * pr(x)));
  // The pdf: calories X between 300 and 1200, p(300) = p(1200) = 1/1800, peak at 500, straight lines.
  // p(500) = 1/600, falling line 31/12600 − x/630000, Pr(X < 1000) = 6/7.
  const a = 1 / 1800, pk = 2 / 900 - a, slope = (a - pk) / 700, icpt = pk - slope * 500;
  const p1000 = icpt + slope * 1000, pLess = 1 - ((p1000 + a) / 2) * 200;
  return {
    tab: "Probability", title: "Probability",
    items: [
      { kind: "lead", text: "A card is drawn at random from a standard deck of 52 playing cards. The deck has four suits (hearts, diamonds, clubs and spades) of 13 cards each: an ace, the number cards 2, 3, …, 10, and three face cards (jack, queen and king). We define the following events:" },
      { kind: "lead", text: "H, the card is a heart," },
      { kind: "lead", text: "F, the card is a face card (a jack, queen or king)," },
      { kind: "lead", text: "E, the card is a number card showing an even number {2, 4, 6, 8, 10}." },
      { kind: "lead", text: "Find the following probabilities. Keep your answers exact and do not round." },
      { kind: "q", n: 21, text: "Pr(F)", points: 1 },
      { kind: "q", n: 22, text: "Pr(not E)", points: 1 },
      { kind: "q", n: 23, text: "Pr(H and F)", points: 1 },
      { kind: "q", n: 24, text: "Pr(E and not H)", points: 1 },
      { kind: "q", n: 25, text: "In Table 6 write I or D in the pink shaded cells to indicate whether the pair of events in the given row and column are independent or dependent.", points: 3 },
      { kind: "lead", text: "A dodecahedral die is a die with 12 faces numbered 1, 2, …, 11, 12. You roll a dodecahedral die and a standard die with 6 faces numbered 1, 2, …, 6, and record their sum, X." },
      { kind: "q", n: 26, text: "Complete the entries in Table 7 showing the sum of the two dice rolls.", points: 1 },
      { kind: "q", n: 27, text: "Complete the entries in Table 8. The first column contains the elements x from the sample space of X and the second column the probabilities Pr(X=x).", points: 1 },
      { kind: "q", n: 28, text: "Find the expectation and the variance of X.", points: 3 },
      { kind: "lead", text: "The number of calories in a takeaway lunch order may be modelled as a continuous random variable X with values between 300 and 1200. The probability density function p(x) has the following properties:" },
      { kind: "lead", text: "p(300) = p(1200) = 1/1800" },
      { kind: "lead", text: "p(500) is the greatest value of p" },
      { kind: "lead", text: "The graph of p is a straight line from x = 300 to x = 500 and a different straight line from x = 500 to x = 1200" },
      { kind: "lead", text: "You are encouraged to draw a picture of the graph of p." },
      { kind: "q", n: 29, text: "What is p(500)? Keep your answer as exact as possible.", points: 2 },
      { kind: "q", n: 30, text: "What is the equation of the line of p between x = 500 and x = 1200? Give the y-intercept and slope.", points: 4 },
      { kind: "q", n: 31, text: "Using your answer from the previous question, what is the probability that a lunch order has fewer than 1000 calories?", points: 3 },
    ],
    cells: c, widths: { 2: 16 },
    questions: [
      { n: 21, points: 1, lesson: 9, title: "Probability of an event", parts: [{ label: "Pr(F)", cell: "C3", tone: "blue", format: "prob", tol: 1e-6, answer: 12 / 52, formula: "=12/52", explain: "3 face cards in each of 4 suits: 12 of the 52 equally likely cards." }] },
      { n: 22, points: 1, lesson: 9, title: "Probability of a complement", parts: [{ label: "Pr(not E)", cell: "C5", tone: "blue", format: "prob", tol: 1e-6, answer: 32 / 52, formula: "=1-20/52", explain: "E has 5 ranks × 4 suits = 20 cards, so Pr(not E) = 1 − 20/52 = 32/52." }] },
      { n: 23, points: 1, lesson: 9, title: "Probability of an intersection", parts: [{ label: "Pr(H and F)", cell: "C7", tone: "blue", format: "prob", tol: 1e-6, answer: 3 / 52, formula: "=3/52", explain: "The jack, queen and king of hearts: 3/52." }] },
      { n: 24, points: 1, lesson: 9, title: "Probability of A and not B", parts: [{ label: "Pr(E and not H)", cell: "C9", tone: "blue", format: "prob", tol: 1e-6, answer: 15 / 52, formula: "=15/52", explain: "Even number cards in diamonds, clubs and spades: 5 × 3 = 15 of the 52 cards.", traps: [{ value: 20 / 52, why: "That's Pr(E); remove the 5 even hearts." }] }] },
      { n: 25, points: 3, lesson: 10, title: "Independent or dependent", parts: [
        { label: "H and F", cell: "E13", tone: "pink", options: ID, answer: "I", formula: "\"I\"", explain: "Pr(H and F) = 3/52 = (13/52)(12/52): independent." },
        { label: "H and E", cell: "F13", tone: "pink", options: ID, answer: "I", formula: "\"I\"", explain: "Pr(H and E) = 5/52 = (13/52)(20/52): independent." },
        { label: "F and E", cell: "F14", tone: "pink", options: ID, answer: "D", formula: "\"D\"", explain: "No card is both a face card and an even number card, so Pr(F and E) = 0 ≠ (12/52)(20/52): dependent." },
      ] },
      { n: 26, points: 1, lesson: 9, title: "Table of sums of two dice", parts: sumParts },
      { n: 27, points: 1, lesson: 9, title: "Distribution of the sum", parts: distParts },
      { n: 28, points: 3, lesson: 9, title: "Expectation and variance of the sum", parts: [
        { label: "Expectation of X", cell: "E54", tone: "blue", answer: E, formula: "=SUMPRODUCT(C36:C52,D36:D52)", explain: "E(X) = Σ x·Pr(X = x) = 10 (= 6.5 + 3.5)." },
        { label: "Variance of X", cell: "E56", tone: "blue", answer: V, formula: "=SUMPRODUCT(C36:C52,C36:C52,D36:D52)-E54^2", explain: "Var(X) = Σ (x − E)²·Pr(X = x) = E(X²) − E(X)² = 178/12 ≈ 14.8333 (his key uses a column of (x − E)²).", traps: [{ value: Math.sqrt(V), why: "Gave the standard deviation; the variance is its square." }] },
      ] },
      { n: 29, points: 2, lesson: 10, title: "Height of the density at its peak", parts: [{ label: "p(500)", cell: "C58", tone: "blue", answer: pk, tol: 1e-9, formula: "=2/(1200-300)-1/1800", explain: "The area is two trapezia: (1/1800 + p)/2 × 200 + (p + 1/1800)/2 × 700 = 450(1/1800 + p) = 1, so p(500) = 1/450 − 1/1800 = 1/600.", traps: [{ value: 2 / 900, why: "Treated it as a triangle; the line starts at p(300) = 1/1800, not 0." }] }] },
      { n: 30, points: 4, lesson: 10, title: "Equation of the falling line", parts: [
        { label: "y-intercept", cell: "E60", tone: "blue", answer: icpt, tol: 1e-9, formula: "=C58-E62*500", explain: "The line through (500, 1/600) and (1200, 1/1800) meets x = 0 at 1/600 + 500/630000 = 31/12600 ≈ 0.00246." },
        { label: "slope", cell: "E62", tone: "blue", answer: slope, tol: 1e-11, formula: "=(1/1800-C58)/(1200-500)", explain: "(1/1800 − 1/600)/(1200 − 500) = −1/630000.", traps: [{ value: -slope, why: "Lost the minus sign: the line falls after the peak." }] },
      ] },
      { n: 31, points: 3, lesson: 10, title: "Probability as an area", parts: [{ label: "Pr(X < 1000)", cell: "C64", tone: "blue", format: "prob", answer: pLess, formula: "=1-((E60+E62*1000)+1/1800)/2*(1200-1000)", explain: "1 − the trapezium from 1000 to 1200: p(1000) = 31/12600 − 1000/630000 = 11/12600, area (11/12600 + 7/12600)/2 × 200 = 1/7, so 1 − 1/7 = 6/7.", traps: [{ value: 1 - pLess, why: "Gave Pr(X > 1000); subtract it from 1." }] }] },
    ],
  };
})();

// =====================================================================================================
// 6. Confidence intervals [6]  (S26 Final §6: the three scenarios)
// =====================================================================================================
const T9 = (() => { const r = mulberry32(20261206); return Array.from({ length: 10 }, () => round(45.8 + 6 * gauss(r), 1)); })();
const T10 = (() => { const r = mulberry32(20261207); return Array.from({ length: 6 }, () => Math.round(118 + 14 * gauss(r))); })();
const ci: DSection = (() => {
  const c: Record<string, Cell> = {};
  qn(c, 32, 2); label(c, "C2", "lower limit"); label(c, "C4", "upper limit");
  table(c, "C7", "Table 9"); col(c, "C", 8, T9);
  qn(c, 33, 19); label(c, "C19", "lower limit"); label(c, "C21", "upper limit");
  table(c, "C24", "Table 10"); col(c, "C", 25, T10);
  qn(c, 34, 32); label(c, "C32", "lower limit"); label(c, "C34", "upper limit");
  const z95 = PhiInv(0.975), z90 = PhiInv(0.95), m9 = mean(T9), m10 = mean(T10), s10 = sdS(T10), t99 = tInv(0.995, 5);
  const r9 = "C8:C17", r10 = "C25:C30";
  return {
    tab: "Confidence intervals", title: "Confidence intervals",
    items: [
      { kind: "lead", text: "Someone is about to use the random number generator to generate 10 numbers according to a normal distribution with μ = 50 and σ = 6." },
      { kind: "q", n: 32, text: "Before they produce the random numbers I want to create an interval inside which there is a 95% chance their sample mean will belong. Give the lower and upper limits of this interval.", points: 2 },
      { kind: "lead", text: "The results of their simulation are given in Table 9. The person tells me that they think they made a mistake inputting the mean. However, they remain confident that their standard deviation was correct." },
      { kind: "q", n: 33, text: "Construct an interval inside which there is a 90% chance their actual mean belongs.", points: 2 },
      { kind: "lead", text: "Table 10 shows a sample of independent and identical normally distributed values. We do not know the population parameters." },
      { kind: "q", n: 34, text: "Construct a confidence interval inside which there is a 99% chance the true mean of the population belongs.", points: 2 },
    ],
    cells: c,
    questions: [
      { n: 32, points: 2, lesson: 13, title: "Where the sample mean will land", parts: [
        { label: "lower limit", cell: "D2", tone: "blue", answer: 50 - z95 * 6 / Math.sqrt(10), formula: "=50-NORM.S.INV(0.975)*6/SQRT(10)", explain: "μ − z·σ/√n with z = NORM.S.INV(0.975) for 95% in the middle.", traps: [{ value: 50 - z95 * 6, why: "Used σ instead of σ/√n." }] },
        { label: "upper limit", cell: "D4", tone: "blue", answer: 50 + z95 * 6 / Math.sqrt(10), formula: "=50+NORM.S.INV(0.975)*6/SQRT(10)", explain: "μ + z·σ/√n." },
      ] },
      { n: 33, points: 2, lesson: 14, title: "CI for the mean, σ known", parts: [
        { label: "lower limit", cell: "D19", tone: "blue", answer: m9 - z90 * 6 / Math.sqrt(10), formula: `=AVERAGE(${r9})-NORM.S.INV(0.95)*6/SQRT(COUNT(${r9}))`, explain: "x̄ − z·σ/√n with the trusted σ = 6 and z = NORM.S.INV(0.95) for 90%.", traps: [{ value: m9 - PhiInv(0.975) * 6 / Math.sqrt(10), why: "Used the 95% z value; 90% in the middle needs NORM.S.INV(0.95)." }] },
        { label: "upper limit", cell: "D21", tone: "blue", answer: m9 + z90 * 6 / Math.sqrt(10), formula: `=AVERAGE(${r9})+NORM.S.INV(0.95)*6/SQRT(COUNT(${r9}))`, explain: "x̄ + z·σ/√n." },
      ] },
      { n: 34, points: 2, lesson: 15, title: "CI for the mean, nothing known", parts: [
        { label: "lower limit", cell: "D32", tone: "blue", answer: m10 - t99 * s10 / Math.sqrt(6), formula: `=AVERAGE(${r10})-T.INV(0.995,COUNT(${r10})-1)*STDEV.S(${r10})/SQRT(COUNT(${r10}))`, explain: "x̄ − t·S/√n with t = T.INV(0.995, 5) and S = STDEV.S.", traps: [{ value: m10 - PhiInv(0.995) * s10 / Math.sqrt(6), why: "Used a z value; with σ unknown use T.INV with n − 1 = 5 degrees of freedom." }] },
        { label: "upper limit", cell: "D34", tone: "blue", answer: m10 + t99 * s10 / Math.sqrt(6), formula: `=AVERAGE(${r10})+T.INV(0.995,COUNT(${r10})-1)*STDEV.S(${r10})/SQRT(COUNT(${r10}))`, explain: "x̄ + t·S/√n." },
      ] },
    ],
  };
})();

// =====================================================================================================
// 7. Hypothesis testing [12]  (S26 Final §7: Z test on RNG numbers; fair die; one-tailed T test with a fallback)
// =====================================================================================================
const T11 = (() => { const r = mulberry32(20261227); return Array.from({ length: 20 }, () => round(42.6 + 5 * gauss(r), 1)); })();
const DIE = [10, 9, 8, 9, 7, 8, 6, 7]; // counts of 1..8 on an eight-sided die
const FALLBACK = { m: 4.2, s: 2.4 };
const ht: DSection = (() => {
  const c: Record<string, Cell> = {};
  qn(c, 35, 2); table(c, "C3", "Table 11"); col(c, "C", 4, T11);
  ["alpha", "n", "test statistic", "lower critical value", "upper critical value", "p-value", "decision"].forEach((t, i) => label(c, `F${3 + i}`, t));
  hint(c, "H9", "Write R for reject and DR for don't reject");
  table(c, "C26", "Table 12"); table(c, "C27", "Outcome"); table(c, "D27", "Number of occurrences");
  DIE.forEach((k, i) => { data(c, `C${28 + i}`, i + 1); data(c, `D${28 + i}`, k); });
  qn(c, 36, 37);
  qn(c, 37, 39); label(c, "C39", "Sample mean"); hint(c, "F39", `Write ${FALLBACK.m} if you do not know`);
  label(c, "C41", "Sample standard deviation"); hint(c, "F41", `Write ${FALLBACK.s} if you do not know`);
  qn(c, 38, 43); ["alpha", "n", "test statistic", "critical value", "p-value", "decision"].forEach((t, i) => label(c, `C${43 + i}`, t));
  hint(c, "E48", "Write R for reject and DR for don't reject");
  // Q35: Z test, H0: mu = 40, sigma = 5 (his key also accepted a T test).
  const n11 = T11.length, x11 = mean(T11), s11 = sdS(T11);
  const z = (x11 - 40) / (5 / Math.sqrt(n11)), zc = PhiInv(0.975), pz = z < 0 ? 2 * Phi(z) : 2 * (1 - Phi(z));
  const tt = (x11 - 40) / (s11 / Math.sqrt(n11)), tc = tInv(0.975, n11 - 1), pt = tt < 0 ? 2 * tCdf(tt, n11 - 1) : 2 * (1 - tCdf(tt, n11 - 1));
  // Q36–38: eight-sided die, H0: mu >= 4.5 (left tail).
  const vals = DIE.flatMap((k, i) => Array(k).fill(i + 1) as number[]);
  const nd = vals.length, xd = mean(vals), sdd = sdS(vals);
  const td = (xd - 4.5) / (sdd / Math.sqrt(nd)), tcd = tInv(0.05, nd - 1), pd = tCdf(td, nd - 1);
  const tf = (FALLBACK.m - 4.5) / (FALLBACK.s / Math.sqrt(nd)), pf = tCdf(tf, nd - 1);
  const r11 = "C4:C23";
  return {
    tab: "Hypothesis testing", title: "Hypothesis testing",
    items: [
      { kind: "lead", text: "A student is asked to use the random number generator to produce 20 numbers generated according to a normal distribution with μ = 40 and σ = 5. Their numbers are given in Table 11. I suspect that the student has not produced the numbers correctly." },
      { kind: "q", n: 35, text: "Test the null hypothesis H_{0} : μ = 40 with α = 0.05.", points: 4 },
      { kind: "lead", text: "My friend is rolling an eight-sided die with faces valued {1,2,3,4,5,6,7,8}. I begin to suspect that the die is not fair and rolls low numbers too often, so I record their throws in Table 12. Let X be the random variable for the outcome of a dice roll." },
      { kind: "q", n: 36, text: "If the die were fair what is the expectation of X?", points: 1 },
      { kind: "q", n: 37, text: "What is the sample mean and sample standard deviation of the rolls in Table 12?", points: 3 },
      { kind: "q", n: 38, text: `Test the null hypothesis H_{0} : μ ≥ 4.5 with α = 0.05. Note: to answer this question you will need answers to Question 37. If you do not have answers to Question 37 please input {xbar} = ${FALLBACK.m} and S = ${FALLBACK.s} into the answer cells.`, points: 4 },
    ],
    cells: c, widths: { 2: 24, 5: 18 },
    questions: [
      { n: 35, points: 4, lesson: 16, title: "Z test on simulated numbers", parts: [
        { label: "alpha", cell: "G3", tone: "pink", answer: 0.05, formula: "=0.05", explain: "Given: α = 0.05." },
        { label: "n", cell: "G4", tone: "pink", answer: n11, tol: 0, formula: `=COUNT(${r11})`, explain: "20 numbers in Table 11." },
        { label: "test statistic", cell: "G5", tone: "blue", answer: z, alts: [tt], formula: `=(AVERAGE(${r11})-40)/(5/SQRT(G4))`, explain: "σ = 5 is known, so Z = (x̄ − 40)/(σ/√n). (His key also accepted the T statistic with S.)", traps: [{ value: (x11 - 40) / 5, why: "Divided by σ instead of σ/√n." }] },
        { label: "lower critical value", cell: "G6", tone: "blue", answer: -zc, alts: [-tc], formula: "=NORM.S.INV(G3/2)", explain: "Two tails (H₀ has =): NORM.S.INV(α/2)." },
        { label: "upper critical value", cell: "G7", tone: "blue", answer: zc, alts: [tc], formula: "=NORM.S.INV(1-G3/2)", explain: "NORM.S.INV(1 − α/2).", traps: [{ value: PhiInv(0.95), why: "Used α instead of α/2; an equals-sign H₀ is two-tailed." }] },
        { label: "p-value", cell: "G8", tone: "blue", format: "prob", answer: pz, alts: [pt], formula: z < 0 ? "=2*NORM.S.DIST(G5,TRUE)" : "=2*(1-NORM.S.DIST(G5,TRUE))", explain: `Two-tailed, statistic ${z < 0 ? "negative" : "positive"}: ${z < 0 ? "2·NORM.S.DIST(Z)" : "2·(1 − NORM.S.DIST(Z))"}.`, traps: [{ value: pz / 2, why: "Gave one tail; double it for an equals-sign H₀." }] },
        { label: "decision", cell: "G9", tone: "pink", options: DECISIONS, answer: dec(pz < 0.05), formula: pz < 0.05 ? "\"R\"" : "\"DR\"", explain: `p = ${pz.toFixed(4)} ${pz < 0.05 ? "<" : ">"} 0.05 (and |Z| ${Math.abs(z) > zc ? ">" : "<"} ${zc.toFixed(3)}): ${pz < 0.05 ? "reject" : "don't reject"} H₀.` },
      ] },
      { n: 36, points: 1, lesson: 9, title: "Expectation of a fair die", parts: [{ label: "E(X) for a fair die", cell: "C37", tone: "blue", answer: 4.5, formula: "=AVERAGE(C28:C35)", explain: "Each face has probability 1/8: (1 + 2 + … + 8)/8 = 4.5." }] },
      { n: 37, points: 3, lesson: 15, title: "Sample mean and SD from counts", parts: [
        { label: "Sample mean", cell: "E39", tone: "blue", answer: xd, formula: "=SUMPRODUCT(C28:C35,D28:D35)/SUM(D28:D35)", explain: `Σ outcome × count ÷ total rolls = ${sum(DIE.map((k, i) => k * (i + 1)))}/${nd}.`, traps: [{ value: mean(DIE), why: "Averaged the counts; weight each outcome by its count." }] },
        { label: "Sample standard deviation", cell: "E41", tone: "blue", answer: sdd, formula: "=SQRT((SUMPRODUCT(C28:C35,C28:C35,D28:D35)-SUM(D28:D35)*E39^2)/(SUM(D28:D35)-1))", explain: "S = √(Σ count·(x − x̄)² / (n − 1)) (his key uses a helper column of (x − x̄)²).", traps: [{ value: sdd * Math.sqrt((nd - 1) / nd), why: "Divided by n; the sample SD divides by n − 1." }] },
      ] },
      { n: 38, points: 4, lesson: 17, title: "One-tailed T test on the die", parts: [
        { label: "alpha", cell: "D43", tone: "pink", answer: 0.05, formula: "=0.05", explain: "Given: α = 0.05." },
        { label: "n", cell: "D44", tone: "pink", answer: nd, tol: 0, formula: "=SUM(D28:D35)", explain: `${nd} rolls in total (the sum of the counts, not 8).` },
        { label: "test statistic", cell: "D45", tone: "blue", answer: td, alts: [tf], formula: "=(E39-C37)/(E41/SQRT(D44))", explain: `T = (x̄ − 4.5)/(S/√n). With the fallback x̄ = ${FALLBACK.m}, S = ${FALLBACK.s} it is ${tf.toFixed(4)} (also accepted).` },
        { label: "critical value", cell: "D46", tone: "blue", answer: tcd, formula: "=T.INV(D43,D44-1)", explain: `H₀: μ ≥ 4.5 is a left-tail test: T.INV(α, ${nd - 1}), negative.`, traps: [{ value: -tcd, why: "Wrong sign: a left-tail critical value is negative." }] },
        { label: "p-value", cell: "D47", tone: "blue", format: "prob", answer: pd, alts: [pf], formula: "=T.DIST(D45,D44-1,TRUE)", explain: `Left tail: T.DIST(T, ${nd - 1}, TRUE).`, traps: [{ value: 1 - pd, why: "Took the right tail; H₀: μ ≥ 4.5 is a left-tail test." }] },
        { label: "decision", cell: "D48", tone: "pink", options: DECISIONS, answer: dec(pd < 0.05), formula: pd < 0.05 ? "\"R\"" : "\"DR\"", explain: `p = ${pd.toFixed(4)} ${pd < 0.05 ? "<" : ">"} 0.05: ${pd < 0.05 ? "reject" : "don't reject"} H₀ (the fallback numbers give the same decision).` },
      ] },
    ],
  };
})();

// =====================================================================================================
// 8. Regression [10]  (S26 Final §8; Lessons 19–20 aren't taught yet, so the paper is flagged beta)
// =====================================================================================================
const HOTELS = (() => {
  const r = mulberry32(20261354);
  return Array.from({ length: 20 }, () => {
    const rating = round(6 + 3.6 * r(), 1);
    return { rating, rate: Math.round(-190 + 41 * rating + 40 * gauss(r)) };
  });
})();
const reg: DSection = (() => {
  const c: Record<string, Cell> = {};
  qn(c, 39, 2); table(c, "C2", "Table 13"); hint(c, "G2", "Chart here");
  table(c, "C3", "Hotel"); table(c, "D3", "Room rate"); table(c, "E3", "Rating");
  HOTELS.forEach((k, i) => { data(c, `C${4 + i}`, i + 1); data(c, `D${4 + i}`, k.rate); data(c, `E${4 + i}`, k.rating); });
  qn(c, 40, 26); label(c, "D26", "y intercept"); hint(c, "G26", "Correct to 3 d.p."); label(c, "D28", "slope"); hint(c, "G28", "Correct to 3 d.p."); label(c, "D30", "Predicted room rate");
  qn(c, 41, 32); ["alpha", "degrees of freedom", "test statistic", "lower critical value", "upper critical value", "decision"].forEach((t, i) => label(c, `C${32 + i}`, t));
  hint(c, "E37", "Write R for reject and DR for don't reject");
  const x = HOTELS.map((k) => k.rating), y = HOTELS.map((k) => k.rate), mx = mean(x), my = mean(y);
  const sxx = sum(x.map((v) => (v - mx) ** 2)), sxy = sum(x.map((v, i) => (v - mx) * (y[i] - my)));
  const b1 = sxy / sxx, b0 = my - b1 * mx, n = x.length;
  const sse = sum(y.map((v, i) => (v - b0 - b1 * x[i]) ** 2)), se = Math.sqrt(sse / (n - 2)), t = b1 / (se / Math.sqrt(sxx)), tc = tInv(0.975, n - 2);
  const Y = "D4:D23", X = "E4:E23";
  return {
    tab: "Regression", title: "Regression",
    items: [
      { kind: "lead", text: "Table 13 shows a sample of 20 city hotels, their nightly room rate ($) and their average guest rating (out of 10)." },
      { kind: "q", n: 39, text: "Produce an appropriate chart in the space provided showing how the room rate depends on the guest rating. Include a trendline.", points: 3 },
      { kind: "q", n: 40, text: "Find the y-intercept and slope for the line of best fit and use this to predict the room rate of a hotel with a guest rating of 8.5.", points: 3 },
      { kind: "lead", text: "We will test a null hypothesis which claims that there is no linear relationship between guest rating and room rate." },
      { kind: "q", n: 41, text: "For a significance of α = 0.05 decide whether to reject (R) or don't reject (DR) the null hypothesis by performing a critical value test.", points: 4 },
    ],
    cells: c, widths: { 2: 20 },
    questions: [
      { n: 39, points: 3, lesson: 19, title: "Scatter chart with a trendline (BETA)", parts: [], unmarked: "A scatter chart with guest rating on the horizontal axis and room rate on the vertical axis, markers only, a linear trendline (optionally showing its equation), a title and axis titles. The trendline slopes up." },
      { n: 40, points: 3, lesson: 19, title: "Line of best fit and a prediction (BETA)", parts: [
        { label: "y intercept", cell: "E26", tone: "pink", answer: b0, formula: `=INTERCEPT(${Y},${X})`, explain: "INTERCEPT(room rate, rating), or the Intercept coefficient in the Toolpak regression output." },
        { label: "slope", cell: "E28", tone: "pink", answer: b1, formula: `=SLOPE(${Y},${X})`, explain: "SLOPE(room rate, rating): the extra dollars per night for each extra rating point.", traps: [{ value: sxy / sum(y.map((v) => (v - my) ** 2)), why: "Swapped x and y: the rate depends on the rating, so y = room rate." }] },
        { label: "Predicted price", cell: "E30", tone: "blue", answer: b0 + 8.5 * b1, formula: "=E26+8.5*E28", explain: "intercept + 8.5 × slope." },
      ] },
      { n: 41, points: 4, lesson: 20, title: "Slope test: no linear relationship (BETA)", parts: [
        { label: "alpha", cell: "D32", tone: "pink", answer: 0.05, formula: "=0.05", explain: "Given: α = 0.05." },
        { label: "degrees of freedom", cell: "D33", tone: "pink", answer: n - 2, tol: 0, formula: "=COUNT(E4:E23)-2", explain: "n − 2 = 18 for simple regression.", traps: [{ value: n - 1, why: "Used n − 1; a simple regression estimates two coefficients, so n − 2." }] },
        { label: "test statistic", cell: "D34", tone: "blue", answer: t, formula: `=SLOPE(${Y},${X})/(STEYX(${Y},${X})/SQRT(DEVSQ(${X})))`, explain: "t = slope ÷ its standard error (the Toolpak's t Stat for Rating, = coefficient / standard error)." },
        { label: "lower critical value", cell: "D35", tone: "blue", answer: -tc, formula: "=T.INV(D32/2,D33)", explain: "Two tails (H₀: slope = 0): T.INV(α/2, 18)." },
        { label: "upper critical value", cell: "D36", tone: "blue", answer: tc, formula: "=T.INV(1-D32/2,D33)", explain: "T.INV(1 − α/2, 18).", traps: [{ value: tInv(0.95, n - 2), why: "Used α instead of α/2; this test is two-tailed." }] },
        { label: "decision", cell: "D37", tone: "pink", options: DECISIONS, answer: dec(Math.abs(t) > tc), formula: Math.abs(t) > tc ? "\"R\"" : "\"DR\"", explain: `t = ${t.toFixed(3)} is ${Math.abs(t) > tc ? "beyond" : "inside"} ±${tc.toFixed(3)}: ${Math.abs(t) > tc ? "reject" : "don't reject"} H₀; ${Math.abs(t) > tc ? "there is" : "no evidence of"} a linear relationship.` },
      ] },
    ],
  };
})();

// Clean answer-key formulas: the "are their random numbers in?" guard lives in liveCheck (checked by the marker),
// not wrapped round the formula a student sees in the key.
function unwrapGates(P: DPaper): DPaper {
  for (const s of P.sections) for (const q of s.questions) for (const p of q.parts) {
    const m = /^=IF\(AND\(COUNT\(([A-Z]+)9:\1(?:105)\)=97,STDEV\.S\(\1(?:9):\1(?:105)\)>1\),(.*),-999999\)$/.exec(p.formula);
    if (!m) continue;
    p.formula = `=${m[2]}`;
    p.liveCheck = `=AND(COUNT(${m[1]}9:${m[1]}105)=97,STDEV.S(${m[1]}9:${m[1]}105)>1)`;
    p.explain = p.explain.replace(" (The IF only checks that your 97 random numbers are in: without them this part can't be marked.)", "");
  }
  return P;
}

export const DIAG_FINAL: DPaper = unwrapGates({
  id: "dx:final",
  title: "Final practice test",
  header: "AQM1000, Fall 2026, Final practice test (AQM Prep)",
  file: "AQM-Final-practice-test",
  minutes: 120,
  beta: true,
  instructions: [
    "This exam is 2 hours long.",
    "You are permitted to bring a double-sided handwritten note-sheet on standard letter size paper.",
    "Your answers are to be inputted in the Excel file provided.",
    "No window other than the Excel file should be open on your screen for the duration of the exam.",
    "Answers should be inputted into the designated cells.",
    "Do not move the location of an answer cell in the spreadsheet.",
    "Do not rename sheets.",
    "Do not round numerical answers, leave them as exact as possible.",
    "Blue answer cells need to contain an Excel formula to receive credit. Pink cells just require the answer.",
    "For hypothesis testing simply write R for reject and DR for don't reject.",
    "Failure to adhere to the above instructions will result in you losing points.",
    "Any unauthorized use of phones or AI will result in your immediate dismissal from the exam.",
    "If you have any questions, please raise your hand. A proctor or I will address you.",
    "The Canvas submission deadline is strict. No consideration will be given to late submissions or blank files submitted in error.",
  ],
  sections: [viz, sd, sim, normal, prob, ci, ht, reg],
});
