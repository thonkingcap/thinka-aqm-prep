// The lesson-workbook kit. Every practice workbook on the Lessons, Units, Final and Get Ahead pages is
// a list of BLOCKS. A block is one question tab: its data, its labels and its answer cells, each answer
// with a live Excel formula (the answer key) and the number that formula must give.
//
// A block is made by a BlockMaker from a seeded random generator, so the same workbook id always
// rebuilds the same numbers: that is how an uploaded file is marked with nothing stored.
//
// Layout rules every block follows (lessons.test.ts enforces them):
//   • row 1: the tab's title (written by the kit), rows 2–6: the question text (≤ 5 paragraphs, by the kit)
//   • the block's own cells start at row 8 or below, in any column from B
//   • every answer cell has a formula that refers to the tab's own cells and gives `answer`
//   • no RAND/RANDBETWEEN in a marked cell: give the "simulated" numbers in the sheet instead
import type { Cell, CellRole, SheetModel } from "../workbook.ts";
import type { Part as GradePart, Trap } from "../practice.ts";
import { DECISIONS } from "../practice.ts";

export { DECISIONS };
export type { Cell, Trap };

// ---------- random numbers ----------
export type Rng = () => number;
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A stable 32-bit hash of a string (FNV-1a). */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
export const rngFor = (key: string) => mulberry32(hash(key));
/** Standard normal draw. */
export const gauss = (rng: Rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
/** Integer in [lo, hi]. */
export const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
export const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
export function shuffle<T>(rng: Rng, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** Round to d decimals (for generated data, so the sheet shows tidy numbers). */
export const round = (x: number, d = 2) => Number((Math.round(x * 10 ** d) / 10 ** d).toFixed(d));
/** Normal sample, rounded. */
export const normals = (rng: Rng, n: number, mu: number, sd: number, d = 2) => Array.from({ length: n }, () => round(mu + sd * gauss(rng), d));

// ---------- addresses ----------
export const COLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const col = (i: number) => (i < 26 ? COLS[i] : COLS[Math.floor(i / 26) - 1] + COLS[i % 26]);
export const colNum = (letters: string) => letters.toUpperCase().split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
/** "C" + 5 → "C5". */
export const at = (c: string, r: number) => `${c}${r}`;
/** "C", 5, 14 → "C5:C14". */
export const span = (c: string, r1: number, r2: number) => `${c}${r1}:${c}${r2}`;
export const abs = (a: string) => a.replace(/^([A-Z]+)(\d+)$/, "$$$1$$$2");

/** Where a table landed: its header row, first/last data rows, and each column's letter and range. */
export type Placed = { top: number; first: number; last: number; cols: Record<string, { c: string; range: string }>; next: number };

/** The first row a block may use (rows 1–7 are the kit's title and question text). */
export const TOP = 8;

// ---------- blocks ----------
export type Part = {
  /** What the cell asks for, shown in the label cell and in the marking report. */
  label: string;
  /** The answer cell on this tab, e.g. "H9". */
  cell: string;
  /** The number the key formula gives, or for a choice the option it gives. */
  answer: number | string;
  /** The answer key's live formula ("=COUNTIF(C9:C58,\"Pet\")"), or for a choice part an =IF(...) or a quoted literal ("\"Yes\""). */
  formula: string;
  /** One or two sentences: why this formula, in the professor's terms. */
  explain: string;
  /** Choice parts: the accepted answers (DECISIONS for R/DR). */
  options?: string[];
  /** Absolute tolerance. Default: 0.001 for probabilities, otherwise max(0.01, 0.2% of the answer); 0 for counts. */
  tol?: number;
  format?: "num" | "prob";
  /** Likely wrong numbers and the slip each one means. */
  traps?: Trap[];
  /** Other numbers that also count as right, e.g. the QUARTILE.EXC value when the key uses QUARTILE.INC (he uses both). */
  alts?: number[];
};
export type Block = {
  /** Tab title, ≤ 26 characters, no []:*?/\ (the kit adds "Q1 "). */
  tab: string;
  /** Title in row 1 of the tab. */
  title: string;
  /** The question, 1–5 short paragraphs (rows 2–6). */
  text: string[];
  /** Labels, data and givens, at row 8 or below. Don't put anything in answer cells. */
  cells: Record<string, Cell>;
  parts: Part[];
  /** Things to do in Excel that the site can't mark (charts, Toolpak histograms, RNG practice), each with how to self-check. */
  manual?: string[];
  colWidths?: number[];
};
export type BlockMaker = {
  /** Stable id, "<lesson>.<name>", e.g. "l8.breakeven". Never rename: it seeds the numbers. */
  key: string;
  /** What it practises, shown in lists. */
  title: string;
  make: (rng: Rng) => Block;
};

/** A small builder so blocks read like the professor's sheets: label in one column, answer cell beside it. */
export class Sheet {
  cells: Record<string, Cell> = {};
  parts: Part[] = [];
  set(addr: string, v: number | string, role: CellRole = "text", extra: Partial<Cell> = {}) { this.cells[addr] = { v, role, ...extra }; return this; }
  text(addr: string, v: string) { return this.set(addr, v, "text"); }
  header(addr: string, v: string) { return this.set(addr, v, "header"); }
  label(addr: string, v: string) { return this.set(addr, v, "label"); }
  given(addr: string, v: number | string, pct = false) { return this.set(addr, v, "given", pct ? { pct } : {}); }
  hint(addr: string, v: string) { return this.set(addr, v, "hint"); }
  /**
   * A table: headers across from (c, top), then the rows below. Numbers are "data", text "data" too.
   * Returns each column's letter and data range, keyed by header.
   */
  table(c: string, top: number, headers: string[], rows: (number | string)[][]): Placed {
    const c0 = colNum(c);
    const out: Placed = { top, first: top + 1, last: top + rows.length, cols: {}, next: top + rows.length + 2 };
    headers.forEach((h, j) => {
      const L = col(c0 + j);
      this.header(at(L, top), h);
      out.cols[h] = { c: L, range: span(L, top + 1, top + rows.length) };
    });
    rows.forEach((r, i) => r.forEach((v, j) => { this.cells[at(col(c0 + j), top + 1 + i)] = { v, role: "data" }; }));
    return out;
  }
  /** A labelled answer: label in `labelAt`, the yellow cell at part.cell. */
  ask(labelAt: string, p: Part) { this.label(labelAt, p.label); this.parts.push(p); return this; }
}

// ---------- tolerance and part conversion ----------
export function tolFor(p: Part): number {
  if (p.tol !== undefined) return p.tol;
  const a = Number(p.answer);
  if (p.format === "prob") return Math.max(0.0005, Math.min(0.002, 0.02 * Math.abs(a)));
  return Math.max(0.01, 0.002 * Math.abs(a));
}
export function toGradePart(p: Part, id: string): GradePart {
  return {
    id, label: p.label, kind: p.options ? "choice" : "number", answer: p.answer, options: p.options,
    tol: p.options ? undefined : tolFor(p), format: p.format, traps: p.traps, excel: p.formula, explain: p.explain,
  };
}

// ---------- sheets ----------
const BAD = /[[\]:*?/\\]/g;
export function tabName(i: number, b: Block) {
  return `Q${i + 1} ${b.tab.replace(BAD, " ")}`.slice(0, 31).trim();
}
function maxRow(cells: Record<string, Cell>) {
  return Object.keys(cells).reduce((m, a) => Math.max(m, Number(/\d+$/.exec(a)?.[0] ?? 0)), 0);
}
function maxCol(cells: Record<string, Cell>) {
  return Object.keys(cells).reduce((m, a) => Math.max(m, colNum(/^[A-Z]+/.exec(a)?.[0] ?? "A")), 0);
}

/** The question tab (key = false) or its answer-key twin with live formulas (key = true). */
export function blockSheet(b: Block, i: number, key: boolean): SheetModel {
  const cells: Record<string, Cell> = { ...b.cells };
  cells.B1 = { v: `${i + 1}. ${b.title}${key ? " · ANSWER KEY" : ""}`, role: "title" };
  b.text.forEach((t, k) => { cells[`B${2 + k}`] = { v: t, role: "text" }; });
  for (const p of b.parts) {
    if (!key) cells[p.cell] = { role: "answer" };
    else {
      const lit = /^"(.*)"$/.exec(p.formula.trim());
      cells[p.cell] = lit ? { role: "answer", v: lit[1] } : { role: "answer", f: p.formula };
    }
  }
  let rows = maxRow(cells);
  if (b.manual?.length) {
    rows += 2;
    cells[`B${rows}`] = { v: "Also practise (not marked by the site):", role: "header" };
    for (const m of b.manual) cells[`B${++rows}`] = { v: `• ${m}`, role: "hint" };
  }
  if (key) {
    const notes = b.parts.map((p) => `${p.cell}: ${p.label}: ${p.explain}`);
    rows += 2;
    cells[`B${rows}`] = { v: "Why each answer", role: "header" };
    for (const n of notes) cells[`B${++rows}`] = { v: n, role: "hint" };
  }
  const width = Math.max(maxCol(cells) + 1, 8);
  const colWidths = b.colWidths ?? Array.from({ length: width }, (_, k) => (k === 0 ? 3 : 14));
  return { name: tabName(i, b), cells, colWidths, answerCells: {}, rows };
}

// ---------- workbook definitions ----------
export type LessonBook = {
  id: string;
  title: string;
  /** File name without .xlsx. */
  file: string;
  intro: string[];
  blocks: Block[];
  /** Shown as "BETA" (Get Ahead material not yet taught). */
  beta?: boolean;
};
export function bookSheets(book: LessonBook, key = false): SheetModel[] {
  return book.blocks.map((b, i) => blockSheet(b, i, key));
}
/** Every block of a book, made from its makers with seeds tied to the book id. */
export function makeBlocks(bookId: string, makers: BlockMaker[]): Block[] {
  return makers.map((m, i) => m.make(rngFor(`${bookId}|${i}|${m.key}`)));
}
/** The decision options as written in class. */
export const decide = (reject: boolean) => (reject ? DECISIONS[0] : DECISIONS[1]);
/** =IF(p<alpha,"R","DR") for a decision part. */
export const decisionFormula = (pCell: string, alphaCell: string) => `=IF(${pCell}<${alphaCell},"R","DR")`;
