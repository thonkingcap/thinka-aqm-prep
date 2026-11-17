// Lesson 18 practice sets, laid out like the Lesson 18 notes' exercises:
//   Q1  the "Exercise" tab: simulated normal data, H₀: the variance is at most σ₀² (right tail), chi-squared
//   Q2  bonus: the same sample, the other tail (H₀: σ² ≥ σ₀², left tail)
//   Q3  the "Two-sample" tab: two simulated samples, known σ, Toolpak z-Test: Two Sample for Means, equal means
//   Q4  bonus: the same X and Y with σ unknown, Toolpak t-Test: Two-Sample Assuming Equal Variances
// Each version's data are chosen so the decisions differ between versions. The workbook has the question tab
// and an answer-key tab with live formulas; uploads are marked against the id "l18:N".
import type { ReadWorkbook } from "./xlsxRead.ts";
import type { Part, Question, QuestionKind, TopicId } from "./practice.ts";
import type { SheetModel, Cell } from "./workbook.ts";
import type { PartGrade, QuestionGrade, WorkbookGrade } from "./grade.ts";
import { mean, stdevS, normInv, normCdf, tInv, tCdf, chisqCdf, chisqInv } from "./stats.ts";
import { num, decision, locate, findTab, type Spec, type Starts } from "./exam3.ts";

