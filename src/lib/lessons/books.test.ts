// Every Lessons/Units/Final workbook builds, survives the .xlsx writer and reader (tab names, the id), and
// marks correctly: a perfect copy scores full marks, a blank copy scores zero, a wrong answer is caught.
import { allBookIds, bookById, gradeBook } from "./books.ts";
import { bookSheets, tabName } from "./kit.ts";
import { buildXlsx } from "../xlsx.ts";
import { readXlsx } from "../xlsxRead.ts";
import { LESSONS } from "./index.ts";

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; if (fails < 40) console.log("FAIL", m); } };
const ids = allBookIds();
for (const id of ids) {
  const b = bookById(id)!;
  ok(!!b && b.blocks.length > 0, `${id} builds`);
  const names = b.blocks.map((x, i) => tabName(i, x));
  ok(new Set(names).size === names.length, `${id}: tab names are unique`);
  const wb = readXlsx(buildXlsx(bookSheets(b), { title: b.title, intro: b.intro, id }));
  ok(wb.thinkaId === id, `${id}: id survives the round trip (got ${wb.thinkaId})`);
  for (const n of names) ok(!!wb.sheets[n], `${id}: tab "${n}" survives`);
  // Blank: every part blank, zero marks.
  const blank = gradeBook(wb);
  ok(blank.got === 0 && blank.total === b.blocks.reduce((s, x) => s + x.parts.length, 0), `${id}: blank scores 0/${blank.total}`);
  // Perfect: put each answer in its cell (choices typed the way class writes them).
  const perfect = structuredClone(wb);
  b.blocks.forEach((x, i) => {
    const sh = perfect.sheets[names[i]];
    for (const p of x.parts) sh[p.cell] = typeof p.answer === "number" ? p.answer : p.answer === "Reject H₀" ? "R" : p.answer === "Do not reject H₀" ? "DR" : p.answer;
  });
  const g = gradeBook(perfect);
  ok(g.got === g.total, `${id}: perfect copy scores ${g.got}/${g.total}`);
  for (const q of g.questions) for (const p of q.parts) if (!p.ok) ok(false, `${id} ${q.q.title} ${p.part.label}: perfect answer marked ${p.status} (${p.mine} vs ${p.answer})`);
  // One wrong number is caught.
  const wrong = structuredClone(perfect);
  const x0 = b.blocks.findIndex((x) => x.parts.some((p) => typeof p.answer === "number"));
  if (x0 >= 0) {
    const p = b.blocks[x0].parts.find((q) => typeof q.answer === "number")!;
    wrong.sheets[names[x0]][p.cell] = (p.answer as number) * 1.37 + 11.3;
    ok(gradeBook(wrong).got === g.total - 1, `${id}: a wrong number loses exactly one mark`);
  }
}
// Every lesson's makers turn up in some unit paper or the lesson set.
ok(LESSONS.every((L) => !L.makers.length || ids.includes(`les:${L.n}:1`)), "every lesson with practice has a workbook");
console.log(`${fails ? "FAILED" : "PASS"}: ${ids.length} lesson/unit/final workbooks round-trip and mark, ${fails} failures`);
if (fails) process.exit(1);
