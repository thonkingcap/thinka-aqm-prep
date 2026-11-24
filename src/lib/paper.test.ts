// Practice exams in the Exam 3 format: every answer-key formula, evaluated by the site's Excel engine,
// must give the paper's answer; a workbook filled with those values must be marked full marks; a blank
// one zero; and the Word paper must build from the template.
import { readFileSync } from "node:fs";
import { paper, PAPER_COUNT, DIAG_PAPER, PAPER_TABS, plain } from "./paper.ts";
import { evaluate } from "./excel.ts";
import { buildXlsx } from "./xlsx.ts";
import { readXlsx } from "./xlsxRead.ts";
import { gradeWorkbook } from "./grade.ts";
import { buildPaperDocx } from "./docx.ts";
import { unzipSync, strFromU8 } from "fflate";
import type { SheetModel } from "./workbook.ts";

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log("FAIL", m); } };

/** Evaluates a key tab's formulas (cells may refer to other formula cells). */
function evalSheet(s: SheetModel): (addr: string) => number | string | null {
  const memo = new Map<string, number | string | null>();
  const get = (addr: string): number | string | null => {
    if (memo.has(addr)) return memo.get(addr)!;
    const c = s.cells[addr];
    let v: number | string | null = c?.v ?? null;
    if (c?.f) {
      const m = /^=IF\((\w+)<(\w+),"R","DR"\)$/.exec(c.f);
      v = m ? ((get(m[1]) as number) < (get(m[2]) as number) ? "R" : "DR") : evaluate(c.f, { get });
    }
    memo.set(addr, v);
    return v;
  };
  return get;
}

const template = new Uint8Array(readFileSync(new URL("../../public/exam-paper-template.docx", import.meta.url)));
for (const n of [...Array.from({ length: PAPER_COUNT }, (_, k) => k + 1), DIAG_PAPER]) {
  const P = paper(n)!;
  ok(P === paper(n), `paper ${n} is cached/deterministic`);
  ok(P.questions.length === 15 && P.questions.reduce((s, q) => s + q.points, 0) === 43, `paper ${n}: 15 questions, 43 points`);
  ok(!P.questions.some((q) => /expectation/i.test(q.text)), `paper ${n}: no expectation question`);
  ok(P.questions.some((q) => q.kind === "var-test") && P.questions.some((q) => q.kind === "two-z") && P.questions.some((q) => q.kind === "two-t") && P.questions.some((q) => q.kind === "paired"), `paper ${n}: chi-squared and all three two-sample tests`);

  // Key formulas give the answers.
  const gets = P.key.map(evalSheet);
  const filled: SheetModel[] = P.sheets.map((s) => ({ ...s, cells: { ...s.cells } }));
  for (const q of P.questions) {
    for (const sp of q.specs) {
      if (!sp.cell) continue;
      const got = gets[q.section](sp.cell);
      if (sp.kind === "number") {
        const want = sp.answer as number;
        ok(typeof got === "number" && Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want)), `paper ${n} Q${q.n} ${sp.label}: key gives ${got}, answer ${want}`);
      } else if (sp.kind === "choice") {
        ok(got === (String(sp.answer).startsWith("Reject") ? "R" : "DR"), `paper ${n} Q${q.n} decision: key ${got}, answer ${sp.answer}`);
      }
      filled[q.section].cells[sp.cell] = { ...filled[q.section].cells[sp.cell], v: typeof got === "number" || typeof got === "string" ? got : undefined };
    }
  }
  // Section 1 intervals are free-form: put them beside the question, as a student would.
  for (const [k, addrs] of [[1, ["H3", "H4"]], [4, [`H${P.starts[4][1]}`, `H${P.starts[4][1] + 1}`]], [5, [`H${P.starts[5][1]}`, `H${P.starts[5][1] + 1}`]]] as const) {
    P.questions[k - 1].specs.forEach((sp, i) => {
      ok(Math.abs((gets[0](addrs[i]) as number) - (sp.answer as number)) < 1e-9, `paper ${n} Q${k} key interval ${sp.label}`);
      filled[0].cells[addrs[i]] = { v: sp.answer as number };
    });
  }

  const g = gradeWorkbook(readXlsx(buildXlsx(filled, { title: P.title, id: P.id, look: "exam" })));
  const numeric = g.questions.reduce((s, q) => s + q.parts.filter((p) => p.status !== "written").reduce((t, p) => t + p.points, 0), 0);
  const gotNumeric = g.questions.reduce((s, q) => s + q.parts.filter((p) => p.status !== "written").reduce((t, p) => t + p.got, 0), 0);
  ok(g.kind === "paper" && Math.abs(gotNumeric - numeric) < 1e-9, `paper ${n}: filled workbook marked ${gotNumeric}/${numeric} on the non-written parts`);
  for (const q of g.questions) for (const p of q.parts) if (!p.ok && p.status !== "written") console.log("   wrong:", n, q.index + 1, p.part.label, p.mine, p.answer, p.cell);
  const blank = gradeWorkbook(readXlsx(buildXlsx(P.sheets, { title: P.title, id: P.id, look: "exam" })));
  ok(blank.got === 0 && blank.total === 43, `paper ${n}: blank workbook marked 0/43 (got ${blank.got}/${blank.total})`);
  ok(PAPER_TABS.every((t) => readXlsx(buildXlsx(P.sheets, { title: P.title, id: P.id, look: "exam" })).sheetOrder.includes(t)), `paper ${n}: exactly the professor's four tabs`);

  // Word paper.
  const doc = strFromU8(unzipSync(buildPaperDocx(P, template))["word/document.xml"]);
  const words = doc.replace(/<[^>]+>/g, "");
  ok((doc.match(/<w:numId w:val="8"\/>/g) ?? []).length === 15, `paper ${n}: 15 numbered questions in the Word paper`);
  ok(words.includes("End of exam") && words.includes(plain(P.questions[14].text)), `paper ${n}: Word paper has every question`);
  ok(doc.includes("txbx") && /<w:sectPr[\s\S]*w:orient="landscape"/.test(doc), `paper ${n}: formula box and landscape page kept`);
}

console.log(fails ? `FAILED: practice exams, ${fails} failure(s)` : `PASS: practice exams, ${PAPER_COUNT} papers + the Unit 2 diagnostic`);
if (fails) process.exit(1);
