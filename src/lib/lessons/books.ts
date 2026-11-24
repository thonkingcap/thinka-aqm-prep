// The workbooks on the Lessons, Units, Final and Get Ahead pages, by id, and how an upload is marked.
//
//   les:<n>:<v>    Lesson n practice, version v (every practice tab of the lesson, new numbers per version)
//   unit:<u>:<v>   Unit review paper u, version v: one tab per lesson in the unit, laid out like an exam
//   final:<v>      Final review paper v: tabs across the whole course
//
// Blocks are rebuilt from the id (seeded), so nothing is stored: the same id always gives the same numbers.
import type { ReadWorkbook } from "../xlsxRead.ts";
import type { Question, QuestionKind, TopicId } from "../practice.ts";
import { gradeCell, type PartGrade, type QuestionGrade, type WorkbookGrade } from "../grade.ts";
import { makeBlocks, tabName, toGradePart, bookSheets, type BlockMaker, type LessonBook } from "./kit.ts";
import { LESSONS, lessonByN } from "./index.ts";
import type { Lesson, UnitId } from "./types.ts";

export const VERSIONS = 3;
export const lessonBookId = (n: number, v: number) => `les:${n}:${v}`;
export const unitBookId = (u: UnitId, v: number) => `unit:${u}:${v}`;
export const finalBookId = (v: number) => `final:${v}`;
export const isLessonBookId = (id: string | null | undefined) => /^(les:\d+:\d+|unit:[123]:\d+|final:\d+)$/.test((id ?? "").trim());

export const UNIT_INFO: Record<UnitId, { title: string; exam: string; blurb: string }> = {
  1: { title: "Unit 1", exam: "Exam 1 (Wed 14 Oct)", blurb: "Spreadsheets, charts, descriptive measures, histograms, linear models, probability, random variables, simulation and the normal distribution." },
  2: { title: "Unit 2", exam: "Exam 2 (Wed 18 Nov)", blurb: "The Central Limit Theorem, confidence intervals, hypothesis tests (one- and two-tailed), the chi-squared variance test, and two-sample and paired tests." },
  3: { title: "Get Ahead", exam: "the final only", blurb: "Regression, residual analysis and multiple regression: taught after Exam 2, built ahead of time from the syllabus and past finals." },
};

/**
 * Tabs that stay in their lesson's own practice but aren't picked for unit/final papers: too long to share a
 * paper (the inventory table is 41 marked cells, which would swamp the score) or not exam-style (row-by-row
 * simulation summaries).
 */
const NOT_ON_PAPERS = new Set(["l11.inventory", "l17.varsim"]);
/** Which of a lesson's makers a paper uses for version v. */
function rotate(L: Lesson, v: number, k = 0): BlockMaker {
  const pool = L.makers.filter((m) => !NOT_ON_PAPERS.has(m.key));
  const ms = pool.length ? pool : L.makers;
  return ms[(v - 1 + k) % ms.length];
}
/** A paper: one tab per group of lessons (an exam area), cycling through each group's lessons and tabs by version. */
function grouped(groups: number[][], v: number): BlockMaker[] {
  const out: BlockMaker[] = [];
  groups.forEach((group, gi) => {
    const avail = group.map((n) => lessonByN(n)).filter((L): L is Lesson => !!L && L.makers.length > 0);
    if (!avail.length) return;
    const L = avail[(v - 1 + gi) % avail.length];
    const m = rotate(L, v, gi);
    if (!out.includes(m)) out.push(m);
  });
  return out;
}
/**
 * Unit papers, laid out by the areas each midterm examined (Fall 2026 Exam 1: charts and spreadsheets, descriptive
 * measures, linear models, random variables and simulation, probability and the normal; Exam 2 / last spring's
 * Exam 3: intervals, tests with σ known and unknown, variance and two-sample tests). Lessons not written yet are skipped.
 */
