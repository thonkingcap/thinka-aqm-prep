// Last spring's Exam 3 (AQM1000, 22 April 2026), which the professor gave out as a sample exam. It is
// the site's diagnostic: students finish it in Excel, upload it, and get it marked here. The
// professor doesn't release a key, so every answer below is worked out from the exam's own data with
// the site's verified stats engine, using the class's Excel convention.
//
// The professor's workbook has four tabs. Sections 2–4 have labelled answer cells (n, alpha, test
// statistic, critical value, p value, Decision); section 1 is free-form, so its intervals are found by
// value anywhere in that question's rows. Question numbers sit in column B.
import type { ReadWorkbook, CellVal } from "./xlsxRead.ts";
import type { Part, Question, QuestionKind, TopicId } from "./practice.ts";
import type { SheetModel, Cell } from "./workbook.ts";
import { mean, stdevS, normInv, normCdf, tInv, tCdf } from "./stats.ts";
import { gradeCell, type PartGrade, type QuestionGrade, type WorkbookGrade } from "./grade.ts";
import { DECISIONS } from "./practice.ts";

// ---------- the exam's data ----------
export const T1 = [61.4, 51, 46.2, 58.9, 60.5];
export const T2_CI = [31, 16, 15, 21, 23, 22, 16, 20, 24, 19, 4, 12, 23, 22, 14, 23, 16, 20, 25, 29, 21, 30, 19, 16, 20, 19, 13, 24, 20, 9, 28, 24, 22, 30, 21, 15, 37, 25, 21, 26, 14, 22, 17, 20, 20, 24, 14, 23, 21, 27];
export const T2_HT = [327, 327, 331, 323, 328, 333, 324, 327, 324, 329, 330, 323, 326, 326, 330, 330, 328];
export const EXAM1 = [100, 98, 98, 98, 98, 95, 93, 90, 90, 88, 88, 88, 85, 83, 83, 83, 83, 83, 83, 83, 80, 80, 80, 80, 80, 80, 80, 78, 78, 75, 75, 73, 73, 73, 73, 73, 70, 70, 70, 70, 70, 70, 70, 70, 68, 68, 68, 68, 68, 68, 65, 65, 65, 65, 65, 65, 63, 63, 63, 63, 63, 60, 60, 60, 60, 60, 60, 60, 60, 60, 58, 58, 58, 58, 58, 58, 58, 58, 58, 55, 55, 55, 55, 53, 53, 53, 53, 50, 48, 48, 48, 48, 45, 45, 45, 45, 45, 40, 38, 33, 28];
export const EXAM2 = [91, 80, 43, 91, 94, 98, 94, 87, 80, 61, 70, 74, 67, 74, 80, 83, 91, 93, 93, 96, 96, 65, 89, 83, 87, 43, 87, 96, 56, 65, 44, 76, 43, 59, 94, 83, 65, 59, 46, 43, 89, 57, 78, 76, 61, 57, 72, 81, 65, 59, 83, 76, 81, 72, 87, 81, 39, 72, 50, 63, 83, 65, 70, 72, 20, 61, 76, 65, 61, 78, 48, 59, 59, 63, 74, 48, 39, 85, 43, 20, 69, 48, 56, 31, 43, 33, 54, 52, 61, 50, 48, 65, 41, 20, 57, 43, 41, 52, 56, 76, 28];
export const T4 = [93, 63, 73, 68, 85, 105, 83, 80, 88, 63, 60, 70, 83, 94, 48, 85, 82, 86, 15, 45, 97, 71, 82];
export const T5 = [67, 69, 61, 81, 67, 52, 75, 54, 55, 80, 61, 64, 69, 63, 72, 79, 73, 73, 74, 76, 77, 66, 74];

export const SECTIONS = ["1. Confidence intervals", "2. Hypothesis testing I", "3. Hypothesis testing II", "4. Two-sample tests"];
const TABS = ["Confidence intervals", "Hypothesis testing I", "Hypothesis testing II", "Two-sample tests"];
export const EXAM3_ID = "exam3";
export const EXAM3_TITLE = "Exam 3 (Spring 2026)";

