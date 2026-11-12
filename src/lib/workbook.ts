// One layout for each question, shared by the in-browser mini sheet and the downloadable .xlsx,
// so a student can switch between them and find every number in the same cell.
//
//   A1  Q3. Two-tailed t-test                        (title)
//   A2  the question text                            (text)
//   A4  Given            D4  Data                    (headers)
//   A5  Mean μ   B5 11.3  D5 10.1
//   A6  …        B6 …     D6 …
//   A(k)   Answers                                   (header)
//   A(k+1) a) What is the p-value?   B(k+1) [yellow answer cell]
//   F:H    free space for working
import type { Question, QuestionKind } from "./practice.ts";
import { generate, generateCase } from "./practice.ts";

export type CellRole = "title" | "text" | "header" | "label" | "given" | "data" | "answer" | "hint";
export type Cell = { v?: number | string; role?: CellRole; pct?: boolean };
export type SheetModel = {
  name: string;                     // tab name, ≤ 31 chars, no []:*?/\
  cells: Record<string, Cell>;      // "B5" → cell
  colWidths: number[];              // A.. in Excel character units
  answerCells: Record<string, string>; // part id → "B12"
  rows: number;                     // rows used
};

export const SHEET_COLS = ["A", "B", "C", "D", "E", "F", "G", "H"];

const LABELS: Record<string, string> = {
  "μ": "Mean μ", "σ": "Standard deviation σ", "n": "Sample size n", "α": "Significance α",
  "μ₀": "Hypothesized mean μ₀", "x̄": "Sample mean x̄", "Confidence": "Confidence level",
  a: "a", b: "b", x: "x",
  "σ₀²": "Hypothesized variance σ₀²", "σ₁": "Std. dev. σ₁ (group 1)", "σ₂": "Std. dev. σ₂ (group 2)",
};

function parseGiven(v: string): { v: number | string; pct?: boolean } {
  const s = v.replace(/[,\s]/g, "").replace(/[−–]/g, "-");
  if (/^-?\d*\.?\d+%$/.test(s)) return { v: Number(s.slice(0, -1)) / 100, pct: true };
  if (/^-?\d*\.?\d+(e-?\d+)?$/i.test(s)) return { v: Number(s) };
  return { v };
}

export function questionSheet(q: Question, n: number): SheetModel {
  const cells: Record<string, Cell> = {};
  const answerCells: Record<string, string> = {};
  cells.A1 = { v: `Q${n}. ${q.title}`, role: "title" };
  cells.A2 = { v: q.prompt, role: "text" };
  cells.A4 = { v: "Given", role: "header" };
  let r = 5;
  for (const g of q.given ?? []) {
    cells[`A${r}`] = { v: LABELS[g.label] ?? g.label, role: "label" };
    const pv = parseGiven(g.value);
    cells[`B${r}`] = { v: pv.v, pct: pv.pct, role: "given" };
    r++;
  }
  if (q.data?.length) {
    cells.D4 = { v: q.dataLabels?.[0] ?? "Data", role: "header" };
    q.data.forEach((x, i) => { cells[`D${5 + i}`] = { v: x, role: "data" }; });
    if (q.data2?.length) {
      cells.E4 = { v: q.dataLabels?.[1] ?? "Data 2", role: "header" };
      q.data2.forEach((x, i) => { cells[`E${5 + i}`] = { v: x, role: "data" }; });
    }
    if (!q.given?.length) { cells.A5 = { v: `Data in D5:D${4 + q.data.length}${q.data2?.length ? ` and E5:E${4 + q.data2.length}` : ""}`, role: "hint" }; r = 6; }
  }
  r += 1;
  cells[`A${r}`] = { v: "Answers", role: "header" };
  cells[`B${r}`] = { v: "Your answer", role: "header" };
  r++;
  for (const p of q.parts) {
    cells[`A${r}`] = { v: `${p.id}) ${p.label}`, role: "label" };
    cells[`B${r}`] = { role: "answer" };
    if (p.kind === "choice") cells[`F${r}`] = { v: p.options!.includes("Reject H₀") ? "Type R (reject) or DR (do not reject)" : `Type one: ${p.options!.join("  /  ")}   (H0, mu, sigma^2, <= and >= are fine)`, role: "hint" };
    if (p.kind === "text") cells[`F${r}`] = { v: "Written answer: type a few sentences in the yellow cell (the text can run past it)", role: "hint" };
    answerCells[p.id] = `B${r}`;
    r++;
  }
  cells.F4 = { v: "Your working", role: "header" };
  const longest = Math.max(q.data?.length ?? 0, q.data2?.length ?? 0);
  const rows = Math.max(r + 2, 5 + longest + 2, 18);
  const two = !!q.data2?.length;
  return { name: `Q${n}`, cells, colWidths: [44, 16, 4, two ? 14 : 11, two ? 14 : 4, 14, 14, 14], answerCells, rows };
}

