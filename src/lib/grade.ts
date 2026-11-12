// Grades an uploaded workbook: identifies which mock exam or problem set it is (from the id the
// download carries), regenerates that exam's questions from their fixed seeds, and checks every
// yellow answer cell with the same rules as the site.
import type { ReadWorkbook, CellVal } from "./xlsxRead.ts";
import { gradeNumber, type Part, type Question } from "./practice.ts";
import { setQuestions, setSheets, questionSheet, matchChoice, SET_COUNT, type SheetModel } from "./workbook.ts";
import { mockExam, MOCK_COUNT, POINTS_PER_PART } from "./mock.ts";
import { fmtNumber } from "./format.ts";
import { DIAGNOSTIC, DIAG_SEED_MAX, diagnosticQuestions } from "./plan.ts";
import { workbookById, workbookSheets } from "./sets.ts";

export type PartGrade = {
  part: Part;
  cell: string;
  ok: boolean;
  status: "right" | "wrong" | "blank" | "nocache" | "error" | "written";
  /** For a wrong number: the slip it matches, if any. */
  slip?: string;
  roundedTo?: number;
  mine: string;
  answer: string;
  points: number;
  got: number;
};
export type QuestionGrade = { q: Question; index: number; section?: string; sheetFound: boolean; parts: PartGrade[]; got: number; total: number };
export type WorkbookKind = "mock" | "set" | "diag" | "topic" | "mix" | "exam" | "spec";
export type WorkbookGrade = { kind: WorkbookKind; n: number; id: string; title: string; questions: QuestionGrade[]; got: number; total: number; notes: string[] };

export function identify(id: string | null): { kind: WorkbookKind; n: number } | null {
  const raw = (id ?? "").trim();
  if (workbookById(raw)) {
    const k = raw.split(":")[0] as WorkbookKind;
    const n = Number(/:(\d+)$/.exec(raw)?.[1] ?? 0);
    return { kind: k, n };
  }
  const m = /^(mock|set|diag):(\d+)$/.exec(raw);
  if (!m) return null;
  const n = Number(m[2]);
  if (m[1] === "diag") return n >= 0 && n < DIAG_SEED_MAX ? { kind: "diag", n } : null;
  const max = m[1] === "mock" ? MOCK_COUNT : SET_COUNT;
  return n >= 1 && n <= max ? { kind: m[1] as WorkbookKind, n } : null;
}

const showAnswer = (p: Part) => (typeof p.answer === "string" ? p.answer : fmtNumber(p.answer, p.format));

function gradeCell(v: CellVal | undefined, p: Part): Omit<PartGrade, "part" | "cell" | "points" | "got"> {
  const answer = showAnswer(p);
  if (v === undefined || v === "") return { ok: false, status: "blank", mine: "Blank", answer };
  if (v === null) return { ok: false, status: "nocache", mine: "A formula with no saved result", answer };
  if (typeof v === "string" && v.startsWith("#")) return { ok: false, status: "error", mine: `Excel error ${v}`, answer };
  if (p.kind === "text") {
    const text = String(v).trim();
    return { ok: false, status: "written", mine: text, answer };
  }
  if (p.kind === "choice") {
    const picked = matchChoice(String(v), p.options!);
    return { ok: picked === p.answer, status: picked === p.answer ? "right" : "wrong", mine: picked ?? String(v), answer };
  }
  const input = typeof v === "number" ? String(v) : typeof v === "boolean" ? (v ? "1" : "0") : v;
  const g = gradeNumber(input, p);
  // A number typed into the cell keeps its digits; show it as typed so a rounded answer is visible.
  const mine = g.value === null ? String(v) : g.roundedTo !== undefined ? String(v) : fmtNumber(g.value, p.format);
  const slip = !g.ok && g.value !== null && g.roundedTo === undefined ? diagnose(g.value, p) : undefined;
  return { ok: g.ok, status: g.ok ? "right" : g.value === null ? "error" : "wrong", mine, answer, roundedTo: g.roundedTo, ...(slip ? { slip } : {}) };
}

