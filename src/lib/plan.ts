// The diagnostic and the study plan built from it.
// The diagnostic is last spring's Exam 3 (exam3.ts): every part is scored against one skill; the plan
// spends the days before the exam on the weakest skills, in course order, then the skills Exam 3
// doesn't check, then a timed exam-style mock and a redo of Exam 3. All practice is a downloadable
// Excel workbook (the four area sets), uploaded for marking. Older 9-question diagnostics still score.
import type { Question, Part, QuestionKind } from "./practice.ts";
import { generate, generateCase } from "./practice.ts";
import { EXAM_MINUTES } from "./sets.ts";
import { AREA_VERSIONS, areaById, type AreaId } from "./areas.ts";
import type { WorkbookGrade } from "./grade.ts";
import { examDate } from "./progress.ts";

export type SkillId =
  | "normal-prob" | "percentile" | "clt" | "ci-z" | "ci-t" | "h0-setup" | "stat" | "pvalue" | "crit"
  | "var-test" | "two-sample" | "written";

export type Skill = {
  id: SkillId;
  name: string;
  learn: string;          // topic id in course.ts
  area: AreaId;           // practice is that area's Excel sets
  task: string;           // what to do on the day, one sentence
  /** False for skills Exam 3 doesn't test: the plan treats them as unchecked gaps. */
  diagnosed: boolean;
};

// Course order: later skills build on earlier ones, so gaps are fixed in this order.
export const SKILLS: Skill[] = [
  { id: "normal-prob", name: "Normal probabilities", learn: "normal", area: "ci", diagnosed: false, task: "Turn less-than, more-than and between into NORM.DIST, and convert between x and z." },
  { id: "percentile", name: "Percentiles with NORM.INV", learn: "normal", area: "ci", diagnosed: false, task: "Top p% means 1 − p goes into NORM.INV; practise top, bottom, Q1 and middle ranges." },
  { id: "clt", name: "Sample means and the CLT", learn: "clt", area: "ci", diagnosed: true, task: "Questions about x̄ use σ/√n, not σ. Practise P(X̄ < a) and where x̄ will land." },
  { id: "ci-z", name: "Intervals with σ known", learn: "ci-z", area: "ci", diagnosed: true, task: "x̄ ± NORM.S.INV(1−α/2)·σ/√n, and the difference between \"where is μ\" and \"where will x̄ land\"." },
  { id: "ci-t", name: "Intervals with σ unknown", learn: "t", area: "ci", diagnosed: true, task: "STDEV.S for s, ν = n − 1, and T.INV(1−α/2, ν) in place of Z." },
  { id: "h0-setup", name: "Setting up H₀ from the wording", learn: "ht-logic", area: "ht1", diagnosed: false, task: "\"More than\" is a right tail, \"less than\" a left tail, \"different\" two tails; the claim goes in H_A." },
  { id: "stat", name: "Computing the test statistic", learn: "ht-logic", area: "ht1", diagnosed: true, task: "x̄ and s from the data, SE, then (x̄ − μ₀)/SE; Z if σ is given, T if not." },
  { id: "pvalue", name: "p-values and the sign rule", learn: "twelve", area: "ht1", diagnosed: true, task: "Left .DIST(stat), right 1 − .DIST(stat), two tails 2 × the smaller tail, chosen by the sign." },
  { id: "crit", name: "Critical values and decisions", learn: "twelve", area: "ht2", diagnosed: true, task: ".INV(1−α), .INV(α) or ±.INV(1−α/2), then reject only when the statistic is past it." },
  { id: "var-test", name: "Chi-squared test for a variance", learn: "variance", area: "ht2", diagnosed: false, task: "VAR.S for S², (n − 1)S²/σ₀² with ν = n − 1, then CHISQ.DIST or CHISQ.INV for the tail." },
  { id: "two-sample", name: "Two-sample and paired tests", learn: "two-sample", area: "two", diagnosed: true, task: "Toolpak z-test when σ is known, pooled t-test for equal variances, and paired data as one sample of differences with ν = n − 1." },
  { id: "written", name: "Written answers and definitions", learn: "dictionary", area: "ci", diagnosed: true, task: "Type I and II errors, what a p-value is, α, bias, and the shapes of the normal, t and χ² curves, in a few clear sentences." },
];
export const skillById = (id: SkillId) => SKILLS.find((s) => s.id === id)!;
/** Skills the diagnostic scores, and the ones it doesn't check yet. */
export const DIAGNOSED_SKILLS = SKILLS.filter((s) => s.diagnosed);
export const UNCHECKED_SKILLS = SKILLS.filter((s) => !s.diagnosed);

