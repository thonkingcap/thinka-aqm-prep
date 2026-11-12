// Every new workbook (topic sets, mixed sets, exam-style mocks, a custom set): built, filled the way a
// student would (openpyxl standing in for Excel), read back and graded. Checks the answer key tab, the
// ids, R/DR decisions, written answers, and that a planted slip is named.
import { writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { buildXlsx } from "./xlsx.ts";
import { readXlsx } from "./xlsxRead.ts";
import { gradeWorkbook } from "./grade.ts";
import { TOPIC_SETS, TOPIC_VERSIONS, MIX_COUNT, EXAM_COUNT, workbookById, workbookSheets, workbookIntro, specId, type WorkbookDef } from "./sets.ts";
import { matchChoice } from "./workbook.ts";
import { OUT as DIR, PY, HAS_OPENPYXL } from "./testEnv.ts";

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log("FAIL", m); } };

// Ids and determinism, no Python needed.
const ids = [
  ...TOPIC_SETS.flatMap((t) => Array.from({ length: TOPIC_VERSIONS }, (_, v) => `topic:${t.id}:${v + 1}`)),
  ...Array.from({ length: MIX_COUNT }, (_, i) => `mix:${i + 1}`),
  ...Array.from({ length: EXAM_COUNT }, (_, i) => `exam:${i + 1}`),
  specId({ t: "Custom: tests on a variance", q: [["var-test", 11], ["two-t", 12], ["concept", 3], ["ht-full", 99, "eq-unknown-p"]],
    sc: [{ pop: "The weight of espresso shots pulled at a campus café", quantity: "shot weight", item: "espresso shot", items: "espresso shots", unit: "g", owner: "The café manager", mu: [17, 19, 0.5], sd: [0.8, 1.4, 0.1], dp: 1 }] }),
];
const defs: WorkbookDef[] = [];
for (const id of ids) {
  const d = workbookById(id);
  ok(!!d, `workbook ${id} exists`);
  if (!d) continue;
  ok(JSON.stringify(d.questions) === JSON.stringify(workbookById(id)!.questions), `${id} is deterministic`);
  ok(d.questions.every((q) => q.parts.length > 0), `${id} has parts`);
  defs.push(d);
}
ok(workbookById("topic:normal:9") === null && workbookById("exam:0") === null && workbookById("spec:%%%") === null, "bad ids rejected");
ok(workbookById(specId({ t: "x", q: [["rm -rf" as never, 1]] })) === null, "unknown kinds rejected in custom sets");
const custom = defs[defs.length - 1];
ok(custom.questions[0].prompt.includes("espresso"), "custom scenario used");
// Each topic set and exam covers what it says.
ok(workbookById("topic:variance:1")!.questions.filter((q) => q.kind === "var-test").length === 3, "variance set has 3 χ² tests");
ok(workbookById("exam:2")!.questions.some((q) => q.kind === "two-z") && workbookById("exam:1")!.questions.some((q) => q.kind === "two-t"), "mocks alternate z and pooled t");
// Decisions and nulls typed the way students type them.
ok(matchChoice("R", ["Reject H₀", "Do not reject H₀"]) === "Reject H₀" && matchChoice("dr", ["Reject H₀", "Do not reject H₀"]) === "Do not reject H₀", "R / DR");
ok(matchChoice("Don't reject", ["Reject H₀", "Do not reject H₀"]) === "Do not reject H₀", "don't reject");
ok(matchChoice("H0: sigma^2 <= 4", ["H₀: σ² ≤ 4", "H₀: σ² = 4", "H₀: σ² ≥ 4"]) === "H₀: σ² ≤ 4", "sigma^2");
ok(matchChoice("mu1 = mu2", ["H₀: μ₁ ≤ μ₂", "H₀: μ₁ = μ₂", "H₀: μ₁ ≥ μ₂"]) === "H₀: μ₁ = μ₂", "mu1 = mu2");
ok(matchChoice("H0: mu_D >= 0", ["H₀: μ_D ≤ 0", "H₀: μ_D = 0", "H₀: μ_D ≥ 0"]) === "H₀: μ_D ≥ 0", "mu_D");
ok(matchChoice("H0: mu <= 12.5", ["H₀: μ ≤ 12.5", "H₀: μ = 12.5", "H₀: μ ≥ 12.5"]) === "H₀: μ ≤ 12.5", "plain mu still works");
console.log(`${fails === 0 ? "PASS" : "FAILED"}: ${defs.length} workbooks resolve, ${fails} failures`);

