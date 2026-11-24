// Lesson 7: Histogram shapes, and a first look at linear models. Built from "Lesson 7, notes (root copy)" (the fuller
// version): sheets "Exam scores", "Shapes" and "Linear models". Breakeven and supply & demand are Lesson 8.
import { Sheet, int, pick, shuffle, TOP, type Block, type BlockMaker, type Trap } from "./kit.ts";
import type { Lesson } from "./types.ts";

// ---------- local statistics helpers (independent of the formula engine) ----------
const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
const devsq = (x: number[]) => { const m = mean(x); return x.reduce((s, v) => s + (v - m) ** 2, 0); };
const varS = (x: number[]) => devsq(x) / (x.length - 1);
const varP = (x: number[]) => devsq(x) / x.length;
function median(x: number[]) {
  const s = [...x].sort((a, b) => a - b), h = 0.5 * (s.length - 1), lo = Math.floor(h);
  return lo + 1 >= s.length ? s[lo] : s[lo] + (h - lo) * (s[lo + 1] - s[lo]);
}
const traps = (answer: number, tol: number, ts: Trap[]): Trap[] => ts.filter((t) => Number.isFinite(t.value) && Math.abs(t.value - answer) > 1.5 * tol + 1e-9);
const defTol = (a: number) => Math.max(0.01, 0.002 * Math.abs(a));