const UNIT_GROUPS: Record<UnitId, number[][]> = {
  1: [[2, 3], [4, 6, 7], [8], [9, 11], [10, 11]],
  2: [[12, 13, 14, 15], [16, 17], [17, 16], [18]],
  3: [[19], [20], [21]],
};
function unitMakers(u: UnitId, v: number): BlockMaker[] {
  return grouped(UNIT_GROUPS[u], v);
}
/** The final: like last spring's 2-hour final, a tab from each big area of the course. */
const FINAL_LESSONS: number[][] = [
  [3, 4, 6, 7],   // visualisation and descriptive measures
  [8],            // linear models: breakeven, supply and demand
  [9, 10],        // random variables, probability
  [11],           // simulation and the normal distribution
  [12, 13, 14, 15], // CLT and confidence intervals
  [16, 17],       // one-sample tests
  [18],           // variance test, two-sample and paired
  [19, 20, 21],   // regression (BETA until taught)
];
function finalMakers(v: number): BlockMaker[] {
  return grouped(FINAL_LESSONS, v);
}

const cache = new Map<string, LessonBook | null>();
export function bookById(id: string): LessonBook | null {
  if (cache.has(id)) return cache.get(id)!;
  const b = build(id);
  cache.set(id, b);
  return b;
}
function build(id: string): LessonBook | null {
  let m = /^les:(\d+):(\d+)$/.exec(id);
  if (m) {
    const L = lessonByN(Number(m[1])), v = Number(m[2]);
    if (!L || !(v >= 1 && v <= VERSIONS) || !L.makers.length) return null;
    return {
      id, title: `Lesson ${L.n}: ${L.title} · practice ${v}`, file: `AQM-Lesson-${L.n}-practice-${v}`, beta: L.beta,
      intro: [
        `Lesson ${L.n} practice${L.beta ? " (BETA: built ahead of the class from the syllabus and past finals)" : ""}. Each tab is one question.`,
        "Fill the yellow cells with formulas that point at the numbers on the tab, the way the professor wants it: don't round, don't type numbers you worked out elsewhere.",
        "Things the site can't mark (charts, Toolpak output) are listed under each question as 'Also practise'.",
        "Save the file and upload it on the site to see what went right and what slipped. The answer key is a separate download: try the whole set first.",
      ],
      blocks: makeBlocks(id, L.makers),
    };
  }
  m = /^unit:([123]):(\d+)$/.exec(id);
  if (m) {
    const u = Number(m[1]) as UnitId, v = Number(m[2]);
    const makers = unitMakers(u, v);
    if (!(v >= 1 && v <= VERSIONS) || !makers.length) return null;
    const U = UNIT_INFO[u];
    return {
      id, title: `${U.title} review paper ${v}`, file: `AQM-${U.title.replace(/\s+/g, "-")}-review-${v}`, beta: u === 3,
      intro: [
        `${U.title} review paper ${v}: a question from each area of ${u === 3 ? "the Get Ahead material (BETA)" : `the unit, the material on ${U.exam}`}.`,
        "Treat it like the exam: one hour, Excel only, formulas in the yellow cells, no rounding.",
        "Save it and upload it on the site to have it marked. The answer key is a separate download.",
      ],
      blocks: makeBlocks(id, makers),
    };
  }
  m = /^final:(\d+)$/.exec(id);
  if (m) {
    const v = Number(m[1]);
    const makers = finalMakers(v);
    if (!(v >= 1 && v <= VERSIONS) || !makers.length) return null;
    return {
      id, title: `Final review paper ${v}`, file: `AQM-Final-review-${v}`,
      intro: [
        `Final review paper ${v}: a question from each big area of the course, like last spring's two-hour final.`,
        "The regression tab is BETA until it's taught (built from the syllabus and last spring's final).",
        "Excel only, formulas in the yellow cells, no rounding. Save it and upload it on the site to have it marked.",
      ],
      blocks: makeBlocks(id, makers),
    };
  }
  return null;
}

/** Which lesson a maker belongs to (its key starts "l<n>."). */
export const lessonOfMaker = (key: string) => Number(/^l(\d+)\./.exec(key)?.[1] ?? 0);

/** Report topics for lesson workbooks: "lesson:<n>". */
export function lessonTopicInfo(topic: string): { name: string; learn: string; practise: string } | null {
  const n = Number(/^lesson:(\d+)$/.exec(topic)?.[1] ?? NaN);
  const L = lessonByN(n);
  return L ? { name: `Lesson ${L.n}: ${L.title}`, learn: `#/lesson/${L.n}`, practise: `#/lesson/${L.n}/practice` } : null;
}

