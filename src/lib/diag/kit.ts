// Diagnostics in the professor's exam format: a Word question paper and an Excel workbook with an
// Instructions tab and one tab per section, question numbers in column B, tables headed "Table k",
// blue answer cells (need a formula) and pink answer cells (just the answer), like his exams.
//
// A paper is written once as data (sections → items for the Word paper, cells for the workbook, and
// questions with their answer cells). The answer key, the Word paper and the marking are all built from it.
//
// Simulation questions are realistic: students run the random number generator themselves, and a part
// marked `live` is checked against THEIR numbers (its key formula is evaluated on the uploaded sheet),
// with `band` checking their simulated numbers look like the right distribution.
import type { Cell, SheetModel } from "../workbook.ts";
import type { Part } from "../lessons/kit.ts";

export { DECISIONS, decide } from "../lessons/kit.ts";
export type { Cell };

export type DPart = Part & {
  /** Blue: an Excel formula is required. Pink: just the answer (a number, R/DR, I/D, a word). */
  tone: "blue" | "pink";
  /** The answer depends on the student's own simulated numbers: mark it by evaluating `formula` on their sheet. */
  live?: boolean;
  /** For live parts: the range their value must fall in for the simulation to look right (e.g. a sample mean of 1000 draws). */
  band?: [number, number];
  /** For live parts: a formula that must be TRUE on the student's sheet before the part can be marked
   *  (e.g. their 97 random numbers are in), so filled-down formulas on an empty column score nothing. */
  liveCheck?: string;
  /** Only counts if the part in this cell (same question) is right too, e.g. Min/Max only when the simulated Mean looks right. */
  requires?: string;
  /** For live parts: other formulas that also count, evaluated on the student's numbers (e.g. QUARTILE.INC beside .EXC). */
  altFormulas?: string[];
};
export type DItem =
  | { kind: "lead"; text: string }
  | { kind: "q"; n: number; text: string; points: number };
export type DQuestion = {
  n: number;
  points: number;
  /** The lesson it tests (the report sends weak questions there). */
  lesson: number;
  title: string;
  parts: DPart[];
  /** Questions the site can't mark (charts, Toolpak histograms): how to check your own. Their points are left out of the site's score. */
  unmarked?: string;
};
export type DSection = {
  /** Tab name, as on his exams ("Linear models"). */
  tab: string;
  /** Section heading on the Word paper (without the number). */
  title: string;
  items: DItem[];
  /** The tab's tables, labels and question numbers. Answer cells come from the questions. */
  cells: Record<string, Cell>;
  questions: DQuestion[];
  /** Example simulated numbers, written into the answer key only (so its live formulas show values). */
  example?: Record<string, Cell>;
  widths?: Record<number, number>;
  merges?: string[];
};
export type DPaper = {
  id: string;
  title: string;
  /** First line of the Word paper, like "AQM1000, Fall 2026, Exam 1, the 14th of October". */
  header: string;
  file: string;
  minutes: number;
  beta?: boolean;
  /** Instructions as on his paper (bullet lines). */
  instructions: string[];
  sections: DSection[];
};

// ---------- layout helpers (the professor's look) ----------
export const qn = (c: Record<string, Cell>, n: number, row: number) => { c[`B${row}`] = { v: n, role: "title" }; };
export const table = (c: Record<string, Cell>, addr: string, label: string, align: "left" | "center" = "left") => { c[addr] = { v: label, role: "header", align }; };
export const label = (c: Record<string, Cell>, addr: string, text: string) => { c[addr] = { v: text, role: "label" }; };
export const text = (c: Record<string, Cell>, addr: string, t: string) => { c[addr] = { v: t, role: "text" }; };
export const hint = (c: Record<string, Cell>, addr: string, t: string) => { c[addr] = { v: t, role: "hint" }; };
export const data = (c: Record<string, Cell>, addr: string, v: number | string, align?: "left") => { c[addr] = { v, role: "data", ...(align ? { align } : {}) }; };
/** A column of data from (col, row) down. */
export const col = (c: Record<string, Cell>, letter: string, row: number, xs: (number | string)[], align?: "left") =>
  xs.forEach((v, i) => { c[`${letter}${row + i}`] = { v, role: "data", ...(align ? { align } : {}) }; });

