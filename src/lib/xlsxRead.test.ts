// node --experimental-strip-types src/lib/xlsxRead.test.ts
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { zipSync, strToU8 } from "fflate";
import { setSheets } from "./workbook.ts";
import { buildXlsx } from "./xlsx.ts";
import { readXlsx } from "./xlsxRead.ts";

import { SCRATCH, OUT, PY, HAS_OPENPYXL } from "./testEnv.ts";
mkdirSync(OUT, { recursive: true });

let failures = 0;
function check(ok: boolean, msg: string) {
  if (!ok) { failures++; console.error("FAIL:", msg); }
}
function throwsWith(fn: () => unknown, re: RegExp, label: string) {
  try { fn(); check(false, `${label}: did not throw`); }
  catch (e) { check(re.test((e as Error).message), `${label}: wrong message ${(e as Error).message}`); }
}

// 1. Round trip of our own writer.
const sheets = setSheets(3);
const bytes = buildXlsx(sheets, { title: "t", id: "set:3" });
const wb = readXlsx(bytes);
check(wb.thinkaId === "set:3", `thinkaId ${wb.thinkaId}`);
const wantNames = ["Start here", ...sheets.map((s) => s.name)];
check(JSON.stringify(wb.sheetOrder) === JSON.stringify(wantNames), `sheet order ${wb.sheetOrder}`);
check(wantNames.length === 9 && wantNames[8] === "Q8", `expected Start here + Q1..Q8, got ${wantNames}`);
let nNum = 0;
for (const s of sheets) {
  for (const [addr, c] of Object.entries(s.cells)) {
    if ((c.role === "given" || c.role === "data") && typeof c.v === "number") {
      nNum++;
      check(wb.sheets[s.name]?.[addr] === c.v, `${s.name}!${addr}: ${wb.sheets[s.name]?.[addr]} != ${c.v}`);
    }
    if (typeof c.v === "string" && c.v) check(wb.sheets[s.name]?.[addr] === c.v, `${s.name}!${addr} text`);
  }
}
check(nNum > 0, "no numeric givens checked");
check(readXlsx(buildXlsx(sheets, { title: "t" })).thinkaId === null, "no id → null");
console.log(`round trip: ${wb.sheetOrder.length} sheets, ${nNum} numeric cells`);

// 2a. Real writer: openpyxl fills answer cells (shared strings, formula w/o cached value).
const src = join(OUT, "read-src.xlsx");
const dst = join(OUT, "read-openpyxl.xlsx");
writeFileSync(src, bytes);
const q1 = sheets[0];
const ans = Object.values(q1.answerCells);
const q2 = sheets[1];
const ans2 = Object.values(q2.answerCells);
check(ans.length >= 1 && ans2.length >= 1, "need answer cells");
const LONG = "Because p < α we reject H0 & conclude μ ≠ μ₀ — ".repeat(40);
const plan = [
  { sheet: q1.name, addr: ans[0], v: 0.0432 },
  { sheet: q1.name, addr: ans[1] ?? "F20", v: "Reject H0" },
  { sheet: q2.name, addr: ans2[0], v: true },
  { sheet: q2.name, addr: ans2[1] ?? "F21", v: "=B5*2" },
  { sheet: q2.name, addr: "F30", v: LONG },
];
const PY_SCRIPT = String.raw`
import json, sys
from openpyxl import load_workbook
src, dst, plan = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
wb = load_workbook(src)
for p in plan: wb[p["sheet"]][p["addr"]] = p["v"]
wb.save(dst)
`;
if (HAS_OPENPYXL) {
  execFileSync(PY, ["-I", "-c", PY_SCRIPT, src, dst, JSON.stringify(plan)]);
  const r = readXlsx(new Uint8Array(readFileSync(dst)));
  check(r.thinkaId === "set:3", `openpyxl thinkaId ${r.thinkaId}`);
  check(JSON.stringify(r.sheetOrder) === JSON.stringify(wantNames), "openpyxl sheet order");
  const get = (i: number) => r.sheets[plan[i].sheet]?.[plan[i].addr];
  check(get(0) === 0.0432, `number ${get(0)}`);
  check(get(1) === "Reject H0", `text ${get(1)}`);
  check(get(2) === true, `bool ${get(2)}`);
  check(get(3) === null && plan[3].addr in r.sheets[plan[3].sheet], `formula w/o cache ${get(3)}`);
  check(get(4) === LONG, "long text");
  for (const [addr, c] of Object.entries(q1.cells)) {
    if (c.role === "given" && typeof c.v === "number") check(r.sheets[q1.name][addr] === c.v, `openpyxl given ${addr}`);
  }
  console.log("openpyxl: number, shared text, bool, uncached formula, long text OK");
} else {
  console.warn("skip: no Python with openpyxl (set THINKA_PYTHON)", PY);
}

