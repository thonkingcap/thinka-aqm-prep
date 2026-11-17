// Exam 3 (the diagnostic): the key against hand-checked values, then a blank copy filled the way a
// student would (openpyxl standing in for Excel), read back and marked: full marks, named slips,
// R/DR decisions, written answers held, and Question 12's follow-through credit.
import { writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { buildXlsx } from "./xlsx.ts";
import { readXlsx } from "./xlsxRead.ts";
import { gradeWorkbook } from "./grade.ts";
import { exam3Key, exam3Sheets, isExam3, EXAM3_ID, EXAM3_INTRO, EXAM3_TEXT } from "./exam3.ts";
import { tCdf } from "./stats.ts";
import { OUT as DIR, PY, HAS_OPENPYXL } from "./testEnv.ts";

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log("FAIL", m); } };
const key = exam3Key();
const val = (n: number, label: string) => key[n - 1].parts.find((p) => p.label.startsWith(label))!.answer as number;
const near = (a: number, b: number, t = 1e-4) => Math.abs(a - b) < t;

// Values checked by hand / in Excel.
ok(near(val(1, "Lower"), 50.61739) && near(val(1, "Upper"), 59.38261), "Q1 interval (matches the Excel file)");
ok(near(val(4, "Lower"), 52.73436) && near(val(4, "Upper"), 58.46564), "Q4 interval");
ok(near(val(5, "Lower"), 18.50262) && near(val(5, "Upper"), 22.97738), "Q5 interval");
ok(near(val(6, "Test"), 0.268328) && near(val(6, "p-value"), 0.788447), "Q6");
ok(near(val(11, "Sample std"), Math.sqrt(1000 / 999 * 0.537 * 0.463)), "Q11 S");
ok(EXAM3_TEXT.reduce((s, q) => s + q.points, 0) === 38, "38 points, as on the paper");
console.log(`${fails === 0 ? "PASS" : "FAILED"}: Exam 3 key, ${fails} failures`);

// The download is the professor's own blank workbook: it must be recognised as Exam 3 and score 0.
{
  const blankWb = readXlsx(new Uint8Array(readFileSync(new URL("../../public/exam3-blank.xlsx", import.meta.url))));
  const g = gradeWorkbook(blankWb);
  if (!isExam3(blankWb) || g.kind !== "exam3" || g.got !== 0) { console.log("FAIL: the professor's blank Exam 3 isn't recognised as a blank Exam 3", g.kind, g.got); process.exit(1); }
  console.log("PASS: professor's blank Exam 3 recognised, marked 0");
}

if (!HAS_OPENPYXL) { console.log("PASS (round trip skipped: no Python with openpyxl; set THINKA_PYTHON)"); process.exit(fails ? 1 : 0); }

const T = ["Confidence intervals", "Hypothesis testing I", "Hypothesis testing II", "Two-sample tests"];
const block = (tab: number, cells: string[], dec: string, n: number) => {
  const labels = ["n", "alpha", "Test statistic", "Critical value", "p-value"];
  const out: [number, string, string | number][] = labels.map((l, i) => [tab, cells[i], val(n, l)]);
  const d = key[n - 1].parts.find((p) => p.label.startsWith("Decision"))!.answer;
  out.push([tab, dec, d === "Reject H₀" ? "R" : "DR"]);
  return out;
};
const col = (c: string, r: number) => Array.from({ length: 5 }, (_, i) => `${c}${r + i}`);
function fills(): [number, string, string | number][] {
  return [
    [0, "G3", "lower limit"], [0, "H3", val(1, "Lower")], [0, "G4", "upper limit"], [0, "H4", val(1, "Upper")],
    [0, "D9", "Not necessarily: there's a 5% chance it lands outside even with no mistake."],
    [0, "D19", "Yes, 55.6 is inside the interval."],
    [0, "H21", val(4, "Lower")], [0, "H22", val(4, "Upper")], [0, "J27", val(5, "Lower")], [0, "J28", val(5, "Upper")],
    ...block(1, col("G", 3), "J3", 6), ...block(1, col("G", 11), "J11", 7), ...block(2, col("G", 3), "J3", 8),
    [2, "D22", "No, Z vs T, different assumptions."], [2, "D24", 0.5], [2, "E26", val(11, "Sample mean")], [2, "E27", val(11, "Sample std")],
    ...block(2, col("E", 29), "H29", 12), ...block(3, col("H", 3), "K3", 13), ...block(3, col("L", 10), "O10", 14),
  ];
}
function run(name: string, f: [number, string, string | number][], withId = true) {
  writeFileSync(`${DIR}/exam3-blank.xlsx`, buildXlsx(exam3Sheets(), { title: "Exam 3", intro: EXAM3_INTRO, id: withId ? EXAM3_ID : undefined }));
  writeFileSync(`${DIR}/fills.json`, JSON.stringify(f.map(([t, c, v]) => ({ sheet: T[t], cell: c, value: v }))));
  execFileSync(PY, ["-I", "-c", `
import json, openpyxl
wb = openpyxl.load_workbook("${DIR}/exam3-blank.xlsx")
for f in json.load(open("${DIR}/fills.json")):
    wb[f["sheet"]][f["cell"]] = f["value"]
wb.save("${DIR}/exam3-${name}.xlsx")
`]);
  const wb = readXlsx(new Uint8Array(readFileSync(`${DIR}/exam3-${name}.xlsx`)));
  ok(isExam3(wb), `${name}: recognised as Exam 3`);
  return gradeWorkbook(wb);
}
const set = (f: [number, string, string | number][], tab: number, cell: string, v: number | string) => f.map((x) => (x[0] === tab && x[1] === cell ? [tab, cell, v] as [number, string, string | number] : x));

