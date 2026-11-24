// Lesson 9: discrete probability. Random variables, a priori probability, events (not / and / or / given),
// expectation and variance of a discrete random variable, and simulating one with the RNG.
// Built from "Lesson 9, notes" (variance is from the start of "Lesson 10, notes", the next class), the old
// probability homework (roulette, two dice) and Fall 2026 Exam 1 Section 2 (Random variables) / Fall 2025 Exam 1 Part 4.
import { Sheet, col, colNum, int, pick, round, TOP, type BlockMaker, type Block, type Rng } from "./kit.ts";
import type { Lesson } from "./types.ts";

// ---------- small local helpers ----------
const keep = (answer: number, ts: { value: number; why: string }[]) =>
  ts.filter((t) => Number.isFinite(t.value) && Math.abs(t.value - answer) > Math.max(1e-4, Math.abs(answer) * 0.004));
/** Tight tolerance: his instruction is "do not round", and every answer here is a formula. */
const tight = (x: number) => Math.max(1e-6, Math.abs(x) * 1e-5);
const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);
const mean = (xs: number[]) => sum(xs) / xs.length;
const varS = (xs: number[]) => { const m = mean(xs); return sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1); };
/** Column widths: 3 for column A, 14 by default, with overrides by letter. */
function widths(lastCol: string, over: Record<string, number>): number[] {
  return Array.from({ length: colNum(lastCol) + 1 }, (_, k) => (k === 0 ? 3 : over[col(k)] ?? 14));
}
/** k probabilities in steps of 0.05 that add to 1, each at least 0.05, usually with one or two big ones. */
function probs(rng: Rng, k: number): number[] {
  const u = Array(k).fill(1);
  const w = Array.from({ length: k }, () => 0.15 + rng() ** 2);
  const tw = sum(w);
  for (let i = k; i < 20; i++) {
    let r = rng() * tw, j = 0;
    while (j < k - 1 && (r -= w[j]) >= 0) j++;
    u[j]++;
  }
  return u.map((x) => x / 20);
}
function draw(rng: Rng, values: number[], p: number[]): number {
  let r = rng();
  for (let i = 0; i < values.length; i++) { r -= p[i]; if (r < 0) return values[i]; }
  return values[values.length - 1];
}

// ---------- Q1: expectation and variance from a table (Fall 2026 Exam 1 Section 2 (Random variables), Fall 2025 Exam 1 Part 4) ----------
type Ctx = { intro: string; values: number[]; extraLabel: string; extraGiven: string; extraValue: number; extra: (e: number) => number; extraFormula: (eCell: string, gCell: string) => string; extraExplain: string };
function contexts(rng: Rng): Ctx {
  const which = int(rng, 0, 3);
  if (which === 0) {
    const tab = pick(rng, [20, 25, 30, 40, 50]);
    return {
      intro: "The percentage a customer tips on their tab is a random variable X (0.15 means 15%).", values: [0, 0.1, 0.15, 0.2, 0.25],
      extraLabel: `Average tip ($) if every tab is $${tab}`, extraGiven: "Every tab ($)", extraValue: tab, extra: (e) => tab * e,
      extraFormula: (e, g) => `=${g}*${e}`, extraExplain: "On average the tip is E[X] of the tab, so tab × E[X] (his =25*I3).",
    };
  }
  if (which === 1) {
    const spend = pick(rng, [6, 8, 12, 15]);
    return {
      intro: "The number of customers who walk into a shop in a minute is a random variable X.", values: [0, 1, 2, 3, 4],
      extraLabel: `Expected spending per minute ($) if each customer spends $${spend}`, extraGiven: "Spend per customer ($)", extraValue: spend, extra: (e) => spend * e,
      extraFormula: (e, g) => `=${g}*${e}`, extraExplain: "Each customer brings the same amount, so the expected spending is spend × E[X].",
    };
  }
  if (which === 2) {
    const cost = pick(rng, [3, 4.5, 7, 12]);
    return {
      intro: "The number of faulty bulbs in a box is a random variable X.", values: [0, 1, 2, 3],
      extraLabel: `Expected replacement cost per box ($) at $${cost} per faulty bulb`, extraGiven: "Cost per faulty bulb ($)", extraValue: cost, extra: (e) => cost * e,
      extraFormula: (e, g) => `=${g}*${e}`, extraExplain: "Cost per faulty bulb × the expected number of faulty bulbs.",
    };
  }
  const price = pick(rng, [1, 2, 3]);
  return {
    intro: `The prize (in $) on a scratch card is a random variable X. A card costs $${price}.`, values: [0, 1, 2, 5, 10],
    extraLabel: "Expected profit per card ($), after paying for it (negative = a loss)", extraGiven: "Price of a card ($)", extraValue: price, extra: (e) => e - price,
    extraFormula: (e, g) => `=${e}-${g}`, extraExplain: "On average you win E[X] and always pay the price, so E[X] − price (like E[Y] for the roulette bet in his homework).",
  };
}

