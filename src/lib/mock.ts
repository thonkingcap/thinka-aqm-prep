// Mock exams: exam-length workbooks laid out like the class's Exam 2 practice files
// (sections with point values, one tab per question, answer cells to fill), built from the
// verified practice generator. Each mock has fixed seeds, so Mock 2 is the same for everyone
// and an uploaded workbook can be regraded from its id alone.
import type { Question, QuestionKind } from "./practice.ts";
import { generate, generateCase } from "./practice.ts";
import { questionSheet, type SheetModel } from "./workbook.ts";

export const MOCK_COUNT = 6;
export const MOCK_MINUTES = 75;
export const POINTS_PER_PART = 2;

type Slot = { section: string; kind?: QuestionKind; cases?: string[] };
const SLOTS: Slot[] = [
  { section: "Normal distribution", kind: "normal-between" },
  { section: "Normal distribution", kind: "normal-inverse" },
  { section: "Normal distribution", kind: "zscore" },
  { section: "Normal distribution", kind: "normal-more" },
  { section: "Sampling distribution", kind: "sample-mean" },
  { section: "Confidence intervals", kind: "ci-z" },
  { section: "Confidence intervals", kind: "ci-t" },
  { section: "Hypothesis test, σ unknown", cases: ["le-unknown-crit", "ge-unknown-p", "eq-unknown-p", "ge-unknown-crit", "le-unknown-p", "eq-unknown-crit"] },
  { section: "Hypothesis test, σ known", cases: ["eq-known-p", "ge-known-crit", "le-known-p", "eq-known-crit", "ge-known-p", "le-known-crit"] },
];

export type MockExam = {
  n: number;
  id: string;
  title: string;
  questions: Question[];
  sections: string[];       // section of each question, same order
  sheets: SheetModel[];
  totalPoints: number;
};

export function mockExam(n: number): MockExam {
  const questions = SLOTS.map((s, i) => {
    const seed = 900_001 * n + 3_571 * (i + 1);
    return s.cases ? generateCase(s.cases[(n - 1) % s.cases.length], seed) : generate(s.kind!, seed);
  });
  const sections = SLOTS.map((s) => s.section);
  const sheets = questions.map((q, i) => {
    const m = questionSheet(q, i + 1);
    const pts = q.parts.length * POINTS_PER_PART;
    m.cells.A1 = { v: `Q${i + 1}. ${sections[i]} · ${pts} points · ${q.title}`, role: "title" };
    return m;
  });
  const totalPoints = questions.reduce((s, q) => s + q.parts.length * POINTS_PER_PART, 0);
  return { n, id: `mock:${n}`, title: `Midterm 2 mock exam ${n}`, questions, sections, sheets, totalPoints };
}

export function mockIntro(m: MockExam): string[] {
  const bySection = new Map<string, number>();
  m.questions.forEach((q, i) => bySection.set(m.sections[i], (bySection.get(m.sections[i]) ?? 0) + q.parts.length * POINTS_PER_PART));
  return [
    `${m.totalPoints} points · suggested time ${MOCK_MINUTES} minutes · Excel only, like the real exam.`,
    "Each tab is one question. The numbers are already in their cells: work with formulas that point at them.",
    "Put each answer in its yellow cell as a formula (best) or the full, unrounded value. Like class, the underlying value is graded: a hand-typed 0.92 for 0.9167 is wrong.",
    "For the multiple-choice parts, type one of the options shown next to the cell.",
    "When you're done, save the file and upload it on the Mock exams page to get your score.",
    ...[...bySection.entries()].map(([s, p]) => `  ${s}: ${p} points`),
  ];
}