// ---------- Q1: describe the shape of a histogram (Exam scores sheet) ----------
const SHAPES_7 = ["Symmetric", "Skewed right", "Skewed left", "Bimodal", "Uniform"];
type Shape7 = "Symmetric" | "Skewed right" | "Skewed left" | "Bimodal" | "Uniform";
const PROFILE_10: Record<Shape7, number[]> = {
  Symmetric: [1, 2, 4, 7, 10, 10, 7, 4, 2, 1],
  "Skewed right": [3, 9, 12, 9, 6, 4, 3, 2, 1, 1],
  "Skewed left": [1, 1, 2, 3, 4, 6, 9, 12, 9, 3],
  Bimodal: [1, 4, 9, 6, 2, 2, 6, 9, 4, 1],
  Uniform: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
};
const WHY_7: Record<Shape7, string> = {
  Symmetric: "One peak in the middle and both sides look alike: symmetric (\"it approximately looks symmetric\"); the mean and median are close.",
  "Skewed right": "The mode is pushed to the left with a long tail to the right: right skewed. The tail pulls the mean above the median.",
  "Skewed left": "The mode is pushed to the right with a long tail to the left: left skewed. The tail pulls the mean below the median.",
  Bimodal: "Two pronounced peaks: bimodal (multimodal means more than one pronounced peak).",
  Uniform: "Roughly the same height in every bin: uniform (\"it approximately has the same height everywhere\").",
};
const SCORE_CTX = [
  { head: "Exam 2 score", story: "Here are the Exam 2 scores of a large class." },
  { head: "Final exam score", story: "Here are the final exam scores of a large class." },
  { head: "Wait time (minutes)", story: "A bank recorded how long each customer waited to be served." },
  { head: "Order size (items)", story: "A warehouse recorded the number of items in each order." },
];
const shapes: BlockMaker = {
  key: "l7.shapes",
  title: "Describe a histogram's shape (symmetric, skewed, bimodal, uniform)",
  make(rng): Block {
    const ctx = pick(rng, SCORE_CTX);
    const shape = pick(rng, SHAPES_7) as Shape7;
    const w = pick(rng, [2, 3, 4, 5]);
    const a = pick(rng, [10, 15, 20, 24]);
    const k = 10;
    const lim = Array.from({ length: k }, (_, i) => a + i * w);
    const mult = pick(rng, [1, 1.5]);
    const x: number[] = [];
    PROFILE_10[shape].forEach((p, i) => {
      const cnt = Math.max(1, Math.round(p * mult) + (p >= 4 ? int(rng, -1, 1) : 0));
      for (let j = 0; j < cnt; j++) x.push(int(rng, lim[i] - w + 1, lim[i]));
    });
    const data = shuffle(rng, x);
    const n = data.length, first = TOP + 1, last = TOP + n, R = `B${first}:B${last}`;
    const S = new Sheet();
    S.header(`B${TOP}`, ctx.head);
    data.forEach((v, i) => S.set(`B${first + i}`, v, "data"));
    S.header(`G${TOP}`, "Bins");
    lim.forEach((u, i) => S.given(`G${first + i}`, u));
    S.header(`D${TOP}`, "Measure").header(`E${TOP}`, "Value");
    const m = mean(data), s = Math.sqrt(varS(data)), md = median(data);
    const r = TOP + 1;
    S.ask(`D${r}`, {
      label: "avg", cell: `E${r}`, answer: m, formula: `=AVERAGE(${R})`, explain: "AVERAGE of the data, as in his cell H3.",
      traps: traps(m, defTol(m), [{ value: md, why: "That is the median." }]),
    });
    S.ask(`D${r + 1}`, {
      label: "std", cell: `E${r + 1}`, answer: s, formula: `=STDEV.S(${R})`, explain: "Sample standard deviation: STDEV.S.",
      traps: traps(s, defTol(s), [{ value: Math.sqrt(varP(data)), why: "STDEV.P is the population version; use STDEV.S." }]),
    });
    S.ask(`D${r + 3}`, { label: "max", cell: `E${r + 3}`, answer: Math.max(...data), formula: `=MAX(${R})`, explain: "MAX, as in his cell H6." });
    S.ask(`D${r + 4}`, { label: "min", cell: `E${r + 4}`, answer: Math.min(...data), formula: `=MIN(${R})`, explain: "MIN, as in his cell H7." });
    S.ask(`D${r + 5}`, {
      label: "median", cell: `E${r + 5}`, answer: md, formula: `=MEDIAN(${R})`, explain: "MEDIAN: compare it with the mean when judging skew.",
      traps: traps(md, defTol(md), [{ value: m, why: "That is the mean." }]),
    });
    S.ask(`D${r + 7}`, {
      label: "Shape of the histogram", cell: `E${r + 7}`, answer: shape, formula: `"${shape}"`, options: SHAPES_7,
      explain: `${WHY_7[shape]} Make the Toolpak histogram with the bins in column G to see it.`,
    });
    return {
      tab: "Histogram shape", title: "Describe the shape",
      text: [
        `${ctx.story} The ${n} values are in column B; bins of width ${w} are in column G.`,
        "Find avg, std, max, min and the median (as on his Exam scores sheet). Then make a Toolpak histogram with the bins in column G and describe its shape.",
        `Shape options: ${SHAPES_7.join(", ")}.`,
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        "Data > Data Analysis > Histogram with Input Range = column B and Bin Range = column G, Chart Output ticked. Self-check: the shape you chose is what the bars show, and the frequencies add up to the number of values.",
      ],
    };
  },
};

