// Marking an uploaded diagnostic, and proving a paper's answer key (for the tests and for authors).
import type { ReadWorkbook, CellVal } from "../xlsxRead.ts";
import type { Question, QuestionKind, TopicId } from "../practice.ts";
import { gradeCell, type PartGrade, type QuestionGrade, type WorkbookGrade } from "../grade.ts";
import { evaluateAny } from "../excel.ts";
import { matchChoice } from "../workbook.ts";
import { partId, toGradePart, tolFor } from "../lessons/kit.ts";
import { paperSheets, paperPoints, type DPaper, type DPart } from "./kit.ts";

type Get = (addr: string) => number | string | null;
const asCtx = (cells: Record<string, CellVal> | undefined): Get => (a) => {
  const v = cells?.[a];
  if (v === undefined || v === null || v === "") return null;
  return typeof v === "boolean" ? (v ? 1 : 0) : v;
};

export function gradeDiag(wb: ReadWorkbook, P: DPaper): WorkbookGrade {
  const notes: string[] = [];
  const questions: QuestionGrade[] = [];
  let liveTrouble = false;
  for (const s of P.sections) {
    const cells = wb.sheets[s.tab] ?? wb.sheets[wb.sheetOrder.find((n) => n.trim().toLowerCase() === s.tab.toLowerCase()) ?? ""];
    const get = asCtx(cells);
    for (const q of s.questions) {
      if (!q.parts.length) continue;
      const per = q.points / q.parts.length;
      const parts: PartGrade[] = q.parts.map((p, k) => {
        const part = toGradePart(p, partId(k));
        let gp = part;
        if (p.live) {
          // Their own numbers decide the right answer.
          let want: number | string | boolean;
          if (p.liveCheck) {
            let ready = false;
            try { const v = evaluateAny(p.liveCheck, { get }); ready = v === true || v === 1 || v === "TRUE"; } catch { /* not ready */ }
            if (!ready) { liveTrouble = true; return { ok: false, status: "wrong" as const, mine: cells?.[p.cell] === undefined ? "Blank" : String(cells?.[p.cell]), answer: "Put in your own simulated numbers first: this is worked out from them", part, cell: p.cell, points: per, got: 0 }; }
          }
          try { want = evaluateAny(p.formula, { get }); } catch { liveTrouble = true; return { ok: false, status: "error" as const, mine: cells?.[p.cell] === undefined ? "Blank" : String(cells?.[p.cell]), answer: "Simulate the numbers first, then this is worked out from them", part, cell: p.cell, points: per, got: 0 }; }
          if (typeof want === "number" && p.band && (want < p.band[0] || want > p.band[1])) {
            liveTrouble = true;
            return { ok: false, status: "wrong" as const, mine: String(cells?.[p.cell] ?? "Blank"), answer: `Your simulated numbers don't look right: this should be between ${p.band[0]} and ${p.band[1]}`, part, cell: p.cell, points: per, got: 0 };
          }
          gp = { ...part, answer: typeof want === "boolean" ? (want ? "TRUE" : "FALSE") : want, traps: undefined };
        }
        let r = gradeCell(cells?.[p.cell], gp);
        const liveAlts: number[] = [];
        if (p.live) for (const f of p.altFormulas ?? []) { try { const v = evaluateAny(f, { get }); if (typeof v === "number") liveAlts.push(v); } catch { /* skip */ } }
        for (const alt of [...(p.alts ?? []), ...liveAlts]) {
          if (r.ok || r.status === "blank" || r.status === "nocache") break;
          const ra = gradeCell(cells?.[p.cell], { ...gp, answer: alt, traps: undefined });
          if (ra.ok) r = { ...ra, answer: r.answer };
        }
        return { ...r, part: gp, cell: p.cell, points: per, got: r.ok ? per : 0 };
      });
      for (const x of parts) {
        const need = q.parts.find((p) => p.cell === x.cell)?.requires;
        const dep = need ? parts.find((y) => y.cell === need) : undefined;
        if (dep && !dep.ok && x.ok) Object.assign(x, { ok: false, got: 0, status: "wrong", answer: `Only counts once your ${dep.part.label.toLowerCase()} (${dep.cell}) is right: check your simulation first` });
      }
      const question: Question = {
        id: `${P.id}-q${q.n}`, seed: 0, kind: "concept" as QuestionKind, topic: `lesson:${q.lesson}` as TopicId,
        title: `Q${q.n}. ${q.title}`, prompt: q.title, parts: parts.map((x) => x.part),
      };
      questions.push({ q: question, index: q.n - 1, section: s.title, sheetFound: !!cells, parts, got: parts.reduce((t, x) => t + x.got, 0), total: q.points });
    }
  }
  const missing = P.sections.filter((s) => !wb.sheets[s.tab]).map((s) => s.tab);
  if (missing.length) notes.push(`These tabs weren't found: ${missing.join(", ")}. Don't rename the sheets (the exam rules say the same).`);
  if (questions.some((q) => q.parts.some((p) => p.status === "nocache"))) notes.push("Some cells have formulas with no saved result. Open the file in Excel, let it calculate, save, and upload again.");
  if (liveTrouble) notes.push("Simulation answers are checked against your own simulated numbers. If those are missing or don't match the distribution in the question, the answers built on them can't get the marks.");
  const rounded = questions.reduce((t, q) => t + q.parts.filter((p) => p.roundedTo !== undefined).length, 0);
  if (rounded) notes.push(`${rounded} answer${rounded === 1 ? " was" : "s were"} right but rounded, so marked wrong, as on the exam ("do not round numerical answers").`);
  const unmarked = P.sections.flatMap((s) => s.questions.filter((q) => q.unmarked));
  if (unmarked.length) notes.push(`Not marked by the site: ${unmarked.map((q) => `Q${q.n}`).join(", ")} (${unmarked.reduce((t, q) => t + q.points, 0)} of the paper's ${paperPoints(P)} points: charts and Toolpak output). Check them against the answer key's notes.`);
  return { kind: "lesson", n: 0, id: P.id, title: P.title, questions, got: questions.reduce((t, q) => t + q.got, 0), total: questions.reduce((t, q) => t + q.total, 0), notes };
}

