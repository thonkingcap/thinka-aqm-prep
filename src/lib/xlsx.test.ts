// node --experimental-strip-types src/lib/xlsx.test.ts
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { setSheets } from "./workbook.ts";
import type { SheetModel } from "./workbook.ts";
import { buildXlsx } from "./xlsx.ts";

import { SCRATCH, OUT, PY, HAS_OPENPYXL } from "./testEnv.ts";
mkdirSync(OUT, { recursive: true });

let failures = 0;
function check(ok: boolean, msg: string) {
  if (!ok) { failures++; console.error("FAIL:", msg); }
}

const INTRO = [
  "Problem set — μ σ x̄ μ₀ ≤ ≥ ≠ α ν, & <tags> \"quotes\" 'apos'",
  "Bad chars stripped:\u0001\u0008\uFFFE end",
];

const built: { file: string; sheets: SheetModel[] }[] = [];
for (const set of [1, 7]) {
  const sheets = setSheets(set);
  const bytes = buildXlsx(sheets, { title: `AQM 1000 · Problem set ${set}`, intro: INTRO });
  const file = join(OUT, `set${set}.xlsx`);
  writeFileSync(file, bytes);
  built.push({ file, sheets });

  const z = unzipSync(bytes);
  for (const p of ["[Content_Types].xml", "_rels/.rels", "docProps/app.xml", "docProps/core.xml",
    "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml"]) check(p in z, `set ${set}: missing ${p}`);
  const wsCount = Object.keys(z).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).length;
  check(wsCount === sheets.length + 1, `set ${set}: ${wsCount} worksheets, want ${sheets.length + 1}`);
  const wb = strFromU8(z["xl/workbook.xml"]);
  check((wb.match(/<sheet /g) ?? []).length === sheets.length + 1, `set ${set}: workbook sheet count`);
  check(wb.includes(`name="Start here"`), `set ${set}: Start here tab`);
  const s1 = strFromU8(z["xl/worksheets/sheet1.xml"]);
  check(s1.includes("μ σ x̄ μ₀ ≤ ≥ ≠ α ν, &amp; &lt;tags&gt; &quot;quotes&quot; &apos;apos&apos;"), `set ${set}: escaping/unicode`);
  check(!/[\u0001\u0008\uFFFE]/.test(s1), `set ${set}: invalid chars stripped`);
}

// Real-reader validation via openpyxl.
const spec = built.map(({ file, sheets }) => ({
  file,
  sheets: sheets.map((s) => ({ name: s.name, cells: s.cells })),
}));
const specFile = join(OUT, "spec.json");
writeFileSync(specFile, JSON.stringify({ spec, intro: INTRO }));

const PY_SCRIPT = String.raw`
import json, sys, math
from openpyxl import load_workbook
d = json.load(open(sys.argv[1], encoding="utf-8"))
errs = []
for item in d["spec"]:
    wb = load_workbook(item["file"])
    want = ["Start here"] + [s["name"] for s in item["sheets"]]
    if wb.sheetnames != want: errs.append(f"{item['file']}: tabs {wb.sheetnames} != {want}")
    if wb.active.title != "Start here": errs.append("active tab is " + wb.active.title)
    st = wb["Start here"]
    if not str(st["A3"].value).startswith("Problem set"): errs.append("intro A3: %r" % st["A3"].value)
    if "μ σ x̄" not in str(st["A3"].value): errs.append("unicode lost: %r" % st["A3"].value)
    if not st["A1"].font.b or st["A1"].font.sz != 14: errs.append("title font")
    n_given = n_ans = n_pct = 0
    for s in item["sheets"]:
        ws = wb[s["name"]]
        for addr, c in s["cells"].items():
            cell = ws[addr]
            role = c.get("role")
            if role in ("given", "data") and isinstance(c.get("v"), (int, float)):
                n_given += 1
                if not isinstance(cell.value, (int, float)) or cell.value != c["v"]:
                    errs.append(f"{s['name']}!{addr}: {cell.value!r} != {c['v']!r}")
                if c.get("pct"):
                    n_pct += 1
                    if "%" not in cell.number_format: errs.append(f"{s['name']}!{addr}: fmt {cell.number_format}")
            if role == "answer":
                n_ans += 1
                if cell.value is not None: errs.append(f"{s['name']}!{addr} answer not empty")
                if cell.fill.fgColor.rgb != "FFFFF2CC": errs.append(f"{s['name']}!{addr} fill {cell.fill.fgColor.rgb}")
                if cell.border.left.style != "thin": errs.append(f"{s['name']}!{addr} border")
            if role == "hint" and not cell.font.i: errs.append(f"{s['name']}!{addr} hint not italic")
            if role == "header" and not cell.font.b: errs.append(f"{s['name']}!{addr} header not bold")
            if isinstance(c.get("v"), str) and cell.value != c["v"]: errs.append(f"{s['name']}!{addr} text mismatch")
    print(f"{item['file'].split('/')[-1]}: {len(want)} tabs, {n_given} numeric givens ({n_pct} pct), {n_ans} answer cells")
if errs:
    print("\n".join(errs[:30])); sys.exit(1)
print("openpyxl OK")
`;

if (HAS_OPENPYXL) {
  try {
    console.log(execFileSync(PY, ["-I", "-c", PY_SCRIPT, specFile], { encoding: "utf8" }).trim());
  } catch (e) {
    failures++;
    console.error("FAIL: openpyxl validation\n", (e as { stdout?: string }).stdout ?? e);
  }
} else {
  console.warn("skip: no Python with openpyxl (set THINKA_PYTHON)", PY);
}

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log("PASS");
