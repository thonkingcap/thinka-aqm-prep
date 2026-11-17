// Lesson 18 sets: every answer-key formula (run by the site's Excel engine) gives the set's answer, a
// workbook filled with those values is marked full marks, and a blank one zero.
import { writeFileSync } from "node:fs";
import { l18Set, L18_COUNT } from "./l18.ts";
import { evaluate } from "./excel.ts";
import { buildXlsx } from "./xlsx.ts";
import { readXlsx } from "./xlsxRead.ts";
import { gradeWorkbook } from "./grade.ts";
import type { SheetModel } from "./workbook.ts";

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log("FAIL", m); } };

/** Evaluates a sheet's formulas, including IF(a<b, x, y). */
function evalSheet(s: SheetModel): (addr: string) => number | string | null {
  const memo = new Map<string, number | string | null>();
  const calc = (f: string): number | string => {
    const m = /^IF\(([^<]+)<([^,]+),(.+)\)$/.exec(f);
    if (!m) return evaluate("=" + f, { get });
    let depth = 0, cut = -1;
    for (let i = 0; i < m[3].length; i++) { const ch = m[3][i]; if (ch === "(") depth++; else if (ch === ")") depth--; else if (ch === "," && depth === 0) { cut = i; break; } }
    const br = evaluate("=" + m[1], { get }) < evaluate("=" + m[2], { get }) ? m[3].slice(0, cut) : m[3].slice(cut + 1);
    return br.startsWith('"') ? br.replace(/"/g, "") : evaluate("=" + br, { get });
  };
  const get = (addr: string): number | string | null => {
    if (memo.has(addr)) return memo.get(addr)!;
    const c = s.cells[addr];
    const v = c?.f ? calc(c.f.replace(/^=/, "")) : (c?.v ?? null);
    memo.set(addr, v);
    return v;
  };
  return get;
}

const dump: unknown[] = [];
for (let k = 1; k <= L18_COUNT; k++) {
  const S = l18Set(k)!;
  const get = evalSheet(S.sheets[1]);
  const filled: SheetModel = { ...S.sheets[0], cells: { ...S.sheets[0].cells } };
  for (const q of S.questions) for (const sp of q.specs) {
    const got = get(sp.cell!);
    if (sp.kind === "number") ok(typeof got === "number" && Math.abs(got - (sp.answer as number)) <= 1e-9 * Math.max(1, Math.abs(sp.answer as number)), `set ${k} Q${q.n} ${sp.label}: key ${got} vs ${sp.answer}`);
    else ok(got === (String(sp.answer).startsWith("Reject") ? "R" : "DR"), `set ${k} Q${q.n} decision: key ${got} vs ${sp.answer}`);
    filled.cells[sp.cell!] = { ...filled.cells[sp.cell!], v: got ?? undefined };
  }
  const g = gradeWorkbook(readXlsx(buildXlsx([filled, S.sheets[1]], { title: S.title, intro: S.intro, id: S.id })));
  ok(g.kind === "l18" && g.got === g.total && g.total === 22, `set ${k}: filled workbook marked ${g.got}/${g.total}`);
  const blank = gradeWorkbook(readXlsx(buildXlsx(S.sheets, { title: S.title, intro: S.intro, id: S.id })));
  ok(blank.got === 0, `set ${k}: blank workbook marked ${blank.got}`);
  dump.push({ k, text: S.questions.map((q) => q.text), data: Object.fromEntries(Object.entries(S.sheets[0].cells).filter(([, c]) => c.role === "data" || c.role === "given").map(([a, c]) => [a, c.v])), answers: S.questions.map((q) => q.specs.map((s) => [s.label, s.answer])) });
}
if (process.env.L18_DUMP) writeFileSync(process.env.L18_DUMP, JSON.stringify(dump));
console.log(fails ? `FAILED: Lesson 18 sets, ${fails} failure(s)` : `PASS: Lesson 18 sets, ${L18_COUNT} sets`);
if (fails) process.exit(1);
