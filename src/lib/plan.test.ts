import { buildPlan, SKILLS, DIAGNOSED_SKILLS, UNCHECKED_SKILLS, levelOf, type DiagnosticResult, type SkillId } from "./plan.ts";
import { AREAS } from "./areas.ts";

let fails = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { fails++; console.log("FAIL", msg); } };

function result(levels: Partial<Record<SkillId, [number, number]>>): DiagnosticResult {
  // A result scores only the skills Exam 3 tests; the rest are unchecked.
  const scores = DIAGNOSED_SKILLS.map((s) => {
    const [c, t] = levels[s.id] ?? [3, 3];
    return { id: s.id, correct: c, total: t, level: levelOf(c, t) };
  });
  return { ts: 0, scores, correct: 0, total: 0 };
}

const today = new Date(2026, 10, 9); // Mon Nov 9 2026
for (const [name, r] of [
  ["all gaps", result(Object.fromEntries(DIAGNOSED_SKILLS.map((s) => [s.id, [0, 3]])) as never)],
  ["all strong", result({})],
  ["two gaps", result({ pvalue: [0, 4], crit: [1, 4] })],
  ["mixed", result({ clt: [1, 2], "ci-t": [2, 4], "two-sample": [0, 3], stat: [3, 6] })],
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
    // Lesson 18 and written answers are never dropped, even though the diagnostic doesn't test them.
    for (const u of UNCHECKED_SKILLS) ok(covered.has(u.id), `${name}/${exam}: unchecked skill ${u.id} not in plan`);
    // Practice is Excel only: the four area sets or the full practice exams.
    const areaIds = new Set(AREAS.map((a) => a.id));
    for (const t of plan.flatMap((p) => p.tasks).filter((t) => t.kind === "practice")) {
      const m = /^#\/area\/([a-z0-9]+)\/set\/[1-4]$/.exec(t.href);
      ok(t.href === "#/home/mocks" || (!!m && areaIds.has(m[1])), `${name}/${exam}: bad practice link ${t.href}`);
      ok(t.href === "#/home/mocks" || /in Excel \(set [1-4] of 4\), then upload it$/.test(t.label), `${name}/${exam}: label ${t.label}`);
    }
    // An area given on two days uses a different set the second time.
    const byTopic = new Map<string, string[]>();
    for (const t of plan.flatMap((p) => p.tasks)) {
      const m = /^#\/area\/([a-z0-9]+)\/set\/\d$/.exec(t.href);
      if (m) { const v = /set (\d) of/.exec(t.label)![1]; ok(t.href.endsWith(`/${v}`), `link ${t.href} names set ${v}`); byTopic.set(m[1], [...(byTopic.get(m[1]) ?? []), v]); }
    }
    for (const [id, vs] of byTopic) ok(vs.slice(0, 4).every((v, i) => v === String(i + 1)), `${name}/${exam}: ${id} versions ${vs.join(",")}`);
    if (exam === "2026-11-18") {
      ok(plan[plan.length - 1].title.startsWith("Redo Exam 3"), `${name}: last day should be the retake`);
      ok(dates[dates.length - 1] === "2026-11-17", `${name}: ends ${dates[dates.length - 1]}`);
      const mock = plan[plan.length - 2];
      ok(mock.tasks.some((t) => t.href === "#/home/mocks" && /60 minutes, timed/.test(t.label)), `${name}: mock day should link the timed mocks`);
      // Each unchecked skill gets a day before the mock day.
      for (const u of UNCHECKED_SKILLS) ok(plan.slice(0, -2).some((p) => p.skills.includes(u.id)), `${name}: ${u.id} has no day before the mock`);
    }
  }
}
const sample = buildPlan(result({ pvalue: [0, 4], "two-sample": [1, 3], clt: [1, 2] }), today, "2026-11-18");
console.log(sample.map((p) => `${p.date}  ${p.title}\n${p.tasks.filter((t) => t.kind === "practice").map((t) => `            ${t.label}  ${t.href}`).join("\n")}`).join("\n"));
ok(SKILLS.length === DIAGNOSED_SKILLS.length + UNCHECKED_SKILLS.length + 1 && DIAGNOSED_SKILLS.length === 8, "eight skills on Exam 3, plus H₀ setup (not scheduled)");
ok(!buildPlan(result({}), today, "2026-11-25").some((d) => d.skills.includes("h0-setup")), "the plan never schedules writing H₀: the professor gives it");
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