/** The questions as printed, for the Exam 3 page. Points in brackets, as on the paper. */
export const EXAM3_TEXT: { n: number; section: number; points: number; lead?: string; text: string }[] = [
  { n: 1, section: 0, points: 3, lead: "I ask a student to use the random number generator to simulate 5 numbers randomly generated according to a normal distribution with μ = 55 and σ = 5.", text: "Construct an interval inside which there is a 95% chance that the student's sample mean belongs." },
  { n: 2, section: 0, points: 1, text: "If the student's sample mean does not belong inside this interval, do we suspect that the student has made a mistake? Write a few sentences explaining your answer." },
  { n: 3, section: 0, points: 1, lead: "The simulated numbers a student produced are shown in Table 1. The student told me that they used σ = 5 but forgot what value for μ they chose.", text: "Is it possible that the student used the intended value of μ = 55 for generating these numbers? Briefly explain your answer." },
  { n: 4, section: 0, points: 3, text: "Construct an interval inside which there is an 80% chance the student's true mean μ belongs." },
  { n: 5, section: 0, points: 3, lead: "Table 2 shows the results of independently sampling a random variable many times.", text: "Construct a confidence interval inside which there is a 99% chance the true mean belongs." },
  { n: 6, section: 1, points: 3, lead: "Table 1 again shows the randomly generated numbers produced by a student who has remembered that σ = 5 but has forgotten which μ they used.", text: "Test the null hypothesis H₀: μ = 55 with α = 0.05." },
  { n: 7, section: 1, points: 3, lead: "A machine is designed to dispense 330ml of liquid into a can. The manufacturer claims the amount dispensed is normally distributed with mean μ = 330ml and σ = 3ml.", text: "We suspect the true mean is actually less than 330ml, but we still trust the stated standard deviation. Use the sample in Table 2 to test H₀: μ ≥ 330ml with α = 0.05." },
  { n: 8, section: 2, points: 3, lead: "Continuing from the last question, we now doubt all the manufacturer's claims about μ and σ.", text: "Perform a hypothesis test using the sample in Table 2 to test H₀: μ ≥ 330ml with α = 0.05." },
  { n: 9, section: 2, points: 1, text: "Must your answers to Questions 7 and 8 be the same? Explain your answer." },
  { n: 10, section: 2, points: 2, lead: "I flip a coin. Heads: X = 1, tails: X = 0, so X has sample space {0, 1}.", text: "If the coin is fair, what is the expectation of X?" },
  { n: 11, section: 2, points: 3, text: "I flip the coin 1000 times: 537 heads and 463 tails. What are the sample mean and sample standard deviation?" },
  { n: 12, section: 2, points: 4, text: "Test the null hypothesis H₀: μ ≤ 0.5 with α = 0.05. (If unsure of Question 11, you can get partial credit using x̄ = 0.51 and S = 0.2.)" },
  { n: 13, section: 3, points: 4, lead: "Table 3 shows students' results in Exams 1 and 2, out of 100. Have students improved?", text: "Let D be the difference between tests, so D is positive if a student improved. Test H₀: μ_D ≥ 0 with α = 0.05." },
  { n: 14, section: 3, points: 4, lead: "Tables 4 and 5 show final exam results in two sections. Does one section do better?", text: "Assuming equal variances, test the null hypothesis that both means are equal with α = 0.05, using S_p = √((S₁² + S₂²)/2), T = (x̄₁ − x̄₂)/(S_p·√(2/n)) and ν = 2n − 2." },
];

// ---------- answers ----------
/** One marked part: its answer, where to find it (a label beside it, an exact cell, or by value) and its slips. */
export type Spec = Omit<Part, "id"> & { id?: string; alts?: number[]; find?: "value"; label: string; at?: RegExp; cell?: string };
export const tolP = (p: number) => Math.max(0.0005, Math.min(0.002, 0.02 * p));
export const num = (label: string, answer: number, excel: string, explain: string, tol: number, extra: Partial<Spec> = {}): Spec =>
  ({ label, kind: "number", answer, excel, explain, tol, format: "num", ...extra });
export const decision = (reject: boolean, rule: string): Spec => ({
  label: "Decision (R or DR)", kind: "choice", answer: reject ? DECISIONS[0] : DECISIONS[1], options: DECISIONS,
  excel: `${rule} → ${reject ? "R" : "DR"}`, explain: "Reject H₀ when the p-value is below α, the same as the statistic falling past the critical value.", at: /^decision/i,
});
export const text = (label: string, model: string, keyPoints: string[]): Spec => ({ label, kind: "text", answer: model, keyPoints, excel: "Written answer", explain: "" });
export const r4 = (x: number) => Math.round(x * 10_000) / 10_000;

/** A one-sample test's six cells, in the template's order. */
export function testParts(o: { n: number; alpha: number; stat: number; statF: string; crit: number; critF: string; p: number; pF: string; tail: "left" | "right" | "two"; S: "Z" | "T" | "χ²"; traps?: { stat?: Part["traps"]; crit?: Part["traps"]; p?: Part["traps"] }; twoSidedStat?: boolean }): Spec[] {
  const reject = o.p < o.alpha;
  const crit = Math.abs(o.crit);
  return [
    num("n", o.n, "=COUNT(data)", "Count the data with COUNT (or COUNTA).", 0, { at: /^n$/i }),
    num("alpha", o.alpha, String(o.alpha), "Given in the question.", 1e-9, { at: /^alpha$|^α$/i }),
    num("Test statistic", o.stat, o.statF, o.S === "Z" ? "σ is known: Z = (x̄ − μ₀)/(σ/√n)." : o.S === "T" ? "σ is unknown: T = (x̄ − μ₀)/(S/√n) with ν = n − 1." : "χ² = (n − 1)·S²/σ₀² with ν = n − 1.", 0.005, { at: /^test stat/i, traps: o.traps?.stat, ...(o.twoSidedStat ? { alts: [-o.stat] } : {}) }),
    num("Critical value", o.crit, o.critF, o.tail === "two" ? "Two tails: ±.INV(1 − α/2)." : o.tail === "left" ? "Left tail: .INV(α), a negative number." : "Right tail: .INV(1 − α).", 0.003, { at: /^crit/i, traps: o.traps?.crit, ...(o.tail === "two" ? { alts: [-o.crit] } : {}) }),
    num("p-value", o.p, o.pF, o.tail === "two" ? "Two tails: double the tail the statistic points into (the class rule, no T.DIST.2T or ABS)." : o.tail === "left" ? "Left tail: .DIST(stat)." : "Right tail: 1 − .DIST(stat).", tolP(o.p), { at: /^p.?val/i, format: "prob", traps: o.traps?.p }),
    decision(reject, `p = ${r4(o.p)} ${reject ? "<" : "≥"} ${o.alpha}; ${o.S} = ${r4(o.stat)} vs ${o.tail === "two" ? "±" : ""}${r4(o.tail === "two" ? crit : o.crit)}`),
  ];
}

