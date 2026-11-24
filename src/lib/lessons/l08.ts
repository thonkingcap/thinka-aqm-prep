// Lesson 8: linear models (breakeven, supply and demand) and the introduction to probability.
// Built from "Lesson 8, notes", "Linear models, exercises/solutions" and the Exam 1 / Final questions they feed.
import { Sheet, int, pick, round, TOP, type BlockMaker, type Block, type Rng } from "./kit.ts";
import type { Lesson } from "./types.ts";

// ---------- small local helpers ----------
const isWhole = (x: number) => Math.abs(x - Math.round(x)) < 1e-9;
/** 6000 → "6,000"; 3.5 → "3.50". */
const usd = (x: number) => (isWhole(x) ? Math.round(x).toLocaleString("en-US") : x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const roundTo = (x: number, step: number) => Math.max(step, Math.round(x / step) * step);
/** Keep only traps that are not the right answer. */
const keep = (answer: number, ts: { value: number; why: string }[]) =>
  ts.filter((t) => Number.isFinite(t.value) && Math.abs(t.value - answer) > Math.max(0.02, Math.abs(answer) * 0.004));

// ---------- Q1: breakeven (Fall 2026 Exam 1 Section 1 (Linear models)) ----------
const SHOPS = [
  { biz: "coffee shop", one: "coffee", many: "coffees" },
  { biz: "food truck", one: "taco", many: "tacos" },
  { biz: "bakery", one: "cupcake", many: "cupcakes" },
  { biz: "juice bar", one: "smoothie", many: "smoothies" },
  { biz: "bubble tea stand", one: "bubble tea", many: "bubble teas" },
] as const;
const RIVALS = [["Rufus", "Dufus"], ["Maya", "Tara"], ["Leo", "Theo"], ["Priya", "Nadia"], ["Omar", "Karim"]] as const;

const breakeven: BlockMaker = {
  key: "l8.breakeven",
  title: "Breakeven: monthly profit, least number to sell, a rival's unit cost",
  make(rng): Block {
    const shop = pick(rng, SHOPS);
    const [me, rival] = pick(rng, RIVALS);
    let F = 0, P = 0, V = 0;
    for (;;) {
      F = pick(rng, [4500, 5000, 6000, 7200, 8000, 9000]);
      P = pick(rng, [3.5, 4, 4.5, 5, 5.5, 6]);
      V = pick(rng, [0.75, 1, 1.25, 1.5, 1.75, 2]);
      if (!isWhole(F / (P - V))) break; // a whole-number breakeven would make "least number" a special case
    }
    const days = 30;
    const m = P - V;
    const beDay = F / (days * m);
    let d = int(rng, Math.max(5, Math.round(beDay * 0.5)), Math.round(beDay * 1.5));
    if (Math.abs(d * days * m - F) < 1e-9) d += 1;
    const profit = d * days * m - F;
    const qBE = F / m;
    const least = Math.ceil(qBE);
    const beRevenue = P * qBE;
    // Rival: same fixed cost, just breaking even at d2 a day, so V2 = P2 − F/(30·d2).
    const d2 = pick(rng, [15, 20, 25, 30, 40, 50, 60, 75].filter((x) => F / (days * x) >= 3 && F / (days * x) <= 12));
    const k = F / (days * d2);
    const P2 = Math.ceil((k + 1) * 2) / 2 + pick(rng, [0, 0.5, 1, 1.5, 2]);
    const V2 = P2 - k;
    const qMax = Math.ceil((qBE * 1.6) / 500) * 500;

    const S = new Sheet();
    S.header(`B${TOP}`, "Given").header(`C${TOP}`, "Value");
    S.label("B9", "Fixed cost per month ($)").given("C9", F);
    S.label("B10", `Price per ${shop.one} ($)`).given("C10", P);
    S.label("B11", `Cost to make one ${shop.one} ($)`).given("C11", V);
    S.label("B12", `${cap(shop.many)} sold per day`).given("C12", d);
    S.label("B13", "Days in a month").given("C13", days);
    S.label("B14", `${rival}'s price per ${shop.one} ($)`).given("C14", P2);
    S.label("B15", `${rival}'s ${shop.many} sold per day`).given("C15", d2);
    S.header("B17", "Question").header("C17", "Your answer");
    S.ask("B18", {
      label: `${me}'s profit per month (a loss is negative)`, cell: "C18", answer: profit,
      formula: "=C12*C13*(C10-C11)-C9",
      explain: "Profit = TR − TC = PQ − (VQ + F) = Q(P − V) − F, with Q = sold per day × 30 days.",
      traps: keep(profit, [
        { value: d * m - F, why: "Forgot to multiply the daily sales by 30 days." },
        { value: d * days * P - F, why: "Forgot the variable cost V of making each one." },
        { value: -profit, why: "Sign flipped: profit is TR − TC, and a loss must be negative." },
      ]),
    });
    S.ask("B19", {
      label: `Least number of ${shop.many} a month to make a profit`, cell: "C19", answer: least, tol: 0,
      formula: "=ROUNDUP(C9/(C10-C11),0)",
      explain: "Q_BE = F/(P − V) is not a whole number, and at Q_BE you only break even, so round UP to the next whole one (his notes: 'Answer: 17. Not the answer: 16.7').",
      traps: keep(least, [
        { value: Math.floor(qBE), why: "Rounded down: one fewer than breakeven is still a loss." },
        { value: Math.ceil(F / P), why: "Divided the fixed cost by the price instead of the margin P − V." },
        { value: Math.ceil(beDay), why: "That is a number per day; the question asks per month." },
      ]),
    });
    S.ask("B20", {
      label: "Revenue at the breakeven quantity ($)", cell: "C20", answer: beRevenue,
      formula: "=C10*C9/(C10-C11)",
      explain: "Breakeven 'in dollars' is the revenue there: TR = P × Q_BE (unrounded Q_BE).",
      traps: keep(beRevenue, [{ value: qBE, why: "That is the breakeven quantity, not the revenue in dollars." }, { value: P * least, why: "Used the rounded-up quantity; breakeven in dollars uses the exact Q_BE." }]),
    });
    S.ask("B21", {
      label: `${rival}'s cost to make one ${shop.one} ($)`, cell: "C21", answer: V2,
      formula: "=C14-C9/(C13*C15)",
      explain: `Breaking even means 30 × ${d2} × (P − V) = F, so V = P − F/(30 × sold per day).`,
      traps: keep(V2, [
        { value: P2 - F / d2, why: "Forgot the 30 days: the fixed cost is per month, the sales are per day." },
        { value: k, why: "That is F/(30·q), the margin P − V; subtract it from the price." },
      ]),
    });
    return {
      tab: "Breakeven", title: "Breakeven analysis",
      text: [
        `${me} owns a ${shop.biz}. Fixed costs are $${usd(F)} a month, each ${shop.one} sells for $${usd(P)} and costs $${usd(V)} to make. Assume ${days} days in a month.`,
        `A rival, ${rival}, charges $${usd(P2)} and sells ${d2} ${shop.many} a day. ${me} assumes ${rival} has the same fixed costs and is only just breaking even.`,
        "Fill the yellow cells with formulas that point at the givens. A loss must be negative. Do not round, except where a whole number is asked for.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        `Make a table of Q = 0 and Q = ${qMax} with TR = P·Q and TC = F + V·Q (use $ references), then chart TR and TC as two separate lines on one chart. Self-check: the lines cross at Q ≈ ${round(qBE, 1)}.`,
      ],
    };
  },
};
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ---------- Q2: a cost line from two points (soccer balls; Spring 2026 Exam 1 Q4; Fall 2026 Exam 1 Section 1 (Linear models) last part) ----------
const costline: BlockMaker = {
  key: "l8.costline",
  title: "Find V and F from two points, then breakeven and the breakeven price",
  make(rng): Block {
    const S = new Sheet();
    const fromProfit = rng() < 0.5;
    let text: string[];
    let V: number, F: number, P: number, N: number;
    let fV: string, fF: string, fLeast: string, fPrice: string;
    let vTraps: { value: number; why: string }[], fTraps: { value: number; why: string }[];
    if (!fromProfit) {
      // Two (quantity, total cost) points.
      for (;;) {
        V = pick(rng, [6, 8, 12, 15, 25, 40, 80]);
        P = V + Math.round(V * pick(rng, [0.5, 0.8, 1, 1.3])) + int(rng, 0, 3);
        F = pick(rng, [2500, 4000, 6000, 9000, 15000, 24000]);
        if (!isWhole(F / (P - V))) break;
      }
      const be = F / (P - V);
      const Q1 = roundTo(be * (0.2 + 0.4 * rng()), 10);
      const Q2 = Q1 + pick(rng, [20, 40, 50, 100, 150, 200]);
      const T1 = F + V * Q1, T2 = F + V * Q2;
      N = roundTo(be * pick(rng, [0.25, 0.4, 0.5, 0.6]), 10);
      S.header(`B${TOP}`, "Quantity").header(`C${TOP}`, "Total cost ($)");
      S.given("B9", Q1).given("C9", T1).given("B10", Q2).given("C10", T2);
      S.label("B12", "Price per unit ($)").given("C12", P);
      S.label("B13", "Units sold (for the last question)").given("C13", N);
      fV = "=(C10-C9)/(B10-B9)"; fF = "=C9-B9*C16"; fLeast = "=ROUNDUP(C17/(C12-C16),0)"; fPrice = "=(C13*C16+C17)/C13";
      vTraps = [{ value: (Q2 - Q1) / (T2 - T1), why: "Slope upside down: it is change in cost ÷ change in quantity." }, { value: T1 / Q1, why: "Average cost per unit (TC/Q) includes the fixed cost; the variable cost is the slope." }];
      fTraps = [{ value: T1, why: "That is the total cost at the first point; the fixed cost is the intercept (cost at Q = 0)." }];
      text = [
        `A product sells for $${usd(P)} per unit. When ${Q1} units are made the total cost is $${usd(T1)}, and when ${Q2} are made it is $${usd(T2)}. Assume TC = F + V·Q.`,
        "Find the variable cost and fixed cost, then answer the breakeven questions with formulas pointing at your cells.",
      ];
    } else {
      // Two (daily sales, monthly profit) points at a known price, as Dufus tells Rufus.
      for (;;) {
        P = pick(rng, [5, 6, 8, 10, 12]);
        V = pick(rng, [1, 1.5, 2, 2.5, 3, 4].filter((v) => v <= P - 2));
        F = pick(rng, [3000, 4500, 6000, 7200, 9000]);
        if (!isWhole(F / (P - V))) break;
      }
      const d1 = int(rng, 5, 15), d2 = int(rng, 6, 12) * 10;
      const pr1 = 30 * d1 * (P - V) - F, pr2 = 30 * d2 * (P - V) - F;
      N = roundTo((F / (P - V)) * pick(rng, [0.3, 0.4, 0.5]), 50);
      S.header(`B${TOP}`, "Sold per day").header(`C${TOP}`, "Profit per month ($)");
      S.given("B9", d1).given("C9", pr1).given("B10", d2).given("C10", pr2);
      S.label("B12", "Price per unit ($)").given("C12", P);
      S.label("B13", "Days in a month").given("C13", 30);
      S.label("B14", "Units sold per month (for the last question)").given("C14", N);
      fV = "=C12-(C10-C9)/(C13*(B10-B9))"; fF = "=C13*B9*(C12-C16)-C9"; fLeast = "=ROUNDUP(C17/(C12-C16),0)"; fPrice = "=(C14*C16+C17)/C14";
      vTraps = [{ value: P - (pr2 - pr1) / (d2 - d1), why: "Forgot the 30 days: profits are per month, sales are per day." }, { value: (pr2 - pr1) / (30 * (d2 - d1)), why: "That is the margin P − V (the slope of profit); subtract it from the price." }];
      fTraps = [{ value: -pr1, why: "The loss at the first point is not the fixed cost: the units sold there also cost V each." }];
      text = [
        `A shop sells a product for $${usd(P)}. Selling ${d1} a day it ${pr1 < 0 ? "loses" : "makes"} $${usd(Math.abs(pr1))} a month; selling ${d2} a day it ${pr2 < 0 ? "loses" : "makes"} $${usd(Math.abs(pr2))} a month. Assume 30 days in a month and Profit = Q(P − V) − F.`,
        "Find the variable cost and fixed cost, then answer the breakeven questions (per month) with formulas pointing at your cells.",
      ];
    }
    const be = F / (P - V);
    const least = Math.ceil(be);
    const priceBE = (N * V + F) / N;
    S.header("B15", "Question").header("C15", "Your answer");
    S.ask("B16", { label: "Variable cost per unit V ($)", cell: "C16", answer: V, formula: fV, explain: fromProfit ? "Profit rises by 30·(P − V) for each extra unit a day, so P − V = change in profit ÷ (30 × change in daily sales); V = P minus that." : "V is the slope of the cost line: (TC₂ − TC₁)/(Q₂ − Q₁).", traps: keep(V, vTraps) });
    S.ask("B17", { label: "Fixed cost F ($)", cell: "C17", answer: F, formula: fF, explain: fromProfit ? "From one point: Profit = 30·q·(P − V) − F, so F = 30·q·(P − V) − Profit." : "F is the intercept: F = TC₁ − V·Q₁ (his soccer-ball formula =D11-D13*C11).", traps: keep(F, fTraps) });
    S.ask("B18", {
      label: fromProfit ? "Least number sold per month to make a profit" : "Least number sold to make a profit", cell: "C18", answer: least, tol: 0, formula: fLeast,
      explain: "Q_BE = F/(P − V); profit needs strictly more, so round up to the next whole number.",
      traps: keep(least, [{ value: Math.floor(be), why: "Rounded down: that quantity still makes a loss." }]),
    });
    S.ask("B19", {
      label: "Breakeven price when that many units are sold (charge more than this to profit) ($)", cell: "C19", answer: priceBE, formula: fPrice,
      explain: "Break even at N units: N·P = F + V·N, so P = (N·V + F)/N (Spring 2026 Exam 1 Q4.5: =(50*80+15000)/50).",
      traps: keep(priceBE, [{ value: F / N, why: "Forgot the variable cost: each unit also costs V." }, { value: V + F, why: "Divide the fixed cost by the number of units." }]),
    });
    return {
      tab: fromProfit ? "V and F from profits" : "Cost line", title: fromProfit ? "Fixed and variable cost from two profit figures" : "The total cost line from two points",
      text, cells: S.cells, parts: S.parts,
      manual: ["Chart total revenue, total cost and profit against quantity on one chart (0 to about twice breakeven). Self-check: the profit line crosses zero exactly where TR meets TC."],
    };
  },
};

// ---------- Q3: supply and demand equilibrium (Spring 2026 Final Q2, Fall 2025 Final, oranges exercise) ----------
const GOODS = [
  { what: "boxes of oranges", unit: "thousand boxes" },
  { what: "concert tickets", unit: "tickets" },
  { what: "bike helmets", unit: "helmets" },
  { what: "phone cases", unit: "cases" },
  { what: "bags of coffee beans", unit: "bags" },
] as const;

const equilibrium: BlockMaker = {
  key: "l8.equilibrium",
  title: "Linear supply and demand from two prices, equilibrium price and quantity",
  make(rng): Block {
    const g = pick(rng, GOODS);
    let a = 0, b = 0, c = 0, d = 0, P1 = 0, P2 = 0;
    for (;;) {
      d = pick(rng, [2, 3, 4, 5, 6, 8]);
      c = pick(rng, [-200, -150, -130, -100, -50, 0, 40, 100]);
      b = -pick(rng, [2, 3, 4, 5, 8, 10]);
      const pe0 = int(rng, 40, 200);
      a = c + (d - b) * pe0 + pick(rng, [0, 0, 15, 25, 30]);
      const pe = (a - c) / (d - b);
      P1 = roundTo(pe * (0.4 + 0.4 * rng()), 10);
      P2 = roundTo(pe * (1.2 + 0.4 * rng()), 10);
      if (P2 > P1 && c + d * P1 > 0 && a + b * P2 > 0) break;
    }
    const S1 = c + d * P1, S2 = c + d * P2, D1 = a + b * P1, D2 = a + b * P2;
    const pe = (a - c) / (d - b);
    const qe = c + d * pe;
    const above = rng() < 0.5;
    let X = roundTo(above ? pe * 1.3 : pe * 0.7, 5);
    if (X === P1 || X === P2) X += above ? 5 : -5; // not one of the two given prices
    if (X <= 0) X = 5;
    const surplus = c + d * X > a + b * X;

    const S = new Sheet();
    S.header(`B${TOP}`, "Price ($)").header(`C${TOP}`, "Supply").header(`D${TOP}`, "Demand");
    S.given("B9", P1).given("C9", S1).given("D9", D1);
    S.given("B10", P2).given("C10", S2).given("D10", D2);
    S.label("B12", "A price to describe ($)").given("C12", X);
    S.header("B13", "Question").header("C13", "Your answer");
    S.ask("B14", { label: "Supply y-intercept (c)", cell: "C14", answer: c, formula: "=C9-B9*C15", explain: "Supply = c + d·P, so c = S₁ − d·P₁ (the supply at a price of $0).", traps: keep(c, [{ value: S1, why: "That is the supply at the first price, not at P = 0." }]) });
    S.ask("B15", { label: "Supply slope (d)", cell: "C15", answer: d, formula: "=(C10-C9)/(B10-B9)", explain: "Slope = change in supply ÷ change in price.", traps: keep(d, [{ value: 1 / d, why: "Slope upside down: change in quantity ÷ change in price." }]) });
    S.ask("B16", { label: "Demand y-intercept (a)", cell: "C16", answer: a, formula: "=D9-B9*C17", explain: "Demand = a + b·P, so a = D₁ − b·P₁.", traps: keep(a, [{ value: D1, why: "That is the demand at the first price, not at P = 0." }, { value: D1 + b * P1, why: "Sign slip: a = D₁ − b·P₁, and b is negative." }]) });
    S.ask("B17", { label: "Demand slope (b)", cell: "C17", answer: b, formula: "=(D10-D9)/(B10-B9)", explain: "Demand falls as price rises, so the slope is negative.", traps: keep(b, [{ value: -b, why: "Lost the minus sign: demand slopes down." }]) });
    S.ask("B18", {
      label: "Equilibrium price P_E ($)", cell: "C18", answer: pe, formula: "=(C16-C14)/(C15-C17)",
      explain: "At P_E supply = demand: c + d·P = a + b·P, so P_E = (a − c)/(d − b) (his S26 Final formula =(D7-D3)/(D5-D9)).",
      traps: keep(pe, [{ value: (a - c) / (d + b), why: "Sign slip: it is d − b, and b is negative, so the slopes add in size." }, { value: (a + c) / (d - b), why: "It is a − c on top." }]),
    });
    S.ask("B19", { label: `Quantity at equilibrium (${g.unit})`, cell: "C19", answer: qe, formula: "=C14+C15*C18", explain: "Put P_E into either line (supply and demand agree there).", traps: keep(qe, [{ value: a, why: "That is the demand at P = 0; use P_E." }]) });
    S.ask("B20", { label: "Total revenue at equilibrium (P_E × quantity)", cell: "C20", answer: pe * qe, formula: "=C18*C19", explain: "Revenue = price × quantity, at the equilibrium (S&D Practice D: =I7*I6)." });
    S.ask("B21", {
      label: `At $${X}, is there a surplus or a shortage?`, cell: "C21", answer: surplus ? "Surplus" : "Shortage", options: ["Surplus", "Shortage"],
      formula: "=IF(C14+C15*C12>C16+C17*C12,\"Surplus\",\"Shortage\")",
      explain: "Above P_E supply is greater than demand (a surplus); below P_E demand is greater than supply (a shortage).",
    });
    return {
      tab: "Supply and demand", title: "Supply, demand and equilibrium",
      text: [
        `At a price of $${P1} the supply of ${g.what} is ${S1} and the demand is ${D1}. At $${P2} the supply is ${S2} and the demand is ${D2} (quantities in ${g.unit}).`,
        "Assume linear models: Supply = c + d·P and Demand = a + b·P. Give exact answers (do not round) with formulas pointing at the table and your own cells.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [`Make a price column from $0 to $${roundTo(pe * 2, 10)} in steps of $10, fill supply and demand with =c+d*P and =a+b*P (absolute references on the parameters), and chart both lines on one chart. Self-check: they cross at about ($${round(pe, 2)}, ${round(qe, 1)}).`],
    };
  },
};

// ---------- Q4: empirical probability from a data table (Fall 2026 Exam 1 Section 3 (Empirical probability)) ----------
const THEMES = [
  { src: "a social media company: the type of short-form video shown to each user", c2: "Sex", v2: ["Man", "Woman"], c3: "Video type", v3: ["Gym", "Podcast", "Pets"], cut: 18, young: "a teenager", noun: "viewer" },
  { src: "a gym's booking system: the class each member booked", c2: "Membership", v2: ["Monthly", "Annual"], c3: "Class", v3: ["Yoga", "Spin", "Weights"], cut: 25, young: "a young member", noun: "member" },
  { src: "a coffee chain's app: the drink each customer ordered", c2: "Customer", v2: ["Member", "Guest"], c3: "Drink", v3: ["Latte", "Tea", "Mocha"], cut: 21, young: "a young customer", noun: "customer" },
] as const;

function weightedPick(rng: Rng, w: number[]): number {
  const t = w.reduce((s, x) => s + x, 0);
  let u = rng() * t;
  for (let i = 0; i < w.length; i++) { u -= w[i]; if (u < 0) return i; }
  return w.length - 1;
}

const empirical: BlockMaker = {
  key: "l8.empirical",
  title: "Empirical probability from data: counts, and, given, or (COUNTIFS)",
  make(rng): Block {
    const T = pick(rng, THEMES);
    const n = int(rng, 150, 240);
    const pFirst = 0.4 + 0.2 * rng();
    const pYoung = 0.15 + 0.15 * rng();
    const w = [0, 1].map(() => [0, 1, 2].map(() => 1 + int(rng, 0, 5)));
    const boost = int(rng, 0, 2);
    const rows: (number | string)[][] = [];
    for (let i = 0; i < n; i++) {
      const s = rng() < pFirst ? 0 : 1;
      const young = i === 0 || rng() < pYoung; // row 1 is always young so the "given young" denominators are never 0
      const ww = w[s].map((x, j) => x + (young && j === boost ? 3 : 0));
      const t = weightedPick(rng, ww);
      const age = young ? int(rng, T.cut - 5, T.cut) : int(rng, T.cut + 1, 65);
      rows.push([i + 1, T.v2[s], T.v3[t], age]);
    }
    const S = new Sheet();
    const D = S.table("H", TOP, ["Instance", T.c2, T.c3, "Age"], rows);
    const last = D.last;
    const R2 = `$I$9:$I$${last}`, R3 = `$J$9:$J$${last}`, RA = `$K$9:$K$${last}`;
    const cnt = (f: (r: (number | string)[]) => boolean) => rows.filter(f).length;
    const isYoung = (r: (number | string)[]) => (r[3] as number) <= T.cut;

    // Counts table, his Table 6/7 style: =COUNTIFS(range,$B10,range,C$9)
    S.header("B8", "Counts");
    T.v3.forEach((t, j) => S.header(`${"CDE"[j]}9`, t));
    T.v2.forEach((s, i) => {
      const r = 10 + i;
      S.label(`B${r}`, s);
      T.v3.forEach((t, j) => {
        const L = "CDE"[j];
        S.parts.push({
          label: `Number with ${T.c2} = ${s} and ${T.c3} = ${t}`, cell: `${L}${r}`, answer: cnt((x) => x[1] === s && x[2] === t), tol: 0,
          formula: `=COUNTIFS(${R2},$B${r},${R3},${L}$9)`,
          explain: "COUNTIFS counts the rows meeting both conditions; with $B10 and C$9 one formula fills the whole table.",
        });
      });
    });

    const s1 = pick(rng, T.v2), t1 = pick(rng, T.v3);
    const sA = pick(rng, T.v2), tA = pick(rng, T.v3);
    const sG = pick(rng, T.v2), tG = pick(rng, T.v3);
    const tY = pick(rng, T.v3);
    const drop = int(rng, 0, 2);
    const [tO1, tO2] = T.v3.filter((_, j) => j !== drop);
    const N = n;
    const pS1 = cnt((x) => x[1] === s1) / N;
    const pT1 = cnt((x) => x[2] === t1) / N;
    const pAnd = cnt((x) => x[1] === sA && x[2] === tA) / N;
    const nG = cnt((x) => x[1] === sG), nGb = cnt((x) => x[1] === sG && x[2] === tG);
    const nY = cnt(isYoung), nYb = cnt((x) => isYoung(x) && x[2] === tY);
    const nO = N - nY, nOb = cnt((x) => !isYoung(x) && (x[2] === tO1 || x[2] === tO2));
    const c = T.cut;
    S.header("B13", "Probability (use the empirical probabilities from the sample)").header("F13", "Your answer");
    S.ask("B14", { label: `Pr(${T.c2} = ${s1})`, cell: "F14", answer: pS1, format: "prob", formula: `=COUNTIF(${R2},"${s1}")/COUNTA(${R2})`, explain: "Empirical probability = how many have it ÷ how many there are (his =H4/H6)." });
    S.ask("B15", { label: `Pr(${T.c3} = ${t1})`, cell: "F15", answer: pT1, format: "prob", formula: `=COUNTIF(${R3},"${t1}")/COUNTA(${R3})`, explain: "Count that category, divide by the sample size." });
    S.ask("B16", {
      label: `Pr(${sA} and ${tA})`, cell: "F16", answer: pAnd, format: "prob", formula: `=COUNTIFS(${R2},"${sA}",${R3},"${tA}")/COUNTA(${R2})`,
      explain: "'And' means both at once: count rows with both, divide by everyone.",
      traps: keep(pAnd, [{ value: cnt((x) => x[1] === sA && x[2] === tA) / cnt((x) => x[1] === sA), why: `That is Pr(${tA} given ${sA}); 'and' divides by the whole sample.` }]),
    });
    S.ask("B17", {
      label: `Pr(${tG} given ${sG})`, cell: "F17", answer: nGb / nG, format: "prob", formula: `=COUNTIFS(${R2},"${sG}",${R3},"${tG}")/COUNTIF(${R2},"${sG}")`,
      explain: `Given ${sG}: you are in a universe of ${sG} rows only, so divide by how many are ${sG} (his =F5/H5).`,
      traps: keep(nGb / nG, [{ value: nGb / N, why: "Divided by the whole sample: that is Pr(A and B), not Pr(A given B)." }]),
    });
    S.ask("B18", {
      label: `Pr(${tY} given ${T.young}, age ≤ ${c})`, cell: "F18", answer: nYb / nY, format: "prob", formula: `=COUNTIFS(${R3},"${tY}",${RA},"<=${c}")/COUNTIF(${RA},"<=${c}")`,
      explain: `Condition on age ≤ ${c} with the criterion "<=${c}" (or classify ages first with VLOOKUP, as in the exam).`,
      traps: keep(nYb / nY, [{ value: nYb / N, why: "Divided by the whole sample instead of by the young ones." }, { value: cnt((x) => (x[3] as number) < c && x[2] === tY) / cnt((x) => (x[3] as number) < c), why: `Used < ${c}; the definition is ≤ ${c}.` }]),
    });
    S.ask("B19", {
      label: `Pr(${tO1} or ${tO2} given NOT ${T.young.replace(/^a /, "")}, age > ${c})`, cell: "F19", answer: nOb / nO, format: "prob",
      formula: `=(COUNTIFS(${R3},"${tO1}",${RA},">${c}")+COUNTIFS(${R3},"${tO2}",${RA},">${c}"))/COUNTIF(${RA},">${c}")`,
      explain: `Universe: ages over ${c}. Count those watching either type (no row is both), divide by how many are over ${c} (his =SUM(E14:F15)/SUM(H14:H15)).`,
      traps: keep(nOb / nO, [{ value: nOb / N, why: "Divided by the whole sample: the question is 'given' not a teenager." }]),
    });
    return {
      tab: "Empirical probability", title: "Empirical probability from a sample",
      text: [
        `The table (columns H to K) is a sample of ${n} rows from ${T.src}.`,
        `A ${T.noun} counts as ${T.young} if their age is ≤ ${c}.`,
        "Fill the counts table with one COUNTIFS formula filled across and down, then the probabilities. Use the empirical probabilities implied by the sample; do not round.",
      ],
      cells: S.cells, parts: S.parts,
      manual: ["Chart the counts table with one clustered column (bar) chart: categories along the axis, one series per row. Self-check: two colours, three groups, axis titles and a legend."],
    };
  },
};

export const LESSON_08: Lesson = {
  n: 8,
  title: "Linear models, breakeven, supply and demand; introduction to probability",
  unit: 1,
  week: "Week 4–5 · Wed 23 and Mon 28 Sep · Linear models, breakeven, equilibrium; introduction to probability",
  sources: ["Lesson 8, notes.xlsx", "Linear models, exercises.xlsx", "Linear models, solutions.xlsx", "Fall_2026_Exam1_solutions.xlsx", "S26_Exam1_solutions.xlsx", "S26_Final, solutions.xlsx"],
  summary:
    "Straight-line business models: total revenue TR = PQ and total cost TC = VQ + F, the breakeven quantity where they meet, and linear supply and demand lines that cross at the equilibrium price. Then the start of probability: what a probability is, the three ways of finding one, random variables, events and making random numbers with the Toolpak. Linear models and empirical probability were two of the four questions on Exam 1.",
  defs: [
    { term: "Total revenue (TR)", text: "TR = PQ: the sale price P times the quantity sold Q.", source: "Lesson 8, notes › Breakeven B3:C5 (equation box)" },
    { term: "Total cost (TC)", text: "TC = VQ + F, where V is the unit cost (variable cost) and F the fixed cost.", source: "Lesson 8, notes › Breakeven B7:C9 (equation box)" },
    { term: "Variable cost (V) and fixed cost (F)", text: "V is the unit cost, paid for each unit made; F is the fixed cost, paid whatever the quantity. On a cost line TC = F + V·Q, V is the slope and F the y-intercept.", source: "Lesson 8, notes › Breakeven B8:C9; Linear models, exercises › Cost for Soccer Balls B7:B8" },
    { term: "Breakeven quantity (Q_BE)", text: "The quantity at which total revenue equals total cost: Q_BE = F/(P − V) (his =F5/(F4-F6)).", source: "Lesson 8, notes › Breakeven B11, F7" },
    { term: "Least number to make a profit", text: "Must be strictly more than Q_BE, so round up to a whole number. For Q_BE = 16.67: 'Answer: 17. Not the answer: 16.7.'", source: "Lesson 8, notes › Breakeven F15:F17" },
    { term: "Line from two points", text: "slope = (y₂ − y₁)/(x₂ − x₁), intercept = y₂ − slope·x₂. For the soccer balls (1000, $8,500) and (2000, $14,500): slope 6, intercept 2,500, so TC = 2500 + 6Q.", source: "Linear models, solutions › Cost for Soccer Balls D13:D14" },
    { term: "Supply and demand", text: "P is the price of a product; S (supply) is the number of units a supplier is willing to produce; D (demand) is the number of willing buyers. We suppose S and D depend on P, linearly.", source: "Lesson 8, notes › S&D C4:C13" },
    { term: "Equilibrium price (P_E)", text: "The price at which supply = demand. With Demand = a + b·P and Supply = c + d·P, P_E = (a − c)/(d − b). The parameters a, b, c, d are typically not given explicitly: you find them from two points.", source: "Lesson 8, notes › S&D C11, C15:C17; Linear models, exercises › Supply and Demand C7:C8" },
    { term: "Probability", text: "A number between 0 and 1. It measures the likelihood that an outcome will happen: 1 means you are certain it will happen, 0 that it will not. It measures the proportion of a particular outcome among a population.", source: "Lesson 8, notes › Intro to Prob. B2:B7" },
    { term: "Three ways of finding a probability", text: "1. Empirical: found by experiment/sample by counting frequency (birthdays: 4/29). 2. A priori: found with a logical argument (a dice lands on 6 with probability 1/6, without throwing any dice). 3. Subjective: the view of an expert based on experience or judgement.", source: "Lesson 8, notes › Intro to Prob. B21:C28" },
    { term: "All probabilities add to 1", text: "IMPORTANT: all probabilities must add to 1.", source: "Lesson 8, notes › Intro to Prob. B31" },
    { term: "Random number generation (Toolpak)", text: "1) You need a list of values (must be numeric) and their probabilities. 2) Open the Data Analysis Toolpak and select Random Number Generation. 3) Select 1 variable and choose how many random numbers you want. 4) Highlight your value-probability table and select an output cell. (Distribution: Discrete; e.g. a coin as Heads = 1, Tails = 0, each 0.5.)", source: "Lesson 8, notes › RNG C10:C13, J7:L9" },
    { term: "Random variable", text: "A random variable X consists of two things: 1. a sample space, a list of all possible outcomes; 2. a probability distribution function (PDF), a probability assigned to each outcome. Roulette: sample space {1, 2, …, 36, 0, 00}, Pr(X = 1) = 1/38 (a priori: each number takes the same space).", source: "Lesson 8, notes › RV B2:C22" },
    { term: "Event", text: "A collection of outcomes. Roulette: a black number B, a red number R, an odd number O, each with probability 18/38.", source: "Lesson 8, notes › RV B25:C33" },
    { term: "Venn diagram", text: "Helps to see how different events overlap (R, B, O inside X = everything).", source: "Lesson 8, notes › Venn B2:B9" },
  ],
  examples: [
    {
      title: "Breakeven and the least number to sell",
      setup: "Sale price P = $150, fixed cost F = $500, unit cost V = $120 (his 'Your values' F4:F6). Find the breakeven quantity, TR and TC at Q = 50, and the least number we must sell to make a profit.",
      table: { head: ["Symbol", "Value"], rows: [["P", 150], ["F", 500], ["V", 120], ["Max Q", 50]] },
      steps: [
        { say: "Breakeven quantity Q_BE = F/(P − V)", formula: "=F5/(F4-F6)", result: "16.6667" },
        { say: "Total revenue at Q = 50 (TR = PQ)", formula: "=E11*$F$4", result: "7500" },
        { say: "Total cost at Q = 50 (TC = F + VQ)", formula: "=$F$5+E11*$F$6", result: "6500" },
        { say: "Least number for a profit: strictly above 16.67, so 17 (not 16.7). In Excel round up, as in his Exam 1 solution.", formula: "=ROUNDUP(F7,0)", result: "17" },
      ],
      takeaway: "Q_BE = F/(P − V); a profit needs the next whole number above it.",
      source: "Lesson 8, notes › Breakeven",
    },
    {
      title: "A total cost line from two points (soccer balls)",
      setup: "At a production level of 1,000 soccer balls total cost is $8,500; at 2,000 it is $14,500. What is the total cost line TC = F + V·Q?",
      table: { head: ["", "x (Q)", "y (TC)"], rows: [["Point 1", 1000, 8500], ["Point 2", 2000, 14500]] },
      steps: [
        { say: "Slope = variable cost V", formula: "=(D11-D10)/(C11-C10)", result: "6" },
        { say: "Intercept = fixed cost F", formula: "=D11-D13*C11", result: "2500" },
        { say: "So TC = 2500 + 6Q." },
      ],
      takeaway: "V is the slope, F is the intercept.",
      source: "Linear models, solutions › Cost for Soccer Balls",
    },
    {
      title: "Supply and demand equilibrium (oranges)",
      setup: "At $80 a box the supply is 270 thousand boxes and the demand 300 thousand; at $90 the supply is 320 thousand and the demand 200 thousand. Find the equilibrium price and quantity.",
      table: { head: ["", "Price", "Supply", "Demand"], rows: [["Point 1", 80, 270, 300], ["Point 2", 90, 320, 200]] },
      steps: [
        { say: "Supply slope d", formula: "=(D11-D10)/(C11-C10)", result: "5" },
        { say: "Demand slope b (negative: demand falls as price rises)", formula: "=(E11-E10)/(C11-C10)", result: "-10" },
        { say: "Supply intercept c", formula: "=D10-C10*D13", result: "-130" },
        { say: "Demand intercept a", formula: "=E10-E13*C10", result: "1100" },
        { say: "Equilibrium price P_E = (a − c)/(d − b) (his Spring 2026 Final formula shape)", formula: "=(E14-D14)/(D13-E13)", result: "82" },
        { say: "Quantity at equilibrium: put P_E into the supply line", formula: "=D14+D13*82", result: "280" },
      ],
      takeaway: "Find both lines from the two points, then set supply = demand. His chart of the two lines crosses between $80 and $90, at $82.",
      source: "Linear models, solutions › Supply and Demand (equilibrium computed; his sheet charts it)",
    },
  ],
  quiz: [
    { q: "In his notation, which formula gives the breakeven quantity Q_BE?", options: ["F/P", "F/(P − V)", "(P − V)/F", "F·(P − V)"], answer: 1, why: "Breakeven is where PQ = VQ + F, so Q(P − V) = F and Q_BE = F/(P − V) (his =F5/(F4-F6))." },
    { q: "With P = $150, F = $500 and V = $120, Q_BE = 16.67. What is the least number we must sell to make a profit?", options: ["16", "16.7", "50", "17"], answer: 3, why: "His notes: 'Answer: 17. Not the answer: 16.7.' You sell whole units and need strictly more than breakeven." },
    { q: "At 1,000 soccer balls the total cost is $8,500 and at 2,000 it is $14,500. What is the variable cost per ball?", options: ["$8.50", "$6", "$7.25", "$2,500"], answer: 1, why: "V is the slope: (14,500 − 8,500)/(2,000 − 1,000) = 6. $2,500 is the fixed cost (the intercept)." },
    { q: "The equilibrium price P_E is the price at which…", options: ["total revenue equals total cost", "demand is zero", "supply equals demand", "supply is as large as possible"], answer: 2, why: "Lesson 8 › S&D: 'Equilibrium price at which supply = demand.' Revenue = cost is breakeven, a different idea." },
    { q: "You are given q = 3p + 357.5 and q = 1425 − 4p. Which is the supply function?", options: ["q = 3p + 357.5, because supply rises with price", "q = 1425 − 4p, because its intercept is bigger", "You cannot tell without a chart", "Both are demand functions"], answer: 0, why: "Supply is the number of units suppliers are willing to produce, which goes up with price (positive slope). Demand, the number of willing buyers, goes down (negative slope)." },
    { q: "For those two lines P_E = $152.50. What happens at a price of $160?", options: ["A shortage: demand is greater than supply", "A surplus: supply is greater than demand", "Equilibrium", "Breakeven"], answer: 1, why: "His answer: '160 is greater than equilibrium. We have a surplus of supply. Demand is lower than supply.'" },
    { q: "'Roll a dice: the probability it lands on a 6 is 1/6.' We got this without throwing any dice. Which kind of probability is it?", options: ["Empirical", "Subjective", "A priori", "Conditional"], answer: 2, why: "A priori probability is found with a logical argument; empirical needs an experiment or sample." },
    { q: "A machine flips a coin 1000 times and gets 550 heads, so we say Pr(heads) = 11/20. Which kind of probability is this?", options: ["Empirical", "A priori", "Subjective", "Uniform"], answer: 0, why: "Found by experiment by counting frequency (Fall 2025 Exam 1 3(j))." },
    { q: "In his definition, a random variable X consists of two things. Which?", options: ["A mean and a standard deviation", "A sample space and a probability distribution function (PDF)", "A set of events and a Venn diagram", "A frequency table and a histogram"], answer: 1, why: "Lesson 8 › RV: 1. sample space, a list of all possible outcomes; 2. PDF, a probability assigned to each outcome." },
    { q: "Before using the Toolpak's Random Number Generation (Discrete), what do you need on the sheet?", options: ["A list of numeric values and their probabilities", "A bin range", "A histogram", "The mean and standard deviation of the data"], answer: 0, why: "Step 1 in his notes: 'You need a list of values (must be numeric) and their probabilities.' That is why a coin is coded Heads = 1, Tails = 0." },
  ],
  excel: [
    { fn: "TR and TC columns with $ references", use: "Revenue =E10*$F$4 and cost =$F$5+E10*$F$6, filled down a quantity column, give the table for the TR/TC chart. The same idea makes supply and demand columns: =(D$13*$C17+D$14)." },
    { fn: "=F/(P−V)", use: "Breakeven quantity, e.g. =F5/(F4-F6). Revenue at breakeven ('breakeven in dollars') is P times that." },
    { fn: "ROUNDUP(x, 0)", use: "Least number to make a profit: =ROUNDUP(J3/(J5-J4),0) in his Fall 2026 Exam 1 solution. Only safe when Q_BE is not already a whole number (then you need Q_BE + 1)." },
    { fn: "Slope and intercept by hand", use: "=(D11-D10)/(C11-C10) for the slope and =D11-D13*C11 for the intercept. Used for cost lines and for both supply and demand lines." },
    { fn: "Equilibrium", use: "=(D7-D3)/(D5-D9): (demand intercept − supply intercept)/(supply slope − demand slope); then quantity =D7+D12*D9." },
    { fn: "Line or scatter chart", use: "TR and TC as two separate lines on one chart (Fall 2026 Exam 1 Section 1 (Linear models): 0 to 4000 coffees); supply and demand on one chart." },
    { fn: "COUNTIF, COUNTIFS, COUNTA", use: "Empirical probability from a data table: =COUNTIFS($K$4:$K$1003,\"Man\",$L$4:$L$1003,\"Gym\") for a two-way table, =COUNTIF(K4:K1003,\"man\")/COUNTA(K4:K1003) for a probability (text criteria ignore capitals)." },
    { fn: "VLOOKUP(x, table, 2, TRUE)", use: "Classify ages into teenager / young adult / adult with an approximate-match lookup table (0, 18.1, 25.1) before counting (Fall 2026 Exam 1 Section 3 (Empirical probability))." },
    { fn: "Data Analysis Toolpak › Random Number Generation", use: "Number of variables 1, how many numbers, Distribution: Discrete, Value and Probability Input Range = your value-probability table (numeric values), choose an output cell." },
  ],
  watch: [
    "Fall 2026 Exam 1 Section 1 (Linear models) (14 points): coffee shop with F = $6000/month, P = $3.50, V = $1.25, 30 days. Profit at 30 a day = 30·30·(3.5 − 1.25) − 6000 = −3975 (a loss must be negative); least coffees a month for a profit =ROUNDUP(6000/2.25,0) = 2667; a chart of TR and TC (two separate lines, 0 to 4000); the rival who just breaks even at $10 and 25 a day has V = 10 − 6000/(30·25) = $2; from 'loses $7200 at 10 a day, makes $9000 at 100 a day' V = $4 and F = $9000.",
    "Spring 2026 Exam 1 Q4: price $162, total cost $20,600 at 70 units and $23,800 at 110. V = 80, F = 15,000, least number for a profit 183, and the least price to profit after selling 50 units = (50·80 + 15000)/50 = $380.",
    "Spring 2026 Final Q2 (8 points): at $50 supply 100 and demand 800; at $200 supply 700 and demand 200. Supply intercept −100, slope 4; demand intercept 1000, slope −4; P_E = 137.5; demand at equilibrium 450. Fall 2025 Final had the same question with other numbers. 'Do not round.'",
    "Fall 2026 Exam 1 Section 3 (Empirical probability): a 1000-row table of users. COUNTIFS for the men/women × video type table, then Pr(man) = 493/1000, Pr(pets) = 0.211, Pr(podcast given woman) = 192/507, Pr(gym given teenager) = 45/124, and Pr(gym or podcast given not a teenager) = 0.797. The 'given' probabilities divide by the count of the condition, not by 1000.",
    "Common slips: per-day vs per-month (multiply by 30); dividing F by P instead of P − V; giving 16.7 instead of 17; a demand slope with no minus sign; computing 'given' with the whole sample in the denominator; using < instead of ≤ for an age cut-off.",
    "Fall 2025 Exam 1 3(j) asked which kind of probability 550 heads in 1000 flips gives (empirical). Know the three kinds by name.",
  ],
  makers: [breakeven, costline, equilibrium, empirical],
};