const expvar: BlockMaker = {
  key: "l9.expvar",
  title: "Expectation, variance and standard deviation of a discrete random variable",
  make(rng): Block {
    const C = contexts(rng);
    const xs = C.values, k = xs.length;
    const p = probs(rng, k);
    const styleB = rng() < 0.5; // A: his Fall 2026 table (x, Pr, (x−E)²); B: Fall 2025 / homework table (x, Pr, x·Pr, (x−E)²·Pr)
    const E = sum(xs.map((x, i) => x * p[i]));
    const Var = sum(xs.map((x, i) => (x - E) ** 2 * p[i]));
    const f = 9, e = 8 + k; // first and last table rows
    const S = new Sheet();
    S.header("B8", "x").header("C8", "Pr(X=x)");
    if (!styleB) S.header("D8", "(x-E[X])^2");
    else S.header("D8", "x*Pr(X=x)").header("E8", "(x-E[X])^2*Pr(X=x)");
    xs.forEach((x, i) => {
      const r = f + i;
      S.set(`B${r}`, x, "data");
      if (i < k - 1) S.set(`C${r}`, p[i], "data");
    });
    S.parts.push({
      label: `Pr(X=${xs[k - 1]}) (missing)`, cell: `C${e}`, answer: p[k - 1], format: "prob", tol: 1e-6,
      formula: `=1-SUM(C${f}:C${e - 1})`, explain: "ALL PROBABILITIES MUST ADD TO 1, so the missing one is 1 minus the others.",
      traps: keep(p[k - 1], [{ value: sum(p.slice(0, k - 1)), why: "That is the sum of the others; subtract it from 1." }]),
    });
    xs.forEach((x, i) => {
      const r = f + i;
      if (!styleB) {
        S.parts.push({ label: `(x-E[X])^2 for x = ${x}`, cell: `D${r}`, answer: (x - E) ** 2, tol: tight((x - E) ** 2), formula: `=(B${r}-$H$9)^2`, explain: "Squared distance from the expectation; the $ on $H$9 lets you fill down (his =(D4-$I$3)^2)." });
      } else {
        S.parts.push({ label: `x*Pr(X=x) for x = ${x}`, cell: `D${r}`, answer: x * p[i], tol: tight(x * p[i]), formula: `=B${r}*C${r}`, explain: "Each value times its probability; these add up to E[X]." });
        S.parts.push({ label: `(x-E[X])^2*Pr(X=x) for x = ${x}`, cell: `E${r}`, answer: (x - E) ** 2 * p[i], tol: tight((x - E) ** 2 * p[i]), formula: `=(B${r}-$H$9)^2*C${r}`, explain: "Squared distance from E[X], weighted by the probability; these add up to Var[X]." });
      }
    });
    const unweighted = mean(xs);
    S.ask("G9", {
      label: "E[X]", cell: "H9", answer: E, tol: tight(E),
      formula: styleB ? `=SUM(D${f}:D${e})` : `=SUMPRODUCT(B${f}:B${e},C${f}:C${e})`,
      explain: "E[X] = Σ xᵢ·Pr(X = xᵢ)" + (styleB ? ": add the x·Pr column." : " = SUMPRODUCT(values, probabilities)."),
      traps: keep(E, [{ value: unweighted, why: "Plain AVERAGE of the values ignores the probabilities." }]),
    });
    S.ask("G10", {
      label: "Var[X]", cell: "H10", answer: Var, tol: tight(Var),
      formula: styleB ? `=SUM(E${f}:E${e})` : `=SUMPRODUCT(C${f}:C${e},D${f}:D${e})`,
      explain: "Var[X] = Σ (xᵢ − E[X])²·Pr(X = xᵢ)" + (styleB ? ": add the last column." : " = SUMPRODUCT(probabilities, squared distances) (his =SUMPRODUCT(E4:E8,F4:F8))."),
      traps: keep(Var, [
        { value: varS(xs), why: "VAR.S of the x column treats the values as a sample; a random variable's variance weights by the probabilities." },
        { value: sum(xs.map((x) => (x - E) ** 2)), why: "Forgot to multiply the squared distances by the probabilities." },
      ]),
    });
    S.ask("G11", { label: "Standard deviation of X", cell: "H11", answer: Math.sqrt(Var), tol: tight(Math.sqrt(Var)), formula: "=SQRT(H10)", explain: "Standard deviation = √Var (his =SQRT(K6)).", traps: keep(Math.sqrt(Var), [{ value: Var, why: "That is the variance; take the square root." }]) });
    S.label("G13", C.extraGiven).given("H13", C.extraValue);
    const ex = C.extra(E);
    S.ask("G14", { label: C.extraLabel, cell: "H14", answer: ex, tol: tight(ex), formula: C.extraFormula("H9", "H13"), explain: C.extraExplain });
    return {
      tab: "Expectation and variance", title: "Expectation and variance of X",
      text: [
        `${C.intro} Its values and probabilities are in the table; one probability is missing.`,
        styleB ? "Complete the table (x·Pr and (x − E[X])²·Pr columns), then find E[X], Var[X] and the standard deviation." : "Complete the table (the (x − E[X])² column), then find E[X], Var[X] and the standard deviation.",
        "Use formulas that point at the table and do not round.",
      ],
      cells: S.cells, parts: S.parts, colWidths: widths("H", { G: 34 }),
    };
  },
};

