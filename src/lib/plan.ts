// v2: the diagnostic and the study plan built from it.
// The diagnostic is 9 exam-style questions from the offline generator (exact grading, no AI cost).
// Every part is scored against one skill; the plan spends the days before the exam on the weakest skills,
// in course order, then a mixed exam set and a retake.
import type { Question, Part, QuestionKind } from "./practice.ts";
import { generate, generateCase } from "./practice.ts";
import { examDate } from "./progress.ts";

export type SkillId = "normal-prob" | "percentile" | "clt" | "ci-z" | "ci-t" | "h0-setup" | "stat" | "pvalue" | "crit";

export type Skill = {
  id: SkillId;
  name: string;
  learn: string;          // topic id in course.ts
  practice: string;       // practice route: a kind, or case:<key>
  task: string;           // what to do on the day, one sentence
};

// Course order: later skills build on earlier ones, so gaps are fixed in this order.
export const SKILLS: Skill[] = [
  { id: "normal-prob", name: "Normal probabilities", learn: "normal", practice: "normal-between", task: "Turn less-than, more-than and between into NORM.DIST, and convert between x and z." },
  { id: "percentile", name: "Percentiles with NORM.INV", learn: "normal", practice: "normal-inverse", task: "Top p% means 1 − p goes into NORM.INV; practise top, bottom, Q1 and middle ranges." },
  { id: "clt", name: "Sample means and the CLT", learn: "clt", practice: "sample-mean", task: "Questions about x̄ use σ/√n, not σ. Practise P(X̄ < a) and where x̄ will land." },
  { id: "ci-z", name: "Intervals with σ known", learn: "ci-z", practice: "ci-z", task: "x̄ ± NORM.S.INV(1−α/2)·σ/√n, and the difference between \"where is μ\" and \"where will x̄ land\"." },
  { id: "ci-t", name: "Intervals with σ unknown", learn: "t", practice: "ci-t", task: "STDEV.S for s, ν = n − 1, and T.INV(1−α/2, ν) in place of Z." },
  { id: "h0-setup", name: "Setting up H₀ from the wording", learn: "ht-logic", practice: "ht", task: "\"More than\" is a right tail, \"less than\" a left tail, \"different\" two tails; the claim goes in H_A." },
  { id: "stat", name: "Computing the test statistic", learn: "ht-logic", practice: "ht", task: "x̄ and s from the data, SE, then (x̄ − μ₀)/SE; Z if σ is given, T if not." },
  { id: "pvalue", name: "p-values and the sign rule", learn: "twelve", practice: "case:eq-unknown-p", task: "Left .DIST(stat), right 1 − .DIST(stat), two tails 2 × the smaller tail, chosen by the sign." },
  { id: "crit", name: "Critical values and decisions", learn: "twelve", practice: "case:le-unknown-crit", task: ".INV(1−α), .INV(α) or ±.INV(1−α/2), then reject only when the statistic is past it." },
];
export const skillById = (id: SkillId) => SKILLS.find((s) => s.id === id)!;

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
export type DiagnosticResult = { ts: number; scores: SkillScore[]; correct: number; total: number };

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
  const scores = SKILLS.map((s) => {
    const t = tally.get(s.id)!;
    return { id: s.id, correct: t.c, total: t.t, level: levelOf(t.c, t.t) };
  });
  return { ts: Date.now(), scores, correct, total };
}

// ---------- the plan ----------
export type PlanTask = { label: string; href: string; kind: "learn" | "practice" | "check" | "tutor"; tutorPrompt?: string };
export type PlanDay = { date: string; title: string; why: string; skills: SkillId[]; tasks: PlanTask[] };