const full = run("full", fills());
const parts = full.questions.flatMap((q) => q.parts);
ok(parts.filter((p) => p.status === "written").length === 3, "3 written answers held");
ok(near(full.got, 35, 1e-9) && full.total === 38, `full marks apart from written: ${full.got}/${full.total}`);
ok(parts.filter((p) => !p.ok && p.status !== "written").length === 0, `nothing wrong: ${parts.filter((p) => !p.ok && p.status !== "written").map((p) => p.part.label + "=" + p.mine).join(", ")}`);
ok(run("noid", fills(), false).got === full.got, "the professor's copy (no site id) is marked the same");

// Slips: Q7 right tail, Q13 D reversed, Q14 two-tailed negative crit (allowed), Q4 centred on 55.
let f = fills();
f = set(f, 1, "G15", 1 - val(7, "p-value"));
f = set(f, 3, "H5", -val(13, "Test"));
f = set(f, 3, "L13", -val(14, "Critical"));
f = set(f, 0, "H21", val(4, "Lower") - 0.6);
const slips = run("slips", f);
const wrong = slips.questions.flatMap((q) => q.parts.filter((p) => p.status === "wrong").map((p) => ({ n: q.index + 1, p })));
ok(wrong.length === 3, `3 wrong (Q4 lower, Q7 p, Q13 stat): ${wrong.map((w) => `Q${w.n} ${w.p.part.label}`).join(", ")}`);
ok(/right tail/.test(wrong.find((w) => w.n === 7)?.p.slip ?? ""), "Q7 slip named");
ok(/Exam 2 − Exam 1/.test(wrong.find((w) => w.n === 13)?.p.slip ?? ""), "Q13 slip named");
ok(/Centred on 55/.test(wrong.find((w) => w.n === 4)?.p.slip ?? ""), "Q4 slip named");

// Follow-through: wrong S in Q11 (divided by n is close; use 0.2), Q12 worked from it.
f = fills();
const s = 0.45, t = (0.537 - 0.5) / (s / Math.sqrt(1000));
f = set(f, 2, "E27", s);
f = set(f, 2, "E31", t);
f = set(f, 2, "E33", 1 - tCdf(t, 999));
const ft = run("follow", f);
ok(ft.notes.some((n) => n.includes("your own Question 11")), "Q12 follow-through from the student's own Q11");
ok(ft.questions[11].parts.find((p) => p.part.label === "Test statistic")?.ok === true, "Q12 statistic credited on follow-through");
ok(ft.questions[10].parts[1].ok === false, "Q11 S still marked wrong");
// The practice set from mistakes: builds, covers the questions that lost points, and is markable.
import { targetedSpec } from "./exam3.ts";
import { specId, workbookById } from "./sets.ts";
const tgt = workbookById(specId(targetedSpec(slips)));
ok(!!tgt && tgt.questions.some((q) => q.kind === "paired") && tgt.questions.some((q) => q.kind === "ci-z") && tgt.questions.length <= 14, `targeted set: ${tgt?.questions.map((q) => q.kind).join(",")}`);
const stretch = workbookById(specId(targetedSpec({ ...full, questions: full.questions.map((q) => ({ ...q, got: q.total })) })));
ok(!!stretch && stretch.questions.length >= 5, "stretch set when nothing was lost");
console.log(`${fails === 0 ? "PASS" : "FAILED"}: Exam 3 round trip, ${fails} failures`);
if (fails) process.exit(1);