// ---------- Q2: the sum of two dice (old probability homework Q9-11, Fall 2025 Exam 1 Part 4, Spring 2026 Final Q5) ----------
const DIE = (m: number) => (m === 6 ? "an ordinary six-sided die" : `${m === 8 ? "an" : "a"} ${["", "", "", "three", "four", "five", "six", "seven", "eight"][m]}-sided die (faces 1 to ${m})`);
const dice: BlockMaker = {
  key: "l9.dice",
  title: "Sum of two dice: probability distribution, E[S], Var[S]",
  make(rng): Block {
    const [mA, mB] = pick(rng, [[4, 6], [6, 6], [4, 8], [3, 6], [4, 4], [5, 6], [3, 8], [6, 8]] as const);
    const total = mA * mB;
    const S = new Sheet();
    S.header("B8", `Sum table: ${mA}-sided die across, ${mB}-sided die down (filled in for you)`);
    for (let a = 1; a <= mA; a++) S.set(`${col(1 + a)}9`, a, "header");
    const grid: number[] = [];
    for (let b = 1; b <= mB; b++) {
      S.set(`B${9 + b}`, b, "header");
      for (let a = 1; a <= mA; a++) { S.set(`${col(1 + a)}${9 + b}`, a + b, "data"); grid.push(a + b); }
    }
    const G = `$C$10:$${col(1 + mA)}$${9 + mB}`;
    const outs = Array.from({ length: mA + mB - 1 }, (_, i) => i + 2);
    const pr = outs.map((s) => grid.filter((g) => g === s).length / total);
    const E = sum(outs.map((s, i) => s * pr[i]));
    const Var = sum(outs.map((s, i) => (s - E) ** 2 * pr[i]));
    const r0 = 10 + mB + 1, f = r0 + 1, e = r0 + outs.length;
    S.header(`B${r0}`, "s").header(`C${r0}`, "Pr(S=s)").header(`D${r0}`, "(s-E[S])^2");
    const eCell = `G${f}`;
    outs.forEach((s, i) => {
      const r = f + i;
      S.set(`B${r}`, s, "data");
      S.parts.push({
        label: `Pr(S=${s})`, cell: `C${r}`, answer: pr[i], format: "prob", tol: 1e-6, formula: `=COUNTIF(${G},B${r})/${total}`,
        explain: `Each of the ${total} cells of the sum table is equally likely (a priori), so count the cells equal to s and divide by ${total} (his =COUNTIF($D$56:$G$61,I55)/24).`,
        traps: keep(pr[i], [{ value: grid.filter((g) => g === s).length, why: `That is the count; divide by ${total}.` }]),
      });
      S.parts.push({ label: `(s-E[S])^2 for s = ${s}`, cell: `D${r}`, answer: (s - E) ** 2, tol: tight((s - E) ** 2), formula: `=(B${r}-$${eCell.replace(/(\d+)/, "$$$1")})^2`, explain: "Squared distance from the expectation, with an absolute reference to E[S]." });
    });
    const t = int(rng, Math.ceil(E), mA + mB - 1);
    const pGe = grid.filter((g) => g >= t).length / total;
    S.ask(`F${f}`, { label: "E[S]", cell: eCell, answer: E, tol: tight(E), formula: `=SUMPRODUCT(B${f}:B${e},C${f}:C${e})`, explain: "E[S] = Σ s·Pr(S = s)." });
    S.ask(`F${f + 1}`, {
      label: "Var[S]", cell: `G${f + 1}`, answer: Var, tol: tight(Var), formula: `=SUMPRODUCT(C${f}:C${e},D${f}:D${e})`, explain: "Var[S] = Σ (s − E[S])²·Pr(S = s).",
      traps: keep(Var, [{ value: varS(outs), why: "VAR.S of the list of outcomes ignores their probabilities." }, { value: varS(grid), why: "VAR.S of the sum table divides by n − 1; a random variable's variance is the probability-weighted average." }]),
    });
    S.ask(`F${f + 2}`, { label: "Standard deviation of S", cell: `G${f + 2}`, answer: Math.sqrt(Var), tol: tight(Math.sqrt(Var)), formula: `=SQRT(G${f + 1})`, explain: "√Var[S].", traps: keep(Math.sqrt(Var), [{ value: Var, why: "That is the variance; take the square root." }]) });
    S.ask(`F${f + 3}`, {
      label: `Pr(S ≥ ${t})`, cell: `G${f + 3}`, answer: pGe, format: "prob", tol: 1e-6, formula: `=COUNTIF(${G},">=${t}")/${total}`, explain: "An event is a collection of outcomes: count the cells in it and divide by the total.",
      traps: keep(pGe, [{ value: grid.filter((g) => g > t).length / total, why: `Used > ${t}; the event includes ${t}.` }]),
    });
    return {
      tab: "Sum of two dice", title: "The sum of two dice",
      text: [
        `You roll ${DIE(mA)} and ${DIE(mB)} and let S be the sum. The sum table lists every equally likely pair.`,
        `The sample space of S is {2, 3, …, ${mA + mB}}. Fill Pr(S=s) and the (s − E[S])² column, then E[S], Var[S], the standard deviation and Pr(S ≥ ${t}).`,
        "Use formulas that point at the tables and do not round.",
      ],
      cells: S.cells, parts: S.parts, colWidths: widths(col(Math.max(7, 1 + mA)), { F: 22 }),
      manual: [`Rebuild the sum table yourself: type the faces across and down, then one formula like =$B10+C$9 filled across and down. Self-check: it matches the table here. Then draw the probability distribution (a column chart of Pr(S=s)): it should rise and fall symmetrically about ${round(E, 2)}.`],
    };
  },
};

// ---------- Q3: events from a table of equally likely outcomes (Lesson 9 coins, roulette homework, F25 Exam 1 Part 4) ----------
type Crit = number | string;
type Ev = { name: string; desc: string; col: number; crit: Crit; neg: Crit };
function test(v: number | string, c: Crit): boolean {
  if (typeof c === "number") return typeof v === "number" && v === c;
  const m = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(c)!;
  const op = m[1] ?? "", rhs = m[2];
  const n = rhs !== "" && Number.isFinite(Number(rhs)) ? Number(rhs) : null;
  const eq = n !== null ? typeof v === "number" && v === n : typeof v === "string" && v.toLowerCase() === rhs.toLowerCase();
  if (op === "" || op === "=") return eq;
  if (op === "<>") return !eq;
  if (n === null || typeof v !== "number") return false;
  return op === "<" ? v < n : op === ">" ? v > n : op === "<=" ? v <= n : v >= n;
}
const lit = (c: Crit) => (typeof c === "number" ? String(c) : `"${c}"`);

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
function experiment(rng: Rng): { intro: string; heads: string[]; rows: (number | string)[][]; events: Ev[] } {
  const which = int(rng, 0, 2);
  if (which === 0) {
    const rows: (number | string)[][] = [["0", "Green", "None", "None", "None", "None"], ["00", "Green", "None", "None", "None", "None"]];
    for (let x = 1; x <= 36; x++) rows.push([x, RED.has(x) ? "Red" : "Black", x % 2 ? "Odd" : "Even", ((x - 1) % 3) + 1, Math.ceil(x / 12), x <= 18 ? "Low" : "High"]);
    return {
      intro: "A roulette wheel has 38 equally likely numbers: 1 to 36, 0 and 00 (0 and 00 are green and count as neither odd nor even). The table lists every number.",
      heads: ["Number", "Colour", "Parity", "Column", "Dozen", "Half"], rows,
      events: [
        { name: "R", desc: "the ball lands on a red number", col: 1, crit: "Red", neg: "<>Red" },
        { name: "B", desc: "the ball lands on a black number", col: 1, crit: "Black", neg: "<>Black" },
        { name: "O", desc: "the ball lands on an odd number", col: 2, crit: "Odd", neg: "<>Odd" },
        { name: "E", desc: "the ball lands on an even number", col: 2, crit: "Even", neg: "<>Even" },
        { name: "C", desc: "the ball lands in the first column {1, 4, 7, …, 34}", col: 3, crit: 1, neg: "<>1" },
        { name: "D", desc: "the ball lands in the second dozen {13, …, 24}", col: 4, crit: 2, neg: "<>2" },
        { name: "L", desc: "the ball lands on a low number (1 to 18)", col: 5, crit: "Low", neg: "<>Low" },
      ],
    };
  }
  if (which === 1) {
    const rows: (number | string)[][] = [];
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) rows.push([a, b, a + b, (a + b) % 2 ? "Odd" : "Even"]);
    return {
      intro: "Roll two fair six-sided dice. The table lists all 36 equally likely (first, second) pairs with their sum.",
      heads: ["First", "Second", "Sum", "Sum is"], rows,
      events: [
        { name: "A", desc: "the sum is even", col: 3, crit: "Even", neg: "Odd" },
        { name: "S3", desc: "the second roll is at least 3", col: 1, crit: ">=3", neg: "<3" },
        { name: "F6", desc: "the first roll is a 6", col: 0, crit: 6, neg: "<>6" },
        { name: "S8", desc: "the sum is at least 8", col: 2, crit: ">=8", neg: "<8" },
        { name: "S7", desc: "the sum is 7", col: 2, crit: 7, neg: "<>7" },
        { name: "F2", desc: "the first roll is at most 2", col: 0, crit: "<=2", neg: ">2" },
      ],
    };
  }
  const rows: (number | string)[][] = [];
  for (const a of ["H", "T"]) for (const b of ["H", "T"]) for (const c of ["H", "T"]) rows.push([a, b, c, [a, b, c].filter((x) => x === "H").length]);
  return {
    intro: "Flip a fair coin 3 times. The table lists the 8 equally likely outcomes (HHH, HHT, …) with the number of heads.",
    heads: ["Flip 1", "Flip 2", "Flip 3", "Heads"], rows,
    events: [
      { name: "A", desc: "at least one head", col: 3, crit: ">=1", neg: "<1" },
      { name: "B", desc: "at least one tail", col: 3, crit: "<=2", neg: ">2" },
      { name: "F", desc: "the first flip is heads", col: 0, crit: "H", neg: "T" },
      { name: "T3", desc: "the third flip is heads", col: 2, crit: "H", neg: "T" },
      { name: "H2", desc: "exactly two heads", col: 3, crit: 2, neg: "<>2" },
      { name: "H3", desc: "all three are heads", col: 3, crit: 3, neg: "<>3" },
    ],
  };
}

