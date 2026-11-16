// The four areas of the exam, in the order of last spring's Exam 3. The whole site is organised by
// these: each area has its notes (Learn topics), its Excel practice sets and its Exam 3 questions.
import type { QuestionKind } from "./practice.ts";

export type AreaId = "ci" | "ht1" | "ht2" | "two";
export type Area = {
  id: AreaId;
  n: number;
  title: string;
  /** Short label for the nav. */
  short: string;
  blurb: string;
  /** Topic ids in course.ts, in reading order. */
  learn: string[];
  /** Exam 3 question numbers in this area. */
  exam3: number[];
  /** Question kinds practised here (for "practise this" links and custom sets). */
  kinds: QuestionKind[];
  /** Extra videos for anyone still confused (YouTube ids). */
  videos?: { id: string; title: string; by: string }[];
};

const V_HT = { id: "zJ8e_wAWUzE", title: "Hypothesis testing problems: Z and T statistics, one- and two-tailed tests", by: "The Organic Chemistry Tutor" };
const V_CI = { id: "DT-fPG0Hff8", title: "How to find the Z score, confidence interval and margin of error for a population mean", by: "The Organic Chemistry Tutor" };

export const AREAS: Area[] = [
  {
    id: "ci", n: 1, title: "Confidence intervals", short: "Intervals",
    blurb: "Where a sample mean will land, and where the true mean probably is: Z when σ is known, T when it isn't.",
    learn: ["normal", "clt", "ci-z", "t"], exam3: [1, 2, 3, 4, 5],
    kinds: ["normal-less", "normal-more", "normal-between", "normal-inverse", "zscore", "sample-mean", "xbar-range", "ci-z", "ci-t"],
    videos: [V_CI],
  },
  {
    id: "ht1", n: 2, title: "Hypothesis testing I", short: "Testing I",
    blurb: "Tests for a mean when σ is known: H₀ from the wording, the Z statistic, critical value, p-value, then R or DR.",
    learn: ["ht-logic", "twelve"], exam3: [6, 7],
    kinds: ["ht-full"],
    videos: [V_HT],
  },
  {
    id: "ht2", n: 3, title: "Hypothesis testing II", short: "Testing II",
    blurb: "When σ is unknown: T tests, 0/1 coin-flip data, why Z and T can disagree, and testing a variance with χ².",
    learn: ["t", "sigma-n", "variance"], exam3: [8, 9, 10, 11, 12],
    kinds: ["ht-full", "bernoulli", "var-test"],
    videos: [V_HT],
  },
  {
    id: "two", n: 4, title: "Two-sample tests", short: "Two-sample",
    blurb: "Paired before/after data as one sample of differences, and two independent groups with the pooled t-test or Toolpak z-test.",
    learn: ["paired", "two-sample"], exam3: [13, 14],
    kinds: ["paired", "two-t", "two-z"],
  },
];
export const areaById = (id: string) => AREAS.find((a) => a.id === id);
export const AREA_VERSIONS = 4;
