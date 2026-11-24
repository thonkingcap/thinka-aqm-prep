// Every diagnostic: the answer key is proved, the workbook round-trips through the .xlsx writer and
// reader, a blank copy scores 0, a perfect copy (with the example simulation) scores full marks, a wrong
// number loses marks, and the Word paper builds from the professor's template.
//   node --experimental-strip-types src/lib/diag/diag.test.ts [path/to/one-paper.ts]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { allDiags } from "./index.ts";
import { checkPaper, gradeDiag } from "./mark.ts";
import { paperSheets, paperPoints, wordPaper, type DPaper } from "./kit.ts";
import { buildXlsx } from "../xlsx.ts";
import { readXlsx } from "../xlsxRead.ts";
import { buildPaperDocx } from "../docx.ts";
import { evaluateAny } from "../excel.ts";

let papers: DPaper[] = allDiags();
if (process.argv[2]) {
  const mod = await import(pathToFileURL(resolve(process.argv[2])).href);
  papers = Object.values(mod).filter((v): v is DPaper => !!v && typeof v === "object" && "sections" in (v as object) && "instructions" in (v as object));
}
const template = new Uint8Array(readFileSync(new URL("../../../public/exam-paper-template.docx", import.meta.url)));
let fails = 0;
const bad = (m: string) => { fails++; if (fails < 60) console.log("FAIL", m); };
for (const P of papers) {
  for (const e of checkPaper(P)) bad(e);
  const wb = readXlsx(buildXlsx(paperSheets(P), { title: P.header, id: P.id, look: "exam" }));
  if (wb.thinkaId !== P.id) bad(`${P.id}: id didn't survive the round trip (${wb.thinkaId})`);
  for (const s of P.sections) if (!wb.sheets[s.tab]) bad(`${P.id}: tab "${s.tab}" missing after round trip`);
  const blank = gradeDiag(wb, P);
  if (blank.got !== 0) bad(`${P.id}: blank copy scored ${blank.got}`);
  // A perfect student: their simulation = the example, every answer cell right.
  const perfect = structuredClone(wb);
  for (const s of P.sections) {
    const sh = perfect.sheets[s.tab];
    for (const [a, c] of Object.entries(s.example ?? {})) if (c.v !== undefined) sh[a] = c.v as number | string;
    for (const q of s.questions) for (const p of q.parts) sh[p.cell] = typeof p.answer === "number" ? p.answer : p.answer === "Reject H₀" ? "R" : p.answer === "Do not reject H₀" ? "DR" : p.answer;
  }
  const g = gradeDiag(perfect, P);
  if (Math.abs(g.got - g.total) > 1e-9) {
    bad(`${P.id}: perfect copy scored ${g.got}/${g.total}`);
    for (const q of g.questions) for (const p of q.parts) if (!p.ok) bad(`  ${q.q.title} ${p.cell} ${p.part.label}: ${p.status} (${p.mine} vs ${p.answer})`);
  }
  const marked = P.sections.flatMap((s) => s.questions).filter((q) => q.parts.length).reduce((t, q) => t + q.points, 0);
  if (Math.abs(g.total - marked) > 1e-9) bad(`${P.id}: marked total ${g.total} ≠ points of marked questions ${marked}`);
  // A wrong number in the first numeric fixed part loses exactly that part's share.
  const target = P.sections.flatMap((s) => s.questions.flatMap((q) => q.parts.filter((p) => !p.live && typeof p.answer === "number").map((p) => ({ s, q, p }))))[0];
  if (target) {
    const wrong = structuredClone(perfect);
    wrong.sheets[target.s.tab][target.p.cell] = (target.p.answer as number) * 1.37 + 11.3;
    const gw = gradeDiag(wrong, P);
    const share = target.q.points / target.q.parts.length;
    if (Math.abs(g.got - gw.got - share) > 1e-9) bad(`${P.id}: a wrong number cost ${g.got - gw.got}, expected ${share}`);
  }
  // Live parts follow the student's own numbers: a different simulation (the example, nudged) still marks right.
  if (P.sections.some((s) => s.example)) {
    const other = structuredClone(perfect);
    for (const s of P.sections) {
      if (!s.example) continue;
      const sh = other.sheets[s.tab];
      for (const [a, c] of Object.entries(s.example)) if (typeof c.v === "number") sh[a] = Number.isInteger(c.v) ? c.v : c.v * 1.004;
      const get = (a: string) => { const v = sh[a]; return v === undefined || v === null || v === "" ? null : typeof v === "boolean" ? (v ? 1 : 0) : v; };
      for (let pass = 0; pass < 3; pass++) for (const q of s.questions) for (const p of q.parts) if (p.live) {
        try { const v = evaluateAny(p.formula, { get }); sh[p.cell] = typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : v; } catch { /* a later pass fills its inputs */ }
      }
    }
    const go = gradeDiag(other, P);
    for (const q of go.questions) for (const p of q.parts) if (!p.ok && P.sections.some((s) => s.questions.some((x) => x.parts.some((y) => y.live && y.cell === p.cell && x.n === Number(q.q.title.slice(1, q.q.title.indexOf("."))))))) bad(`${P.id} ${q.q.title} ${p.cell}: a different simulation was marked ${p.status} (${p.mine} vs ${p.answer})`);
  }
  try { buildPaperDocx({ ...wordPaper(P), instructions: P.instructions }, template); } catch (e) { bad(`${P.id}: Word paper failed: ${(e as Error).message}`); }
  console.log(`  ${P.id}: ${P.sections.length} sections, ${paperPoints(P)} points (${marked} marked by the site), ${P.minutes} minutes`);
}
console.log(`${fails ? "FAILED" : "PASS"}: ${papers.length} diagnostics, ${fails} problems`);
if (fails) process.exit(1);