/** Names the likely slip behind a wrong number, when it matches one of the part's traps. */
export function diagnose(value: number, p: Part): string | undefined {
  const tol = p.tol ?? 0.001;
  let best: { d: number; why: string } | undefined;
  for (const t of p.traps ?? []) {
    if (!Number.isFinite(t.value)) continue;
    const d = Math.abs(value - t.value);
    if (d <= Math.max(tol, 1e-9 * Math.abs(t.value)) * 1.5 && (!best || d < best.d)) best = { d, why: t.why };
  }
  return best?.why;
}

export function gradeWorkbook(wb: ReadWorkbook): WorkbookGrade {
  const who = identify(wb.thinkaId);
  if (!who) {
    throw new Error(wb.thinkaId
      ? "This workbook is from a mock exam, problem set or diagnostic the site doesn't recognise. Download it again from the site."
      : "This doesn't look like a workbook downloaded from Thinka's AQM Prep: its \"Start here\" tab is missing its id. Download a fresh copy and copy your answers into it.");
  }
  let questions: Question[], sheets: SheetModel[], sections: (string | undefined)[], title: string, perPart: number;
  const def = workbookById((wb.thinkaId ?? "").trim());
  if (def) {
    questions = def.questions; sheets = workbookSheets(def); sections = def.sections; title = def.title; perPart = def.pointsPerPart;
  } else if (who.kind === "mock") {
    const m = mockExam(who.n);
    questions = m.questions; sheets = m.sheets; sections = m.sections; title = m.title; perPart = POINTS_PER_PART;
  } else if (who.kind === "diag") {
    questions = diagnosticQuestions(who.n); sheets = questions.map((q, i) => questionSheet(q, i + 1));
    sections = DIAGNOSTIC.map((d) => d.label); title = "Diagnostic"; perPart = 1;
  } else {
    questions = setQuestions(who.n); sheets = setSheets(who.n); sections = questions.map(() => undefined); title = `Problem set ${who.n}`; perPart = 1;
  }

  const notes: string[] = [];
  const graded: QuestionGrade[] = questions.map((q, i) => {
    const sheet = sheets[i];
    const cells = wb.sheets[sheet.name];
    const parts: PartGrade[] = q.parts.map((p) => {
      const cell = sheet.answerCells[p.id];
      const r = gradeCell(cells?.[cell], p);
      return { ...r, part: p, cell, points: perPart, got: r.ok ? perPart : 0 };
    });
    const got = parts.reduce((s, x) => s + x.got, 0);
    return { q, index: i, section: sections[i], sheetFound: !!cells, parts, got, total: parts.length * perPart };
  });

  const missingTabs = graded.filter((g) => !g.sheetFound).map((g) => sheets[g.index].name);
  if (missingTabs.length) notes.push(`These tabs weren't in the file: ${missingTabs.join(", ")}. Don't rename or delete the question tabs.`);
  if (graded.some((g) => g.parts.some((p) => p.status === "nocache"))) {
    notes.push("Some answer cells have formulas with no saved result. Open the file in Excel (or Google Sheets), let it calculate, save, and upload again.");
  }
  const rounded = graded.reduce((s, g) => s + g.parts.filter((p) => p.roundedTo !== undefined).length, 0);
  const written = graded.reduce((s, g) => s + g.parts.filter((p) => p.status === "written").length, 0);
  if (written) notes.push(`${written} written answer${written === 1 ? " needs" : "s need"} marking: compare with the model answer below${" "}(or have Claude mark ${written === 1 ? "it" : "them"} if your key is added).`);
  if (rounded) notes.push(`${rounded} answer${rounded === 1 ? " was" : "s were"} right but rounded, so ${rounded === 1 ? "it was" : "they were"} marked wrong, as in class. Leave the formula (or the full value) in the yellow cell instead of typing a rounded number.`);
  const got = graded.reduce((s, g) => s + g.got, 0);
  const total = graded.reduce((s, g) => s + g.total, 0);
  return { kind: who.kind, n: who.n, id: (wb.thinkaId ?? "").trim(), title, questions: graded, got, total, notes };
}