type QDef = { n: number; title: string; kind: QuestionKind; topic: TopicId; specs: Spec[] };

function build(world?: { q12?: { xbar: number; s: number } }): QDef[] {
  // Q1: where x̄ will land (μ, σ known).
  const z95 = normInv(0.975), se5 = 5 / Math.sqrt(5);
  // Q4: 80% interval for μ around Table 1's mean.
  const x1 = mean(T1), z80 = normInv(0.9);
  // Q5: 99% t-interval from Table 2.
  const n5 = T2_CI.length, x5 = mean(T2_CI), s5 = stdevS(T2_CI), t5 = tInv(0.995, n5 - 1), se5b = s5 / Math.sqrt(n5);
  // Q6: two-tailed Z test, μ₀ = 55.
  const z6 = (x1 - 55) / se5, p6 = z6 < 0 ? 2 * normCdf(z6) : 2 * (1 - normCdf(z6));
  // Q7/Q8: left-tailed, μ₀ = 330.
  const n7 = T2_HT.length, x7 = mean(T2_HT), s7 = stdevS(T2_HT);
  const z7 = (x7 - 330) / (3 / Math.sqrt(n7)), t8 = (x7 - 330) / (s7 / Math.sqrt(n7));
  // Q11/Q12: Bernoulli.
  const x11 = 0.537, s11 = Math.sqrt((1000 / 999) * 0.537 * 0.463);
  const q12 = world?.q12 ?? { xbar: x11, s: s11 };
  const t12 = (q12.xbar - 0.5) / (q12.s / Math.sqrt(1000));
  // Q13: paired, D = Exam 2 − Exam 1, left tail.
  const D = EXAM2.map((v, i) => v - EXAM1[i]);
  const n13 = D.length, xD = mean(D), sD = stdevS(D), t13 = xD / (sD / Math.sqrt(n13));
  // Q14: pooled t (equal n), two tails.
  const n14 = T4.length, sp = Math.sqrt((stdevS(T4) ** 2 + stdevS(T5) ** 2) / 2);
  const t14 = (mean(T4) - mean(T5)) / (sp * Math.sqrt(2 / n14)), df14 = 2 * n14 - 2;
  const p14 = t14 < 0 ? 2 * tCdf(t14, df14) : 2 * (1 - tCdf(t14, df14));

  return [
    { n: 1, title: "Interval for the sample mean (95%)", kind: "xbar-range", topic: "clt", specs: [
      num("Lower limit", 55 - z95 * se5, "=55-NORM.S.INV(0.975)*5/SQRT(5)", "μ and σ are known, so x̄ lands in μ ± NORM.S.INV(1 − α/2)·σ/√n.", 0.005, { find: "value", traps: [{ value: 55 - z95 * 5, why: "Used σ instead of the standard error σ/√n." }, { value: 55 - normInv(0.95) * se5, why: "Used α instead of α/2: a 95% interval needs NORM.S.INV(0.975)." }] }),
      num("Upper limit", 55 + z95 * se5, "=55+NORM.S.INV(0.975)*5/SQRT(5)", "Same width above μ.", 0.005, { find: "value", traps: [{ value: 55 + z95 * 5, why: "Used σ instead of the standard error σ/√n." }, { value: 55 + normInv(0.95) * se5, why: "Used α instead of α/2: a 95% interval needs NORM.S.INV(0.975)." }] }),
    ] },
    { n: 2, title: "Outside the interval: a mistake?", kind: "concept", topic: "concept", specs: [
      text("Do we suspect a mistake?", "Not necessarily. Even if the student did everything right, there is a 5% chance the sample mean lands outside a 95% interval. A mean outside it makes a mistake more likely, so we might suspect one, but it doesn't prove it.",
        ["5% chance of landing outside even with no mistake", "outside makes us suspicious but is not proof"]),
    ] },
    { n: 3, title: "Could μ have been 55?", kind: "concept", topic: "concept", specs: [
      text("Is μ = 55 possible?", `Yes. The sample mean of Table 1 is ${r4(x1)}, which lies inside the 95% interval (${r4(55 - z95 * se5)}, ${r4(55 + z95 * se5)}) for x̄ when μ = 55, so the numbers are consistent with μ = 55.`,
        ["x̄ = 55.6", "it lies inside the 95% interval from Question 1, so yes"]),
    ] },
    { n: 4, title: "Interval for the true mean (80%)", kind: "ci-z", topic: "ci-z", specs: [
      num("Lower limit", x1 - z80 * se5, "=AVERAGE(Table1)-NORM.S.INV(0.9)*5/SQRT(5)", "σ known, μ unknown: centre on x̄, x̄ ± NORM.S.INV(1 − α/2)·σ/√n with α = 0.2.", 0.005, { find: "value", traps: [{ value: 55 - z80 * se5, why: "Centred on 55. This interval is for the unknown μ, so centre it on x̄ = 55.6." }, { value: x1 - normInv(0.8) * se5, why: "Used α instead of α/2: 80% needs NORM.S.INV(0.9)." }, { value: x1 - z80 * 5, why: "Used σ instead of σ/√n." }] }),
      num("Upper limit", x1 + z80 * se5, "=AVERAGE(Table1)+NORM.S.INV(0.9)*5/SQRT(5)", "Same width above x̄.", 0.005, { find: "value", traps: [{ value: 55 + z80 * se5, why: "Centred on 55. This interval is for the unknown μ, so centre it on x̄ = 55.6." }, { value: x1 + normInv(0.8) * se5, why: "Used α instead of α/2: 80% needs NORM.S.INV(0.9)." }, { value: x1 + z80 * 5, why: "Used σ instead of σ/√n." }] }),
    ] },
    { n: 5, title: "99% interval, σ unknown", kind: "ci-t", topic: "t", specs: [
      num("Lower limit", x5 - t5 * se5b, "=AVERAGE(Table2)-T.INV(0.995,49)*STDEV.S(Table2)/SQRT(50)", "σ unknown: x̄ ± T.INV(1 − α/2, n − 1)·S/√n.", 0.005, { find: "value", traps: [{ value: x5 - normInv(0.995) * se5b, why: "Used NORM.S.INV, but σ is unknown: use T.INV with ν = n − 1." }, { value: x5 - tInv(0.99, n5 - 1) * se5b, why: "Used α instead of α/2: 99% needs T.INV(0.995, ν)." }] }),
      num("Upper limit", x5 + t5 * se5b, "=AVERAGE(Table2)+T.INV(0.995,49)*STDEV.S(Table2)/SQRT(50)", "Same width above x̄.", 0.005, { find: "value", traps: [{ value: x5 + normInv(0.995) * se5b, why: "Used NORM.S.INV, but σ is unknown: use T.INV with ν = n − 1." }, { value: x5 + tInv(0.99, n5 - 1) * se5b, why: "Used α instead of α/2: 99% needs T.INV(0.995, ν)." }] }),
    ] },
    { n: 6, title: "Two-tailed Z test, H₀: μ = 55", kind: "ht-full", topic: "ht", specs: testParts({
      n: 5, alpha: 0.05, stat: z6, statF: "=(AVERAGE(Table1)-55)/(5/SQRT(5))", crit: normInv(0.975), critF: "=NORM.S.INV(0.975)",
      p: p6, pF: z6 < 0 ? "=2*NORM.S.DIST(Z,TRUE)" : "=2*(1-NORM.S.DIST(Z,TRUE))", tail: "two", S: "Z",
      traps: { stat: [{ value: (x1 - 55) / 5, why: "Divided by σ instead of σ/√n." }], crit: [{ value: normInv(0.95), why: "Used α instead of α/2 for a two-tailed test." }], p: [{ value: p6 / 2, why: "Gave one tail: an equals-sign H₀ is two-tailed, so double it." }, { value: 1 - p6 / 2, why: "Took the wrong side of the statistic." }] },
    }) },
    { n: 7, title: "Left-tailed Z test, H₀: μ ≥ 330 (σ = 3)", kind: "ht-full", topic: "ht", specs: testParts({
      n: n7, alpha: 0.05, stat: z7, statF: "=(AVERAGE(Table2)-330)/(3/SQRT(17))", crit: normInv(0.05), critF: "=NORM.S.INV(0.05)",
      p: normCdf(z7), pF: "=NORM.S.DIST(Z,TRUE)", tail: "left", S: "Z",
      traps: { stat: [{ value: t8, why: "Used S from the data, but here σ = 3 is trusted: divide by 3/√n." }], crit: [{ value: -normInv(0.05), why: "Wrong sign: a left-tail critical value is negative." }, { value: normInv(0.025), why: "Used α/2, but this is one-tailed." }], p: [{ value: 1 - normCdf(z7), why: "Took the right tail; H₀: μ ≥ 330 is a left-tail test." }, { value: 2 * normCdf(z7), why: "Doubled it, but this test is one-tailed." }] },
    }) },
    { n: 8, title: "Left-tailed T test, H₀: μ ≥ 330 (σ unknown)", kind: "ht-full", topic: "ht", specs: testParts({
      n: n7, alpha: 0.05, stat: t8, statF: "=(AVERAGE(Table2)-330)/(STDEV.S(Table2)/SQRT(17))", crit: tInv(0.05, n7 - 1), critF: "=T.INV(0.05,16)",
      p: tCdf(t8, n7 - 1), pF: "=T.DIST(T,16,TRUE)", tail: "left", S: "T",
      traps: { stat: [{ value: z7, why: "Used σ = 3, but now σ is doubted: estimate it with STDEV.S." }], crit: [{ value: normInv(0.05), why: "Used NORM.S.INV; σ is unknown, so T.INV with ν = 16." }, { value: -tInv(0.05, n7 - 1), why: "Wrong sign: a left-tail critical value is negative." }], p: [{ value: normCdf(t8), why: "Used NORM.S.DIST; σ is unknown, so T.DIST with ν = 16." }, { value: 1 - tCdf(t8, n7 - 1), why: "Took the right tail; H₀: μ ≥ 330 is a left-tail test." }] },
    }) },
    { n: 9, title: "Must Questions 7 and 8 agree?", kind: "concept", topic: "concept", specs: [
      text("Must the answers be the same?", "No. Question 7 trusts σ = 3 and uses a Z statistic; Question 8 estimates σ with S from the data and uses a T distribution with 16 degrees of freedom. Different assumptions give a different statistic, critical value and p-value, so the decisions can differ (here they happen to agree).",
        ["no, they need not be the same", "Q7 assumes σ known (Z), Q8 estimates σ with S (T, ν = 16)", "different assumptions can lead to different decisions"]),
    ] },
    { n: 10, title: "Expectation of a fair coin", kind: "bernoulli", topic: "ht", specs: [
      num("E(X)", 0.5, "=0*0.5+1*0.5", "E(X) = 0·P(0) + 1·P(1) = 0.5.", 1e-6, { find: "value" }),
    ] },
    { n: 11, title: "Sample mean and SD of 1000 flips", kind: "bernoulli", topic: "ht", specs: [
      num("Sample mean", x11, "=537/1000", "537 ones out of 1000: x̄ = 0.537.", 1e-6, { at: /^sample mean/i }),
      num("Sample std dev", s11, "=SQRT((537*(1-0.537)^2+463*(0-0.537)^2)/999)", "S = √(Σ(x − x̄)²/(n − 1)), with 537 ones and 463 zeros.", 0.0005, { at: /^sample std/i, traps: [{ value: Math.sqrt(0.537 * 0.463), why: "Divided by n, not n − 1: STDEV.S divides by n − 1." }] }),
    ] },
    { n: 12, title: "Right-tailed T test, H₀: μ ≤ 0.5", kind: "bernoulli", topic: "ht", specs: testParts({
      n: 1000, alpha: 0.05, stat: t12, statF: "=(xbar-0.5)/(S/SQRT(1000))", crit: tInv(0.95, 999), critF: "=T.INV(0.95,999)",
      p: 1 - tCdf(t12, 999), pF: "=1-T.DIST(T,999,TRUE)", tail: "right", S: "T",
      traps: { crit: [{ value: -tInv(0.95, 999), why: "Wrong sign: a right-tail critical value is positive." }], p: [{ value: tCdf(t12, 999), why: "Took the left tail; H₀: μ ≤ 0.5 is a right-tail test." }] },
    }) },
    { n: 13, title: "Paired test: did students improve?", kind: "paired", topic: "two", specs: testParts({
      n: n13, alpha: 0.05, stat: t13, statF: "=AVERAGE(D)/(STDEV.S(D)/SQRT(101)), D = Exam 2 − Exam 1", crit: tInv(0.05, n13 - 1), critF: "=T.INV(0.05,100)",
      p: tCdf(t13, n13 - 1), pF: "=T.DIST(T,100,TRUE)", tail: "left", S: "T",
      traps: { stat: [{ value: -t13, why: "Took Exam 1 − Exam 2. D is positive when a student improved, so D = Exam 2 − Exam 1." }], p: [{ value: 1 - tCdf(t13, n13 - 1), why: "Took the right tail; H₀: μ_D ≥ 0 is a left-tail test." }], crit: [{ value: -tInv(0.05, n13 - 1), why: "Wrong sign: a left-tail critical value is negative." }] },
    }) },
    { n: 14, title: "Pooled t test: Tables 4 and 5", kind: "two-t", topic: "two", specs: testParts({
      n: n14, alpha: 0.05, stat: t14, statF: "=(AVERAGE(T4)-AVERAGE(T5))/(Sp*SQRT(2/23)), Sp = SQRT((VAR.S(T4)+VAR.S(T5))/2)", crit: tInv(0.975, df14), critF: "=T.INV(0.975,44)",
      p: p14, pF: t14 < 0 ? "=2*T.DIST(T,44,TRUE)" : "=2*(1-T.DIST(T,44,TRUE))", tail: "two", S: "T", twoSidedStat: true,
      traps: { crit: [{ value: tInv(0.975, n14 - 1), why: "Used ν = n − 1; the pooled test has ν = 2n − 2 = 44." }, { value: tInv(0.95, df14), why: "Used α instead of α/2 for a two-tailed test." }], p: [{ value: p14 / 2, why: "Gave one tail: an equals-sign H₀ is two-tailed, so double it." }] },
    }).map((s) => (s.label === "n" ? { ...s, explain: "n is the size of each section (23), so ν = 2n − 2 = 44.", traps: [{ value: 46, why: "n here is per section: 23, not 46." }] } : s)) },
  ];
}

