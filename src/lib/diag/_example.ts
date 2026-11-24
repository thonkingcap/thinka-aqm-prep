// A tiny example diagnostic for authors (NOT registered). Shows a fixed-answer section and a simulation
// section whose answers are marked against the student's own random numbers.
import { qn, table, label, col, hint, type DPaper, type DSection, type Cell } from "./kit.ts";
import { mulberry32, gauss, round } from "../lessons/kit.ts";

const linear: DSection = (() => {
  const c: Record<string, Cell> = {};
  label(c, "I3", "Fixed cost"); c.J3 = { v: 6000, role: "given" };
  label(c, "I4", "Variable cost"); c.J4 = { v: 1.25, role: "given" };
  label(c, "I5", "Price"); c.J5 = { v: 3.5, role: "given" };
  qn(c, 1, 3); qn(c, 2, 5);
  return {
    tab: "Linear models", title: "Linear models",
    items: [
      { kind: "lead", text: "Rufus has fixed costs of $6000 a month, sells coffee for $3.50 and each coffee costs $1.25 to make. Assume 30 days in a month." },
      { kind: "q", n: 1, text: "If Rufus sells 30 coffees every day how much money does he make or lose each month?", points: 2 },
      { kind: "q", n: 2, text: "What is the least number of coffees Rufus must sell a month to make a profit?", points: 3 },
    ],
    cells: c,
    questions: [
      { n: 1, points: 2, lesson: 8, title: "Monthly profit", parts: [{ label: "Profit", cell: "D3", tone: "blue", answer: 30 * 30 * 2.25 - 6000, formula: "=30*30*(J5-J4)-J3", explain: "Profit = q(P − V) − F." }] },
      { n: 2, points: 3, lesson: 8, title: "Least number for a profit", parts: [{ label: "Least number", cell: "D5", tone: "blue", answer: 2667, tol: 0, formula: "=INT(J3/(J5-J4))+1", explain: "Strictly above breakeven F/(P − V) = 2666.67." }] },
    ],
  };
})();

const sim: DSection = (() => {
  const rng = mulberry32(7);
  const ex = Array.from({ length: 100 }, () => round(50 + 10 * gauss(rng), 4));
  const c: Record<string, Cell> = {};
  qn(c, 3, 3); table(c, "D3", "Table 1"); hint(c, "D4", "Simulated value");
  qn(c, 4, 6); label(c, "F6", "mean");
  const example: Record<string, Cell> = {};
  col(example, "D", 5, ex);
  const m = ex.reduce((s, x) => s + x, 0) / ex.length;
  return {
    tab: "Simulation", title: "Simulation",
    items: [
      { kind: "q", n: 3, text: "Use the random number generator to simulate 100 values from a normal distribution with mean 50 and standard deviation 10, and put them in Table 1.", points: 1 },
      { kind: "q", n: 4, text: "What is the mean of your simulated values?", points: 1 },
    ],
    cells: c, example,
    questions: [
      { n: 3, points: 1, lesson: 11, title: "Simulate", parts: [], unmarked: "Your 100 values should average about 50 with standard deviation about 10." },
      { n: 4, points: 1, lesson: 11, title: "Mean of the simulation", parts: [{ label: "Mean", cell: "G6", tone: "blue", live: true, band: [46, 54], answer: m, formula: "=AVERAGE(D5:D104)", explain: "AVERAGE of your own simulated values (about 50)." }] },
    ],
  };
})();

export const EXAMPLE_DIAG: DPaper = {
  id: "dx:example", title: "Example diagnostic", header: "AQM1000, Example diagnostic (AQM Prep)", file: "AQM-example-diagnostic", minutes: 10,
  instructions: ["This exam is 10 minutes long.", "Do not round numerical answers, leave them as exact as possible.", "Blue answer cells need to contain an Excel formula to receive credit. Pink cells just require the answer."],
  sections: [linear, sim],
};