const events: BlockMaker = {
  key: "l9.events",
  title: "Events: not, and, or, given; independent and mutually exclusive",
  make(rng): Block {
    const X = experiment(rng);
    const iA = int(rng, 0, X.events.length - 1);
    let iB = int(rng, 0, X.events.length - 2);
    if (iB >= iA) iB++;
    const A = X.events[iA], B = X.events[iB];
    const S = new Sheet();
    const D = S.table("H", TOP, X.heads, X.rows);
    const N = X.rows.length;
    const rng_ = (ev: Ev) => { const c = D.cols[X.heads[ev.col]].c; return `$${c}$${D.first}:$${c}$${D.last}`; };
    const all = rng_({ col: 0 } as Ev);
    const cnt = (f: (r: (number | string)[]) => boolean) => X.rows.filter(f).length;
    const inA = (r: (number | string)[]) => test(r[A.col], A.crit);
    const inB = (r: (number | string)[]) => test(r[B.col], B.crit);
    const nA = cnt(inA), nB = cnt(inB), nAB = cnt((r) => inA(r) && inB(r)), nnotAB = cnt((r) => test(r[A.col], A.neg) && inB(r));
    const indep = nAB * N === nA * nB;
    const cA = `COUNTIF(${rng_(A)},${lit(A.crit)})`, cB = `COUNTIF(${rng_(B)},${lit(B.crit)})`, cAB = `COUNTIFS(${rng_(A)},${lit(A.crit)},${rng_(B)},${lit(B.crit)})`;
    S.header("B8", "Event").header("C8", "Meaning");
    S.label("B9", "A").text("C9", A.desc);
    S.label("B10", "B").text("C10", B.desc);
    S.header("B12", "Question").header("F12", "Your answer");
    const q = (r: number, label: string, cell: string, answer: number, formula: string, explain: string, traps: { value: number; why: string }[] = []) =>
      S.ask(`B${r}`, { label, cell, answer, format: "prob", tol: 1e-6, formula, explain, traps: keep(answer, traps) });
    q(13, "Pr(A)", "F13", nA / N, `=${cA}/COUNTA(${all})`, `All ${N} outcomes are equally likely (a priori), so Pr(A) = outcomes in A ÷ ${N}.`);
    q(14, "Pr(B)", "F14", nB / N, `=${cB}/COUNTA(${all})`, `Outcomes in B ÷ ${N}.`);
    q(15, "Pr(not A)", "F15", 1 - nA / N, "=1-F13", "Pr(A) + Pr(not A) = 1, so Pr(not A) = 1 − Pr(A).");
    q(16, "Pr(A and B)", "F16", nAB / N, `=${cAB}/COUNTA(${all})`, "Outcomes in both A and B (the overlap of the Venn diagram) ÷ the total.", [{ value: (nA / N) * (nB / N), why: "Pr(A)·Pr(B) only equals Pr(A and B) when A and B are independent; count the overlap." }]);
    q(17, "Pr(A or B)", "F17", (nA + nB - nAB) / N, `=(${cA}+${cB}-${cAB})/COUNTA(${all})`, "Outcomes in A or B (or both), each counted once: those in A plus those in B minus the overlap you counted twice.", [{ value: (nA + nB) / N, why: "Counted the overlap twice: take off the outcomes in both." }]);
    q(18, "Pr(not A and B)", "F18", nnotAB / N, `=COUNTIFS(${rng_(A)},${lit(A.neg)},${rng_(B)},${lit(B.crit)})/COUNTA(${all})`, "Outcomes in B that are not in A, ÷ the total.", [{ value: (1 - nA / N) * (nB / N), why: "Multiplying only works for independent events; count the outcomes." }]);
    q(19, "Pr(A given B)", "F19", nAB / nB, "=F16/F14", "Pr(A given B) = Pr(A and B)/Pr(B): you are in a universe where B happens.", [{ value: nAB / nA, why: "That is Pr(B given A): divide by Pr(B), the event you are given." }, { value: nAB / N, why: "That is Pr(A and B); divide it by Pr(B)." }]);
    S.ask("B20", {
      label: "Are A and B independent?", cell: "F20", answer: indep ? "Independent" : "Not independent", options: ["Independent", "Not independent"],
      formula: '=IF(ROUND(F19,6)=ROUND(F13,6),"Independent","Not independent")',
      explain: `A and B are independent if Pr(A given B) = Pr(A). Here ${round(nAB / nB, 4)} ${indep ? "=" : "≠"} ${round(nA / N, 4)}.`,
    });
    S.ask("B21", {
      label: "Are A and B mutually exclusive?", cell: "F21", answer: nAB === 0 ? "Yes" : "No", options: ["Yes", "No"],
      formula: '=IF(F16=0,"Yes","No")', explain: "Mutually exclusive means Pr(A and B) = 0: the two events have no outcome in common.",
    });
    return {
      tab: "Events", title: "Events: not, and, or, given",
      text: [
        X.intro,
        `Event A: ${A.desc}. Event B: ${B.desc}.`,
        "Find the probabilities with formulas (COUNTIF/COUNTIFS on the table, or by counting outcomes and typing e.g. =18/38). Keep them exact: do not round.",
      ],
      cells: S.cells, parts: S.parts,
      manual: ["Draw the Venn diagram of A and B inside X = everything and write how many outcomes fall in each region. Self-check: the four regions add up to the total number of outcomes."],
    };
  },
};