/** Lower-case the first letter only, so NORM.INV and H₀ survive. */
export const lcFirst = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function skillTasks(ids: SkillId[], reps: number): PlanTask[] {
  const tasks: PlanTask[] = [];
  const learned = new Set<string>();
  for (const id of ids) {
    const s = skillById(id);
    if (!learned.has(s.learn)) {
      learned.add(s.learn);
      tasks.push({ kind: "learn", label: `Read the notes and worked example: ${lcFirst(s.name)}`, href: `#/learn/${s.learn}` });
    }
    tasks.push({ kind: "practice", label: `${reps} practice questions: ${lcFirst(s.name)}`, href: `#/practice/${s.practice}` });
  }
  return tasks;
}

/**
 * Builds the plan from today up to the day before the exam.
 * Focus days go to gaps then shaky skills (course order within each), two skills a day at most;
 * spare days revisit the weakest skills; the last two days are a mixed set and a retake.
 */
export function buildPlan(result: DiagnosticResult, today = new Date(), exam = examDate()): PlanDay[] {
  const [ey, em, ed] = exam.split("-").map(Number);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.max(1, Math.round((new Date(ey, em - 1, ed).getTime() - start.getTime()) / 86_400_000)); // today .. day before the exam
  const order = (lvl: SkillScore["level"]) => result.scores.filter((s) => s.level === lvl).map((s) => s.id);
  const gaps = order("gap"), shaky = order("shaky"), strong = order("strong");
  const weak = [...gaps, ...shaky];

  const endDays = days >= 4 ? 2 : days >= 2 ? 1 : 0;
  const focusDays = Math.max(0, days - endDays);
  const slots: SkillId[][] = [];

  if (focusDays > 0 && weak.length > 0) {
    // Pack weak skills into the focus days: one per day when there is room, otherwise two.
    const perDay = weak.length > focusDays ? 2 : 1;
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
  const level = (id: SkillId) => result.scores.find((s) => s.id === id)!;

  slots.forEach((ids, i) => {
    const seen = Math.max(0, ...ids.map((id) => plan.filter((p) => p.skills.includes(id)).length));
    const firstPass = seen === 0;
    const lv = ids.map(level);
    const why = lv.map((s) => `${skillById(s.id).name}: ${s.correct} of ${s.total} right in the diagnostic`).join(" · ");
    const isWarm = lv.every((s) => s.level === "strong");
    plan.push({
      date: day(i),
      title: isWarm ? `Keep it warm: ${ids.map((id) => skillById(id).name).join(" and ")}` : `${firstPass ? "" : seen === 1 ? "Second pass: " : "Review: "}${ids.map((id) => skillById(id).name).join(" and ")}`,
      why: isWarm ? `You did well on ${ids.length > 1 ? "these" : "this"}. A short set keeps ${ids.length > 1 ? "them" : "it"} fresh.` : why,
      skills: ids,
      tasks: [
        ...skillTasks(ids, isWarm ? 3 : firstPass ? 5 : 4),
        ...(isWarm ? [] : [{ kind: "tutor" as const, label: "Stuck? Ask the tutor to quiz you on it", href: "#/tutor", tutorPrompt: `Quiz me on ${ids.map((id) => lcFirst(skillById(id).name)).join(" and ")}, one question at a time, exam style, using the class's Excel functions.` }]),
      ],
    });
  });

  if (endDays >= 2) {
    plan.push({
      date: day(plan.length), title: "Mixed exam practice", why: "The exam mixes topics, so practise switching between them.",
      skills: [], tasks: [
        { kind: "practice", label: "8 mixed questions, all topics", href: "#/practice/mixed" },
        { kind: "learn", label: "Skim the 12 hypothesis test questions grid", href: "#/learn/twelve" },
      ],
    });
  }
  if (endDays >= 1) {
    plan.push({
      date: day(plan.length), title: "Retake the diagnostic and review", why: "Check what moved, and spend the rest of the time on anything still marked as a gap.",
      skills: [], tasks: [
        { kind: "check", label: "Retake the diagnostic (about 25 minutes)", href: "#/plan/check" },
        { kind: "learn", label: "Read the mistakes list for any topic still weak", href: "#/learn" },
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
