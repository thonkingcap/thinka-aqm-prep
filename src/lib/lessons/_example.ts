// A worked example of a lesson file, for authors. NOT registered in index.ts. Copy its shape.
// (The content here mirrors the style of Fall 2026 Exam 1 Q1; the real Lesson 7/8 files hold the real content.)
import { Sheet, int, pick, round, TOP, type BlockMaker, type Block } from "./kit.ts";
import type { Lesson } from "./types.ts";

const breakeven: BlockMaker = {
  key: "l99.breakeven",
  title: "Breakeven for a linear cost and revenue model",
  make(rng): Block {
    // 1) Choose numbers so every answer is clean and the versions differ.
    const fixed = pick(rng, [4000, 4500, 6000, 7200, 9000]);
    const price = pick(rng, [3.5, 4, 4.25, 5]);
    const unit = pick(rng, [1, 1.25, 1.5, 1.75]);
    const perDay = int(rng, 20, 40);
    const days = 30;
    const margin = price - unit;
    const profitAtSales = perDay * days * margin - fixed;
    const be = fixed / margin;
    const least = Math.floor(be) + 1; // strictly more than breakeven makes a profit

    // 2) Lay the tab out like the professor: givens in a small table, answers beside labels.
    const S = new Sheet();
    S.header(`B${TOP}`, "Given").header(`C${TOP}`, "Value");
    S.label(`B${TOP + 1}`, "Fixed cost per month ($)").given(`C${TOP + 1}`, fixed);
    S.label(`B${TOP + 2}`, "Price per coffee ($)").given(`C${TOP + 2}`, price);
    S.label(`B${TOP + 3}`, "Cost to make one coffee ($)").given(`C${TOP + 3}`, unit);
    S.label(`B${TOP + 4}`, "Coffees sold per day").given(`C${TOP + 4}`, perDay);
    S.label(`B${TOP + 5}`, "Days in a month").given(`C${TOP + 5}`, days);
    const r = TOP + 7;
    S.header(`B${r}`, "Question").header(`C${r}`, "Your answer");

    // 3) Each answer: the formula a student should type (pointing at the givens) and the number it gives.
    S.ask(`B${r + 1}`, {
      label: "Profit (or loss, as a negative) per month", cell: `C${r + 1}`, answer: profitAtSales,
      formula: `=C${TOP + 4}*C${TOP + 5}*(C${TOP + 2}-C${TOP + 3})-C${TOP + 1}`,
      explain: "Profit = revenue − cost = q·p − (F + q·c) with q = coffees per day × days.",
      traps: [{ value: perDay * days * price - fixed, why: "Forgot the cost of making each coffee." }],
    });
    S.ask(`B${r + 2}`, {
      label: "Breakeven quantity (coffees per month)", cell: `C${r + 2}`, answer: be,
      formula: `=C${TOP + 1}/(C${TOP + 2}-C${TOP + 3})`,
      explain: "Breakeven where revenue = cost: q = F/(p − c).",
      traps: [{ value: fixed / price, why: "Divided by the price, not the margin p − c." }],
    });
    S.ask(`B${r + 3}`, {
      label: "Least number of coffees a month to make a profit", cell: `C${r + 3}`, answer: least, tol: 0,
      formula: `=INT(C${r + 2})+1`,
      explain: "Profit needs strictly more than the breakeven quantity, so round down and add one.",
      traps: [{ value: Math.ceil(be) === be ? be : Math.ceil(be) - 1, why: "Rounded the wrong way." }].filter((t) => t.value !== least),
    });
    return {
      tab: "Breakeven", title: "Breakeven analysis",
      text: [
        `A coffee shop has fixed costs of $${fixed} a month, sells coffee for $${price} and each coffee costs $${unit} to make. Assume ${days} days in a month.`,
        "Fill the yellow cells with formulas that point at the givens.",
      ],
      cells: S.cells, parts: S.parts,
      manual: ["Chart total revenue and total cost against coffees sold (0 to 4000) as two lines on one chart. Self-check: they cross at your breakeven quantity."],
    };
  },
};
void round;

export const EXAMPLE: Lesson = {
  n: 99, title: "Example lesson", unit: 1, week: "Week 4 · Wed 23 Sep · Linear models in business",
  sources: ["Lesson 8, notes.xlsx"],
  summary: "Two plain sentences.",
  defs: [
    { term: "Fixed cost", text: "A cost you pay no matter how many units you make.", red: true, source: "Lesson 8, notes › Breakeven B4" },
    { term: "Variable cost", text: "The cost of making each unit.", source: "…" },
    { term: "Breakeven point", text: "Where total revenue equals total cost.", source: "…" },
  ],
  examples: [{ title: "Breakeven", setup: "…", steps: [{ say: "Margin per unit", formula: "=C10-C11", result: "2.25" }], takeaway: "q = F/(p − c)", source: "Lesson 8, notes › Breakeven" }],
  quiz: [
    { q: "…", options: ["a", "b", "c"], answer: 0, why: "…" },
    { q: "…2", options: ["a", "b"], answer: 1, why: "…" },
    { q: "…3", options: ["a", "b"], answer: 1, why: "…" },
    { q: "…4", options: ["a", "b"], answer: 1, why: "…" },
    { q: "…5", options: ["a", "b"], answer: 1, why: "…" },
  ],
  excel: [{ fn: "INT", use: "Round down a breakeven quantity before adding one." }],
  watch: ["Exam 1 (Fall 2026) Q1 asked for the least number sold for a profit: that's strictly above breakeven."],
  makers: [breakeven],
};