export const sectionPoints = (s: DSection) => s.questions.reduce((t, q) => t + q.points, 0);
export const paperPoints = (p: DPaper) => p.sections.reduce((t, s) => t + sectionPoints(s), 0);

// ---------- sheets ----------
const W = 8.83;
function instructionsSheet(p: DPaper): SheetModel {
  const cells: Record<string, Cell> = {
    B2: { v: p.header, role: "title" },
    B4: { v: "Instructions", role: "title" },
    K5: { v: "First name", role: "label" }, L5: { role: "answer", tone: "purple" },
    K6: { v: "Last name", role: "label" }, L6: { role: "answer", tone: "purple" },
  };
  let r = 5;
  for (const line of p.instructions) cells[`B${r++}`] = { v: `• ${line}`, role: "text" };
  r += 1;
  cells[`B${r++}`] = { v: "AQM Prep: save the finished file and upload it on the site to have it marked. The answer key is a separate download.", role: "hint" };
  return { name: "Instructions", cells, colWidths: Array.from({ length: 13 }, (_, i) => (i === 1 ? 8.66 : W)), answerCells: {}, rows: r };
}
function maxRow(cells: Record<string, Cell>) {
  return Object.keys(cells).reduce((m, a) => Math.max(m, Number(/\d+$/.exec(a)?.[0] ?? 0)), 0);
}
function sectionSheet(s: DSection, key: boolean): SheetModel {
  const cells: Record<string, Cell> = { ...s.cells, ...(key ? s.example ?? {} : {}) };
  for (const q of s.questions) for (const p of q.parts) {
    const tone = p.tone === "blue" ? "blue" : "purple";
    if (!key) { cells[p.cell] = { role: "answer", tone }; continue; }
    const lit = /^"(.*)"$/.exec(p.formula.trim());
    cells[p.cell] = lit ? { role: "answer", tone, v: lit[1] } : { role: "answer", tone, f: p.formula };
  }
  let rows = maxRow(cells);
  if (key && s.questions.length) {
    rows += 2;
    cells[`B${rows}`] = { v: "ANSWER KEY: why each answer", role: "title" };
    for (const q of s.questions) {
      if (q.unmarked) cells[`B${++rows}`] = { v: `Q${q.n} (not marked by the site): ${q.unmarked}`, role: "hint" };
      for (const p of q.parts) cells[`B${++rows}`] = { v: `Q${q.n} ${p.cell}, ${p.label}: ${p.explain}`, role: "hint" };
    }
    if (s.example) cells[`B${++rows}`] = { v: "The simulated numbers on this key are one example run: yours will differ, and the site marks your answers against your own numbers.", role: "hint" };
  }
  const widest = Object.keys(cells).reduce((m, a) => Math.max(m, (/^[A-Z]+/.exec(a)?.[0] ?? "A").split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)), 0);
  return { name: s.tab, cells, colWidths: Array.from({ length: Math.max(widest, 12) }, (_, i) => s.widths?.[i] ?? (i === 1 ? 8.66 : W)), answerCells: {}, rows, ...(s.merges ? { merges: s.merges } : {}) };
}
/** The blank workbook (key = false) or the answer key with live formulas (key = true). */
export function paperSheets(p: DPaper, key = false): SheetModel[] {
  return [instructionsSheet(p), ...p.sections.map((s) => sectionSheet(s, key))];
}

/** The shape docx.ts's buildPaperDocx reads (header + numbered sections of leads and questions). */
export function wordPaper(p: DPaper) {
  return {
    header: p.header,
    sections: p.sections.map((s) => ({ title: s.title, points: sectionPoints(s), items: s.items })),
  };
}
