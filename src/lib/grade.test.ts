// End to end: download a mock, fill it like a student would (with openpyxl standing in for Excel),
// read the uploaded file back and grade it.
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { buildXlsx } from "./xlsx.ts";
import { readXlsx } from "./xlsxRead.ts";
import { gradeWorkbook } from "./grade.ts";
import { mockExam, mockIntro, POINTS_PER_PART } from "./mock.ts";
import { setSheets, setQuestions } from "./workbook.ts";

import { OUT as DIR, PY, HAS_OPENPYXL } from "./testEnv.ts";
if (!HAS_OPENPYXL) { console.log("PASS (skipped: no Python with openpyxl; set THINKA_PYTHON)"); process.exit(0); }
let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log("FAIL", m); } };

// Mock 2: right answers everywhere except a few planted mistakes.
const m = mockExam(2);
writeFileSync(`${DIR}/mock2.xlsx`, buildXlsx(m.sheets, { title: m.title, intro: mockIntro(m), id: m.id }));
const fills: { sheet: string; cell: string; value: string | number }[] = [];
let expectedRight = 0, planted = 0, totalParts = 0;
m.questions.forEach((q, i) => {
  q.parts.forEach((p, k) => {
    totalParts++;
    const cell = m.sheets[i].answerCells[p.id];
    const sheet = m.sheets[i].name;
    if (i === 2 && k === 0) { planted++; return; } // left blank
    if (i === 4 && k === 0) { planted++; fills.push({ sheet, cell, value: "#DIV/0!" }); return; } // an error value as text
    if (i === 0 && k === 0) { planted++; fills.push({ sheet, cell, value: Number(p.answer) + 0.2 }); return; } // wrong number
    if (p.kind === "choice") {
      // Typed the way a student types in Excel.
      const typed = String(p.answer).replace("H₀", "H0").replace("μ", "mu").replace("≤", "<=").replace("≥", ">=");
      fills.push({ sheet, cell, value: typed });
    } else fills.push({ sheet, cell, value: Number(p.answer) });
    expectedRight++;
  });
});
writeFileSync(`${DIR}/fills.json`, JSON.stringify(fills));
execFileSync(PY, ["-I", "-c", `
import json, openpyxl
wb = openpyxl.load_workbook("${DIR}/mock2.xlsx")
for f in json.load(open("${DIR}/fills.json")):
    wb[f["sheet"]][f["cell"]] = f["value"]
wb.save("${DIR}/mock2-filled.xlsx")
`]);
const g = gradeWorkbook(readXlsx(new Uint8Array(readFileSync(`${DIR}/mock2-filled.xlsx`))));
ok(g.kind === "mock" && g.n === 2, "identified as mock 2");
ok(g.total === totalParts * POINTS_PER_PART, `total ${g.total}`);
ok(g.got === expectedRight * POINTS_PER_PART, `got ${g.got}, want ${expectedRight * POINTS_PER_PART}`);
const statuses = g.questions.flatMap((q) => q.parts.map((p) => p.status));
ok(statuses.filter((s) => s === "blank").length === 1, "one blank");
ok(statuses.filter((s) => s === "error").length === 1, "one Excel error");
ok(statuses.filter((s) => s === "wrong").length === 1, "one wrong");
console.log(`mock 2: ${g.got}/${g.total} (expected ${expectedRight * POINTS_PER_PART}), ${planted} planted mistakes caught`);

// Problem set 4: all right, and an untouched workbook scores 0.
const sheets = setSheets(4), qs = setQuestions(4);
writeFileSync(`${DIR}/set4.xlsx`, buildXlsx(sheets, { title: "Set 4", id: "set:4" }));
const empty = gradeWorkbook(readXlsx(new Uint8Array(readFileSync(`${DIR}/set4.xlsx`))));
ok(empty.kind === "set" && empty.got === 0, "empty set scores 0");
const fills2 = qs.flatMap((q, i) => q.parts.map((p) => ({ sheet: sheets[i].name, cell: sheets[i].answerCells[p.id], value: p.kind === "choice" ? String(p.answer) : Number(p.answer) })));
writeFileSync(`${DIR}/fills2.json`, JSON.stringify(fills2));
execFileSync(PY, ["-I", "-c", `
import json, openpyxl
wb = openpyxl.load_workbook("${DIR}/set4.xlsx")
for f in json.load(open("${DIR}/fills2.json")):
    wb[f["sheet"]][f["cell"]] = f["value"]
wb.save("${DIR}/set4-filled.xlsx")
`]);
const full = gradeWorkbook(readXlsx(new Uint8Array(readFileSync(`${DIR}/set4-filled.xlsx`))));
ok(full.got === full.total, `set 4 full marks ${full.got}/${full.total}`);

// Diagnostic: the id's base seed regenerates the same nine questions; right answers except the t-tests.
{
  const { diagnosticQuestions, scoreDiagnostic, DIAGNOSTIC } = await import("./plan.ts");
  const { questionSheet } = await import("./workbook.ts");
  const base = 123456789;
  const dq = diagnosticQuestions(base);
  ok(JSON.stringify(dq) === JSON.stringify(diagnosticQuestions(base)), "diagnostic seeds are stable");
  ok(dq.length === DIAGNOSTIC.length, "nine diagnostic questions");
  const ds = dq.map((q, i) => questionSheet(q, i + 1));
  writeFileSync(`${DIR}/diag.xlsx`, buildXlsx(ds, { title: "Diagnostic", id: `diag:${base}` }));
  const dfills: typeof fills = [];
  let want = 0;
  dq.forEach((q, i) => q.parts.forEach((p) => {
    if (i >= 7) return; // the two t-tests left blank
    want++;
    const typed = p.kind === "choice" ? String(p.answer).replace("H₀", "H0").replace("μ", "mu").replace("≤", "<=").replace("≥", ">=") : Number(p.answer);
    dfills.push({ sheet: ds[i].name, cell: ds[i].answerCells[p.id], value: typed });
  }));
  writeFileSync(`${DIR}/dfills.json`, JSON.stringify(dfills));
  execFileSync(PY, ["-I", "-c", `
import json, openpyxl
wb = openpyxl.load_workbook("${DIR}/diag.xlsx")
for f in json.load(open("${DIR}/dfills.json")):
    wb[f["sheet"]][f["cell"]] = f["value"]
wb.save("${DIR}/diag-filled.xlsx")
`]);
  const dg = gradeWorkbook(readXlsx(new Uint8Array(readFileSync(`${DIR}/diag-filled.xlsx`))));
  ok(dg.kind === "diag" && dg.n === base, "identified as the diagnostic");
  ok(dg.got === want, `diagnostic ${dg.got}, want ${want}`);
  const r = scoreDiagnostic(dg.questions.map((qg) => ({ q: qg.q, slot: qg.index, ok: qg.parts.map((p) => p.ok) })));
  ok(r.correct === want && r.scores.some((s) => s.level !== "strong"), "diagnostic result has gaps from the blank t-tests");
  ok(r.scores.find((s) => s.id === "ci-t")?.level === "strong", "CI t strong");
  console.log(`diagnostic: ${dg.got}/${dg.total}; ${r.scores.map((s) => `${s.id}=${s.level}`).join(" ")}`);
}

// A workbook without the id is refused with a clear message.
let refused = false;
try { gradeWorkbook({ sheets: {}, sheetOrder: [], thinkaId: null }); } catch (e) { refused = /Start here/.test(String(e)); }
ok(refused, "unknown workbook refused");

console.log(`${fails === 0 ? "PASS" : "FAILED"}: grading end to end, ${fails} failures`);
if (fails) process.exit(1);
