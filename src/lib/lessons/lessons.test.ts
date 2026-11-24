// Every lesson's content is well formed and every practice tab's answer key is proved: each answer
// cell's formula, evaluated on the tab's own cells by the site's Excel engine, gives the stated answer.
import { LESSONS } from "./index.ts";
import { EXAMPLE } from "./_example.ts";
import { checkLesson, checkMaker } from "./check.ts";
import { rngFor } from "./kit.ts";

const only = process.argv[2] ? Number(process.argv[2]) : null; // node … lessons.test.ts 8  → just Lesson 8
const all = [EXAMPLE, ...LESSONS].filter((L) => only === null || L.n === only);
const errs: string[] = [];
let blocks = 0;
const ns = new Set<number>();
for (const L of all) {
  if (ns.has(L.n)) errs.push(`Lesson ${L.n} registered twice`);
  ns.add(L.n);
  errs.push(...checkLesson(L));
  for (const m of L.makers) { errs.push(...checkMaker(m, 25, rngFor)); blocks++; }
}
import { RED_DEFS } from "./red.ts";
if (only === null) for (const k of RED_DEFS) { const [n, term] = [Number(k.split("|")[0]), k.slice(k.indexOf("|") + 1)]; if (!LESSONS.find((L) => L.n === n)?.defs.some((d) => d.term === term)) errs.push(`red.ts: no definition "${term}" in Lesson ${n}`); }
for (const e of errs.slice(0, 60)) console.log("FAIL", e);
console.log(`${errs.length ? "FAILED" : "PASS"}: ${all.length} lessons, ${blocks} practice tabs × 25 seeds, ${errs.length} problems`);
if (errs.length) process.exit(1);