// 2b. Hand-crafted package: prefixed XML, absolute targets, cached formula, str/e/inline/rich text.
const hand = zipSync({
  "[Content_Types].xml": strToU8(`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`),
  "_rels/.rels": strToU8(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="/xl/workbook.xml"/></Relationships>`),
  "xl/workbook.xml": strToU8(`<?xml version="1.0"?><x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><x:sheets><x:sheet name="Start &amp; go" sheetId="1" r:id="rId7"/><x:sheet name="Q1" sheetId="2" r:id="rId8"/></x:sheets></x:workbook>`),
  "xl/_rels/workbook.xml.rels": strToU8(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/a.xml"/><Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/../worksheets/b.xml"/><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="/xl/sharedStrings.xml"/></Relationships>`),
  "xl/sharedStrings.xml": strToU8(`<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>plain</t></si><si><r><rPr><b/></rPr><t>Re</t></r><r><t xml:space="preserve">ject </t></r><r><t>H0</t></r></si><si><t>thinka-id:hand:9</t></si></sst>`),
  "xl/worksheets/a.xml": strToU8(`<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData><x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c><x:c r="B1" t="s"><x:v>1</x:v></x:c></x:row><x:row r="60"><x:c r="A60" t="s"><x:v>2</x:v></x:c></x:row></x:sheetData></x:worksheet>`),
  "xl/worksheets/b.xml": strToU8(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="5"><c r="B5"><v>11.3</v></c><c r="C5" s="3"/><c r="D5" s="2"></c></row>
<row r="10"><c r="B10"><f>NORM.DIST(B7,B5,B6,TRUE)</f><v>0.62084</v></c><c r="C10" t="str"><f>IF(B10&lt;0.05,"Reject","Fail")</f><v>Fail &amp; keep</v></c><c r="D10" t="e"><f>1/0</f><v>#DIV/0!</v></c><c r="E10" t="b"><v>0</v></c></row>
<row r="11"><c r="B11" t="inlineStr"><is><t>a &lt; b &#956;</t></is></c><c r="C11" s="10"><v>0.05</v></c><c r="D11" t="e"><v>#N/A</v></c><c r="E11"><v>-1.5E-3</v></c></row>
</sheetData></worksheet>`),
});
const h = readXlsx(hand);
check(JSON.stringify(h.sheetOrder) === JSON.stringify(["Start & go", "Q1"]), `hand order ${h.sheetOrder}`);
check(h.thinkaId === "hand:9", `hand id ${h.thinkaId}`);
const s0 = h.sheets["Start & go"], s1 = h.sheets.Q1;
check(s0.A1 === "plain" && s0.B1 === "Reject H0", `prefixed shared/rich ${s0.A1} ${s0.B1}`);
check(s1.B5 === 11.3 && !("C5" in s1) && !("D5" in s1), "number + empty cells skipped");
check(s1.B10 === 0.62084, `cached formula ${s1.B10}`);
check(s1.C10 === "Fail & keep", `str ${s1.C10}`);
check(s1.D10 === "#DIV/0!" && s1.D11 === "#N/A", `errors ${s1.D10} ${s1.D11}`);
check(s1.E10 === false, `bool false ${s1.E10}`);
check(s1.B11 === "a < b μ", `inlineStr ${s1.B11}`);
check(s1.C11 === 0.05 && s1.E11 === -0.0015, `pct raw / exp ${s1.C11} ${s1.E11}`);
console.log("hand-crafted: prefixes, abs/relative targets, cached formula, str, e, b, inlineStr OK");

// 3. Friendly errors.
throwsWith(() => readXlsx(new Uint8Array([1, 2, 3, 250, 251, 0, 9, 7])), /isn't an Excel workbook/, "garbage");
throwsWith(() => readXlsx(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0])), /\.xls\)/, "ole");
throwsWith(() => readXlsx(zipSync({})), /isn't an Excel workbook/, "empty zip");
throwsWith(() => readXlsx(new Uint8Array(0)), /isn't an Excel workbook/, "empty file");
throwsWith(() => readXlsx(strToU8("name,score\nAna,3\n")), /CSV/, "csv");
throwsWith(() => readXlsx(zipSync({ "Index/Document.iwa": new Uint8Array([1]) })), /Numbers/, "numbers");
console.log("errors OK");

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log("PASS");
