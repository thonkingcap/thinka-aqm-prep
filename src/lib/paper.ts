// Practice exams laid out exactly like last spring's Exam 3: the same four tabs, the same question
// wording with new numbers, the professor's cell layout (question numbers in column B, grey table
// headers, labelled answer blocks), and a matching Word question paper (docx.ts).
//
// Changes from Exam 3, as asked: the fair-coin expectation question is gone (E[X] isn't on Midterm 2),
// Section 3 gains a chi-squared test for a variance, and Section 4 gains a two-sample z-test (variances
// known, Data Analysis Toolpak) beside the paired and pooled t-tests.
//
// Every number is generated from the paper's seed and every answer comes from the site's verified stats
// engine, following the class convention (one-tail .DIST/.INV functions, two-tailed p-value by the sign
// of the statistic). The workbook carries the id "paper:N", so an upload is marked against this file.
import type { ReadWorkbook, CellVal } from "./xlsxRead.ts";
import type { Part, Question, QuestionKind, TopicId } from "./practice.ts";
import type { SheetModel, Cell } from "./workbook.ts";
import type { PartGrade, QuestionGrade, WorkbookGrade } from "./grade.ts";
import { mean, stdevS, normInv, normCdf, tInv, tCdf, chisqCdf, chisqInv } from "./stats.ts";
import { num, text, testParts, r4, locate, findTab, type Spec, type Starts } from "./exam3.ts";

export const PAPER_COUNT = 6;
export const PAPER_MINUTES = 60;
export const paperId = (n: number) => `paper:${n}`;
export const PAPER_TABS = ["Confidence intervals", "Hypothesis testing I", "Hypothesis testing II", "Two-sample tests"];
export const PAPER_SECTIONS = ["1. Confidence intervals", "2. Hypothesis testing I", "3. Hypothesis testing II", "4. Two-sample tests"];
const SECTION_TITLES = ["Confidence intervals", "Hypothesis testing I", "Hypothesis testing II", "Two-sample tests"];

// ---------- seeded numbers ----------
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
const gauss = (rng: Rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
const round = (x: number, dp: number) => Number(x.toFixed(dp));
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
/** Clean number text (no float noise). */
const fmt = (x: number) => { const v = Number(x.toFixed(6)); return Object.is(v, -0) ? "0" : String(v); };

// ---------- markup ----------
// Question text is written once, in a small markup the Word paper and the site both read:
//   _{0} subscript, ^{2} superscript, *…* italic, **…** bold, {xbar} an x̄ (a Word equation in the paper).
const SUB: Record<string, string> = { 0: "₀", 1: "₁", 2: "₂", D: "D" };
const SUP: Record<string, string> = { 2: "²" };
export function plain(m: string): string {
  return m.replace(/_\{([^}]*)\}/g, (_, x: string) => [...x].map((c) => SUB[c] ?? c).join(""))
    .replace(/\^\{([^}]*)\}/g, (_, x: string) => [...x].map((c) => SUP[c] ?? c).join(""))
    .replace(/\{xbar\}/g, "x̄").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
}

// ---------- the paper ----------
export type PaperItem =
  | { kind: "lead"; text: string }
  | { kind: "q"; n: number; text: string; points: number }
  | { kind: "formulae" }; // the professor's pooled-t formula box, after Question 14
export type PaperQ = { n: number; section: number; points: number; title: string; kind: QuestionKind; topic: TopicId; text: string; specs: Spec[] };
export type Paper = {
  n: number; id: string; title: string; header: string; file: string;
  sections: { title: string; points: number; items: PaperItem[] }[];
  questions: PaperQ[];
  sheets: SheetModel[]; key: SheetModel[]; starts: Starts;
  fallback: { xbar: number; s: number }; // Question 12's partial-credit values
  coin: { N: number; h: number; tail: "left" | "right"; alpha: number };
};

const MACHINES = [
  { lead: (t: string) => `A machine is designed to dispense ${t} of liquid into a can.`, what: "the actual amount dispensed by the machine", target: 330, sigma: 3, unit: "ml" },
  { lead: (t: string) => `A machine is designed to fill bags with ${t} of flour.`, what: "the actual amount of flour the machine puts in a bag", target: 1000, sigma: 8, unit: "g" },
  { lead: (t: string) => `A coffee machine is designed to pour ${t} of coffee into a cup.`, what: "the actual amount poured by the machine", target: 250, sigma: 4, unit: "ml" },
  { lead: (t: string) => `A machine is designed to fill bottles with ${t} of olive oil.`, what: "the actual amount dispensed by the machine", target: 750, sigma: 5, unit: "ml" },
  { lead: (t: string) => `A machine is designed to cut steel rods to a length of ${t}.`, what: "the actual length of a rod cut by the machine", target: 120, sigma: 2, unit: "mm" },
  { lead: (t: string) => `A machine is designed to fill boxes with ${t} of cereal.`, what: "the actual amount of cereal the machine puts in a box", target: 500, sigma: 6, unit: "g" },
];
const TWO_Z = [
  { lead: (a: string, b: string) => `Tables 6 and 7 show the time (in minutes) customers waited to be served at two branches of a bank. From years of records the variances are known: σ_{1}^{2} = ${a} at Branch 1 (Table 6) and σ_{2}^{2} = ${b} at Branch 2 (Table 7). Do customers wait longer at one branch than the other?`, q: "Test the null hypothesis that the mean waiting times at the two branches are equal with α = 0.05. You may use the Data Analysis Toolpak.", m: [9, 14], v: [9, 16], dp: 1 },
  { lead: (a: string, b: string) => `Tables 6 and 7 show delivery times (in minutes) for orders sent with two courier companies. From past records the variances are known: σ_{1}^{2} = ${a} for Courier 1 (Table 6) and σ_{2}^{2} = ${b} for Courier 2 (Table 7). Is one courier faster than the other?`, q: "Test the null hypothesis that the mean delivery times of the two couriers are equal with α = 0.05. You may use the Data Analysis Toolpak.", m: [40, 50], v: [36, 49], dp: 0 },
  { lead: (a: string, b: string) => `Tables 6 and 7 show the battery life (in hours) of phones from two brands. The manufacturers publish the variances: σ_{1}^{2} = ${a} for Brand 1 (Table 6) and σ_{2}^{2} = ${b} for Brand 2 (Table 7). Does one brand last longer than the other?`, q: "Test the null hypothesis that the mean battery lives of the two brands are equal with α = 0.05. You may use the Data Analysis Toolpak.", m: [18, 24], v: [4, 6.25], dp: 1 },
];

const cache = new Map<number, Paper>();
/** Practice paper n (1…PAPER_COUNT). Deterministic: the same n always gives the same paper. */
export function paper(n: number): Paper | null {
  if (!(Number.isInteger(n) && n >= 1 && n <= PAPER_COUNT)) return null;
  const hit = cache.get(n);
  if (hit) return hit;
  const p = build(n);
  cache.set(n, p);
  return p;
}