// ---------- Q2: skew from the mean, median and mode (the mortality example) ----------
const SUM_CTX = [
  { name: "House prices in a town ($000)", base: 350, step: 18 },
  { name: "Household income ($000)", base: 62, step: 5 },
  { name: "Age at retirement (years)", base: 64, step: 1.5 },
  { name: "Score on an easy test (%)", base: 80, step: 3 },
  { name: "Light bulb lifetime (hours)", base: 1000, step: 40 },
  { name: "Marathon finish time (minutes)", base: 265, step: 9 },
  { name: "Items in a shopping basket", base: 12, step: 1 },
  { name: "Delivery time (days)", base: 4, step: 0.5 },
];
const SUM_SHAPES = ["Symmetric", "Skewed right", "Skewed left"];
const summary: BlockMaker = {
  key: "l7.summary",
  title: "Skew from the mean, median and mode",
  make(rng): Block {
    const ctxs = shuffle(rng, SUM_CTX).slice(0, 4);
    const kinds = shuffle(rng, ["Skewed right", "Skewed left", "Symmetric", pick(rng, ["Skewed right", "Skewed left"])]);
    const S = new Sheet();
    S.header(`B${TOP}`, "Data set").header(`C${TOP}`, "Mean").header(`D${TOP}`, "Median").header(`E${TOP}`, "Mode").header(`F${TOP}`, "Shape");
    ctxs.forEach((c, i) => {
      const row = TOP + 1 + i;
      const kind = kinds[i];
      const d1 = c.step * int(rng, 1, 3), d2 = c.step * int(rng, 1, 3);
      const md = c.base + c.step * int(rng, -2, 2);
      const [mn, mo] = kind === "Skewed right" ? [md + d1, md - d2] : kind === "Skewed left" ? [md - d1, md + d2] : [md, md];
      const fix = (v: number) => Number(v.toFixed(2));
      S.text(`B${row}`, c.name);
      S.given(`C${row}`, fix(mn)).given(`D${row}`, fix(md)).given(`E${row}`, fix(mo));
      S.parts.push({
        label: `Shape: ${c.name}`, cell: `F${row}`, answer: kind, options: SUM_SHAPES,
        formula: `=IF(C${row}>D${row},"Skewed right",IF(C${row}<D${row},"Skewed left","Symmetric"))`,
        explain: kind === "Skewed right"
          ? "Mode < median < mean: the long right tail pulls the mean up, and the mode (the peak) is pushed left. Right skewed."
          : kind === "Skewed left"
            ? "Mean < median < mode, like the mortality data (mean 79, median 82, mode 86): the long left tail pulls the mean down. Left skewed."
            : "Mean, median and mode coincide: symmetric.",
      });
    });
    return {
      tab: "Skew from summaries", title: "Skew from the mean, median and mode",
      text: [
        "Each row gives the mean, median and mode of a data set. Without a chart, decide whether each is symmetric, skewed right or skewed left.",
        "Recall the mortality example: men's age at death has mean 79, median 82 and mode 86, and its histogram is left skewed.",
        "Write a formula that compares the mean with the median, or type your answer.",
      ],
      cells: S.cells, parts: S.parts,
      colWidths: [3, 34, 12, 12, 12, 16, 12, 12],
    };
  },
};

// ---------- Q3: the Linear models sheet (one simple tab; breakeven practice is Lesson 8) ----------
const line: BlockMaker = {
  key: "l7.line",
  title: "Linear models: fill the revenue and total cost lines",
  make(rng): Block {
    const P = pick(rng, [12, 15, 20, 35, 40, 48]);
    const V = pick(rng, [0.4, 0.5, 0.6, 0.7].map((f) => Math.round(P * f)));
    const F = pick(rng, [300, 500, 1200, 2000, 2500, 4000]);
    const step = pick(rng, [50, 100, 200, 250]);
    const cR = 0;
    const S = new Sheet();
    S.header(`B${TOP}`, "Q").header(`C${TOP}`, "R").header(`D${TOP}`, "TC");
    const qs = [0, step, 2 * step, 3 * step];
    qs.forEach((q, i) => S.given(`B${TOP + 1 + i}`, q));
    S.label(`G${TOP + 1}`, "P").given(`H${TOP + 1}`, P);
    S.label(`G${TOP + 2}`, "c").given(`H${TOP + 2}`, cR);
    S.label(`G${TOP + 4}`, "V").given(`H${TOP + 4}`, V);
    S.label(`G${TOP + 5}`, "F").given(`H${TOP + 5}`, F);
    qs.forEach((q, i) => {
      const row = TOP + 1 + i;
      S.parts.push({
        label: `R at Q = ${q}`, cell: `C${row}`, answer: P * q + cR, formula: `=$H$${TOP + 1}*B${row}+$H$${TOP + 2}`,
        explain: "Revenue is the line y = mx + c with slope P (the price) and intercept c = 0: =$H$9*B9+$H$10, filled down.",
        traps: traps(P * q + cR, defTol(P * q + cR), [{ value: V * q, why: "Used the unit cost V instead of the price P." }]),
      });
      S.parts.push({
        label: `TC at Q = ${q}`, cell: `D${row}`, answer: V * q + F, formula: `=$H$${TOP + 4}*B${row}+$H$${TOP + 5}`,
        explain: "Total cost is the line with slope V (the cost of each unit) and intercept F (the fixed cost): =$H$12*B9+$H$13, filled down.",
        traps: traps(V * q + F, defTol(V * q + F), [{ value: V * q, why: "Forgot the fixed cost F." }, { value: F * q + V, why: "Swapped slope and intercept: TC = V·Q + F." }]),
      });
    });
    const r = TOP + 7;
    S.ask(`B${r}`, {
      label: "Slope of the TC line (from two rows of your table)", cell: `D${r}`, answer: V, formula: `=(D${TOP + 3}-D${TOP + 2})/(B${TOP + 3}-B${TOP + 2})`,
      explain: "Slope = change in TC ÷ change in Q between any two rows. It equals V: each extra unit adds V to the total cost.",
      traps: traps(V, defTol(V), [{ value: (V * 2 * step + F) / (2 * step), why: "Divided TC by Q: that is the average cost per unit, not the slope (it includes the fixed cost)." }]),
    });
    S.ask(`B${r + 1}`, {
      label: "Intercept of the TC line (TC when Q = 0)", cell: `D${r + 1}`, answer: F, formula: `=D${TOP + 1}`,
      explain: "The intercept c of y = mx + c is the value at x = 0: for total cost that is the fixed cost F.",
    });
    return {
      tab: "Linear models", title: "Revenue and total cost as lines",
      text: [
        `A product sells for P = $${P} each (revenue line R = P·Q + c with c = 0). Each unit costs V = $${V} to make and the fixed cost is F = $${F}, so TC = V·Q + F.`,
        "Fill the R and TC columns with formulas that point at the constants (use $ so they fill down), as on his Linear models sheet.",
        "Then read the slope and intercept of the TC line from your table.",
      ],
      cells: S.cells, parts: S.parts,
      manual: ["Chart R and TC against Q as two lines on one chart (Insert > Scatter with straight lines), with a title and axis titles. Self-check: the TC line starts at F on the vertical axis and the two lines cross where R = TC (Lesson 8 calls this the breakeven point)."],
    };
  },
};