// ---------- Q4: analysing a simulation (Lesson 9 dice task, Fall 2026 Exam 1 Section 2 (Random variables) parts 3-4) ----------
const simulate: BlockMaker = {
  key: "l9.simulate",
  title: "Analyse 1000 simulated values of a discrete random variable",
  make(rng): Block {
    const which = int(rng, 0, 2);
    const N = 1000;
    let xs: number[], intro: string;
    if (which === 0) { xs = [0, 0.1, 0.15, 0.2, 0.25]; intro = "A waiter's tip percentage X (0.2 = 20%) has the distribution in the table. The RNG was used to simulate 1000 tips, one for each tab served last month (columns B and C)."; }
    else if (which === 1) { xs = [1, 2, 3, 4, 5, 6]; intro = "A weighted die has the distribution in the table. In a game you are paid $X, the number rolled. The RNG was used to simulate 1000 rolls (column B)."; }
    else { xs = [0, 1, 2, 3, 4]; intro = "The number of laptops X a store sells in a week has the distribution in the table. The RNG was used to simulate 1000 weeks (column B)."; }
    const k = xs.length;
    const p = probs(rng, k);
    const sim = Array.from({ length: N }, () => draw(rng, xs, p));
    const tabs = which === 0 ? Array.from({ length: N }, () => round(8 + 62 * rng() ** 1.3, 2)) : [];
    const S = new Sheet();
    const last = 8 + N;
    S.header("B8", "Simulated X");
    if (which === 0) S.header("C8", "Tab ($)");
    sim.forEach((v, i) => { S.set(`B${9 + i}`, v, "data"); if (which === 0) S.set(`C${9 + i}`, tabs[i], "data"); });
    const R = `$B$9:$B$${last}`;
    S.header("E8", "x").header("F8", "Pr(X=x)");
    S.header("H8", "x").header("I8", "Frequency").header("J8", "Proportion");
    const E = sum(xs.map((x, i) => x * p[i]));
    xs.forEach((x, i) => {
      const r = 9 + i;
      S.set(`E${r}`, x, "data").set(`F${r}`, p[i], "data").set(`H${r}`, x, "data");
      const fr = sim.filter((v) => v === x).length;
      S.parts.push({ label: `Frequency of x = ${x}`, cell: `I${r}`, answer: fr, tol: 0, formula: `=COUNTIF(${R},H${r})`, explain: "COUNTIF counts how often each value came up (his =COUNTIF($C$20:$C$1019,E20))." });
      S.parts.push({ label: `Proportion of x = ${x}`, cell: `J${r}`, answer: fr / N, format: "prob", tol: 1e-6, formula: `=I${r}/COUNT(${R})`, explain: `Frequency ÷ number of trials (his =F20/$F$26). It should be close to Pr(X=${x}) = ${p[i]}.`, traps: keep(fr / N, [{ value: p[i], why: "That is the probability from the distribution; the proportion comes from the simulated data." }]) });
    });
    const m = mean(sim), sd = Math.sqrt(varS(sim));
    S.ask("L9", { label: "E[X] from the distribution", cell: "M9", answer: E, tol: tight(E), formula: `=SUMPRODUCT(E9:E${8 + k},F9:F${8 + k})`, explain: "E[X] = Σ x·Pr(X = x), from the table, not from the simulation.", traps: keep(E, [{ value: m, why: "That is the simulated average; E[X] comes from the distribution." }]) });
    S.ask("L10", { label: "Mean of the simulated values", cell: "M10", answer: m, tol: tight(m), formula: `=AVERAGE(${R})`, explain: "The simulated average should be close to E[X] (his 3.574 against 3.5)." });
    S.ask("L11", { label: "Standard deviation of the simulated values (sample)", cell: "M11", answer: sd, tol: tight(sd), formula: `=STDEV.S(${R})`, explain: "Simulated values are a sample, so STDEV.S (n − 1).", traps: keep(sd, [{ value: Math.sqrt(varS(sim) * (N - 1) / N), why: "STDEV.P: the simulation is a sample, use STDEV.S." }]) });
    let manual2: string;
    if (which === 0) {
      const tot = sum(sim.map((v, i) => v * tabs[i]));
      S.ask("L12", { label: "Total of all the tips ($)", cell: "M12", answer: tot, tol: tight(tot), formula: `=SUMPRODUCT(B9:B${last},C9:C${last})`, explain: "Tip amount = tab × tip %; SUMPRODUCT adds tab × tip over every row (or make a tip-amount column =C9*B9 and SUM it)." });
      S.ask("L13", { label: "Average tip per tab ($)", cell: "M13", answer: tot / N, tol: tight(tot / N), formula: `=M12/COUNT(B9:B${last})`, explain: "Total tips ÷ number of tabs (the AVERAGE of a tip-amount column)." });
      manual2 = "Make a tip-amount column (=C9*B9 filled down), then its Toolpak histogram, and describe the shape (Fall 2026 Exam 1 Section 2 (Random variables)). Self-check: its AVERAGE equals your average tip per tab.";
    } else if (which === 1) {
      let c = Math.round((E + pick(rng, [-0.6, -0.35, 0.3, 0.55])) * 4) / 4;
      if (Math.abs(c - E) < 1e-9) c += 0.25;
      S.label("L15", "Price to play one game ($)").given("M15", c);
      S.ask("L12", { label: "Average winnings per game in the simulation, after paying ($)", cell: "M12", answer: m - c, tol: tight(m - c), formula: "=M10-M15", explain: "Each game you get X and pay the price, so on average: simulated mean − price." });
      S.ask("L13", { label: "Is the game worth playing in the long run? (Yes/No)", cell: "M13", answer: E > c ? "Yes" : "No", options: ["Yes", "No"], formula: '=IF(M9>M15,"Yes","No")', explain: "In the long run you get E[X] per game: play only if E[X] is more than the price (his 'what price would you pay to play the game?')." });
      manual2 = "Make the die's table yourself and simulate 1000 rolls; would you pay the price? Self-check: your own simulated mean lands near E[X].";
    } else {
      const price = pick(rng, [450, 800, 1200]);
      S.label("L15", "Price of a laptop ($)").given("M15", price);
      S.ask("L12", { label: "Average weekly revenue in the simulation ($)", cell: "M12", answer: price * m, tol: tight(price * m), formula: "=M15*M10", explain: "Revenue = price × number sold, so the average is price × simulated mean." });
      S.ask("L13", { label: "Expected weekly revenue from the distribution ($)", cell: "M13", answer: price * E, tol: tight(price * E), formula: "=M15*M9", explain: "price × E[X]: what the simulated average should approach." });
      manual2 = "Make a revenue column (=price × X) and a Toolpak histogram of it. Self-check: its AVERAGE equals your average weekly revenue.";
    }
    return {
      tab: "Simulation", title: "Analysing a simulation",
      text: [
        intro,
        "Count each value, turn the counts into proportions, and compare the simulation with the distribution. The simulated numbers are given so the site can mark your analysis.",
        "Use formulas that point at the sheet and do not round.",
      ],
      cells: S.cells, parts: S.parts, colWidths: widths("M", { L: 40 }),
      manual: [
        "Practise the RNG yourself: Data › Data Analysis › Random Number Generation; Number of Variables 1, Number of Random Numbers 1000, Distribution: Discrete, Value and Probability Input Range = the x and Pr(X=x) table (E9:F…), and an output cell. Self-check: your numbers differ from these, but the proportions are near Pr(X=x) and the mean near E[X].",
        manual2,
      ],
    };
  },
};