/** The 9 diagnostic slots: one question each. */
export const DIAGNOSTIC: { kind?: QuestionKind; caseKey?: string; skill?: SkillId; label: string }[] = [
  { kind: "normal-more", skill: "normal-prob", label: "Normal probability" },
  { kind: "normal-inverse", skill: "percentile", label: "Percentile" },
  { kind: "zscore", skill: "normal-prob", label: "Z-scores" },
  { kind: "sample-mean", skill: "clt", label: "Sample mean" },
  { kind: "ci-z", skill: "ci-z", label: "Interval, σ known" },
  { kind: "ci-t", skill: "ci-t", label: "Interval, σ unknown" },
  { caseKey: "eq-known-p", label: "Two-tailed Z-test" },
  { caseKey: "le-unknown-crit", label: "Right-tailed t-test" },
  { caseKey: "ge-unknown-p", label: "Left-tailed t-test" },
];

export function diagnosticQuestion(slot: number, seed: number): Question {
  const d = DIAGNOSTIC[slot];
  return d.caseKey ? generateCase(d.caseKey, seed) : generate(d.kind!, seed);
}
/** Slot seeds for the Excel diagnostic: one base seed (carried in the workbook's id) fixes all nine. */
export const diagnosticSeeds = (base: number) => DIAGNOSTIC.map((_, i) => (Math.imul(base, 2654435761) + 7919 * (i + 1)) >>> 1);
export const diagnosticQuestions = (base: number) => diagnosticSeeds(base).map((seed, i) => diagnosticQuestion(i, seed));
export const DIAG_SEED_MAX = 2 ** 31;

/** Which skill a part measures. Hypothesis-test parts are split by what they ask. */
export function skillOfPart(q: Question, p: Part, slotSkill?: SkillId): SkillId {
  if (q.kind !== "ht") return slotSkill ?? "normal-prob";
  const l = p.label.toLowerCase();
  if (l.includes("null hypothesis")) return "h0-setup";
  if (l.includes("p-value")) return "pvalue";
  if (l.includes("critical")) return "crit";
  if (l.startsWith("decision")) return q.caseKey?.endsWith("-crit") ? "crit" : "pvalue";
  return "stat"; // x̄, s, and the statistic itself
}

export type SkillScore = { id: SkillId; correct: number; total: number; level: "strong" | "shaky" | "gap" };
export type DiagnosticResult = { ts: number; scores: SkillScore[]; correct: number; total: number; source?: "exam3" | "diag"; points?: { got: number; total: number } };

export function levelOf(correct: number, total: number): SkillScore["level"] {
  if (total === 0) return "gap";
  const r = correct / total;
  return r >= 0.8 ? "strong" : r >= 0.5 ? "shaky" : "gap";
}

export function scoreDiagnostic(answers: { q: Question; slot: number; ok: boolean[] }[]): DiagnosticResult {
  const tally = new Map<SkillId, { c: number; t: number }>();
  for (const s of SKILLS) tally.set(s.id, { c: 0, t: 0 });
  let correct = 0, total = 0;
  for (const a of answers) {
    a.q.parts.forEach((p, i) => {
      const id = skillOfPart(a.q, p, DIAGNOSTIC[a.slot].skill);
      const t = tally.get(id)!;
      t.t += 1;
      if (a.ok[i]) { t.c += 1; correct += 1; }
      total += 1;
    });
  }
  return { ts: Date.now(), scores: scoresFrom(tally), correct, total };
}

function scoresFrom(tally: Map<SkillId, { c: number; t: number }>): SkillScore[] {
  return SKILLS.filter((s) => (tally.get(s.id)?.t ?? 0) > 0).map((s) => {
    const t = tally.get(s.id)!;
    return { id: s.id, correct: Math.round(t.c * 10) / 10, total: t.t, level: levelOf(t.c, t.t) };
  });
}

/** Which skill an Exam 3 part measures (question number 1–14, part label). */
export function skillOfExam3Part(n: number, label: string): SkillId {
  if (n === 1) return "clt";
  if (n === 4) return "ci-z";
  if (n === 5) return "ci-t";
  if (n === 2 || n === 3 || n === 9) return "written";
  if (n === 13 || n === 14) return "two-sample";
  if (n === 10 || n === 11) return "stat";
  const l = label.toLowerCase();
  if (l.startsWith("critical")) return "crit";
  if (l.startsWith("p-value") || l.startsWith("decision")) return "pvalue";
  return "stat";
}

/**
 * An uploaded Exam 3 as a diagnostic result. `written` holds the marks for the written parts
 * (0, 0.5 or 1, keyed "<question index>:<part id>"); unmarked written parts are left out.
 */
