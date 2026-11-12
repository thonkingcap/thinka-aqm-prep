// Every downloadable workbook, by id. A workbook is a list of (generator, seed) slots, so the same id
// always rebuilds the same questions: that's how an uploaded file is regraded with nothing stored.
//
//   topic:<topic>:<v>   topic practice sets (fixed, 3 versions each)
//   mix:<n>             mixed problem sets covering the whole syllabus
//   exam:<n>            exam-style mocks laid out like last spring's Exam 3
//   spec:<base64url>    custom sets (built on the site, or designed by Claude on the student's key)
//   set:<n> mock:<n> diag:<seed>   older downloads, still graded (see grade.ts)
import { generate, generateCase, withScenarios, type Question, type QuestionKind, type Scenario } from "./practice.ts";
import { questionSheet, answerKeySheet, type SheetModel } from "./workbook.ts";

export type Slot = { kind: QuestionKind; seed: number; caseKey?: string };
export type WorkbookDef = {
  id: string;
  title: string;
  /** File name without .xlsx. */
  file: string;
  questions: Question[];
  sections: (string | undefined)[];
  pointsPerPart: number;
  minutes?: number;
  intro: string[];
};

const C = { typeI: 0, typeII: 1, pvalue: 2, alpha: 3, nMinus1: 4, biased: 5, tShape: 6, chiShape: 7, clt: 8, se: 9, zOrT: 10, agree: 11, outside: 12, dontReject: 13, paired: 14, tails: 15 };

function build(slots: Slot[], scenarios?: Scenario[]): Question[] {
  return withScenarios(scenarios, () => slots.map((s) => (s.caseKey ? generateCase(s.caseKey, s.seed, s.kind === "ht-full") : generate(s.kind, s.seed))));
}

// ---------- topic sets ----------
type TopicSet = { id: string; title: string; covers: string; slots: (v: number) => (Omit<Slot, "seed"> & { seed?: number })[] };
const pickV = <T,>(v: number, xs: T[]) => xs[(v - 1) % xs.length];
export const TOPIC_SETS: TopicSet[] = [
  { id: "normal", title: "The normal distribution", covers: "NORM.DIST for less/more/between, NORM.INV for percentiles, z-scores",
    slots: (v) => [{ kind: "normal-less" }, { kind: "normal-more" }, { kind: "normal-between" }, { kind: "normal-inverse" }, { kind: "zscore" }, { kind: "normal-inverse" }] },
  { id: "sampling", title: "The sample mean and the CLT", covers: "Standard error σ/√n, probabilities for x̄, where x̄ will land, the CLT in words",
    slots: (v) => [{ kind: "sample-mean" }, { kind: "xbar-range" }, { kind: "sample-mean" }, { kind: "xbar-range" }, { kind: "concept", seed: pickV(v, [C.clt, C.se, C.clt]) }] },
  { id: "intervals", title: "Confidence intervals (levels 1–3)", covers: "Level 1: μ and σ known; level 2: σ known; level 3: both unknown, with T.INV",
    slots: (v) => [{ kind: "xbar-range" }, { kind: "ci-z" }, { kind: "ci-t" }, { kind: "ci-z" }, { kind: "ci-t" }, { kind: "concept", seed: pickV(v, [C.outside, C.tShape, C.outside]) }] },
  { id: "one-sample", title: "Hypothesis tests for a mean", covers: "The 12 cases: Z or T, one or two tails, statistic, critical value, p-value, decision",
    slots: (v) => [
      { kind: "ht-full", caseKey: pickV(v, ["eq-known-p", "ge-known-p", "le-known-p"]) },
      { kind: "ht-full", caseKey: pickV(v, ["ge-unknown-p", "le-unknown-p", "eq-unknown-p"]) },
      { kind: "ht-full", caseKey: pickV(v, ["le-known-p", "eq-known-p", "ge-known-p"]) },
      { kind: "ht-full", caseKey: pickV(v, ["eq-unknown-p", "ge-unknown-p", "le-unknown-p"]) },
      { kind: "bernoulli" },
      { kind: "concept", seed: pickV(v, [C.zOrT, C.agree, C.tails]) },
      { kind: "concept", seed: pickV(v, [C.pvalue, C.typeI, C.dontReject]) },
    ] },
  { id: "variance", title: "Testing a variance (chi-squared)", covers: "VAR.S, (n − 1)S²/σ₀², CHISQ.DIST and CHISQ.INV, unbiased estimates",
    slots: (v) => [{ kind: "var-test" }, { kind: "var-test" }, { kind: "var-test" }, { kind: "concept", seed: pickV(v, [C.nMinus1, C.biased, C.nMinus1]) }, { kind: "concept", seed: C.chiShape }] },
  { id: "two-sample", title: "Two samples and paired data", covers: "Toolpak z-test (σ known), pooled t-test (equal variances), paired differences",
    slots: (v) => [{ kind: "two-z" }, { kind: "two-t" }, { kind: "paired" }, { kind: "two-t" }, { kind: "concept", seed: C.paired }] },
  { id: "concepts", title: "Definitions and explanations", covers: "The written parts: errors, p-values, α, bias, distribution shapes, the CLT",
    slots: (v) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ kind: "concept" as QuestionKind, seed: (i * 2 + v - 1) % 16 })) },
];
export const TOPIC_VERSIONS = 3;
/** Which topic set practises a question kind (for "practise this" links). */
export function topicForKind(kind: string): string {
  const k = kind.startsWith("case:") ? "ht-full" : kind;
  return TOPIC_SETS.find((t) => t.slots(1).some((s) => s.kind === k || (k === "ht" && s.kind === "ht-full")))?.id ?? "one-sample";
}