export const LESSON_09: Lesson = {
  n: 9,
  title: "Discrete probability: events, expectation and variance",
  unit: 1,
  week: "Week 5 · Wed 30 Sep · Discrete probability",
  sources: ["Lesson 9, notes.xlsx", "Lesson 10, notes.xlsx (Discrete RVs: variance)", "Old probability homework.docx", "Old probability homework solutions.xlsx", "Fall_2026_Exam1_solutions.xlsx", "F25_Exam1_solutions.xlsx", "S26_Final, solutions.xlsx"],
  summary:
    "A discrete random variable is a sample space plus a probability for each outcome. This lesson builds new events from old (not, and, or, given), tests independence, and finds the expectation and variance of a random variable from its table, then simulates it with the RNG. Exam 1 Q2 was exactly this: a table, E[X] and Var[X], an expected tip and 1000 simulated trials.",
  defs: [
    { term: "Random variable", text: "A random variable X consists of 1. a sample space of all possible outcomes; 2. a pdf which gives the probability of each outcome. Roll a dice: sample space {1, 2, 3, 4, 5, 6}, Pr(X = 5) = 1/6.", source: "Lesson 9, notes › Expectation B2:C10" },
    { term: "A priori probability", text: "No reason to suspect any outcome is more likely than another, so they must all have the same probability: 1/6 for each face of a dice; 1/8 for each of the 8 outcomes of three coin flips (Pr(HHH) = (1/2)³ = 1/8).", source: "Lesson 9, notes › Expectation F10; Discrete prob C8:H9" },
    { term: "Event", text: "An event is a collection of outcomes. Pr(roll an even number) = 3/6; Pr(roll a prime number) = 3/6.", source: "Lesson 9, notes › Expectation B12:C15" },
    { term: "Simulating a random variable", text: "Use the RNG to produce 1000 dice rolls, record the frequency of each outcome (=COUNTIF($C$20:$C$1019,E20)) and the proportion (frequency ÷ 1000). His run gave 161, 162, 146, 176, 183, 172: proportions near 1/6.", source: "Lesson 9, notes › Expectation B17:G26" },
    { term: "Expectation", text: "A random variable X with sample space {x₁, …, x_N} has expectation E[X] = Σ xᵢ·Pr(X = xᵢ). In Excel: =SUMPRODUCT(values, probabilities); for a dice E[X] = 3.5.", source: "Lesson 9, notes › Expectation E43 (equation), O23:O25" },
    { term: "Expectation and the simulated average", text: "The game: you are paid the dollar amount on the dice. 'For your simulation what price would you pay to play the game?' =AVERAGE of the 1000 rolls = 3.574, close to E[X] = 3.5.", source: "Lesson 9, notes › Expectation E31:I36" },
    { term: "Variance and standard deviation of a discrete random variable", text: "Var[X] = Σ (xᵢ − E[X])²·Pr(X = xᵢ): make a (x − E[X])² column and =SUMPRODUCT(it, probabilities). Std dev = SQRT(Var). For a dice Var[X] = 2.9167, std dev 1.7078. (Taught at the start of the next class; on Exam 1 Q2.)", source: "Lesson 10, notes › Discrete RVs F4:K7" },
    { term: "Four ways of making new events from old", text: "1. Pr(not A); 2. Pr(A and B); 3. Pr(A or B); 4. Pr(A given B). Three coin flips with A = at least one head, B = at least one tail: Pr(A) = 7/8, Pr(B) = 7/8, Pr(not A) = 1/8, Pr(A and B) = 6/8, Pr(A or B) = 1.", source: "Lesson 9, notes › Discrete prob B11:J24" },
    { term: "Not A", text: "Pr(A) + Pr(not A) = 1, so Pr(not A) = 1 − Pr(A).", source: "Lesson 9, notes › Discrete prob M22" },
    { term: "Mutually exclusive", text: "Two events are called mutually exclusive if Pr(A and B) = 0. Equivalently, the two events do not contain an outcome in common.", source: "Lesson 9, notes › Discrete prob B20:B23" },
    { term: "A given B (conditional probability)", text: "You are in a universe where B happens. Given this, what is the probability that A now happens too? Pr(A given B) = Pr(A and B)/Pr(B).", source: "Lesson 9, notes › Discrete prob B25:C27" },
    { term: "Independent", text: "Two events A and B are called independent if Pr(A given B) = Pr(A).", source: "Lesson 9, notes › Discrete prob B29" },
  ],
  examples: [
    {
      title: "A dice: expectation, then 1000 simulated rolls",
      setup: "Roll a dice and record the result. Find E[X], then use the RNG to produce 1000 rolls, make a frequency table and find the average roll ('what price would you pay to play?').",
      table: { head: ["x", "Pr(X=x)", "Frequency (his run)", "Proportion"], rows: [[1, "1/6", 161, 0.161], [2, "1/6", 162, 0.162], [3, "1/6", 146, 0.146], [4, "1/6", 176, 0.176], [5, "1/6", 183, 0.183], [6, "1/6", 172, 0.172]] },
      steps: [
        { say: "Each probability (a priori)", formula: "=1/6", result: "0.1667" },
        { say: "E[X] = Σ x·Pr(X = x)", formula: "=SUMPRODUCT(I20:I25,J20:J25)", result: "3.5" },
        { say: "Frequency of 1 in the 1000 simulated rolls (fill down)", formula: "=COUNTIF($C$20:$C$1019,E20)", result: "161" },
        { say: "Total number of rolls", formula: "=SUM(F20:F25)", result: "1000" },
        { say: "Proportion of 1s", formula: "=F20/$F$26", result: "0.161" },
        { say: "Average of the simulated rolls: close to E[X]", formula: "=AVERAGE(C20:C1019)", result: "3.574" },
      ],
      takeaway: "Proportions from a simulation approach the probabilities, and the simulated average approaches E[X].",
      source: "Lesson 9, notes › Expectation",
    },
    {
      title: "Three coin flips: not, and, or, given",
      setup: "X is the result of flipping a coin 3 times. A = at least one heads, B = at least one tails. Sample space {HHH, HHT, HTH, THH, TTH, THT, HTT, TTT}, each 1/8 a priori.",
      steps: [
        { say: "Pr(A): every outcome but TTT", formula: "=7/8", result: "0.875" },
        { say: "Pr(not A) = 1 − Pr(A)", formula: "=1-7/8", result: "0.125" },
        { say: "Pr(A and B): every outcome but HHH and TTT", formula: "=6/8", result: "0.75" },
        { say: "Pr(A or B): every outcome", formula: "=8/8", result: "1" },
        { say: "Pr(A given B) = Pr(A and B)/Pr(B) (his formula applied; not worked in the notes)", formula: "=(6/8)/(7/8)", result: "0.857" },
        { say: "0.857 ≠ Pr(A) = 0.875, so A and B are not independent. They are not mutually exclusive either: Pr(A and B) ≠ 0." },
      ],
      takeaway: "Count outcomes for each new event; 'given B' shrinks the universe to B.",
      source: "Lesson 9, notes › Discrete prob",
    },
    {
      title: "Exam 1: the tip percentage (Fall 2026 Exam 1 Section 2 (Random variables))",
      setup: "A customer's tip percentage X has sample space {0%, 10%, 15%, 20%, 25%} with probabilities 0.05, 0.05, 0.1, 0.7, 0.1. Find E[X] and Var[X], and the average tip if every tab is $25.",
      table: { head: ["x", "Pr(X=x)", "(x-E[X])^2"], rows: [[0, 0.05, 0.034225], [0.1, 0.05, 0.007225], [0.15, 0.1, 0.001225], [0.2, 0.7, 0.000225], [0.25, 0.1, 0.004225]] },
      steps: [
        { say: "E[X]", formula: "=SUMPRODUCT(D4:D8,E4:E8)", result: "0.185" },
        { say: "(x − E[X])² column, filled down", formula: "=(D4-$I$3)^2", result: "0.034225" },
        { say: "Var[X]", formula: "=SUMPRODUCT(E4:E8,F4:F8)", result: "0.002775" },
        { say: "Average tip on a $25 tab", formula: "=25*I3", result: "4.625" },
      ],
      takeaway: "E[X] and Var[X] both come from SUMPRODUCT with the probability column.",
      source: "Fall_2026_Exam1_solutions › Random variables",
    },
  ],
  quiz: [
    { q: "In his definition, a random variable X consists of…", options: ["a mean and a variance", "a sample space of all possible outcomes and a pdf giving the probability of each", "a list of events", "1000 simulated values"], answer: 1, why: "Lesson 9 › Expectation B2:C4: '1. A sample space of all possible outcomes 2. A pdf which gives the probability of each outcome.'" },
    { q: "Roll a dice. What is Pr(roll a prime number)?", options: ["2/6", "4/6", "3/6", "1/6"], answer: 2, why: "The event 'prime' is the collection {2, 3, 5}: 3 of the 6 equally likely outcomes (his notes: 3/6)." },
    { q: "Why is each face of a dice given probability 1/6 before any rolling?", options: ["Empirical: we rolled it many times", "A priori: no reason to suspect any outcome is more likely than another", "Subjective: an expert's judgement", "Because E[X] = 3.5"], answer: 1, why: "A priori probability comes from a logical argument: six outcomes, none more likely, so 1/6 each." },
    { q: "His 1000 simulated dice rolls averaged 3.574. What does that estimate?", options: ["Var[X]", "Pr(X = 4)", "The standard deviation", "E[X] = 3.5"], answer: 3, why: "The average of many simulated values approaches the expectation; that is the price you would pay to play the game." },
    { q: "For three coin flips, A = at least one head has Pr(A) = 7/8. What is Pr(not A)?", options: ["1/8", "7/8", "6/8", "0"], answer: 0, why: "Pr(A) + Pr(not A) = 1, so 1 − 7/8 = 1/8 (only TTT)." },
    { q: "Two events are mutually exclusive when…", options: ["Pr(A given B) = Pr(A)", "Pr(A or B) = 1", "Pr(A and B) = 0: they have no outcome in common", "Pr(A) = Pr(B)"], answer: 2, why: "Lesson 9 › Discrete prob B20:B23. Pr(A given B) = Pr(A) is independence, a different idea." },
    { q: "Which formula did he give for Pr(A given B)?", options: ["Pr(A and B)/Pr(A)", "Pr(A and B)/Pr(B)", "Pr(A)·Pr(B)", "Pr(A) + Pr(B)"], answer: 1, why: "You are in a universe where B happens, so divide by Pr(B)." },
    { q: "Three coin flips, A = at least one head, B = at least one tail. Pr(A given B) = (6/8)/(7/8) = 6/7 and Pr(A) = 7/8. Are A and B independent?", options: ["Yes, because Pr(A and B) is not 0", "Yes, because Pr(A) = Pr(B)", "No, because Pr(A given B) ≠ Pr(A)", "No, because they are mutually exclusive"], answer: 2, why: "Independent means Pr(A given B) = Pr(A). 6/7 ≠ 7/8, so not independent. They are not mutually exclusive either, since Pr(A and B) = 6/8." },
    { q: "X takes values 0, 1, 2 with probabilities 0.5, 0.3, 0.2. Which gives Var[X] in his method?", options: ["=VAR.S(B4:B6)", "=SUMPRODUCT(C4:C6,D4:D6) where D holds (x − E[X])²", "=AVERAGE(B4:B6)", "=SUM(D4:D6) where D holds (x − E[X])²"], answer: 1, why: "Var[X] = Σ (x − E[X])²·Pr(X = x): weight the squared distances by the probabilities. VAR.S treats the three values as a sample and ignores the probabilities." },
    { q: "To simulate a tip percentage with the Toolpak's Random Number Generation, which distribution do you choose?", options: ["Normal", "Uniform", "Discrete, with your value-probability table as the input range", "Bernoulli"], answer: 2, why: "A discrete random variable is given by a table of numeric values and probabilities; the Discrete option draws from exactly that table." },
  ],
  excel: [
    { fn: "SUMPRODUCT(values, probabilities)", use: "E[X] (=SUMPRODUCT(I20:I25,J20:J25)); with a (x − E[X])² column, Var[X] = SUMPRODUCT(probabilities, that column). In the Fall 2025 / homework layout he instead makes x·Pr and (x − E[X])²·Pr columns and SUMs them." },
    { fn: "(x − E[X])² column", use: "=(D4-$I$3)^2 filled down: the $ keeps the reference on the E[X] cell." },
    { fn: "SQRT", use: "Standard deviation from the variance: =SQRT(K6)." },
    { fn: "=1-SUM(...)", use: "A missing probability: all probabilities must add to 1." },
    { fn: "Sum table with mixed references", use: "=$C40+D$39 filled across and down lists the sum of two dice for every pair; then Pr(S = s) =COUNTIF(table, s)/36 (or /24, /20^2)." },
    { fn: "COUNTIF / COUNTIFS on an outcome table", use: "Events: count the outcomes in the event and divide by the total, e.g. =18/38 for red on a roulette wheel. Keep exact fractions: 'do not round'." },
    { fn: "COUNTIF, AVERAGE, STDEV.S on simulated data", use: "Frequency of each value =COUNTIF($C$20:$C$1019,E20), proportion =F20/$F$26, simulated mean =AVERAGE(...)." },
    { fn: "Toolpak › Random Number Generation (Discrete)", use: "1 variable, 1000 numbers, Distribution: Discrete, Value and Probability Input Range = the x/Pr table (numeric values only)." },
  ],
  watch: [
    "Fall 2026 Exam 1 Section 2 (Random variables) (14 points): tip % X with probabilities 0.05, 0.05, 0.1, 0.7, 0.1. Complete the table, E[X] = 0.185 and Var[X] = 0.002775 (both SUMPRODUCT); average tip on a $25 tab = 25·E[X] = 4.625; simulate 1000 tip percentages with the RNG, tip amount = tab × tip %, then the descriptive measures of the tip amounts and a Toolpak histogram.",
    "Fall 2025 Exam 1 Part 4: the sum of two dice. Sample space {2, …, 12}, Pr via =COUNTIF($F$8:$K$13,N7)/36, table columns x·Pr(X=x) and (x−E[X])²·Pr(X=x); E[X] = 7, Var = 5.833, std dev 2.415. With A = sum even and B = second roll ≥ 3: Pr(A) = 1/2, Pr(B) = 2/3, Pr(A and B) = 1/3, Pr(A or B) = 5/6, Pr(not A and B) = 1/3, independent: Yes.",
    "Spring 2026 Final Q5 (21 points): roulette events (Pr(R) = 18/38, Pr(not R) = 20/38, and/not combinations with the first column and second dozen, an I/D independence table) and the sum of two 20-sided dice (E = 21, Var = 66.5). 'Keep your answers exact and do not round.'",
    "Old probability homework: roulette sample space {0, 00, 1, …, 36}, each 1/38; Pr(R given C) = 1/2 so R and C are not independent; a $1 bet on black has E[Y] = −2/38.",
    "Common slips: VAR.S on the x column instead of weighting by probabilities; forgetting the square root for the standard deviation; dividing 'given' by the total instead of by Pr(B); counting the overlap twice in 'A or B'; rounding probabilities like 18/38.",
  ],
  makers: [expvar, dice, events, simulate],
};