// ---------- reading a student's workbook ----------
export const colNum = (c: string) => { let n = 0; for (const ch of c) n = n * 26 + ch.charCodeAt(0) - 64; return n; };
export const colName = (n: number) => { let s = ""; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
export const split = (a: string) => { const m = /^([A-Z]+)(\d+)$/.exec(a); return m ? { c: colNum(m[1]), r: Number(m[2]) } : null; };

// Rows where each question starts (column B), per tab.
const STARTS: Record<number, [number, number]> = { 1: [0, 3], 2: [0, 9], 3: [0, 19], 4: [0, 21], 5: [0, 27], 6: [1, 3], 7: [1, 11], 8: [2, 3], 9: [2, 22], 10: [2, 24], 11: [2, 26], 12: [2, 29], 13: [3, 3], 14: [3, 10] };
// Text the professor's template already contains: not a student's answer.
export const TEMPLATE_TEXT = /^(table \d+|exam [12]|n|alpha|test statistic|critical value|p value|decision|write r for reject and dr for do not reject|sample mean|sample std dev)$/i;

export function findTab(wb: ReadWorkbook, name: string): Record<string, CellVal> | undefined {
  const key = wb.sheetOrder.find((s) => s.trim().toLowerCase() === name.toLowerCase());
  return key ? wb.sheets[key] : undefined;
}

/** Is this the professor's Exam 3 workbook (or the site's blank copy)? */
export function isExam3(wb: ReadWorkbook): boolean {
  if ((wb.thinkaId ?? "").trim() === EXAM3_ID) return true;
  const ci = findTab(wb, TABS[0]), ht = findTab(wb, TABS[1]);
  return !!ci && !!ht && TABS.every((t) => findTab(wb, t)) && Number(ci.D12) === 61.4 && Number(ht.D12) === 327;
}

export type Starts = Record<number, [tab: number, row: number]>;
function region(cells: Record<string, CellVal>, n: number, starts: Starts = STARTS) {
  const [tab, start] = starts[n];
  const next = Object.entries(starts).filter(([k, [t, r]]) => Number(k) > n && t === tab).map(([, [, r]]) => r)[0] ?? Infinity;
  return Object.entries(cells).map(([a, v]) => ({ a, v, p: split(a)! })).filter((x) => x.p && x.p.r >= start && x.p.r < next);
}

export function gradeOne(v: CellVal | undefined, s: Spec): Omit<PartGrade, "part" | "cell" | "points" | "got"> {
  const part = s as unknown as Part;
  const r = gradeCell(v, part);
  if (r.ok || s.kind !== "number" || !s.alts?.length || typeof v !== "number") return r;
  for (const alt of s.alts) {
    const a = gradeCell(v, { ...part, answer: alt });
    if (a.ok) return { ...a, answer: r.answer };
  }
  return r;
}

export function locate(cells: Record<string, CellVal> | undefined, n: number, s: Spec, wb: ReadWorkbook, starts: Starts = STARTS): { cell: string; r: Omit<PartGrade, "part" | "cell" | "points" | "got"> } {
  if (!cells) return { cell: "", r: gradeOne(undefined, s) };
  // A known answer cell with something in it: mark that.
  if (s.cell && cells[s.cell] !== undefined && cells[s.cell] !== null && cells[s.cell] !== "") return { cell: s.cell, r: gradeOne(cells[s.cell], s) };
  const reg = region(cells, n, starts);
  if (s.at) {
    const label = reg.find((x) => typeof x.v === "string" && s.at!.test(x.v.trim()));
    if (label) {
      const cell = `${colName(label.p.c + 1)}${label.p.r}`;
      return { cell, r: gradeOne(cells[cell], s) };
    }
  }
  // A part with a known answer cell that's empty: blank (a value elsewhere could match by coincidence).
  if (s.cell && s.kind !== "text" && s.find !== "value") return { cell: s.cell, r: { ok: false, status: "blank", mine: "Blank", answer: gradeOne(undefined, s).answer } };
  if (s.kind === "text") {
    const words = reg.filter((x) => typeof x.v === "string" && !TEMPLATE_TEXT.test(x.v.trim()) && x.v.trim().length > 1).sort((a, b) => a.p.r - b.p.r || a.p.c - b.p.c);
    const joined = words.map((x) => String(x.v).trim()).join(" ");
    return { cell: words[0]?.a ?? `rows of Q${n}`, r: gradeOne(joined || undefined, s) };
  }
  // Free-form: any number in the question's rows that matches (data cells can't, they're whole numbers or Table 1's).
  const nums = reg.filter((x) => typeof x.v === "number" || (typeof x.v === "string" && /^[\d.\s/]+$/.test(x.v)));
  const values = nums.map((x) => ({ ...x, v: typeof x.v === "string" && x.v.includes("/") ? Number(x.v.split("/")[0]) / Number(x.v.split("/")[1]) : x.v }));
  const hit = values.find((x) => gradeOne(x.v as CellVal, s).ok);
  if (hit) return { cell: hit.a, r: gradeOne(hit.v as CellVal, s) };
  const slip = values.find((x) => typeof x.v === "number" && (s.traps ?? []).some((t) => Math.abs(t.value - (x.v as number)) <= (s.tol ?? 0.005) * 1.5));
  if (slip) return { cell: slip.a, r: gradeOne(slip.v as CellVal, s) };
  void wb;
  return { cell: `rows of Q${n}`, r: { ok: false, status: "blank", mine: "Not found", answer: gradeOne(undefined, s).answer } };
}

/** Marks an uploaded Exam 3. Question 12 gets follow-through credit from the student's own Question 11, or from the exam's x̄ = 0.51, S = 0.2. */
export function gradeExam3(wb: ReadWorkbook): WorkbookGrade {
  const tabs = TABS.map((t) => findTab(wb, t));
  const notes: string[] = [];
  const gradeQ = (q: QDef): QuestionGrade => {
    const cells = tabs[STARTS[q.n][0]];
    const qPoints = EXAM3_TEXT[q.n - 1].points;
    const per = qPoints / q.specs.length;
    const parts: PartGrade[] = q.specs.map((s, i) => {
      const { cell, r } = locate(cells, q.n, s, wb);
      const part = { ...(s as unknown as Part), id: String.fromCharCode(97 + i) };
      return { ...r, part, cell, points: per, got: r.ok ? per : 0 };
    });
    const got = parts.reduce((t, p) => t + p.got, 0);
    const question: Question = { id: `exam3-q${q.n}`, seed: 0, kind: q.kind, topic: q.topic, title: q.title, prompt: EXAM3_TEXT[q.n - 1].text, parts: parts.map((p) => p.part) };
    return { q: question, index: q.n - 1, section: SECTIONS[EXAM3_TEXT[q.n - 1].section], sheetFound: !!cells, parts, got, total: qPoints };
  };

  const base = build().map(gradeQ);
  // Question 12, follow-through: try the student's own Q11 values and the exam's fallback.
  const q11 = base[10];
  const mine = q11.parts.map((p) => Number(p.mine));
  const worlds: { xbar: number; s: number; why: string }[] = [{ xbar: 0.51, s: 0.2, why: "the exam's fallback x̄ = 0.51 and S = 0.2" }];
  if (mine.every((v) => Number.isFinite(v) && v > 0) && !q11.parts.every((p) => p.ok)) worlds.unshift({ xbar: mine[0], s: mine[1], why: "your own Question 11 answers" });
  for (const w of worlds) {
    const alt = gradeQ(build({ q12: w })[11]);
    const statOk = (g: QuestionGrade) => g.parts.filter((p) => p.ok && /statistic|p-value|Critical|Decision/.test(p.part.label)).length;
    if (statOk(alt) > statOk(base[11])) {
      base[11] = alt;
      notes.push(`Question 12 was marked using ${w.why} (follow-through credit, as the exam allows).`);
      break;
    }
  }

  const missing = TABS.filter((_, i) => !tabs[i]);
  if (missing.length) notes.push(`These tabs weren't in the file: ${missing.join(", ")}. Upload the professor's Exam 3 workbook with its four tabs.`);
  if (base.some((g) => g.parts.some((p) => p.status === "nocache"))) notes.push("Some cells have formulas with no saved result. Open the file in Excel, let it calculate, save, and upload again.");
  const written = base.reduce((s, g) => s + g.parts.filter((p) => p.status === "written").length, 0);
  if (written) notes.push(`${written} written answer${written === 1 ? " needs" : "s need"} marking: have Claude mark ${written === 1 ? "it" : "them"}, or compare with the model answer below.`);
  notes.push("Section 1 has no fixed answer cells, so intervals are found by value anywhere in each question's rows.");
  const got = base.reduce((s, g) => s + g.got, 0);
  const total = base.reduce((s, g) => s + g.total, 0);
  return { kind: "exam3", n: 3, id: EXAM3_ID, title: EXAM3_TITLE, questions: base, got, total, notes };
}

// ---------- a blank copy, laid out exactly like the professor's ----------
export function exam3Sheets(): SheetModel[] {
  const sheet = (name: string, cells: Record<string, Cell>, rows: number): SheetModel => ({ name, cells, colWidths: [3, 5, 3, 12, 12, 14, 14, 14, 12, 12, 12, 14, 12, 12, 12, 12], answerCells: {}, rows });
  const col = (c: Record<string, Cell>, letter: string, row: number, xs: number[]) => xs.forEach((v, i) => { c[`${letter}${row + i}`] = { v, role: "data" }; });
  const q = (c: Record<string, Cell>, n: number, row: number) => { c[`B${row}`] = { v: n, role: "header" }; };
  const block = (c: Record<string, Cell>, labelCol: string, row: number, decisionCol: string, nRows = 5) => {
    const lc = colNum(labelCol), dc = colNum(decisionCol);
    ["n", "alpha", "test statistic", "critical value", "p value"].slice(0, nRows).forEach((l, i) => { c[`${labelCol}${row + i}`] = { v: l, role: "label" }; c[`${colName(lc + 1)}${row + i}`] = { role: "answer" }; });
    c[`${decisionCol}${row}`] = { v: "Decision", role: "label" }; c[`${colName(dc + 1)}${row}`] = { role: "answer" };
    c[`${colName(dc + 2)}${row}`] = { v: "Write R for reject and DR for do not reject", role: "hint" };
  };
  const ci: Record<string, Cell> = {};
  [[1, 3], [2, 9], [3, 19], [4, 21], [5, 27]].forEach(([n, r]) => q(ci, n, r));
  ci.D11 = { v: "Table 1", role: "header" }; col(ci, "D", 12, T1);
  ci.D27 = { v: "Table 2", role: "header" }; col(ci, "D", 28, T2_CI);
  const h1: Record<string, Cell> = {};
  q(h1, 6, 3); h1.D3 = { v: "Table 1", role: "header" }; col(h1, "D", 4, T1); block(h1, "F", 3, "I");
  q(h1, 7, 11); h1.D11 = { v: "Table 2", role: "header" }; col(h1, "D", 12, T2_HT); block(h1, "F", 11, "I");
  const h2: Record<string, Cell> = {};
  q(h2, 8, 3); h2.D3 = { v: "Table 2", role: "header" }; col(h2, "D", 4, T2_HT); block(h2, "F", 3, "I");
  q(h2, 9, 22); q(h2, 10, 24); q(h2, 11, 26);
  h2.D26 = { v: "Sample mean", role: "label" }; h2.E26 = { role: "answer" }; h2.D27 = { v: "Sample std dev", role: "label" }; h2.E27 = { role: "answer" };
  q(h2, 12, 29); block(h2, "D", 29, "G");
  const two: Record<string, Cell> = {};
  q(two, 13, 3); two.D3 = { v: "Table 3", role: "header" }; two.D4 = { v: "Exam 1", role: "header" }; two.E4 = { v: "Exam 2", role: "header" };
  col(two, "D", 5, EXAM1); col(two, "E", 5, EXAM2); block(two, "G", 3, "J");
  q(two, 14, 10); two.G10 = { v: "Table 4", role: "header" }; two.I10 = { v: "Table 5", role: "header" };
  col(two, "G", 11, T4); col(two, "I", 11, T5); block(two, "K", 10, "N");
  return [sheet(TABS[0], ci, 77), sheet(TABS[1], h1, 28), sheet(TABS[2], h2, 33), sheet(TABS[3], two, 105)];
}
export const EXAM3_INTRO = [
  "Last spring's Exam 3, laid out exactly like the professor's workbook. The questions are on the site's Exam 3 page.",
  "60 minutes, Excel only, no calculator. Use formulas that point at the data cells.",
  "Section 1 has no answer cells: put your intervals anywhere in that question's rows (label them lower and upper). Sections 2–4: fill the cells beside n, alpha, test statistic, critical value, p value, and R or DR beside Decision. Written answers: type them in the question's rows.",
  "When you're done, save it as .xlsx and drop it on the site's Exam 3 page. Your professor's own copy works too.",
];

/** Correct values, for the tests. */
export const exam3Key = () => build().map((q) => ({ n: q.n, parts: q.specs.map((s) => ({ label: s.label, answer: s.answer })) }));

// ---------- a practice set aimed at what was lost ----------
const RETRY: Record<number, [QuestionKind, number?, string?][]> = {
  1: [["xbar-range"]], 2: [["concept", 12]], 3: [["concept", 12]], 4: [["ci-z"]], 5: [["ci-t"]],
  6: [["ht-full", undefined, "eq-known-p"]], 7: [["ht-full", undefined, "ge-known-p"]], 8: [["ht-full", undefined, "ge-unknown-p"]],
  9: [["concept", 11], ["concept", 10]], 10: [["bernoulli"]], 11: [["bernoulli"]], 12: [["ht-full", undefined, "le-unknown-p"], ["bernoulli"]],
  13: [["paired"]], 14: [["two-t"]],
};
/**
 * A custom set built from the Exam 3 questions that lost points: two fresh look-alikes of each (one for
 * written ones), at most 14 questions. `written` holds written-part marks, keyed "<question index>:<part id>".
 * Fresh seeds every call, so each download is new; the set's id carries them, so it is marked on upload.
 */
export function targetedSpec(g: WorkbookGrade, written: Record<string, number> = {}, rand = () => 1000 + Math.floor(Math.random() * 1e9)): { t: string; q: [QuestionKind, number, string?][] } {
  const lost = g.questions
    .map((q) => ({ n: q.index + 1, lost: q.total - q.got - q.parts.reduce((s, p) => s + (p.status === "written" ? (written[`${q.index}:${p.part.id}`] ?? 0) * p.points : 0), 0) }))
    .filter((x) => x.lost > 1e-9)
    .sort((a, b) => b.lost - a.lost);
  const q: [QuestionKind, number, string?][] = [];
  const seen = new Set<string>();
  for (const { n } of lost) {
    for (const [kind, seed, caseKey] of RETRY[n] ?? []) {
      const copies = kind === "concept" ? 1 : 2;
      for (let i = 0; i < copies && q.length < 14; i++) {
        const key = `${kind}:${seed ?? ""}:${caseKey ?? ""}:${i}`;
        if (kind === "concept" && seen.has(key)) continue;
        seen.add(key);
        q.push(caseKey ? [kind, rand(), caseKey] : [kind, seed ?? rand()]);
      }
    }
  }
  if (!q.length) for (const n of [5, 8, 12, 13, 14]) for (const [kind, seed, caseKey] of RETRY[n]) q.push(caseKey ? [kind, rand(), caseKey] : [kind, seed ?? rand()]);
  return { t: lost.length ? "Targeted practice from your Exam 3" : "Exam 3 stretch set", q: q.slice(0, 14) };
}