export function exam3Result(g: WorkbookGrade, written: Record<string, number> = {}): DiagnosticResult {
  const tally = new Map<SkillId, { c: number; t: number }>(SKILLS.map((s) => [s.id, { c: 0, t: 0 }]));
  let correct = 0, total = 0;
  for (const q of g.questions) {
    for (const p of q.parts) {
      let score: number;
      if (p.status === "written") {
        const m = written[`${q.index}:${p.part.id}`];
        if (m === undefined) continue;
        score = m;
      } else score = p.ok ? 1 : 0;
      const t = tally.get(skillOfExam3Part(q.index + 1, p.part.label))!;
      t.t += 1; t.c += score; correct += score; total += 1;
    }
  }
  return { ts: Date.now(), scores: scoresFrom(tally), correct, total, source: "exam3", points: { got: g.got + g.questions.reduce((s, q) => s + q.parts.reduce((x, p) => x + (p.status === "written" ? (written[`${q.index}:${p.part.id}`] ?? 0) * p.points : 0), 0), 0), total: g.total } };
}

// ---------- the plan ----------
export type PlanTask = { label: string; href: string; kind: "learn" | "practice" | "check" | "tutor"; tutorPrompt?: string };
export type PlanDay = { date: string; title: string; why: string; skills: SkillId[]; tasks: PlanTask[] };

/** Lower-case the first letter only, so NORM.INV and H₀ survive. */
export const lcFirst = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * The day's tasks: notes once per Learn topic, then one Excel set per area.
 * `versions` counts how often each area's sets have been given so far, so repeat days get the next set.
 */
function skillTasks(ids: SkillId[], versions: Map<string, number>): PlanTask[] {
  const tasks: PlanTask[] = [];
  const learned = new Set<string>();
  const areas = new Set<string>();
  for (const id of ids) {
    const s = skillById(id);
    if (!learned.has(s.learn)) {
      learned.add(s.learn);
      tasks.push({ kind: "learn", label: `Read the notes and worked example: ${lcFirst(s.name)}`, href: `#/learn/${s.learn}` });
    }
  }
  for (const id of ids) {
    const s = skillById(id);
    if (areas.has(s.area)) continue;
    areas.add(s.area);
    const used = versions.get(s.area) ?? 0;
    versions.set(s.area, used + 1);
    const v = (used % AREA_VERSIONS) + 1;
    const a = areaById(s.area)!;
    tasks.push({ kind: "practice", label: `Do the ${a.title} set in Excel (set ${v} of ${AREA_VERSIONS}), then upload it`, href: `#/area/${a.id}/set/${v}` });
  }
  return tasks;
}

const MOCK_TASK: PlanTask = { kind: "practice", label: `Full practice exam in Excel: ${EXAM_MINUTES} minutes, timed, no calculator, then upload it`, href: "#/home/mocks" };

/**
 * Builds the plan from today up to the day before the exam.
 * Focus days go to gaps, then shaky skills, then the skills the diagnostic doesn't check yet
 * (course order within each), spread evenly over the days; spare days revisit the weakest skills;
 * the last two days are a timed exam-style mock and a retake.
 */
/** Day titles stay short: two skills by name, then "and N more". */
const names = (ids: SkillId[]) => ids.length > 2 ? `${skillById(ids[0]).name}, ${lcFirst(skillById(ids[1]).name)} and ${ids.length - 2} more` : ids.map((id) => skillById(id).name).join(" and ");