function build(n: number): Paper {
  const rng = mulberry32((0x5eed1e55 ^ Math.imul(n, 0x9e3779b1)) >>> 0);

  // ----- Section 1 data -----
  const mu1 = pick(rng, [40, 45, 50, 55, 60, 65, 70, 75, 80]);
  const sig1 = pick(rng, [4, 5, 6, 8, 10]);
  const n1 = pick(rng, [5, 6, 7, 8]);
  const conf1 = pick(rng, [90, 95, 99]);
  const conf4 = pick(rng, [80, 90]);
  const conf5 = pick(rng, [90, 95, 99]);
  const plausible = rng() < 0.6;
  const shift = plausible ? 0 : (rng() < 0.5 ? -1 : 1) * uniform(rng, 2.2, 3.2) * sig1 / Math.sqrt(n1);
  const T1 = Array.from({ length: n1 }, () => round(mu1 + shift + sig1 * gauss(rng), 1));
  const n5 = randInt(rng, 40, 60), m5 = randInt(rng, 15, 80), s5 = m5 * uniform(rng, 0.2, 0.35);
  const T2CI = Array.from({ length: n5 }, () => Math.max(0, Math.round(m5 + s5 * gauss(rng))));

  // ----- Sections 2–3: the machine -----
  const mach = MACHINES[(n - 1) % MACHINES.length];
  const t0 = mach.target, s0 = mach.sigma, u = mach.unit;
  const less = rng() < 0.5; // we suspect the mean is less (H₀: μ ≥ t0, left tail) or more (H₀: μ ≤ t0, right tail)
  const n2 = randInt(rng, 15, 20);
  const k = rng() < 0.8 ? uniform(rng, 0.4, 2.2) : -uniform(rng, 0.2, 0.8);
  const trueMean = t0 + (less ? -1 : 1) * k * s0 / Math.sqrt(n2);
  const varMore = rng() < 0.5; // H₀: σ² ≤ σ₀² (right tail) or H₀: σ² ≥ σ₀² (left tail)
  const f = rng() < 0.7 ? (varMore ? uniform(rng, 1.2, 1.55) : uniform(rng, 0.6, 0.82)) : uniform(rng, 0.92, 1.08);
  const dp2 = s0 >= 3 ? 0 : 1;
  // Redraw until the statistics look like an exam's (no z of 6 or a p-value of 0.0000001).
  let T2: number[] = [];
  for (let tries = 0; tries < 60; tries++) {
    T2 = Array.from({ length: n2 }, () => round(trueMean + s0 * f * gauss(rng), dp2));
    const z = Math.abs(mean(T2) - t0) / (s0 / Math.sqrt(n2)), c = ((n2 - 1) * stdevS(T2) ** 2) / (s0 * s0);
    const pc = Math.min(chisqCdf(c, n2 - 1), 1 - chisqCdf(c, n2 - 1));
    if (z < 3.6 && pc > 0.0005) break;
  }
  const alpha6 = pick(rng, [0.05, 0.05, 0.1, 0.01]);

  // ----- coin -----
  const N = pick(rng, [400, 500, 800, 1000, 1200, 1500]);
  const ph = 0.5 + (rng() < 0.6 ? 1 : -1) * uniform(rng, 0.004, 0.05);
  const h = Math.round(N * ph);
  const coinTail: "left" | "right" = rng() < 0.65 ? "right" : "left"; // H₀: μ ≤ 0.5 or μ ≥ 0.5
  const fbX = round(round(h / N, 2) + (rng() < 0.5 ? 0.01 : -0.01), 2);
  const fallback = { xbar: fbX, s: 0.2 };

  // ----- Section 4 -----
  const n3 = randInt(rng, 60, 101);
  const exam1 = Array.from({ length: n3 }, () => Math.round(clamp(68 + 14 * gauss(rng), 25, 100))).sort((a, b) => b - a);
  const delta = pick(rng, [-4, -2, 0, 2, 4, 6]);
  const exam2 = exam1.map((x) => Math.round(clamp(x + delta + 15 * gauss(rng), 10, 100)));
  const n45 = randInt(rng, 20, 25);
  const m4 = uniform(rng, 64, 78), m5b = m4 + pick(rng, [-9, -6, -3, 0, 3, 6, 9]);
  const T4 = Array.from({ length: n45 }, () => Math.round(clamp(m4 + 13 * gauss(rng), 10, 100)));
  const T5 = Array.from({ length: n45 }, () => Math.round(clamp(m5b + 11 * gauss(rng), 10, 100)));
  const tz = TWO_Z[(n - 1) % TWO_Z.length];
  const [v6, v7] = rng() < 0.5 ? [tz.v[0], tz.v[1]] : [tz.v[1], tz.v[0]];
  const n67 = randInt(rng, 25, 35);
  const base = uniform(rng, tz.m[0], tz.m[1]);
  const gap = (rng() < 0.5 ? -1 : 1) * pick(rng, [0, 0.8, 1.6, 2.4, 3.2]) * Math.sqrt((v6 + v7) / n67);
  const T6 = Array.from({ length: n67 }, () => round(Math.max(0.1, base + Math.sqrt(v6) * gauss(rng)), tz.dp));
  const T7 = Array.from({ length: n67 }, () => round(Math.max(0.1, base + gap + Math.sqrt(v7) * gauss(rng)), tz.dp));

  // ---------- layout (rows), as on the professor's tabs ----------
  const r3 = 11 + n1 + 3, rq4 = r3 + 2, r5 = r3 + 8;          // Confidence intervals
  const r7 = 3 + n1 + 3;                                       // Hypothesis testing I
  const r9 = 3 + n2 + 2, r10 = r9 + 2, r11 = r10 + 7, r12 = r11 + 3; // Hypothesis testing II
  const r15 = 15 + n45 + 4;                                    // Two-sample tests
  const starts: Starts = { 1: [0, 3], 2: [0, 9], 3: [0, r3], 4: [0, rq4], 5: [0, r5], 6: [1, 3], 7: [1, r7], 8: [2, 3], 9: [2, r9], 10: [2, r10], 11: [2, r11], 12: [2, r12], 13: [3, 3], 14: [3, 10], 15: [3, r15] };
  const rng1 = `D12:D${11 + n1}`, rngT2ci = `D${r5 + 1}:D${r5 + n5}`;
  const rngT1h = `D4:D${3 + n1}`, rngT2h1 = `D${r7 + 1}:D${r7 + n2}`, rngT2h2 = `D4:D${3 + n2}`;
  const rngD = `F5:F${4 + n3}`;
  const rng4 = `G16:G${15 + n45}`, rng5 = `I16:I${15 + n45}`, rng6 = `G${r15 + 6}:G${r15 + 5 + n67}`, rng7 = `I${r15 + 6}:I${r15 + 5 + n67}`;

  // ---------- answers ----------
  const zc = (conf: number) => normInv(1 - (1 - conf / 100) / 2);
  const se1 = sig1 / Math.sqrt(n1), x1 = mean(T1);
  const lo1 = mu1 - zc(conf1) * se1, hi1 = mu1 + zc(conf1) * se1;
  const inside = x1 >= lo1 && x1 <= hi1;
  const a1 = 1 - conf1 / 100, a4 = 1 - conf4 / 100, a5 = 1 - conf5 / 100;
  const x5 = mean(T2CI), sd5 = stdevS(T2CI), t5 = tInv(1 - a5 / 2, n5 - 1), se5 = sd5 / Math.sqrt(n5);

  const z6 = (x1 - mu1) / se1, p6 = z6 < 0 ? 2 * normCdf(z6) : 2 * (1 - normCdf(z6));
  const x2 = mean(T2), sd2 = stdevS(T2);
  const z7 = (x2 - t0) / (s0 / Math.sqrt(n2)), t8 = (x2 - t0) / (sd2 / Math.sqrt(n2));
  const tail7: "left" | "right" = less ? "left" : "right";
  const p7 = less ? normCdf(z7) : 1 - normCdf(z7), crit7 = less ? normInv(0.05) : normInv(0.95);
  const p8 = less ? tCdf(t8, n2 - 1) : 1 - tCdf(t8, n2 - 1), crit8 = less ? tInv(0.05, n2 - 1) : tInv(0.95, n2 - 1);
  const v0 = s0 * s0, chi = ((n2 - 1) * sd2 * sd2) / v0;
  const p10 = varMore ? 1 - chisqCdf(chi, n2 - 1) : chisqCdf(chi, n2 - 1), crit10 = varMore ? chisqInv(0.95, n2 - 1) : chisqInv(0.05, n2 - 1);
  const xc = h / N, sc = Math.sqrt((N / (N - 1)) * xc * (1 - xc));
  const D = exam2.map((v, i) => v - exam1[i]), xD = mean(D), sD = stdevS(D), t13 = xD / (sD / Math.sqrt(n3));
  const sP = Math.sqrt((stdevS(T4) ** 2 + stdevS(T5) ** 2) / 2), df14 = 2 * n45 - 2;
  const t14 = (mean(T4) - mean(T5)) / (sP * Math.sqrt(2 / n45)), p14 = t14 < 0 ? 2 * tCdf(t14, df14) : 2 * (1 - tCdf(t14, df14));
  const z15 = (mean(T6) - mean(T7)) / Math.sqrt(v6 / n67 + v7 / n67), p15 = z15 < 0 ? 2 * normCdf(z15) : 2 * (1 - normCdf(z15));

  const lessWord = less ? "less" : "more", h0Sym = less ? "≥" : "≤";
  const t0u = `${t0}${u}`, s0u = `${s0}${u}`;
  const twoP = (stat: number, dist: string) => (stat < 0 ? `=2*${dist}` : `=2*(1-${dist})`);
  const pct = (c: number) => `${c}%`;

  // Block cells: [n, alpha, test statistic, critical value, p value, Decision].
  const blockCells = (labelCol: string, row: number, decCol: string) => {
    const ac = String.fromCharCode(labelCol.charCodeAt(0) + 1), dc = String.fromCharCode(decCol.charCodeAt(0) + 1);
    return [0, 1, 2, 3, 4].map((i) => `${ac}${row + i}`).concat(`${dc}${row}`);
  };
  const B6 = blockCells("F", 3, "I"), B7 = blockCells("F", r7, "I"), B8 = blockCells("F", 3, "I");
  const B10 = blockCells("D", r10, "G"), B12 = blockCells("D", r12, "G");
  const B13 = blockCells("G", 3, "J"), B14 = blockCells("K", 10, "N"), B15 = blockCells("K", r15, "N");
  const withCells = (specs: Spec[], cells: string[]) => specs.map((s, i) => ({ ...s, cell: cells[i] }));
  const decF = (cells: string[]) => `=IF(${cells[4]}<${cells[1]},"R","DR")`;

  const interval = (label: string, value: number, excel: string, explain: string, traps: { value: number; why: string }[]): Spec =>
    num(label, value, excel, explain, 0.005, { find: "value", traps });

  // Q12 depends on the student's Question 11 (follow-through), so it is built from (x̄, S).
  const coinSpecs = (xb: number, s: number): Spec[] => {
    const t = (xb - 0.5) / (s / Math.sqrt(N));
    const right = coinTail === "right";
    const p = right ? 1 - tCdf(t, N - 1) : tCdf(t, N - 1);
    return withCells(testParts({
      n: N, alpha: 0.05, stat: t, statF: `=(E${r11}-0.5)/(E${r11 + 1}/SQRT(E${r12}))`, crit: tInv(right ? 0.95 : 0.05, N - 1), critF: `=T.INV(${right ? "1-" : ""}E${r12 + 1},E${r12}-1)`,
      p, pF: right ? `=1-T.DIST(E${r12 + 2},E${r12}-1,TRUE)` : `=T.DIST(E${r12 + 2},E${r12}-1,TRUE)`, tail: coinTail, S: "T",
      traps: { crit: [{ value: -tInv(right ? 0.95 : 0.05, N - 1), why: `Wrong sign: a ${coinTail}-tail critical value is ${right ? "positive" : "negative"}.` }], p: [{ value: 1 - p, why: `Took the wrong tail; H₀: μ ${right ? "≤" : "≥"} 0.5 is a ${coinTail}-tail test.` }] },
    }), B12);
  };

  const Q: PaperQ[] = [
    { n: 1, section: 0, points: 3, title: `Interval for the sample mean (${pct(conf1)})`, kind: "xbar-range", topic: "clt",
      text: `Construct an interval inside which there is a ${pct(conf1)} chance that the student’s sample mean belongs.`,
      specs: [
        interval("Lower limit", lo1, `=${mu1}-NORM.S.INV(${fmt(1 - a1 / 2)})*${sig1}/SQRT(${n1})`, "μ and σ are known, so x̄ lands in μ ± NORM.S.INV(1 − α/2)·σ/√n.", [{ value: mu1 - zc(conf1) * sig1, why: "Used σ instead of the standard error σ/√n." }, { value: mu1 - normInv(1 - a1) * se1, why: `Used α instead of α/2: a ${pct(conf1)} interval needs NORM.S.INV(${fmt(1 - a1 / 2)}).` }]),
        interval("Upper limit", hi1, `=${mu1}+NORM.S.INV(${fmt(1 - a1 / 2)})*${sig1}/SQRT(${n1})`, "Same width above μ.", [{ value: mu1 + zc(conf1) * sig1, why: "Used σ instead of the standard error σ/√n." }, { value: mu1 + normInv(1 - a1) * se1, why: `Used α instead of α/2: a ${pct(conf1)} interval needs NORM.S.INV(${fmt(1 - a1 / 2)}).` }]),
      ] },
    { n: 2, section: 0, points: 1, title: "Outside the interval: a mistake?", kind: "concept", topic: "concept",
      text: "If the student’s sample mean does not belong inside this interval, do we suspect that the student has made a mistake? Write a few sentences explaining your answer.",
      specs: [{ ...text("Do we suspect a mistake?", `Not necessarily. Even if the student did everything right, there is a ${pct(100 - conf1)} chance the sample mean lands outside a ${pct(conf1)} interval. A mean outside it makes a mistake more likely, so we might suspect one, but it doesn't prove it.`,
        [`${pct(100 - conf1)} chance of landing outside even with no mistake`, "outside makes us suspicious but is not proof"]), cell: "D9" }] },
    { n: 3, section: 0, points: 1, title: `Could μ have been ${mu1}?`, kind: "concept", topic: "concept",
      text: `Is it possible that the student used the intended value of μ=${mu1} for generating these numbers? Briefly explain your answer.`,
      specs: [{ ...text(`Is μ = ${mu1} possible?`, inside
        ? `Yes. The sample mean of Table 1 is ${r4(x1)}, which lies inside the ${pct(conf1)} interval (${r4(lo1)}, ${r4(hi1)}) for x̄ when μ = ${mu1}, so the numbers are consistent with μ = ${mu1}.`
        : `It's possible but unlikely. The sample mean of Table 1 is ${r4(x1)}, outside the ${pct(conf1)} interval (${r4(lo1)}, ${r4(hi1)}) for x̄ when μ = ${mu1}; that happens only ${pct(100 - conf1)} of the time, so we doubt the student used μ = ${mu1}.`,
        [`x̄ = ${r4(x1)}`, inside ? "it lies inside the interval from Question 1, so yes" : "it lies outside the interval from Question 1, so it's unlikely (but not impossible)"]), cell: `D${r3}` }] },
    { n: 4, section: 0, points: 3, title: `Interval for the true mean (${pct(conf4)})`, kind: "ci-z", topic: "ci-z",
      text: `Construct an interval inside which there is an ${pct(conf4)} chance the student’s true mean μ belongs.`.replace("an 9", "a 9"),
      specs: [
        interval("Lower limit", x1 - zc(conf4) * se1, `=AVERAGE(${rng1})-NORM.S.INV(${fmt(1 - a4 / 2)})*${sig1}/SQRT(${n1})`, `σ known, μ unknown: centre on x̄, x̄ ± NORM.S.INV(1 − α/2)·σ/√n with α = ${fmt(a4)}.`, [{ value: mu1 - zc(conf4) * se1, why: `Centred on ${mu1}. This interval is for the unknown μ, so centre it on x̄ = ${r4(x1)}.` }, { value: x1 - normInv(1 - a4) * se1, why: `Used α instead of α/2: ${pct(conf4)} needs NORM.S.INV(${fmt(1 - a4 / 2)}).` }, { value: x1 - zc(conf4) * sig1, why: "Used σ instead of σ/√n." }]),
        interval("Upper limit", x1 + zc(conf4) * se1, `=AVERAGE(${rng1})+NORM.S.INV(${fmt(1 - a4 / 2)})*${sig1}/SQRT(${n1})`, "Same width above x̄.", [{ value: mu1 + zc(conf4) * se1, why: `Centred on ${mu1}. This interval is for the unknown μ, so centre it on x̄ = ${r4(x1)}.` }, { value: x1 + normInv(1 - a4) * se1, why: `Used α instead of α/2: ${pct(conf4)} needs NORM.S.INV(${fmt(1 - a4 / 2)}).` }, { value: x1 + zc(conf4) * sig1, why: "Used σ instead of σ/√n." }]),
      ] },
    { n: 5, section: 0, points: 3, title: `${pct(conf5)} interval, σ unknown`, kind: "ci-t", topic: "t",
      text: `Construct a confidence interval inside which there is a ${pct(conf5)} chance the true mean belongs.`,
      specs: [
        interval("Lower limit", x5 - t5 * se5, `=AVERAGE(${rngT2ci})-T.INV(${fmt(1 - a5 / 2)},${n5 - 1})*STDEV.S(${rngT2ci})/SQRT(${n5})`, "σ unknown: x̄ ± T.INV(1 − α/2, n − 1)·S/√n.", [{ value: x5 - zc(conf5) * se5, why: "Used NORM.S.INV, but σ is unknown: use T.INV with ν = n − 1." }, { value: x5 - tInv(1 - a5, n5 - 1) * se5, why: `Used α instead of α/2: ${pct(conf5)} needs T.INV(${fmt(1 - a5 / 2)}, ν).` }]),
        interval("Upper limit", x5 + t5 * se5, `=AVERAGE(${rngT2ci})+T.INV(${fmt(1 - a5 / 2)},${n5 - 1})*STDEV.S(${rngT2ci})/SQRT(${n5})`, "Same width above x̄.", [{ value: x5 + zc(conf5) * se5, why: "Used NORM.S.INV, but σ is unknown: use T.INV with ν = n − 1." }, { value: x5 + tInv(1 - a5, n5 - 1) * se5, why: `Used α instead of α/2: ${pct(conf5)} needs T.INV(${fmt(1 - a5 / 2)}, ν).` }]),
      ] },
    { n: 6, section: 1, points: 3, title: `Two-tailed Z test, H₀: μ = ${mu1}`, kind: "ht-full", topic: "ht",
      text: `Test the null hypothesis H_{0} : μ = ${mu1} with α = ${alpha6}.`,
      specs: withCells(testParts({
        n: n1, alpha: alpha6, stat: z6, statF: `=(AVERAGE(${rngT1h})-${mu1})/(${sig1}/SQRT(G3))`, crit: normInv(1 - alpha6 / 2), critF: "=NORM.S.INV(1-G4/2)",
        p: p6, pF: twoP(z6, "NORM.S.DIST(G5,TRUE)"), tail: "two", S: "Z",
        traps: { stat: [{ value: (x1 - mu1) / sig1, why: "Divided by σ instead of σ/√n." }], crit: [{ value: normInv(1 - alpha6), why: "Used α instead of α/2 for a two-tailed test." }], p: [{ value: p6 / 2, why: "Gave one tail: an equals-sign H₀ is two-tailed, so double it." }, { value: 1 - p6 / 2, why: "Took the wrong side of the statistic." }] },
      }), B6) },
    { n: 7, section: 1, points: 3, title: `${less ? "Left" : "Right"}-tailed Z test, H₀: μ ${h0Sym} ${t0u} (σ = ${s0u})`, kind: "ht-full", topic: "ht",
      text: `We begin to suspect that the true mean is actually ${lessWord} than ${t0u}, however we continue to trust the stated standard deviation. Use the sample provided in Table 2 to test the null hypothesis H_{0} : μ ${h0Sym} ${t0u} with α = 0.05.`,
      specs: withCells(testParts({
        n: n2, alpha: 0.05, stat: z7, statF: `=(AVERAGE(${rngT2h1})-${t0})/(${s0}/SQRT(G${r7}))`, crit: crit7, critF: less ? `=NORM.S.INV(G${r7 + 1})` : `=NORM.S.INV(1-G${r7 + 1})`,
        p: p7, pF: less ? `=NORM.S.DIST(G${r7 + 2},TRUE)` : `=1-NORM.S.DIST(G${r7 + 2},TRUE)`, tail: tail7, S: "Z",
        traps: { stat: [{ value: t8, why: `Used S from the data, but here σ = ${s0u} is trusted: divide by ${s0}/√n.` }], crit: [{ value: -crit7, why: `Wrong sign: a ${tail7}-tail critical value is ${less ? "negative" : "positive"}.` }, { value: less ? normInv(0.025) : normInv(0.975), why: "Used α/2, but this is one-tailed." }], p: [{ value: 1 - p7, why: `Took the wrong tail; H₀: μ ${h0Sym} ${t0u} is a ${tail7}-tail test.` }, { value: 2 * Math.min(p7, 1 - p7), why: "Doubled it, but this test is one-tailed." }] },
      }), B7) },
    { n: 8, section: 2, points: 3, title: `${less ? "Left" : "Right"}-tailed T test, H₀: μ ${h0Sym} ${t0u} (σ unknown)`, kind: "ht-full", topic: "ht",
      text: `Perform a hypothesis test using the sample given in Table 2 to test the null hypothesis H_{0} : μ ${h0Sym} ${t0u} with α = 0.05.`,
      specs: withCells(testParts({
        n: n2, alpha: 0.05, stat: t8, statF: `=(AVERAGE(${rngT2h2})-${t0})/(STDEV.S(${rngT2h2})/SQRT(G3))`, crit: crit8, critF: less ? "=T.INV(G4,G3-1)" : "=T.INV(1-G4,G3-1)",
        p: p8, pF: less ? "=T.DIST(G5,G3-1,TRUE)" : "=1-T.DIST(G5,G3-1,TRUE)", tail: tail7, S: "T",
        traps: { stat: [{ value: z7, why: `Used σ = ${s0u}, but now σ is doubted: estimate it with STDEV.S.` }], crit: [{ value: crit7, why: `Used NORM.S.INV; σ is unknown, so T.INV with ν = ${n2 - 1}.` }, { value: -crit8, why: `Wrong sign: a ${tail7}-tail critical value is ${less ? "negative" : "positive"}.` }], p: [{ value: less ? normCdf(t8) : 1 - normCdf(t8), why: `Used NORM.S.DIST; σ is unknown, so T.DIST with ν = ${n2 - 1}.` }, { value: 1 - p8, why: `Took the wrong tail; H₀: μ ${h0Sym} ${t0u} is a ${tail7}-tail test.` }] },
      }), B8) },
    { n: 9, section: 2, points: 1, title: "Must Questions 7 and 8 agree?", kind: "concept", topic: "concept",
      text: "Must your answers to Questions 7 and 8 be the same? Explain your answer.",
      specs: [{ ...text("Must the answers be the same?", `No. Question 7 trusts σ = ${s0u} and uses a Z statistic; Question 8 estimates σ with S from the data and uses a T distribution with ${n2 - 1} degrees of freedom. Different assumptions give a different statistic, critical value and p-value, so the decisions can differ (here they ${(p7 < 0.05) === (p8 < 0.05) ? "happen to agree" : "differ"}).`,
        ["no, they need not be the same", `Q7 assumes σ known (Z), Q8 estimates σ with S (T, ν = ${n2 - 1})`, "different assumptions can lead to different decisions"]), cell: `D${r9}` }] },
    { n: 10, section: 2, points: 3, title: `Chi-squared test, H₀: σ² ${varMore ? "≤" : "≥"} ${fmt(v0)}`, kind: "var-test", topic: "var",
      text: `The manufacturer also claims that σ = ${s0u}. We suspect the machine is ${varMore ? "less consistent than this, so that σ is actually larger" : "more consistent than this, so that σ is actually smaller"}. Use the sample given in Table 2 to test the null hypothesis H_{0} : σ^{2} ${varMore ? "≤" : "≥"} ${fmt(v0)} with α = 0.05.`,
      specs: withCells(testParts({
        n: n2, alpha: 0.05, stat: chi, statF: `=(E${r10}-1)*VAR.S(${rngT2h2})/${fmt(v0)}`, crit: crit10, critF: varMore ? `=CHISQ.INV(1-E${r10 + 1},E${r10}-1)` : `=CHISQ.INV(E${r10 + 1},E${r10}-1)`,
        p: p10, pF: varMore ? `=1-CHISQ.DIST(E${r10 + 2},E${r10}-1,TRUE)` : `=CHISQ.DIST(E${r10 + 2},E${r10}-1,TRUE)`, tail: varMore ? "right" : "left", S: "χ²",
        traps: { stat: [{ value: ((n2 - 1) * sd2) / s0, why: "Used S and σ, not the variances S² and σ₀²." }, { value: (n2 * sd2 * sd2) / v0, why: "Used n, not n − 1." }], crit: [{ value: varMore ? chisqInv(0.05, n2 - 1) : chisqInv(0.95, n2 - 1), why: `Wrong tail: H₀: σ² ${varMore ? "≤" : "≥"} ${fmt(v0)} is a ${varMore ? "right" : "left"}-tail test.` }], p: [{ value: 1 - p10, why: `Took the wrong tail; H₀: σ² ${varMore ? "≤" : "≥"} ${fmt(v0)} is a ${varMore ? "right" : "left"}-tail test.` }] },
      }).map((s) => (s.label === "Critical value" ? { ...s, explain: varMore ? "Right tail: CHISQ.INV(1 − α, n − 1)." : "Left tail: CHISQ.INV(α, n − 1). χ² values are never negative." } : s)), B10) },
    { n: 11, section: 2, points: 3, title: `Sample mean and SD of ${N} flips`, kind: "bernoulli", topic: "ht",
      text: `I flip the coin ${N} times: I record ${h} heads and ${N - h} tails. What is the sample mean and sample standard deviation?`,
      specs: [
        num("Sample mean", xc, `=${h}/${N}`, `${h} ones out of ${N}: x̄ = ${fmt(xc)}.`, 1e-6, { at: /^sample mean/i, cell: `E${r11}` }),
        num("Sample std dev", sc, `=SQRT((${h}*(1-E${r11})^2+${N - h}*(0-E${r11})^2)/(${N}-1))`, `S = √(Σ(x − x̄)²/(n − 1)), with ${h} ones and ${N - h} zeros.`, 0.0005, { at: /^sample std/i, cell: `E${r11 + 1}`, traps: [{ value: Math.sqrt(xc * (1 - xc)), why: "Divided by n, not n − 1: STDEV.S divides by n − 1." }] }),
      ] },
    { n: 12, section: 2, points: 4, title: `${coinTail === "right" ? "Right" : "Left"}-tailed T test, H₀: μ ${coinTail === "right" ? "≤" : "≥"} 0.5`, kind: "bernoulli", topic: "ht",
      text: `Test the null hypothesis H_{0} : μ ${coinTail === "right" ? "≤" : "≥"} 0.5 with α = 0.05. *Note: to answer this question you will need answers to Question 11. If you are unsure of your answers you can obtain partial credit for this question by using {xbar} = ${fallback.xbar} and S = ${fallback.s}.*`,
      specs: coinSpecs(xc, sc) },
    { n: 13, section: 3, points: 4, title: "Paired test: did students improve?", kind: "paired", topic: "two",
      text: "Let D denote the difference between tests. For example, if a student has improved then D is positive. Test the null hypothesis H_{0} : μ ≥ 0 with α = 0.05 where μ is the hypothesized mean of D.",
      specs: withCells(testParts({
        n: n3, alpha: 0.05, stat: t13, statF: `=AVERAGE(${rngD})/(STDEV.S(${rngD})/SQRT(H3)), with D = Exam 2 − Exam 1 in ${rngD}`, crit: tInv(0.05, n3 - 1), critF: "=T.INV(H4,H3-1)",
        p: tCdf(t13, n3 - 1), pF: "=T.DIST(H5,H3-1,TRUE)", tail: "left", S: "T",
        traps: { stat: [{ value: -t13, why: "Took Exam 1 − Exam 2. D is positive when a student improved, so D = Exam 2 − Exam 1." }], p: [{ value: 1 - tCdf(t13, n3 - 1), why: "Took the right tail; H₀: μ_D ≥ 0 is a left-tail test." }], crit: [{ value: -tInv(0.05, n3 - 1), why: "Wrong sign: a left-tail critical value is negative." }] },
      }), B13) },
    { n: 14, section: 3, points: 4, title: "Pooled t test: Tables 4 and 5", kind: "two-t", topic: "two",
      text: "Assuming that the variances in final exam scores in both classes are the same, test the null hypothesis that the means for both classes are equal with α = 0.05. You may use the following formulae:",
      specs: withCells(testParts({
        n: n45, alpha: 0.05, stat: t14, statF: `=(AVERAGE(${rng4})-AVERAGE(${rng5}))/(SQRT((VAR.S(${rng4})+VAR.S(${rng5}))/2)*SQRT(2/L10))`, crit: tInv(0.975, df14), critF: "=T.INV(1-L11/2,2*L10-2)",
        p: p14, pF: twoP(t14, "T.DIST(L12,2*L10-2,TRUE)"), tail: "two", S: "T", twoSidedStat: true,
        traps: { crit: [{ value: tInv(0.975, n45 - 1), why: `Used ν = n − 1; the pooled test has ν = 2n − 2 = ${df14}.` }, { value: tInv(0.95, df14), why: "Used α instead of α/2 for a two-tailed test." }], p: [{ value: p14 / 2, why: "Gave one tail: an equals-sign H₀ is two-tailed, so double it." }] },
      }).map((s) => (s.label === "n" ? { ...s, explain: `n is the size of each section (${n45}), so ν = 2n − 2 = ${df14}.`, traps: [{ value: 2 * n45, why: `n here is per section: ${n45}, not ${2 * n45}.` }] } : s)), B14) },
    { n: 15, section: 3, points: 4, title: "Two-sample z test (variances known): Tables 6 and 7", kind: "two-z", topic: "two",
      text: tz.q,
      specs: withCells(testParts({
        n: n67, alpha: 0.05, stat: z15, statF: `=(AVERAGE(${rng6})-AVERAGE(${rng7}))/SQRT(${fmt(v6)}/L${r15}+${fmt(v7)}/L${r15}), the Toolpak's "z"`, crit: normInv(0.975), critF: `=NORM.S.INV(1-L${r15 + 1}/2), the Toolpak's "z Critical two-tail"`,
        p: p15, pF: `${twoP(z15, `NORM.S.DIST(L${r15 + 2},TRUE)`)}, the Toolpak's "P(Z<=z) two-tail"`, tail: "two", S: "Z", twoSidedStat: true,
        traps: { stat: [{ value: (mean(T6) - mean(T7)) / Math.sqrt(Math.sqrt(v6) / n67 + Math.sqrt(v7) / n67), why: "Entered σ where the Toolpak (and the formula) wants the variance σ²." }], crit: [{ value: normInv(0.95), why: "Used the one-tail critical value; equal means is a two-tailed test." }], p: [{ value: p15 / 2, why: "Gave the one-tail p-value; equal means is a two-tailed test." }] },
      }).map((s) => (s.label === "n" ? { ...s, explain: `n is the size of each group (${n67}).`, traps: [{ value: 2 * n67, why: `n here is per group: ${n67}, not ${2 * n67}.` }] } : s.label === "Test statistic" ? { ...s, explain: "z = (x̄₁ − x̄₂)/√(σ₁²/n₁ + σ₂²/n₂): the Toolpak's z-Test: Two Sample for Means, with the known variances." } : s)), B15) },
  ];

  // ---------- the question paper ----------
  const q = (k: number): PaperItem => ({ kind: "q", n: k, text: Q[k - 1].text, points: Q[k - 1].points });
  const v6s = fmt(v6), v7s = fmt(v7);
  const sections: Paper["sections"] = [
    { title: SECTION_TITLES[0], points: 0, items: [
      { kind: "lead", text: `I ask a student to use the random number generator to simulate ${n1} numbers randomly generated according to a normal distribution with μ = ${mu1} and σ = ${sig1}.` },
      q(1), q(2),
      { kind: "lead", text: `The simulated numbers a student produced are shown in Table 1. The student told me that they used σ = ${sig1} but forgot what value for μ they chose.` },
      q(3), q(4),
      { kind: "lead", text: "Table 2 shows the results of independently sampling a random variable many times." },
      q(5),
    ] },
    { title: SECTION_TITLES[1], points: 0, items: [
      { kind: "lead", text: `Table 1 again shows the randomly generated numbers produced by a student who has remembered that σ = ${sig1} but has forgotten which μ they used.` },
      q(6),
      { kind: "lead", text: `${mach.lead(t0u)} The manufacturer of the machine claims that ${mach.what} is a random variable which is normally distributed with mean μ = ${t0u} and σ = ${s0u}.` },
      q(7),
    ] },
    { title: SECTION_TITLES[2], points: 0, items: [
      { kind: "lead", text: "Continuing from the last question, we now doubt all the manufacturer’s claims about μ **and** σ." },
      q(8), q(9), q(10),
      { kind: "lead", text: "I flip a coin. If it lands heads I record X = 1 and if it lands tails I record X = 0. In this way I model the outcome of a coin flip with the random variable X with sample space {0,1}." },
      q(11), q(12),
    ] },
    { title: SECTION_TITLES[3], points: 0, items: [
      { kind: "lead", text: "Table 3 shows the results of students in Exams 1 and 2 scaled out of 100. Have students improved?" },
      q(13),
      { kind: "lead", text: "Tables 4 and 5 show the results of students in two different sections for the final exam. Do students in one section perform better than the other?" },
      q(14), { kind: "formulae" },
      { kind: "lead", text: tz.lead(v6s, v7s) },
      q(15),
    ] },
  ];
  for (const [i, s] of sections.entries()) s.points = Q.filter((x) => x.section === i).reduce((t, x) => t + x.points, 0);

  // ---------- the workbook, laid out like the professor's ----------
  const W = 8.83;
  const sheet = (name: string, cells: Record<string, Cell>, rows: number, widths: Record<number, number> = {}, merges?: string[]): SheetModel =>
    ({ name, cells, colWidths: Array.from({ length: 17 }, (_, i) => widths[i] ?? (i === 1 ? 8.66 : W)), answerCells: {}, rows, ...(merges ? { merges } : {}) });
  const qn = (c: Record<string, Cell>, k: number, row: number) => { c[`B${row}`] = { v: k, role: "title" }; };
  const col = (c: Record<string, Cell>, letter: string, row: number, xs: number[], align?: "left") => xs.forEach((v, i) => { c[`${letter}${row + i}`] = { v, role: "data", ...(align ? { align } : {}) }; });
  const table = (c: Record<string, Cell>, addr: string, label: string, align: "left" | "center" = "left") => { c[addr] = { v: label, role: "header", align }; };
  const block = (c: Record<string, Cell>, labelCol: string, row: number, decCol: string) => {
    const cells = blockCells(labelCol, row, decCol);
    ["n", "alpha", "test statistic", "critical value", "p value"].forEach((l, i) => {
      c[`${labelCol}${row + i}`] = { v: l, role: "label" };
      c[cells[i]] = { role: "answer", tone: i < 2 ? "purple" : "blue" };
    });
    const dc = String.fromCharCode(decCol.charCodeAt(0) + 2);
    c[`${decCol}${row}`] = { v: "Decision", role: "label" };
    c[cells[5]] = { role: "answer", tone: "purple" };
    c[`${dc}${row}`] = { v: "Write R for reject and DR for do not reject", role: "hint" };
  };
  const written = (c: Record<string, Cell>, addr: string) => { c[addr] = { role: "answer", tone: "purple" }; };

  const ci: Record<string, Cell> = {};
  qn(ci, 1, 3); qn(ci, 2, 9); written(ci, "D9");
  table(ci, "D11", "Table 1"); col(ci, "D", 12, T1, "left");
  qn(ci, 3, r3); written(ci, `D${r3}`); qn(ci, 4, rq4);
  qn(ci, 5, r5); table(ci, `D${r5}`, "Table 2"); col(ci, "D", r5 + 1, T2CI, "left");
  const h1: Record<string, Cell> = {};
  qn(h1, 6, 3); table(h1, "D3", "Table 1"); col(h1, "D", 4, T1, "left"); block(h1, "F", 3, "I");
  qn(h1, 7, r7); table(h1, `D${r7}`, "Table 2"); col(h1, "D", r7 + 1, T2, "left"); block(h1, "F", r7, "I");
  const h2: Record<string, Cell> = {};
  qn(h2, 8, 3); table(h2, "D3", "Table 2"); col(h2, "D", 4, T2, "left"); block(h2, "F", 3, "I");
  qn(h2, 9, r9); written(h2, `D${r9}`);
  qn(h2, 10, r10); block(h2, "D", r10, "G");
  qn(h2, 11, r11); h2[`C${r11}`] = { v: "Sample mean", role: "label" }; h2[`E${r11}`] = { role: "answer", tone: "purple" };
  h2[`C${r11 + 1}`] = { v: "Sample std dev", role: "label" }; h2[`E${r11 + 1}`] = { role: "answer", tone: "purple" };
  qn(h2, 12, r12); block(h2, "D", r12, "G");
  const two: Record<string, Cell> = {};
  qn(two, 13, 3); table(two, "D3", "Table 3", "center"); two.D4 = { v: "Exam 1", role: "label" }; two.E4 = { v: "Exam 2", role: "label" };
  col(two, "D", 5, exam1); col(two, "E", 5, exam2); block(two, "G", 3, "J");
  qn(two, 14, 10); block(two, "K", 10, "N");
  table(two, "G15", "Table 4"); table(two, "I15", "Table 5"); col(two, "G", 16, T4); col(two, "I", 16, T5);
  qn(two, 15, r15); block(two, "K", r15, "N");
  table(two, `G${r15 + 5}`, "Table 6"); table(two, `I${r15 + 5}`, "Table 7"); col(two, "G", r15 + 6, T6); col(two, "I", r15 + 6, T7);
  const sheets = [
    sheet(PAPER_TABS[0], ci, r5 + n5),
    sheet(PAPER_TABS[1], h1, r7 + n2, { 5: 12.16 }),
    sheet(PAPER_TABS[2], h2, r12 + 5, { 5: 11.5 }),
    sheet(PAPER_TABS[3], two, Math.max(4 + n3, r15 + 5 + n67), {}, ["D3:E3"]),
  ];

  // ---------- the answer key: the same tabs with every answer as a live formula ----------
  const key = sheets.map((s) => ({ ...s, cells: { ...s.cells } }));
  const fill = (tab: number, specs: Spec[], formulas: string[]) => specs.forEach((sp, i) => {
    const cell = sp.cell!;
    const prev = key[tab].cells[cell] ?? {};
    key[tab].cells[cell] = { ...prev, role: "answer", f: formulas[i] };
  });
  const blockF = (cells: string[], nF: string, alpha: number, statF: string, critF: string, pF: string) => [nF, `=${alpha}`, statF, critF, pF, decF(cells)];
  const lim = (tab: number, labelCol: string, row: number, lo: string, hi: string) => {
    const ac = String.fromCharCode(labelCol.charCodeAt(0) + 1);
    key[tab].cells[`${labelCol}${row}`] = { v: "lower limit", role: "label" }; key[tab].cells[`${ac}${row}`] = { role: "answer", tone: "blue", f: lo };
    key[tab].cells[`${labelCol}${row + 1}`] = { v: "upper limit", role: "label" }; key[tab].cells[`${ac}${row + 1}`] = { role: "answer", tone: "blue", f: hi };
  };
  lim(0, "G", 3, Q[0].specs[0].excel, Q[0].specs[1].excel);
  lim(0, "G", rq4, Q[3].specs[0].excel, Q[3].specs[1].excel);
  lim(0, "G", r5, Q[4].specs[0].excel, Q[4].specs[1].excel);
  key[0].cells.D9 = { role: "answer", tone: "purple", v: Q[1].specs[0].answer as string };
  key[0].cells[`D${r3}`] = { role: "answer", tone: "purple", v: Q[2].specs[0].answer as string };
  key[2].cells[`D${r9}`] = { role: "answer", tone: "purple", v: Q[8].specs[0].answer as string };
  const sp = (k: number) => Q[k - 1].specs;
  fill(1, sp(6), blockF(B6, `=COUNT(${rngT1h})`, alpha6, sp(6)[2].excel, sp(6)[3].excel, sp(6)[4].excel));
  fill(1, sp(7), blockF(B7, `=COUNT(${rngT2h1})`, 0.05, sp(7)[2].excel, sp(7)[3].excel, sp(7)[4].excel));
  fill(2, sp(8), blockF(B8, `=COUNT(${rngT2h2})`, 0.05, sp(8)[2].excel, sp(8)[3].excel, sp(8)[4].excel));
  fill(2, sp(10), blockF(B10, `=COUNT(${rngT2h2})`, 0.05, sp(10)[2].excel, sp(10)[3].excel, sp(10)[4].excel));
  fill(2, sp(11), [sp(11)[0].excel, sp(11)[1].excel]);
  fill(2, sp(12), blockF(B12, `=${N}`, 0.05, sp(12)[2].excel, sp(12)[3].excel, sp(12)[4].excel));
  key[3].cells.F4 = { v: "D", role: "label" };
  exam1.forEach((_, i) => { key[3].cells[`F${5 + i}`] = { f: `=E${5 + i}-D${5 + i}`, role: "data" }; });
  fill(3, sp(13), blockF(B13, `=COUNT(${rngD})`, 0.05, sp(13)[2].excel.split(", with")[0], sp(13)[3].excel, sp(13)[4].excel));
  fill(3, sp(14), blockF(B14, `=COUNT(${rng4})`, 0.05, sp(14)[2].excel, sp(14)[3].excel, sp(14)[4].excel));
  fill(3, sp(15), blockF(B15, `=COUNT(${rng6})`, 0.05, sp(15)[2].excel.split(", the")[0], sp(15)[3].excel.split(", the")[0], sp(15)[4].excel.split(", the")[0]));

  const title = `Practice exam ${n}`;
  return {
    n, id: paperId(n), title, header: `AQM1000, Fall 2026, Midterm 2 practice exam ${n} (AQM Prep)`, file: `AQM-Midterm-2-practice-exam-${n}`,
    sections, questions: Q, sheets, key: key.map((s, i) => ({ ...s, name: PAPER_TABS[i] })), starts, fallback, coin: { N, h, tail: coinTail, alpha: 0.05 },
  };
}