export const L18_COUNT = 6;
export const l18Id = (n: number) => `l18:${n}`;
export const isL18Id = (id: string | null | undefined) => /^l18:\d+$/.test((id ?? "").trim());
const TAB = "Practice", KEY_TAB = "Answer key";

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
const gauss = (rng: Rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
const r4 = (x: number) => Number(x.toFixed(4));
const fmt = (x: number) => String(Number(x.toFixed(6)));
const pct = (a: number) => `${Math.round(a * 100)}%`;

// [Q1 right tail, Q2 left tail, Q3 z, Q4 t]: R (true) / DR (false); null = whatever the data give.
type Version = {
  v: { n: number; mu: number; sd: number; v0: number; alpha: number };
  t: { nx: number; ny: number; mx: number; my: number; sx: number; sy: number; alpha: number };
  want: [boolean, boolean, boolean, boolean] | null;
};
const VERSIONS: Version[] = [
  { v: { n: 10, mu: 0, sd: 1.5, v0: 1, alpha: 0.2 }, t: { nx: 10, ny: 10, mx: 10, my: 9, sx: 1, sy: 1, alpha: 0.2 }, want: [true, false, true, true] },
  { v: { n: 12, mu: 5, sd: 2, v0: 4, alpha: 0.1 }, t: { nx: 12, ny: 12, mx: 20, my: 20.5, sx: 2, sy: 2, alpha: 0.05 }, want: [false, false, false, false] },
  { v: { n: 15, mu: 50, sd: 2.2, v0: 9, alpha: 0.05 }, t: { nx: 15, ny: 12, mx: 50, my: 53, sx: 3, sy: 4, alpha: 0.1 }, want: [false, true, true, true] },
  { v: { n: 8, mu: 100, sd: 7, v0: 25, alpha: 0.05 }, t: { nx: 10, ny: 10, mx: 30, my: 31, sx: 2, sy: 2, alpha: 0.1 }, want: [true, false, false, false] },
  { v: { n: 20, mu: 12, sd: 0.8, v0: 1, alpha: 0.1 }, t: { nx: 20, ny: 20, mx: 5, my: 5.7, sx: 1, sy: 1, alpha: 0.05 }, want: [false, true, true, true] },
  // The notes' own setup: N(0, 1) and variance ≤ 1 at 20%; X~N(10,1), Y~N(9,1) at 20%.
  { v: { n: 10, mu: 0, sd: 1, v0: 1, alpha: 0.2 }, t: { nx: 10, ny: 10, mx: 10, my: 9, sx: 1, sy: 1, alpha: 0.2 }, want: null },
];

type Ans = {
  n: number; s2: number; stat: number; pR: number; cR: number; pL: number; cL: number;
  mx: number; my: number; z: number; pz: number; cz: number; sp2: number; df: number; t: number; pt: number; ct: number;
};
function answers(V: Version, xs: number[], X: number[], Y: number[]): Ans {
  const n = xs.length, s2 = stdevS(xs) ** 2, stat = ((n - 1) * s2) / V.v.v0, a = V.v.alpha, b = V.t.alpha;
  const mx = mean(X), my = mean(Y), nx = X.length, ny = Y.length;
  const z = (mx - my) / Math.sqrt(V.t.sx ** 2 / nx + V.t.sy ** 2 / ny);
  const df = nx + ny - 2, sp2 = ((nx - 1) * stdevS(X) ** 2 + (ny - 1) * stdevS(Y) ** 2) / df;
  const t = (mx - my) / Math.sqrt(sp2 * (1 / nx + 1 / ny));
  return {
    n, s2, stat, pR: 1 - chisqCdf(stat, n - 1), cR: chisqInv(1 - a, n - 1), pL: chisqCdf(stat, n - 1), cL: chisqInv(a, n - 1),
    mx, my, z, pz: z < 0 ? 2 * normCdf(z) : 2 * (1 - normCdf(z)), cz: normInv(1 - b / 2),
    sp2, df, t, pt: t < 0 ? 2 * tCdf(t, df) : 2 * (1 - tCdf(t, df)), ct: tInv(1 - b / 2, df),
  };
}

export type L18Q = { n: number; title: string; kind: QuestionKind; topic: TopicId; text: string; specs: Spec[] };
export type L18Set = { n: number; id: string; title: string; file: string; sheets: SheetModel[]; questions: L18Q[]; starts: Starts; intro: string[] };

const cache = new Map<number, L18Set>();
export function l18Set(n: number): L18Set | null {
  if (!(Number.isInteger(n) && n >= 1 && n <= L18_COUNT)) return null;
  if (!cache.has(n)) cache.set(n, build(n));
  return cache.get(n)!;
}

function build(k: number): L18Set {
  const V = VERSIONS[k - 1];
  const rng = mulberry32((0x18181818 ^ Math.imul(k, 0x9e3779b1)) >>> 0);
  let xs: number[] = [], X: number[] = [], Y: number[] = [], A!: Ans;
  for (let tries = 0; tries < 4000; tries++) {
    xs = Array.from({ length: V.v.n }, () => r4(V.v.mu + V.v.sd * gauss(rng)));
    X = Array.from({ length: V.t.nx }, () => r4(V.t.mx + V.t.sx * gauss(rng)));
    Y = Array.from({ length: V.t.ny }, () => r4(V.t.my + V.t.sy * gauss(rng)));
    A = answers(V, xs, X, Y);
    const got = [A.pR < V.v.alpha, A.pL < V.v.alpha, A.pz < V.t.alpha, A.pt < V.t.alpha];
    const clear = Math.abs(A.pR - V.v.alpha) > 0.02 && Math.abs(A.pL - V.v.alpha) > 0.02 && Math.abs(A.pz - V.t.alpha) > 0.01 && Math.abs(A.pt - V.t.alpha) > 0.01 && A.pz > 0.001 && A.pR > 0.002 && A.pL > 0.002;
    if (clear && (!V.want || V.want.every((w, i) => w === got[i]))) break;
  }

  // ---------- layout ----------
  const n = xs.length, rng1 = `C5:C${4 + n}`;
  const r = Math.max(5 + n, 13) + 1, q = r + 8, a0 = q + 3;
  const rx = `C${a0}:C${a0 - 1 + X.length}`, ry = `D${a0}:D${a0 - 1 + Y.length}`;
  const b = a0 + Math.max(X.length, Y.length, 9) + 1;
  const starts: Starts = { 1: [0, 2], 2: [0, r], 3: [0, q], 4: [0, b] };
  const v0 = V.v.v0, al = V.v.alpha, bt = V.t.alpha;

  const dec = (reject: boolean, rule: string, cell: string): Spec => ({ ...decision(reject, rule), label: "Decision (R or DR)", cell });
  const Q: L18Q[] = [
    { n: 1, title: `Chi-squared test, H₀: σ² ≤ ${fmt(v0)}`, kind: "var-test", topic: "var",
      text: `Task: simulate ${n} normally distributed random variables with mean ${V.v.mu} and std_dev ${V.v.sd} (the values are in the sheet). Test a null hypothesis which claims that the variance is less than ${fmt(v0)} with significance ${pct(al)}.`,
      specs: [
        num("n", n, `=COUNT(${rng1})`, "Count the sample.", 0, { cell: "G6" }),
        num("Sample variance", A.s2, `=VAR.S(${rng1})`, "S² = VAR.S of the data (divides by n − 1).", Math.max(0.0005, 0.002 * A.s2), { cell: "G7", traps: [{ value: (A.s2 * (n - 1)) / n, why: "Divided by n (VAR.P). Use VAR.S." }, { value: Math.sqrt(A.s2), why: "That's S, not S²." }] }),
        num("Test statistic", A.stat, "=((G6-1)/G8)*G7", "χ² = (n − 1)·S²/σ₀².", Math.max(0.005, 0.002 * A.stat), { cell: "G9", traps: [{ value: (n * A.s2) / v0, why: "Used n, not n − 1." }] }),
        num("p-value", A.pR, "=1-CHISQ.DIST(G9,G6-1,TRUE)", "H₀: σ² ≤ σ₀² is a right-tail test: 1 − CHISQ.DIST(stat, n − 1, TRUE).", Math.max(0.0005, Math.min(0.002, 0.02 * A.pR)), { cell: "G10", format: "prob", traps: [{ value: A.pL, why: "Took the left tail; 'at most σ₀²' in H₀ means a right-tail test." }] }),
        num("Critical value", A.cR, "=CHISQ.INV(1-G5,G6-1)", "Right tail: CHISQ.INV(1 − α, n − 1).", 0.003, { cell: "G11", traps: [{ value: A.cL, why: "Used CHISQ.INV(α): that's the left-tail cut-off." }] }),
        dec(A.pR < al, `p = ${r4(A.pR)} ${A.pR < al ? "<" : "≥"} α = ${al}`, "G12"),
      ] },
    { n: 2, title: `Bonus: the other tail, H₀: σ² ≥ ${fmt(v0)}`, kind: "var-test", topic: "var",
      text: `Bonus (other tail). Using the same sample, test the null hypothesis that the variance is at least ${fmt(v0)} (H₀: σ² ≥ ${fmt(v0)}) with significance ${pct(al)}.`,
      specs: [
        num("Test statistic", A.stat, "=((G6-1)/G8)*G7", "Same statistic as Question 1.", Math.max(0.005, 0.002 * A.stat), { cell: `G${r + 2}` }),
        num("p-value", A.pL, `=CHISQ.DIST(G${r + 2},G6-1,TRUE)`, "Left tail: CHISQ.DIST(stat, n − 1, TRUE).", Math.max(0.0005, Math.min(0.002, 0.02 * A.pL)), { cell: `G${r + 3}`, format: "prob", traps: [{ value: A.pR, why: "Took the right tail; H₀: σ² ≥ σ₀² is a left-tail test." }] }),
        num("Critical value", A.cL, `=CHISQ.INV(G${r + 1},G6-1)`, "Left tail: CHISQ.INV(α, n − 1), a small positive number (chi-squared is never negative).", 0.003, { cell: `G${r + 4}`, traps: [{ value: A.cR, why: "Used CHISQ.INV(1 − α): that's the right-tail cut-off." }, { value: -A.cR, why: "Chi-squared has no negative values: use CHISQ.INV(α)." }] }),
        dec(A.pL < al, `p = ${r4(A.pL)} ${A.pL < al ? "<" : "≥"} α = ${al}`, `G${r + 5}`),
      ] },
    { n: 3, title: "Two-sample z test (σ known), Toolpak", kind: "two-z", topic: "two",
      text: `Task: use the RNG to make two different samples (X of size ${X.length}, Y of size ${Y.length}): X~N(${V.t.mx},${fmt(V.t.sx ** 2)}), Y~N(${V.t.my},${fmt(V.t.sy ** 2)}). Use the Toolpak to test the null hypothesis that both means are equal with alpha = ${pct(bt)}, assuming we know the true standard deviations (${V.t.sx} for X, ${V.t.sy} for Y).`,
      specs: [
        num("Mean X", A.mx, `=AVERAGE(${rx})`, "The Toolpak's Mean for Variable 1.", 0.0005, { cell: `G${a0 + 3}` }),
        num("Mean Y", A.my, `=AVERAGE(${ry})`, "The Toolpak's Mean for Variable 2.", 0.0005, { cell: `G${a0 + 4}` }),
        num("z", A.z, `=(G${a0 + 3}-G${a0 + 4})/SQRT(G${a0 + 1}/COUNT(${rx})+G${a0 + 2}/COUNT(${ry}))`, "z = (x̄ − ȳ)/√(σx²/nx + σy²/ny): the Toolpak's z, with the KNOWN variances.", 0.005, { cell: `G${a0 + 5}`, traps: [{ value: (A.mx - A.my) / Math.sqrt(V.t.sx / X.length + V.t.sy / Y.length), why: "Entered σ where the Toolpak wants the variance σ²." }, { value: -A.z, why: "Subtracted the other way round: Variable 1 is X." }] }),
        num("p-value (two-tail)", A.pz, A.z < 0 ? `=2*NORM.S.DIST(G${a0 + 5},TRUE)` : `=2*(1-NORM.S.DIST(G${a0 + 5},TRUE))`, "Two tails: double the tail z points into (the Toolpak's P(Z<=z) two-tail).", Math.max(0.0005, Math.min(0.002, 0.02 * A.pz)), { cell: `G${a0 + 6}`, format: "prob", traps: [{ value: A.pz / 2, why: "Gave the one-tail p-value; equal means is a two-tailed test." }] }),
        num("z critical (±)", A.cz, `=NORM.S.INV(1-G${a0}/2)`, "Two tails: NORM.S.INV(1 − α/2), the Toolpak's z Critical two-tail.", 0.003, { cell: `G${a0 + 7}`, alts: [-A.cz], traps: [{ value: normInv(1 - bt), why: "That's the one-tail critical value." }] } as Partial<Spec>),
        dec(A.pz < bt, `p = ${r4(A.pz)} ${A.pz < bt ? "<" : "≥"} α = ${bt}`, `G${a0 + 8}`),
      ] },
    { n: 4, title: "Bonus: pooled t test (σ unknown), Toolpak", kind: "two-t", topic: "two",
      text: `Bonus. Now suppose the true standard deviations are NOT known. Use the Toolpak's t-Test: Two-Sample Assuming Equal Variances on the same X and Y to test that the means are equal with alpha = ${pct(bt)}.`,
      specs: [
        num("Pooled variance", A.sp2, `=((COUNT(${rx})-1)*VAR.S(${rx})+(COUNT(${ry})-1)*VAR.S(${ry}))/(COUNT(${rx})+COUNT(${ry})-2)`, "The Toolpak's Pooled Variance.", Math.max(0.0005, 0.002 * A.sp2), { cell: `G${b + 2}` }),
        num("df", A.df, `=COUNT(${rx})+COUNT(${ry})-2`, "ν = nx + ny − 2.", 0, { cell: `G${b + 3}`, traps: [{ value: A.df + 1, why: "ν = nx + ny − 2." }] }),
        num("t Stat", A.t, `=(AVERAGE(${rx})-AVERAGE(${ry}))/SQRT(G${b + 2}*(1/COUNT(${rx})+1/COUNT(${ry})))`, "The Toolpak's t Stat.", 0.005, { cell: `G${b + 4}`, traps: [{ value: -A.t, why: "Subtracted the other way round: Variable 1 is X." }] }),
        num("p-value (two-tail)", A.pt, A.t < 0 ? `=2*T.DIST(G${b + 4},G${b + 3},TRUE)` : `=2*(1-T.DIST(G${b + 4},G${b + 3},TRUE))`, "The Toolpak's P(T<=t) two-tail.", Math.max(0.0005, Math.min(0.002, 0.02 * A.pt)), { cell: `G${b + 5}`, format: "prob", traps: [{ value: A.pt / 2, why: "Gave the one-tail p-value." }] }),
        num("t critical (±)", A.ct, `=T.INV(1-G${b + 1}/2,G${b + 3})`, "The Toolpak's t Critical two-tail.", 0.003, { cell: `G${b + 6}`, alts: [-A.ct], traps: [{ value: tInv(1 - bt, A.df), why: "That's the one-tail critical value." }] } as Partial<Spec>),
        dec(A.pt < bt, `p = ${r4(A.pt)} ${A.pt < bt ? "<" : "≥"} α = ${bt}`, `G${b + 7}`),
      ] },
  ] as L18Q[];

  // ---------- sheets ----------
  const cells: Record<string, Cell> = {};
  const T = (addr: string, v: string, role: Cell["role"] = "text") => { cells[addr] = { v, role }; };
  T("B1", `Lesson 18 practice · set ${k}`, "title");
  T("B2", `1. ${Q[0].text}`, "header");
  T("C4", "Sample", "header");
  xs.forEach((x, i) => { cells[`C${5 + i}`] = { v: x, role: "data" }; });
  ["alpha", "n", "sample variance", "hypothesized variance", "test_stat", "p-val", "critical value", "decision (R or DR)"].forEach((l, i) => T(`E${5 + i}`, l, "label"));
  cells.G5 = { v: al, role: "given" }; cells.G8 = { v: v0, role: "given" };
  T(`B${r}`, `2. ${Q[1].text}`, "header");
  ["alpha", "test_stat", "p-val", "critical value", "decision (R or DR)"].forEach((l, i) => T(`E${r + 1 + i}`, l, "label"));
  cells[`G${r + 1}`] = { v: al, role: "given" };
  T(`B${q}`, `3. ${Q[2].text}`, "header");
  T(`C${a0 - 1}`, "X", "header"); T(`D${a0 - 1}`, "Y", "header");
  X.forEach((x, i) => { cells[`C${a0 + i}`] = { v: x, role: "data" }; });
  Y.forEach((y, i) => { cells[`D${a0 + i}`] = { v: y, role: "data" }; });
  ["alpha", "known variance X", "known variance Y", "mean X", "mean Y", "z", "p-value (two-tail)", "z critical (two-tail, ±)", "decision (R or DR)"].forEach((l, i) => T(`E${a0 + i}`, l, "label"));
  cells[`G${a0}`] = { v: bt, role: "given" }; cells[`G${a0 + 1}`] = { v: V.t.sx ** 2, role: "given" }; cells[`G${a0 + 2}`] = { v: V.t.sy ** 2, role: "given" };
  T(`B${b}`, `4. ${Q[3].text}`, "header");
  ["alpha", "pooled variance", "df", "t Stat", "p-value (two-tail)", "t critical (two-tail, ±)", "decision (R or DR)"].forEach((l, i) => T(`E${b + 1 + i}`, l, "label"));
  cells[`G${b + 1}`] = { v: bt, role: "given" };
  for (const qq of Q) for (const s of qq.specs) cells[s.cell!] = { role: "answer" };

  const keyCells: Record<string, Cell> = { ...cells, B1: { v: `Lesson 18 practice · set ${k} · ANSWER KEY`, role: "title" } };
  for (const qq of Q) for (const s of qq.specs) {
    keyCells[s.cell!] = { role: "answer", f: s.kind === "choice" ? (s.cell === "G12" ? '=IF(G10<G5,"R","DR")' : s.cell === `G${r + 5}` ? `=IF(G${r + 3}<G${r + 1},"R","DR")` : s.cell === `G${a0 + 8}` ? `=IF(G${a0 + 6}<G${a0},"R","DR")` : `=IF(G${b + 5}<G${b + 1},"R","DR")`) : s.excel };
  }
  const note = (addr: string, txt: string) => { keyCells[addr] = { v: txt, role: "hint" }; };
  note("I12", `p = ${r4(A.pR)} ${A.pR < al ? "<" : "≥"} α = ${al}, so ${A.pR < al ? "R: the test statistic is right of the critical value." : "DR: the sample variance isn't large enough to doubt H₀."}`);
  note(`I${r + 5}`, `p = ${r4(A.pL)} ${A.pL < al ? "<" : "≥"} α, so ${A.pL < al ? "R" : "DR"}. Left tail: the critical value is CHISQ.INV(α), a small positive number.`);
  note(`I${a0 + 8}`, `z = ${r4(A.z)} is ${A.z < 0 ? "negative, so p = 2*NORM.S.DIST(z)" : "positive, so p = 2*(1 − NORM.S.DIST(z))"} = ${r4(A.pz)}; ${A.pz < bt ? "R" : "DR"}. Same as the Toolpak's 'P(Z<=z) two-tail'.`);
  note(`I${b + 7}`, `t = ${r4(A.t)}, ν = ${A.df}, p = ${r4(A.pt)}; ${A.pt < bt ? "R" : "DR"}. Same as the Toolpak's 'P(T<=t) two-tail'.`);

  const widths = [3, 4, 12, 12, 24, 4, 15, 4, 15];
  const rows = b + 8;
  const sheets: SheetModel[] = [
    { name: TAB, cells, colWidths: widths, answerCells: {}, rows },
    { name: KEY_TAB, cells: keyCells, colWidths: widths, answerCells: {}, rows },
  ];
  return {
    n: k, id: l18Id(k), title: `Lesson 18 practice · set ${k}`, file: `AQM-Lesson-18-practice-set-${k}`, sheets, questions: Q, starts,
    intro: [
      "Lesson 18 practice, laid out like the Lesson 18 notes' exercises: a test on a variance (chi-squared) and the Toolpak two-sample test, plus a bonus on each.",
      "Fill the yellow cells on the Practice tab with formulas that point at the data. For Questions 3 and 4 run the Toolpak (Data › Data Analysis) and point the yellow cells at its output.",
      "Variance, H₀: σ² ≤ σ₀² (right tail): p = 1 − CHISQ.DIST(stat, n−1, TRUE), cut-off CHISQ.INV(1 − α, n−1). H₀: σ² ≥ σ₀² (left tail): p = CHISQ.DIST(stat, n−1, TRUE), cut-off CHISQ.INV(α, n−1).",
      "Decisions: R (reject H₀) when p < α, otherwise DR. The Answer key tab has every formula: try the whole set first.",
      "Then save and upload the file on the site to have it marked.",
    ],
  };
}

/** Marks an uploaded Lesson 18 set. */
export function gradeL18(wb: ReadWorkbook, k: number): WorkbookGrade {
  const S = l18Set(k);
  if (!S) throw new Error("This Lesson 18 set isn't one the site knows. Download it again from the site.");
  const cells = findTab(wb, TAB);
  const graded: QuestionGrade[] = S.questions.map((q) => {
    const parts: PartGrade[] = q.specs.map((s, i) => {
      const { cell, r } = locate(cells, q.n, s, wb, S.starts);
      const part = { ...(s as unknown as Part), id: String.fromCharCode(97 + i) };
      return { ...r, part, cell, points: 1, got: r.ok ? 1 : 0 };
    });
    const question: Question = { id: `${S.id}-q${q.n}`, seed: 0, kind: q.kind, topic: q.topic, title: q.title, prompt: q.text, parts: parts.map((p) => p.part) };
    return { q: question, index: q.n - 1, section: "Lesson 18", sheetFound: !!cells, parts, got: parts.reduce((t, p) => t + p.got, 0), total: parts.length };
  });
  const notes: string[] = [];
  if (!cells) notes.push(`The "${TAB}" tab wasn't in the file. Upload the workbook downloaded from the site.`);
  if (graded.some((g) => g.parts.some((p) => p.status === "nocache"))) notes.push("Some cells have formulas with no saved result. Open the file in Excel, let it calculate, save, and upload again.");
  return { kind: "l18", n: k, id: S.id, title: S.title, questions: graded, got: graded.reduce((s, g) => s + g.got, 0), total: graded.reduce((s, g) => s + g.total, 0), notes };
}