function topicSet(id: string, v: number): WorkbookDef | null {
  const t = TOPIC_SETS.find((x) => x.id === id);
  if (!t || !(v >= 1 && v <= TOPIC_VERSIONS)) return null;
  const base = 31_337 * (TOPIC_SETS.indexOf(t) + 1) + 104_729 * v;
  const slots = t.slots(v).map((s, i) => ({ ...s, seed: s.seed ?? base + 7_919 * (i + 1) }));
  return {
    id: `topic:${id}:${v}`, title: `${t.title} · set ${v}`, file: `AQM-${id}-set-${v}`,
    questions: build(slots), sections: slots.map(() => t.title), pointsPerPart: 1,
    intro: [`Covers: ${t.covers}.`],
  };
}

// ---------- mixed sets ----------
export const MIX_COUNT = 10;
const MIX: { kinds?: QuestionKind[]; cases?: string[] }[] = [
  { kinds: ["normal-more", "normal-between", "normal-less"] },
  { kinds: ["normal-inverse", "zscore"] },
  { kinds: ["sample-mean", "xbar-range"] },
  { kinds: ["ci-z", "xbar-range"] },
  { kinds: ["ci-t"] },
  { cases: ["eq-known-p", "ge-known-p", "le-known-p"] },
  { cases: ["ge-unknown-p", "eq-unknown-p", "le-unknown-p"] },
  { kinds: ["var-test"] },
  { kinds: ["two-t", "paired", "two-z"] },
  { kinds: ["concept"] },
];
function mixSet(n: number): WorkbookDef | null {
  if (!(n >= 1 && n <= MIX_COUNT)) return null;
  const slots: Slot[] = MIX.map((m, i) => {
    const seed = 100_019 * n + 6_101 * (i + 1);
    if (m.cases) return { kind: "ht-full", caseKey: m.cases[(n - 1) % m.cases.length], seed };
    const kind = m.kinds![(n - 1) % m.kinds!.length];
    return { kind, seed: kind === "concept" ? (n * 5) % 16 : seed };
  });
  return {
    id: `mix:${n}`, title: `Mixed problem set ${n}`, file: `AQM-mixed-set-${n}`,
    questions: build(slots), sections: slots.map(() => undefined), pointsPerPart: 1,
    intro: ["One question from every syllabus topic: normal, sample means, intervals, the tests for a mean, variance, two samples and a written part."],
  };
}

