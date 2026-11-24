// Check one lesson file before it is registered:
//   node --experimental-strip-types src/lib/lessons/try.ts src/lib/lessons/l08.ts
// Prints every problem, then a sample of each practice tab (seed 1) so you can eyeball the numbers.
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { checkLesson, checkMaker } from "./check.ts";
import { rngFor, blockSheet } from "./kit.ts";
import type { Lesson } from "./types.ts";

const file = process.argv[2];
if (!file) { console.log("usage: try.ts <lesson file>"); process.exit(2); }
const mod = await import(pathToFileURL(resolve(file)).href);
const lessons: Lesson[] = Object.values(mod).filter((v): v is Lesson => !!v && typeof v === "object" && "makers" in (v as object) && "quiz" in (v as object));
if (!lessons.length) { console.log("no exported Lesson found"); process.exit(2); }
let n = 0;
for (const L of lessons) {
  const errs = [...checkLesson(L), ...L.makers.flatMap((m) => checkMaker(m, 40, rngFor))];
  for (const e of errs) console.log("FAIL", e);
  n += errs.length;
  if (process.argv.includes("--show")) for (const m of L.makers) {
    const b = m.make(rngFor(`check|1|${m.key}`));
    const s = blockSheet(b, 0, true);
    console.log(`\n--- ${m.key}: tab "${s.name}"`);
    for (const [a, c] of Object.entries(s.cells).sort((x, y) => Number(/\d+/.exec(x[0])![0]) - Number(/\d+/.exec(y[0])![0]))) if (c.v !== undefined || c.f) console.log(`${a}: ${c.f ?? JSON.stringify(c.v)}`);
    for (const p of b.parts) console.log(`  ANSWER ${p.cell} = ${p.answer}   (${p.label})`);
  }
  console.log(`${errs.length ? "FAILED" : "PASS"}: Lesson ${L.n} "${L.title}": ${L.defs.length} definitions, ${L.examples.length} examples, ${L.quiz.length} quiz questions, ${L.makers.length} practice tabs × 40 seeds`);
}
process.exit(n ? 1 : 0);
