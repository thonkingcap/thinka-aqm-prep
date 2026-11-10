import { buildPlan, SKILLS, levelOf, type DiagnosticResult, type SkillId } from "./plan.ts";

let fails = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { fails++; console.log("FAIL", msg); } };

function result(levels: Partial<Record<SkillId, [number, number]>>): DiagnosticResult {
  const scores = SKILLS.map((s) => {
    const [c, t] = levels[s.id] ?? [3, 3];
    return { id: s.id, correct: c, total: t, level: levelOf(c, t) };
  });
  return { ts: 0, scores, correct: 0, total: 0 };
}

const today = new Date(2026, 10, 9); // Mon Nov 9 2026
for (const [name, r] of [
  ["all gaps", result(Object.fromEntries(SKILLS.map((s) => [s.id, [0, 3]])) as never)],
  ["all strong", result({})],
  ["two gaps", result({ pvalue: [0, 4], crit: [1, 4] })],
  ["mixed", result({ clt: [1, 2], "ci-t": [2, 4], "h0-setup": [0, 3], stat: [3, 6] })],
] as const) {
  for (const exam of ["2026-11-18", "2026-11-12", "2026-11-10"]) {
    const plan = buildPlan(r, today, exam);
    const [y, m, d] = exam.split("-").map(Number);
    const days = Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000);
    ok(plan.length === days, `${name}/${exam}: ${plan.length} days, want ${days}`);
    const dates = plan.map((p) => p.date);
    ok(new Set(dates).size === dates.length, `${name}/${exam}: duplicate dates`);
    ok(dates[0] === "2026-11-09", `${name}/${exam}: starts ${dates[0]}`);
    const weak = r.scores.filter((s) => s.level !== "strong").map((s) => s.id);
    const covered = new Set(plan.flatMap((p) => p.skills));
    for (const w of weak) ok(covered.has(w), `${name}/${exam}: weak skill ${w} not in plan`);
    ok(plan.every((p) => p.tasks.length > 0), `${name}/${exam}: a day has no tasks`);
    if (exam === "2026-11-18") {
      ok(plan[plan.length - 1].title.startsWith("Retake"), `${name}: last day should be the retake`);
      ok(dates[dates.length - 1] === "2026-11-17", `${name}: ends ${dates[dates.length - 1]}`);
    }
  }
}
const sample = buildPlan(result({ pvalue: [0, 4], "h0-setup": [1, 3], clt: [1, 2] }), today, "2026-11-18");
console.log(sample.map((p) => `${p.date}  ${p.title}`).join("\n"));
console.log(`${fails === 0 ? "PASS" : "FAILED"}: plan builder, ${fails} failures`);
if (fails) process.exit(1);

import { matchChoice } from "./workbook.ts";
const opts = ["H₀: μ ≤ 50", "H₀: μ = 50", "H₀: μ ≥ 50"];
ok(matchChoice("H0: mu <= 50", opts) === opts[0], "matchChoice <=");
ok(matchChoice("h0 mu=50", opts) === opts[1], "matchChoice =");
ok(matchChoice("H₀: μ ≥ 50", opts) === opts[2], "matchChoice exact");
ok(matchChoice("reject", ["Reject H₀", "Do not reject H₀"]) === "Reject H₀", "matchChoice reject");
ok(matchChoice("Do not reject H0", ["Reject H₀", "Do not reject H₀"]) === "Do not reject H₀", "matchChoice do not reject");
ok(matchChoice("maybe", opts) === null, "matchChoice garbage");
console.log(`${fails === 0 ? "PASS" : "FAILED"}: choice matching`);
if (fails) process.exit(1);

// Graded on the full value like class; a hand-rounded answer is wrong but flagged as rounding.
import { gradeNumber } from "./practice.ts";
const pp = { id: "a", label: "", kind: "number" as const, answer: 0.9166667, format: "prob" as const, excel: "", explain: "" };
ok(gradeNumber("0.92", pp).ok === false && gradeNumber("0.92", pp).roundedTo === 2, "0.92 is wrong, flagged as rounded to 2");
ok(gradeNumber("92%", pp).roundedTo === 2, "92% flagged as rounded");
ok(gradeNumber("0.9167", pp).ok, "0.9167 accepted");
ok(gradeNumber("0.91", pp).roundedTo === undefined && !gradeNumber("0.91", pp).ok, "0.91 is just wrong");
ok(gradeNumber("=NORM.S.DIST(1.383,TRUE)", pp).ok, "formula accepted");
console.log(`${fails === 0 ? "PASS" : "FAILED"}: rounding feedback`);
if (fails) process.exit(1);
const p2 = { id: "b", label: "", kind: "number" as const, answer: 0.98922, format: "prob" as const, excel: "", explain: "" };
ok(gradeNumber("0.99", p2).ok === false && gradeNumber("0.99", p2).roundedTo === 2, "0.99 for 0.9892 is rounded, not right");
ok(gradeNumber("0.989", p2).ok, "3 decimals keep the tolerance");
const p3 = { id: "c", label: "", kind: "number" as const, answer: 9.78, format: "num" as const, excel: "", explain: "" };
ok(gradeNumber("9.78", p3).ok, "an exact short answer is right");
console.log(`${fails === 0 ? "PASS" : "FAILED"}: consistent rounding rule`);
if (fails) process.exit(1);