// ---------- exam-style mocks (laid out like Exam 3: CIs, HT I, HT II, two-sample) ----------
export const EXAM_COUNT = 6;
export const EXAM_MINUTES = 60;
type ExamSlot = { section: string; kind: QuestionKind; cases?: string[]; concept?: number[] };
const EXAM: ExamSlot[] = [
  { section: "1. Confidence intervals", kind: "xbar-range" },
  { section: "1. Confidence intervals", kind: "concept", concept: [C.outside, C.outside, C.outside, C.se, C.outside, C.clt] },
  { section: "1. Confidence intervals", kind: "ci-z" },
  { section: "1. Confidence intervals", kind: "ci-t" },
  { section: "2. Hypothesis testing I", kind: "ht-full", cases: ["eq-known-p", "le-known-p", "ge-known-p"] },
  { section: "2. Hypothesis testing I", kind: "ht-full", cases: ["ge-known-p", "eq-known-p", "le-known-p"] },
  { section: "3. Hypothesis testing II", kind: "ht-full", cases: ["ge-unknown-p", "le-unknown-p", "eq-unknown-p"] },
  { section: "3. Hypothesis testing II", kind: "concept", concept: [C.agree, C.zOrT, C.agree, C.typeI, C.agree, C.pvalue] },
  { section: "3. Hypothesis testing II", kind: "bernoulli" },
  { section: "3. Hypothesis testing II", kind: "var-test" },
  { section: "4. Two-sample tests", kind: "paired" },
  { section: "4. Two-sample tests", kind: "two-t" },
];
function examMock(n: number): WorkbookDef | null {
  if (!(n >= 1 && n <= EXAM_COUNT)) return null;
  const slots: Slot[] = EXAM.map((e, i) => {
    const seed = 700_001 * n + 4_271 * (i + 1);
    if (e.cases) return { kind: e.kind, caseKey: e.cases[(n - 1) % e.cases.length], seed };
    if (e.concept) return { kind: "concept", seed: e.concept[(n - 1) % e.concept.length] };
    // Alternate the last two-sample question so mocks cover both Toolpak tests.
    if (e.kind === "two-t" && n % 2 === 0) return { kind: "two-z", seed };
    return { kind: e.kind, seed };
  });
  return {
    id: `exam:${n}`, title: `Exam-style mock ${n}`, file: `AQM-exam-style-mock-${n}`,
    questions: build(slots), sections: EXAM.map((e) => e.section), pointsPerPart: 1, minutes: EXAM_MINUTES,
    intro: [`Laid out like last spring's Exam 3: four sections, ${EXAM_MINUTES} minutes, Excel only, no calculator. Time yourself.`],
  };
}

// ---------- custom sets ----------
export type CustomSpec = { t: string; q: [QuestionKind, number, string?][]; sc?: Scenario[] };
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
export const specId = (spec: CustomSpec) => `spec:${b64(JSON.stringify(spec))}`;
const KIND_OK = new Set<string>(["normal-less", "normal-more", "normal-between", "normal-inverse", "zscore", "sample-mean", "xbar-range", "ci-z", "ci-t", "ht", "ht-full", "var-test", "two-z", "two-t", "paired", "bernoulli", "concept"]);
function customSet(encoded: string): WorkbookDef | null {
  let spec: CustomSpec;
  try { spec = JSON.parse(unb64(encoded)) as CustomSpec; } catch { return null; }
  if (!spec || !Array.isArray(spec.q) || !spec.q.length || spec.q.length > 30) return null;
  const slots: Slot[] = [];
  for (const [kind, seed, caseKey] of spec.q) {
    if (!KIND_OK.has(kind) || !Number.isInteger(seed) || seed < 0) return null;
    slots.push({ kind, seed, ...(caseKey ? { caseKey } : {}) });
  }
  const sc = Array.isArray(spec.sc) ? spec.sc.map(cleanScenario).filter((x): x is Scenario => !!x) : undefined;
  let questions: Question[];
  try { questions = build(slots, sc); } catch { return null; }
  const title = String(spec.t || "Custom set").slice(0, 80);
  return {
    id: specId(spec), title, file: `AQM-${title.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "custom-set"}`,
    questions, sections: slots.map(() => undefined), pointsPerPart: 1,
    intro: ["A custom set. The numbers and the answer key are worked out by the site's verified stats engine."],
  };
}