/** The intro shown when the workbook has no Start-here tab (kept for the site's notes). */
export const PAPER_INTRO = [
  "A practice exam laid out exactly like last spring's Exam 3: four tabs, question numbers in column B, the data in its tables.",
  "60 minutes, Excel only, no calculator. The questions are in the Word paper.",
];

// ---------- marking ----------
export const isPaperId = (id: string | null | undefined) => /^paper:\d+$/.test((id ?? "").trim());

/** Marks an uploaded practice exam. Question 12 gets follow-through credit like Exam 3's. */
export function gradePaper(wb: ReadWorkbook, n: number): WorkbookGrade {
  const P = paper(n);
  if (!P) throw new Error("This practice exam isn't one the site knows. Download it again from the site.");
  const tabs = PAPER_TABS.map((t) => findTab(wb, t));
  const notes: string[] = [];
  const gradeQ = (q: PaperQ, specs = q.specs): QuestionGrade => {
    const cells = tabs[q.section];
    const per = q.points / specs.length;
    const parts: PartGrade[] = specs.map((s, i) => {
      const { cell, r } = locate(cells, q.n, s, wb, P.starts);
      const part = { ...(s as unknown as Part), id: String.fromCharCode(97 + i) };
      return { ...r, part, cell, points: per, got: r.ok ? per : 0 };
    });
    const question: Question = { id: `${P.id}-q${q.n}`, seed: 0, kind: q.kind, topic: q.topic, title: q.title, prompt: plain(q.text), parts: parts.map((p) => p.part) };
    return { q: question, index: q.n - 1, section: PAPER_SECTIONS[q.section], sheetFound: !!cells, parts, got: parts.reduce((t, p) => t + p.got, 0), total: q.points };
  };
  const base = P.questions.map((q) => gradeQ(q));

  // Question 12, follow-through: the student's own Question 11, then the paper's fallback values.
  const q11 = base[10], q12 = P.questions[11];
  const mine = q11.parts.map((p) => Number(p.mine));
  const worlds: { xbar: number; s: number; why: string }[] = [{ ...P.fallback, why: `the paper's fallback x̄ = ${P.fallback.xbar} and S = ${P.fallback.s}` }];
  if (mine.every((v) => Number.isFinite(v) && v > 0) && !q11.parts.every((p) => p.ok)) worlds.unshift({ xbar: mine[0], s: mine[1], why: "your own Question 11 answers" });
  const statOk = (g: QuestionGrade) => g.parts.filter((p) => p.ok && /statistic|p-value|Critical|Decision/.test(p.part.label)).length;
  for (const w of worlds) {
    const alt = gradeQ(q12, specsForCoin(P, w.xbar, w.s));
    if (statOk(alt) > statOk(base[11])) {
      base[11] = alt;
      notes.push(`Question 12 was marked using ${w.why} (follow-through credit, as the paper allows).`);
      break;
    }
  }

  const missing = PAPER_TABS.filter((_, i) => !tabs[i]);
  if (missing.length) notes.push(`These tabs weren't in the file: ${missing.join(", ")}. Upload the practice exam workbook with its four tabs.`);
  if (base.some((g) => g.parts.some((p) => p.status === "nocache"))) notes.push("Some cells have formulas with no saved result. Open the file in Excel, let it calculate, save, and upload again.");
  const writtenN = base.reduce((s, g) => s + g.parts.filter((p) => p.status === "written").length, 0);
  if (writtenN) notes.push(`${writtenN} written answer${writtenN === 1 ? " needs" : "s need"} marking: have Claude mark ${writtenN === 1 ? "it" : "them"}, or compare with the model answer below.`);
  notes.push("Section 1 has no fixed answer cells, so intervals are found by value anywhere in each question's rows.");
  return { kind: "paper", n, id: P.id, title: P.title, questions: base, got: base.reduce((s, g) => s + g.got, 0), total: base.reduce((s, g) => s + g.total, 0), notes };
}

/** Question 12's parts for another (x̄, S), keeping the same cells. */
function specsForCoin(P: Paper, xb: number, s: number): Spec[] {
  const { N, tail } = P.coin;
  const right = tail === "right";
  const t = (xb - 0.5) / (s / Math.sqrt(N));
  const p = right ? 1 - tCdf(t, N - 1) : tCdf(t, N - 1);
  return P.questions[11].specs.map((sp) => {
    if (/^Test stat/.test(sp.label)) return { ...sp, answer: t, traps: undefined };
    if (/^p-value/.test(sp.label)) return { ...sp, answer: p, tol: Math.max(0.0005, Math.min(0.002, 0.02 * p)), traps: undefined };
    if (sp.kind === "choice") return { ...sp, answer: (sp.options ?? [])[p < 0.05 ? 0 : 1] };
    return sp;
  });
}

/** For the tests: does a value sit in a cell of a given tab? */
export const cellOf = (wb: ReadWorkbook, tab: number, addr: string): CellVal | undefined => findTab(wb, PAPER_TABS[tab])?.[addr];