export function buildPlan(result: DiagnosticResult, today = new Date(), exam = examDate()): PlanDay[] {
  const [ey, em, ed] = exam.split("-").map(Number);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.max(1, Math.round((new Date(ey, em - 1, ed).getTime() - start.getTime()) / 86_400_000)); // today .. day before the exam
  const scoreOf = (id: SkillId) => result.scores.find((s) => s.id === id);
  const order = (lvl: SkillScore["level"]) => SKILLS.filter((s) => scoreOf(s.id)?.level === lvl).map((s) => s.id);
  const gaps = order("gap"), shaky = order("shaky"), strong = order("strong");
  // Not checked: skills Exam 3 doesn't test, plus anything an older saved result lacks.
  const unchecked = SKILLS.filter((s) => !scoreOf(s.id)).map((s) => s.id);
  const weak = [...gaps, ...shaky, ...unchecked];

  const endDays = days >= 4 ? 2 : days >= 2 ? 1 : 0;
  const focusDays = Math.max(0, days - endDays);
  const slots: SkillId[][] = [];

  if (focusDays > 0 && weak.length > 0) {
    // Pack weak skills into the focus days: one per day when there is room, otherwise spread evenly.
    const perDay = weak.length > focusDays ? Math.ceil(weak.length / focusDays) : 1;
    for (let i = 0; i < weak.length && slots.length < focusDays; i += perDay) slots.push(weak.slice(i, i + perDay));
    const leftover = weak.slice(slots.flat().length);
    if (leftover.length) slots[slots.length - 1].push(...leftover); // never drop a weak skill
    // Spare days, part 1: one second pass over the weak skills, two a day, gaps first.
    for (let i = 0; i < weak.length && slots.length < focusDays; i += 2) slots.push(weak.slice(i, i + 2));
  }
  // Spare days, part 2: pair a weak skill with a strong one, so nothing goes cold.
  const warm = strong.length ? strong : SKILLS.map((s) => s.id);
  let w = 0;
  while (slots.length < focusDays) {
    const pair = weak.length ? [weak[w % weak.length], warm[w % warm.length]] : [warm[(2 * w) % warm.length], warm[(2 * w + 1) % warm.length]];
    slots.push(pair.filter((v, i, a) => a.indexOf(v) === i));
    w += 1;
  }

  const plan: PlanDay[] = [];
  const day = (i: number) => { const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i); return iso(d); };
  const versions = new Map<string, number>();
  const whyOf = (id: SkillId) => {
    const s = scoreOf(id);
    return s ? `${skillById(id).name}: ${s.correct} of ${s.total} right ${result.source === "exam3" ? "on Exam 3" : "in the diagnostic"}` : `${skillById(id).name}: not on Exam 3, but on the syllabus`;
  };

  slots.forEach((ids, i) => {
    const seen = Math.max(0, ...ids.map((id) => plan.filter((p) => p.skills.includes(id)).length));
    const firstPass = seen === 0;
    const isWarm = ids.every((id) => scoreOf(id)?.level === "strong");
    plan.push({
      date: day(i),
      title: isWarm ? `Keep it warm: ${names(ids)}` : `${firstPass ? "" : seen === 1 ? "Second pass: " : "Review: "}${names(ids)}`,
      why: isWarm ? `You did well on ${ids.length > 1 ? "these" : "this"}. One set keeps ${ids.length > 1 ? "them" : "it"} fresh.` : ids.map(whyOf).join(" · "),
      skills: ids,
      tasks: [
        ...skillTasks(ids, versions),
        ...(isWarm ? [] : [{ kind: "tutor" as const, label: "Stuck? Ask Dr Phil to quiz you on it", href: "#/tutor", tutorPrompt: `Quiz me on ${ids.map((id) => lcFirst(skillById(id).name)).join(" and ")}, one question at a time, exam style, using the class's Excel functions.` }]),
      ],
    });
  });

  if (endDays >= 2) {
    plan.push({
      date: day(plan.length), title: "Timed practice exam",
      why: `The exam is ${EXAM_MINUTES} minutes, Excel only, no calculator, and mixes Lessons 12–18. Do one mock under the same conditions.`,
      skills: [], tasks: [
        MOCK_TASK,
        { kind: "learn", label: "Skim the 12 hypothesis test questions grid", href: "#/learn/twelve" },
      ],
    });
  }
  if (endDays >= 1) {
    plan.push({
      date: day(plan.length), title: "Redo Exam 3 and review", why: "Redo Exam 3 from a blank copy to check what moved, then spend the rest of the time on anything still marked as a gap.",
      skills: [], tasks: [
        { kind: "check", label: "Redo Exam 3 from a blank copy (60 minutes), then upload it", href: "#/exam3" },
        { kind: "learn", label: "Read the mistakes list for any topic still weak", href: "#/learn" },
        { ...MOCK_TASK, label: `If you have an hour: another exam-style mock, ${EXAM_MINUTES} minutes, timed` },
      ],
    });
  }
  return plan;
}

// ---------- storage ----------
const RESULT_KEY = "aqm.diag.result";
const HISTORY_KEY = "aqm.diag.history";
const DONE_KEY = "aqm.plan.done";

export function saveResult(r: DiagnosticResult) {
  try {
    const hist = readHistory();
    hist.push(r);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(-10)));
    localStorage.setItem(RESULT_KEY, JSON.stringify(r));
    localStorage.removeItem(DONE_KEY);
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("aqm:plan"));
}
export function readResult(): DiagnosticResult | null {
  try { const raw = localStorage.getItem(RESULT_KEY); return raw ? (JSON.parse(raw) as DiagnosticResult) : null; } catch { return null; }
}
export function readHistory(): DiagnosticResult[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as DiagnosticResult[]; } catch { return []; }
}
export function readDone(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(DONE_KEY) ?? "{}") as Record<string, boolean>; } catch { return {}; }
}
export function setDone(id: string, v: boolean) {
  const d = readDone();
  d[id] = v;
  try { localStorage.setItem(DONE_KEY, JSON.stringify(d)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("aqm:plan"));
}
/** The plan is rebuilt from the saved result and its date, so it stays stable across reloads. */
export function currentPlan(): PlanDay[] | null {
  const r = readResult();
  if (!r) return null;
  return buildPlan(r, new Date(r.ts));
}
export const todayIso = () => iso(new Date());