/** Keeps a scenario (from Claude or a URL) inside ranges the generators handle. */
export function cleanScenario(x: unknown): Scenario | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const str = (k: string, max = 90) => (typeof o[k] === "string" ? (o[k] as string).replace(/[\u0000-\u001f]/g, "").trim().slice(0, max) : "");
  const rng = (k: string): [number, number, number] | null => {
    const r = o[k];
    if (!Array.isArray(r) || r.length !== 3 || !r.every((v) => typeof v === "number" && Number.isFinite(v))) return null;
    const [lo, hi, step] = r as number[];
    if (!(step > 0) || hi < lo || (hi - lo) / step > 1000) return null;
    return [lo, hi, step];
  };
  const mu = rng("mu"), sd = rng("sd");
  const dp = typeof o.dp === "number" ? Math.max(0, Math.min(2, Math.round(o.dp))) : 1;
  const sc: Scenario = { pop: str("pop", 140), quantity: str("quantity", 40), item: str("item", 40), items: str("items", 40), unit: str("unit", 16), owner: str("owner", 60), mu: mu!, sd: sd!, dp };
  if (!sc.pop || !sc.quantity || !sc.item || !sc.items || !sc.owner || !mu || !sd) return null;
  // The spread must be positive and small next to the mean, so samples stay sensible.
  if (sd[0] <= 0 || mu[0] <= 0 || sd[1] > mu[0] / 2) return null;
  if (str("prep", 6) === "on") sc.prep = "on";
  return sc;
}

// ---------- lookup ----------
export function workbookById(id: string): WorkbookDef | null {
  const t = /^topic:([a-z-]+):(\d+)$/.exec(id);
  if (t) return topicSet(t[1], Number(t[2]));
  const m = /^(mix|exam):(\d+)$/.exec(id);
  if (m) return m[1] === "mix" ? mixSet(Number(m[2])) : examMock(Number(m[2]));
  const s = /^spec:([A-Za-z0-9_-]+)$/.exec(id);
  if (s) return customSet(s[1]);
  return null;
}

export function workbookSheets(def: WorkbookDef): SheetModel[] {
  const sheets = def.questions.map((q, i) => {
    const m = questionSheet(q, i + 1);
    const pts = q.parts.length * def.pointsPerPart;
    m.cells.A1 = { v: `Q${i + 1}. ${def.sections[i] ? `${def.sections[i]} · ` : ""}${q.title} · ${pts} point${pts === 1 ? "" : "s"}`, role: "title" };
    return m;
  });
  return [...sheets, answerKeySheet(def.questions, sheets)];
}

export function workbookIntro(def: WorkbookDef): string[] {
  const total = def.questions.reduce((s, q) => s + q.parts.length * def.pointsPerPart, 0);
  return [
    ...def.intro,
    `${def.questions.length} questions, ${total} points. Each tab is one question; the numbers are already in their cells.`,
    "Work like the exam: Excel formulas pointing at the data cells, no calculator. Put each answer in its yellow cell as a formula (best) or the full, unrounded value.",
    "Multiple choice: type one of the options shown beside the cell (R or DR is fine for decisions). Written parts: type a few sentences in the yellow cell.",
    "Two-sample questions: use the Data Analysis Toolpak (Data › Data Analysis), then point the yellow cells at its output.",
    "The last tab is the answer key with every formula. Try the whole set first.",
    "Then save and upload the file on the site's Practice page: it marks every answer, names the likely slip on each wrong one, and lists what to redo.",
  ];
}
