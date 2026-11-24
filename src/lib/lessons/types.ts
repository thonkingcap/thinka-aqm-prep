// What one lesson page holds. Each lesson lives in its own file (l02.ts … l21.ts) and is registered in index.ts.
import type { BlockMaker } from "./kit.ts";

/** 1 = Exam 1 material, 2 = Exam 2 material, 3 = after Exam 2 (on the final only; Get Ahead while untaught). */
export type UnitId = 1 | 2 | 3;

/** A definition or key fact from the professor's notes, in his words where possible. */
export type Def = {
  term: string;
  text: string;
  /** He highlighted it red in the notes (his "examinable" flag). */
  red?: boolean;
  /** Where it is: "Lesson 9, notes › Discrete prob B12". */
  source?: string;
};
/** One step of a worked example. `formula` is what you type in Excel; `result` what it shows. */
export type Step = { say: string; formula?: string; result?: string };
export type Example = {
  title: string;
  /** The question, as he set it (or close to it). */
  setup: string;
  /** Optional small data table shown above the steps. */
  table?: { head: string[]; rows: (string | number)[][] };
  steps: Step[];
  /** One sentence to remember. */
  takeaway?: string;
  /** Where it comes from: "Lesson 8, notes › Breakeven". */
  source?: string;
};
/** A quick-check question (in the browser, no Excel). */
export type QuizQ = { q: string; options: string[]; answer: number; why: string };

export type Lesson = {
  /** The professor's lesson number (the notes file's number); Get Ahead lessons continue at 19. */
  n: number;
  title: string;
  unit: UnitId;
  /** The syllabus line(s) it matches, e.g. "Week 4 · Wed 23 Sep · Linear models in business". */
  week: string;
  /** Not taught yet: built from the syllabus and past exams (Get Ahead). */
  beta?: boolean;
  /** Canvas files it is built from. */
  sources: string[];
  /** Two plain-English sentences: what this lesson is about and why it matters. */
  summary: string;
  defs: Def[];
  examples: Example[];
  quiz: QuizQ[];
  /** Excel functions/tools used, each with how he uses it. */
  excel: { fn: string; use: string }[];
  /** Exam tips: how this has shown up on past exams, common slips. */
  watch: string[];
  /** Practice generators (each is one tab of the lesson's workbook). */
  makers: BlockMaker[];
};