export function gradeBook(wb: ReadWorkbook): WorkbookGrade {
  const id = (wb.thinkaId ?? "").trim();
  const book = bookById(id);
  if (!book) throw new Error("This workbook isn't one the site knows. Download it again from the site.");
  const notes: string[] = [];
  const questions: QuestionGrade[] = book.blocks.map((b, i) => {
    const name = tabName(i, b);
    const sheetName = wb.sheets[name] ? name : wb.sheetOrder.find((s) => s.startsWith(`Q${i + 1} `));
    const cells = sheetName ? wb.sheets[sheetName] : undefined;
    const parts: PartGrade[] = b.parts.map((p, k) => {
      const part = toGradePart(p, String.fromCharCode(97 + k));
      let r = gradeCell(cells?.[p.cell], part);
      // Accepted alternatives (e.g. QUARTILE.EXC as well as .INC): right if the cell matches any of them.
      for (const alt of p.alts ?? []) {
        if (r.ok || r.status === "blank" || r.status === "nocache") break;
        const ra = gradeCell(cells?.[p.cell], { ...part, answer: alt, traps: undefined });
        if (ra.ok) r = { ...ra, answer: r.answer };
      }
      return { ...r, part, cell: p.cell, points: 1, got: r.ok ? 1 : 0 };
    });
    const lessonN = sectionLesson(book, i);
    const q: Question = {
      id: `${id}-q${i + 1}`, seed: 0, kind: "concept" as QuestionKind,
      // One lesson's workbook: report by question; a unit or final paper: report by lesson.
      topic: (lessonN ? (id.startsWith("les:") ? `lesson:${lessonN}:${b.title}` : `lesson:${lessonN}`) : "concept") as TopicId,
      title: b.title, prompt: b.text.join(" "), parts: parts.map((p) => p.part),
    };
    return { q, index: i, section: lessonN ? `Lesson ${lessonN}` : undefined, sheetFound: !!cells, parts, got: parts.reduce((s, p) => s + p.got, 0), total: parts.length };
  });
  const missing = questions.filter((q) => !q.sheetFound).map((q) => tabName(q.index, book.blocks[q.index]));
  if (missing.length) notes.push(`These tabs weren't in the file: ${missing.join(", ")}. Don't rename or delete the question tabs.`);
  if (questions.some((q) => q.parts.some((p) => p.status === "nocache"))) notes.push("Some answer cells have formulas with no saved result. Open the file in Excel, let it calculate, save, and upload again.");
  const rounded = questions.reduce((s, q) => s + q.parts.filter((p) => p.roundedTo !== undefined).length, 0);
  if (rounded) notes.push(`${rounded} answer${rounded === 1 ? " was" : "s were"} right but rounded, so marked wrong, as in class. Leave the formula (or the full value) in the yellow cell.`);
  return {
    kind: "lesson", n: 0, id, title: book.title, questions,
    got: questions.reduce((s, q) => s + q.got, 0), total: questions.reduce((s, q) => s + q.total, 0), notes,
  };
}

/** The lesson each tab of a book came from (for the report's "what to work on"). */
const sourceCache = new Map<string, number[]>();
function sectionLesson(book: LessonBook, i: number): number {
  if (!sourceCache.has(book.id)) sourceCache.set(book.id, makersFor(book.id).map((m) => lessonOfMaker(m.key)));
  return sourceCache.get(book.id)![i] ?? 0;
}
export function makersFor(id: string): BlockMaker[] {
  let m = /^les:(\d+):(\d+)$/.exec(id);
  if (m) return lessonByN(Number(m[1]))?.makers ?? [];
  m = /^unit:([123]):(\d+)$/.exec(id);
  if (m) return unitMakers(Number(m[1]) as UnitId, Number(m[2]));
  m = /^final:(\d+)$/.exec(id);
  if (m) return finalMakers(Number(m[1]));
  return [];
}

export function bookFiles(id: string) {
  const b = bookById(id);
  if (!b) return null;
  return { book: b, sheets: bookSheets(b, false), key: bookSheets(b, true) };
}

/** Every book id that exists right now (for tests and the admin view). */
export function allBookIds(): string[] {
  const ids: string[] = [];
  for (const L of LESSONS) for (let v = 1; v <= VERSIONS; v++) if (L.makers.length) ids.push(lessonBookId(L.n, v));
  for (const u of [1, 2, 3] as UnitId[]) for (let v = 1; v <= VERSIONS; v++) if (unitMakers(u, v).length) ids.push(unitBookId(u, v));
  for (let v = 1; v <= VERSIONS; v++) if (finalMakers(v).length) ids.push(finalBookId(v));
  return ids;
}