// ---------- answer key ----------
/** The last tab of every workbook: each part's answer, the formula that gets it, and why. */
export function answerKeySheet(questions: Question[], sheets: SheetModel[]): SheetModel {
  const cells: Record<string, Cell> = {};
  cells.A1 = { v: "Answer key", role: "title" };
  cells.A2 = { v: "Try every question first. Then check each yellow cell against the answer and the formula that produces it (formulas are written with the numbers filled in; yours should point at the cells).", role: "text" };
  cells.A4 = { v: "Question and part", role: "header" };
  cells.B4 = { v: "Answer", role: "header" };
  cells.C4 = { v: "Your cell", role: "header" };
  cells.D4 = { v: "How (Excel)", role: "header" };
  cells.E4 = { v: "Why", role: "header" };
  let r = 5;
  questions.forEach((q, i) => {
    cells[`A${r}`] = { v: `Q${i + 1}. ${q.title}`, role: "label" };
    r++;
    for (const p of q.parts) {
      cells[`A${r}`] = { v: `   ${p.id}) ${p.label}`, role: "text" };
      cells[`B${r}`] = p.kind === "number" ? { v: p.answer as number } : { v: p.kind === "text" ? "See the model answer →" : String(p.answer) };
      cells[`C${r}`] = { v: `${sheets[i].name}!${sheets[i].answerCells[p.id]}`, role: "hint" };
      cells[`D${r}`] = { v: p.kind === "text" ? p.answer as string : p.excel };
      cells[`E${r}`] = { v: p.kind === "text" ? `Key points: ${(p.keyPoints ?? []).join("; ")}` : p.explain, role: "hint" };
      r++;
    }
    r++;
  });
  return { name: "Answer key", cells, colWidths: [56, 18, 10, 70, 80], answerCells: {}, rows: r };
}

// ---------- problem sets ----------
// Each set is 8 mixed questions with fixed seeds, so Set 3 is the same for every student.
export const SET_COUNT = 12;
const SLOTS: ({ kind: QuestionKind } | { cases: string[] })[] = [
  { kind: "normal-less" },
  { kind: "normal-inverse" },
  { kind: "zscore" },
  { kind: "sample-mean" },
  { kind: "ci-z" },
  { kind: "ci-t" },
  { cases: ["eq-known-p", "le-known-crit", "ge-known-p", "eq-known-crit", "le-known-p", "ge-known-crit"] },
  { cases: ["ge-unknown-p", "eq-unknown-crit", "le-unknown-p", "ge-unknown-crit", "eq-unknown-p", "le-unknown-crit"] },
];
const ROTATE: QuestionKind[] = ["normal-less", "normal-more", "normal-between"];

export function setQuestions(set: number): Question[] {
  return SLOTS.map((slot, i) => {
    const seed = 100_003 * set + 7_919 * (i + 1);
    if ("cases" in slot) return generateCase(slot.cases[(set - 1) % slot.cases.length], seed);
    const kind = i === 0 ? ROTATE[(set - 1) % ROTATE.length] : slot.kind;
    return generate(kind, seed);
  });
}

export function setSheets(set: number): SheetModel[] {
  return setQuestions(set).map((q, i) => questionSheet(q, i + 1));
}

/** Matches a typed choice to an option, forgiving how symbols were typed: "H0: mu <= 50" = "H₀: μ ≤ 50", "reject" = "Reject H₀". */
export function matchChoice(typed: string, options: string[]): string | null {
  const norm = (s: string) => s.toLowerCase()
    .replace(/h₀|h0|h_0/g, "").replace(/<=|=</g, "≤").replace(/>=|=>/g, "≥").replace(/!=|<>/g, "≠")
    .replace(/sigma\s*\^\s*2|σ\^2|sigma²|sigma2|var(iance)?/g, "σ²").replace(/sigma/g, "σ")
    .replace(/(mu|µ|μ)\s*_?\s*1|μ₁/g, "μ₁").replace(/(mu|µ|μ)\s*_?\s*2|μ₂/g, "μ₂").replace(/(mu|µ)\s*_?\s*d\b|μ_?d/g, "μ_d")
    .replace(/\bmu\b|µ/g, "μ").replace(/[\s:]/g, "");
  const t = norm(typed);
  if (!t) return null;
  // Decisions: class writes R and DR.
  if (options.includes("Reject H₀")) {
    const d = t.replace(/[.'’]/g, "").replace(/h₀|h0|null/g, "");
    if (["r", "reject", "rejecth", "rejectthe"].includes(d)) return "Reject H₀";
    if (["dr", "donotreject", "dontreject", "failtoreject", "notreject", "fr"].includes(d)) return "Do not reject H₀";
  }
  return options.find((o) => norm(o) === t) ?? null;
}