export const LESSON_07: Lesson = {
  n: 7,
  title: "Histogram shapes, and linear models",
  unit: 1,
  week: "Week 4 · Mon 21 / Wed 23 Sep · Histogram shapes, then the start of linear models",
  sources: ["Lesson 7, notes (root copy).xlsx"],
  summary:
    "Once a histogram is drawn you describe it: symmetric, skewed left or right, unimodal or multimodal, uniform, with or without outliers. The lesson then starts linear models, y = mx + c, writing revenue and total cost as straight lines in the quantity sold.",
  defs: [
    { term: "Describing a histogram", text: "A histogram can be described as symmetric, multimodal, uniform or skew (definitions below).", source: "Lesson 7, notes › Shapes L3" },
    { term: "Symmetric", text: "It approximately looks symmetric.", source: "Lesson 7, notes › Shapes L5" },
    { term: "Multimodal, unimodal, bimodal", text: "Multimodal: if it has more than one pronounced peak. Unimodal: one peak. Bimodal: two.", source: "Lesson 7, notes › Shapes L6–M8" },
    { term: "Uniform", text: "It approximately has the same height everywhere.", source: "Lesson 7, notes › Shapes L9" },
    { term: "Skew", text: "If the mode is pushed left/right, it is right/left-skewed.", source: "Lesson 7, notes › Shapes L10" },
    { term: "Earthquake histogram", text: "Right skew, unimodal, and a \"bad chart\": nothing between zero and one (maybe it doesn't register, maybe it isn't officially an earthquake). Any outliers? Possibly the magnitude 7 data point: you could argue both sides, for (high Z-score) and against (the data is real, not an error).", source: "Lesson 7, notes › Shapes K20–K29" },
    { term: "Mortality histogram", text: "Numbers of men expected to die at each age, out of 100,000 born (2010–2012 rates): left skew, unimodal, with an outlier-like spike at birth, which \"represents an infant mortality mode in the data\". The expectation (mean) is 79, the median 82 and the mode 86.", source: "Lesson 7, notes › Shapes K45–L50, B60" },
    { term: "Skew and mean vs median (key fact)", text: "In the left-skewed mortality data the mean (79) is below the median (82), which is below the mode (86): the long tail pulls the mean toward it. So a mean below the median suggests left skew, and a mean above the median suggests right skew.", source: "Lesson 7, notes › Shapes B60 (key fact from his example)" },
    { term: "Linear relationship", text: "A linear relationship between a dependent variable y depending on an independent x means y = mx + c, where m and c are fixed numbers (constants).", source: "Lesson 7, notes › Linear models B2, F4, H4" },
    { term: "Revenue and total cost lines", text: "With quantity Q: revenue R = P·Q + c, where P is the price (on his sheet P = 35 and c = 0); total cost TC = V·Q + F, where V is the cost of each unit (variable cost) and F the fixed cost (V = 25, F = 300). The slope of R is P; the slope of TC is V and its intercept is F.", source: "Lesson 7, notes › Linear models B6–I10" },
  ],
  examples: [
    {
      title: "Exam 1 scores: summary and Toolpak histogram",
      setup: "67 Exam 1 scores are in B4:B71 (B3 holds the maximum possible, 57, and is not a score; B41 is empty). Find avg, max and min, then a Toolpak histogram with bins 3, 6, 9, …, 57.",
      table: { head: ["Bin", "Frequency"], rows: [[21, 2], [24, 4], [27, 4], [30, 9], [33, 7], [36, 7], [39, 6], [42, 8], [45, 7], [48, 7], [51, 3], [54, 3]] },
      steps: [
        { say: "avg", formula: "=AVERAGE(B4:B71)", result: "36.776" },
        { say: "std (his cell is left blank; the sample standard deviation is)", formula: "=STDEV.S(B4:B71)", result: "8.790" },
        { say: "max and min", formula: "=MAX(B4:B71)  and  =MIN(B4:B71)", result: "54 and 20" },
        { say: "Toolpak Histogram: Input Range B4:B71, Bin Range G10:G28 (bins of width 3)", result: "bins 3 to 18 are empty; the counts from 21 to 54 are in the table above" },
        { say: "Median, to compare with the mean", formula: "=MEDIAN(B4:B71)", result: "37" },
      ],
      takeaway: "Mean 36.8 and median 37 are almost equal and the bars spread fairly evenly from 21 to 54, with no single pronounced peak. (The notes do not record his description of this chart.)",
      source: "Lesson 7, notes (root copy) › Exam scores",
    },
    {
      title: "Reading shape from the mean, median and mode",
      setup: "Men's age at death (out of 100,000 born, 2010–2012 mortality rates): expectation 79, median 82, mode 86. The histogram has a small spike at age 0.",
      steps: [
        { say: "Order the three measures", result: "mean 79 < median 82 < mode 86" },
        { say: "The mode (the tallest peak) is pushed to the right, so by the definition the histogram is…", result: "left skewed" },
        { say: "The spike at birth", result: "\"an infant mortality mode\": an outlier-like second bump, not an error" },
      ],
      takeaway: "Left skew: mean < median < mode. The tail drags the mean furthest.",
      source: "Lesson 7, notes › Shapes K45–L50, B60",
    },
    {
      title: "The Linear models sheet: revenue and total cost",
      setup: "P = 35 and c = 0 for revenue; V = 25 and F = 300 for total cost. Fill R and TC for Q = 0, 100, 200, 300.",
      table: { head: ["Q", "R", "TC"], rows: [[0, 0, 300], [100, 3500, 2800], [200, 7000, 5300], [300, 10500, 7800]] },
      steps: [
        { say: "Revenue in C7 (anchor the constants, fill down)", formula: "=$H$6*B7+$H$7", result: "0, 3500, 7000, 10500" },
        { say: "Total cost in D7 (fill down)", formula: "=$I$9*B7+$I$10", result: "300, 2800, 5300, 7800" },
        { say: "Slope of TC between Q = 100 and Q = 200", formula: "=(D9-D8)/(B9-B8)", result: "25 = V" },
      ],
      takeaway: "Both are lines y = mx + c: revenue has slope P and intercept 0; total cost has slope V and intercept F. Where they cross is the breakeven point of Lesson 8.",
      source: "Lesson 7, notes › Linear models",
    },
  ],
  quiz: [
    { q: "A histogram has approximately the same height everywhere. It is…", options: ["Symmetric and unimodal", "Uniform", "Bimodal", "Skewed"], answer: 1, why: "Uniform: \"it approximately has the same height everywhere\"." },
    { q: "\"Multimodal\" means the histogram has…", options: ["Exactly one peak", "More than one pronounced peak", "No peak", "A long tail"], answer: 1, why: "Multimodal: more than one pronounced peak (unimodal: one; bimodal: two)." },
    { q: "The mode of a histogram is pushed to the left. It is…", options: ["Left-skewed", "Right-skewed", "Symmetric", "Uniform"], answer: 1, why: "\"If the mode is pushed left/right, right/left-skewed\": pushed left means right-skewed." },
    { q: "Ages at death: mean 79, median 82, mode 86. The histogram is…", options: ["Right skewed", "Left skewed", "Symmetric", "Uniform"], answer: 1, why: "The mode is pushed right and the long tail is on the left, which pulls the mean down: left skewed." },
    { q: "In the earthquake histogram, is the magnitude 7 point an outlier?", options: ["Yes, always remove it", "No, never", "You could argue both sides: high Z-score for, real data (not an error) against", "Only if it is the mode"], answer: 2, why: "The notes argue both sides; outliers are a judgement." },
    { q: "In y = mx + c, m and c are…", options: ["Variables that change with x", "Fixed numbers (constants)", "Always positive", "The dependent variables"], answer: 1, why: "\"m and c are fixed numbers (constants).\"" },
    { q: "For total cost TC = V·Q + F, which is the intercept?", options: ["V, the unit cost", "F, the fixed cost", "Q, the quantity", "P, the price"], answer: 1, why: "The intercept is the value at Q = 0, the fixed cost F. The slope is V." },
    { q: "With P = 35 and c = 0, what is the revenue at Q = 200?", options: ["235", "5300", "7000", "7035"], answer: 2, why: "R = 35 × 200 + 0 = 7000 (his Linear models sheet)." },
  ],
  excel: [
    { fn: "AVERAGE, STDEV.S, MAX, MIN, MEDIAN", use: "The avg, std, max and min block on the Exam scores sheet (=AVERAGE(B4:B71), =MAX(B4:B71), =MIN(B4:B71)); the median to compare with the mean." },
    { fn: "Data Analysis Toolpak: Histogram", use: "Bins of width 3 (3, 6, …, 57) in a column, then Data > Data Analysis > Histogram with that Bin Range and Chart Output." },
    { fn: "Absolute references in a line", use: "=$H$6*B7+$H$7 for R and =$I$9*B7+$I$10 for TC, filled down: the constants stay fixed while Q moves." },
    { fn: "Line chart of R and TC", use: "Plot both columns against Q on one chart with a title and axis titles (Fall 2026 Exam 1 Section 1 (Linear models) asked for exactly this)." },
  ],
  watch: [
    "Spring 2026 Exam 1 quick questions 5–6: choose the adjectives for a pictured histogram (positive skew, negative skew, symmetric, bimodal, none of the above). Positive skew = right skew, negative skew = left skew.",
    "Fall 2026 Exam 1 Section 2 (Random variables): describe the shape of your Toolpak histogram of tip amounts; his key wrote \"Unimodal, right (positive) skew.\" Name the number of peaks and the direction of skew.",
    "Homework 4 Q1 and Q6: boxplots of Z-scores for three exams, and a Toolpak histogram of the weighted scores: the same exam-score data style as this lesson.",
    "Fall 2026 Exam 1 Section 1 (Linear models): \"Produce a chart with two separate lines for the total revenue and cost\" for quantities 0 to 4000. The lines are R = P·Q and TC = V·Q + F, as on the Linear models sheet; Lesson 8 does the breakeven questions.",
    "Common slips: naming the skew by the side of the peak instead of the tail (peak on the left = right skew); calling every histogram with a bump bimodal (the peaks must be pronounced); forgetting the fixed cost F in TC, or the $ signs so the formula breaks when filled down.",
  ],
  makers: [shapes, summary, line],
};