/** Proves a paper: every key formula, evaluated on the key sheet (with the example simulation), gives its answer. */
export function checkPaper(P: DPaper): string[] {
  const errs: string[] = [];
  const e = (m: string) => errs.push(`${P.id}: ${m}`);
  const key = paperSheets(P, true).slice(1);
  const nums = new Set<number>();
  P.sections.forEach((s, si) => {
    const sheet = key[si];
    const all = s.questions.flatMap((q) => q.parts);
    const byCell = new Map<string, DPart>(all.map((p) => [p.cell, p]));
    if (byCell.size !== all.length) e(`${s.tab}: two parts share an answer cell`);
    for (const a of Object.keys(s.cells)) if (byCell.has(a)) e(`${s.tab} ${a}: answer cell also holds content`);
    for (const a of Object.keys(s.cells)) if (/^A\d+$/.test(a)) e(`${s.tab} ${a}: column A is kept empty`);
    const qNums = s.items.filter((it) => it.kind === "q").map((it) => (it as { n: number }).n);
    for (const q of s.questions) {
      if (nums.has(q.n)) e(`question ${q.n} appears twice`);
      nums.add(q.n);
      if (!qNums.includes(q.n)) e(`Q${q.n} is in ${s.tab}'s questions but not in its Word items`);
      const it = s.items.find((x) => x.kind === "q" && x.n === q.n) as { points: number } | undefined;
      if (it && it.points !== q.points) e(`Q${q.n}: Word paper says [${it.points}] but the question is worth ${q.points}`);
      if (!q.parts.length && !q.unmarked) e(`Q${q.n}: no answer cells and not flagged unmarked`);
    }
    const memo = new Map<string, number | string | null>();
    const busy = new Set<string>();
    const get = (addr: string): number | string | null => {
      if (memo.has(addr)) return memo.get(addr)!;
      const p = byCell.get(addr);
      if (!p) { const v = sheet.cells[addr]?.v; return v === undefined ? null : (v as number | string); }
      if (busy.has(addr)) throw new Error(`circular reference through ${addr}`);
      busy.add(addr);
      try {
        const lit = /^"(.*)"$/.exec(p.formula.trim());
        const v = lit ? lit[1] : evaluateAny(p.formula, { get });
        const out = typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : v;
        memo.set(addr, out); return out;
      } finally { busy.delete(addr); }
    };
    for (const q of s.questions) for (const p of q.parts) {
      const where = `${s.tab} Q${q.n} ${p.cell} (${p.label})`;
      if (/\bRAND(BETWEEN)?\s*\(/i.test(p.formula)) { e(`${where}: RAND in an answer formula`); continue; }
      if (p.live && !s.example) { e(`${where}: live part but the section has no example simulation`); continue; }
      if (p.liveCheck) { try { const v = evaluateAny(p.liveCheck, { get }); if (!(v === true || v === 1 || v === "TRUE")) e(`${where}: liveCheck is false on the example simulation`); } catch (x) { e(`${where}: liveCheck → ${(x as Error).message}`); } }
      for (const f of p.altFormulas ?? []) { try { if (typeof evaluateAny(f, { get }) !== "number") e(`${where}: alternative formula ${f} isn't a number`); } catch (x) { e(`${where}: alternative formula ${f} → ${(x as Error).message}`); } }
      if (p.tone === "blue" && /^".*"$/.test(p.formula.trim())) e(`${where}: blue cells need a formula, not a typed answer`);
      let got: number | string | null;
      try { got = get(p.cell); } catch (x) { e(`${where}: ${p.formula} → ${(x as Error).message}`); continue; }
      if (p.options) {
        if (!p.options.includes(String(p.answer))) e(`${where}: answer "${p.answer}" not in options`);
        if (matchChoice(String(got), p.options) !== p.answer) e(`${where}: key gives "${got}", answer is "${p.answer}"`);
      } else {
        if (typeof got !== "number" || typeof p.answer !== "number") { e(`${where}: key gives ${JSON.stringify(got)}, answer ${p.answer}`); continue; }
        const tol = tolFor(p);
        if (Math.abs(got - p.answer) > Math.max(tol, 1e-9 * Math.abs(p.answer)) + 1e-12) e(`${where}: key gives ${got}, answer is ${p.answer}`);
        if (p.band && (p.answer < p.band[0] || p.answer > p.band[1])) e(`${where}: the example's value ${p.answer} is outside its own band`);
        for (const t of p.traps ?? []) if (Math.abs(t.value - p.answer) <= tol * 1.5) e(`${where}: trap "${t.why}" equals the answer`);
      }
      if (!p.explain?.trim()) e(`${where}: no explanation`);
      if (p.requires && !q.parts.some((x) => x.cell === p.requires)) e(`${where}: requires ${p.requires}, which isn't a part of this question`);
    }
  });
  const want = [...nums].sort((a, b) => a - b);
  want.forEach((n, i) => { if (n !== i + 1) e(`questions should be numbered 1…${want.length} in order (found ${want.join(",")})`); });
  return [...new Set(errs)];
}