if (!HAS_OPENPYXL) { console.log("PASS (round trip skipped: no Python with openpyxl; set THINKA_PYTHON)"); process.exit(fails ? 1 : 0); }

// Round trip: fill every answer right, except one planted slip per workbook where a trap exists.
let slipsNamed = 0, written = 0;
for (const d of defs) {
  const sheets = workbookSheets(d);
  ok(sheets[sheets.length - 1].name === "Answer key", `${d.id}: answer key is the last tab`);
  const safe = d.file.replace(/[^A-Za-z0-9-]/g, "");
  writeFileSync(`${DIR}/${safe}.xlsx`, buildXlsx(sheets, { title: d.title, intro: workbookIntro(d), id: d.id }));
  const fills: { sheet: string; cell: string; value: string | number }[] = [];
  let planted: string | null = null, expectWrong = 0, textParts = 0;
  d.questions.forEach((q, i) => q.parts.forEach((p) => {
    const sheet = sheets[i].name, cell = sheets[i].answerCells[p.id];
    if (p.kind === "text") { textParts++; fills.push({ sheet, cell, value: "Rejecting the null when it is true; its probability is alpha." }); return; }
    if (p.kind === "choice") {
      const v = String(p.answer);
      fills.push({ sheet, cell, value: v === "Reject H₀" ? "R" : v === "Do not reject H₀" ? "DR" : v.replace("H₀", "H0").replace("μ", "mu").replace("σ²", "sigma^2").replace("≤", "<=").replace("≥", ">=") });
      return;
    }
    const trap = (p.traps ?? []).find((t) => Number.isFinite(t.value) && Math.abs(t.value - (p.answer as number)) > (p.tol ?? 0) * 3);
    if (!planted && trap) { planted = trap.why; expectWrong++; fills.push({ sheet, cell, value: trap.value }); return; }
    fills.push({ sheet, cell, value: p.answer as number });
  }));
  writeFileSync(`${DIR}/fills.json`, JSON.stringify(fills));
  execFileSync(PY, ["-I", "-c", `
import json, openpyxl
wb = openpyxl.load_workbook("${DIR}/${safe}.xlsx")
for f in json.load(open("${DIR}/fills.json")):
    wb[f["sheet"]][f["cell"]] = f["value"]
wb.save("${DIR}/${safe}-filled.xlsx")
`]);
  const g = gradeWorkbook(readXlsx(new Uint8Array(readFileSync(`${DIR}/${safe}-filled.xlsx`))));
  ok(g.id === d.id && g.title === d.title, `${d.id}: identified (${g.id.slice(0, 40)})`);
  const parts = g.questions.flatMap((q) => q.parts);
  const wrong = parts.filter((p) => p.status === "wrong");
  ok(wrong.length === expectWrong, `${d.id}: ${wrong.length} wrong, expected ${expectWrong}: ${wrong.map((w) => `${w.part.label}=${w.mine}`).join(" | ")}`);
  if (planted) { ok(wrong[0]?.slip === planted, `${d.id}: slip named ("${wrong[0]?.slip}" vs "${planted}")`); if (wrong[0]?.slip === planted) slipsNamed++; }
  ok(parts.filter((p) => p.status === "written").length === textParts, `${d.id}: written parts held for marking`);
  written += textParts;
  ok(g.got === g.total - expectWrong - textParts, `${d.id}: ${g.got}/${g.total}`);
}
console.log(`${fails === 0 ? "PASS" : "FAILED"}: ${defs.length} workbooks round-tripped, ${slipsNamed} planted slips named, ${written} written parts held, ${fails} failures`);
if (fails) process.exit(1);
