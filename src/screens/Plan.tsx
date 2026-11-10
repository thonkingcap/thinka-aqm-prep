import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Download, MessageSquare, RotateCcw } from "lucide-react";
import type { Question } from "../lib/practice.ts";
import {
  DIAGNOSTIC, SKILLS, DIAG_SEED_MAX, diagnosticQuestion, diagnosticQuestions, skillById, scoreDiagnostic, saveResult, readResult, readHistory, currentPlan, readDone, setDone, todayIso, lcFirst,
  type DiagnosticResult, type PlanDay, type SkillScore,
} from "../lib/plan.ts";
import { examDate } from "../lib/progress.ts";
import { questionSheet } from "../lib/workbook.ts";
import { buildXlsx, downloadXlsx } from "../lib/xlsx.ts";
import { UploadBox, GradeReport, DownloadNote } from "../components/UploadGrade.tsx";
import type { WorkbookGrade } from "../lib/grade.ts";
import { useSession } from "../session.tsx";
import { QuestionCard } from "./Practice.tsx";
import Thinka from "../components/Thinka.tsx";
import "./screens.css";
import "./practice.css";
import "./mocks.css";
import "./plan.css";

const PROGRESS = "aqm.diag.progress";
type Progress = { seeds: number[]; answers: { slot: number; ok: boolean[] }[] };

function readProgress(): Progress | null {
  try { const raw = localStorage.getItem(PROGRESS); return raw ? (JSON.parse(raw) as Progress) : null; } catch { return null; }
}
function writeProgress(p: Progress | null) {
  try { if (p) localStorage.setItem(PROGRESS, JSON.stringify(p)); else localStorage.removeItem(PROGRESS); } catch { /* ignore */ }
}
const questionFor = (slot: number, seed: number): Question => diagnosticQuestion(slot, seed);

// ---------------------------------------------------------------- the diagnostic as an Excel workbook
// One base seed (kept until the workbook is uploaded, so a re-download gives the same file)
// fixes all nine questions; it rides in the workbook's id, so the upload regrades exactly them.
const XLSX_SEED = "aqm.diag.xlsxSeed";
function diagSeed(): number {
  try {
    const v = Number(localStorage.getItem(XLSX_SEED));
    if (Number.isInteger(v) && v > 0 && v < DIAG_SEED_MAX) return v;
    const fresh = 1 + Math.floor(Math.random() * (DIAG_SEED_MAX - 1));
    localStorage.setItem(XLSX_SEED, String(fresh));
    return fresh;
  } catch { return 1 + Math.floor(Math.random() * (DIAG_SEED_MAX - 1)); }
}
function downloadDiagnostic() {
  const base = diagSeed();
  const sheets = diagnosticQuestions(base).map((q, i) => {
    const m = questionSheet(q, i + 1);
    m.cells.A1 = { v: `Q${i + 1}. ${DIAGNOSTIC[i].label} · ${q.title}`, role: "title" };
    return m;
  });
  const bytes = buildXlsx(sheets, {
    title: "Thinka's AQM Prep · Midterm 2 diagnostic",
    intro: [
      `${DIAGNOSTIC.length} questions, one for each kind the midterm asks · about 25 minutes · Excel only, like the real exam.`,
      "Each tab is one question. The numbers are already in their cells (column B, and data in column D): write formulas that point at them.",
      "Put each answer in its yellow cell as a formula (best) or the full, unrounded value. Like class, the underlying value is graded.",
      "For the multiple-choice parts, type one of the options shown next to the cell. Leave a cell blank if you don't know it: that's what the diagnostic is for.",
      "When you're done, save the file and upload it on the Study plan page. Your results become a day-by-day plan.",
    ],
    id: `diag:${base}`,
  });
  downloadXlsx(bytes, "AQM-Midterm2-Diagnostic.xlsx");
}

function DiagExcel({ onGraded, compact }: { onGraded: (g: WorkbookGrade) => void; compact?: boolean }) {
  return (
    <section className="panel stack diag-excel">
      <div className="panel-head"><h2>{compact ? "Retake in Excel" : "Or take it in Excel"}</h2></div>
      <p className="hint">Download the diagnostic as one workbook, solve it in real Excel, then upload it here. It's graded on this device and builds your plan the same way.</p>
      <div className="row">
        <button className="btn btn-secondary" onClick={downloadDiagnostic}><Download size={16} aria-hidden="true" />Download the diagnostic (.xlsx)</button>
        <DownloadNote />
      </div>
      <UploadBox onGraded={(g) => { if (g.kind === "diag") { try { localStorage.removeItem(XLSX_SEED); } catch { /* ignore */ } } onGraded(g); }} />
    </section>
  );
}

export function dayLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

const LEVEL: Record<SkillScore["level"], { label: string; cls: string }> = {
  strong: { label: "Strong", cls: "pill-pos" },
  shaky: { label: "Shaky", cls: "pill-warn" },
  gap: { label: "Gap", cls: "pill-neg" },
};

// ---------------------------------------------------------------- the diagnostic run
function Diagnostic() {
  const [prog, setProg] = useState<Progress>(() => {
    const existing = readProgress();
    if (existing && existing.answers.length < DIAGNOSTIC.length) return existing;
    const fresh = { seeds: DIAGNOSTIC.map(() => Math.floor(Math.random() * 2 ** 31)), answers: [] };
    writeProgress(fresh);
    return fresh;
  });
  const [answered, setAnswered] = useState(false);
  const pending = useRef<Progress | null>(null);
  const slot = prog.answers.length;
  const q = useMemo(() => (slot < DIAGNOSTIC.length ? questionFor(slot, prog.seeds[slot]) : null), [slot, prog.seeds]);

  function done(_c: number, _t: number, ok: boolean[]) {
    const next = { ...prog, answers: [...prog.answers, { slot, ok }] };
    writeProgress(next);
    setAnswered(true);
    // The card stays on screen with its feedback until "Next" is pressed.
    pending.current = next;
  }

  function next() {
    const p = pending.current ?? prog;
    pending.current = null;
    setAnswered(false);
    if (p.answers.length >= DIAGNOSTIC.length) {
      const result = scoreDiagnostic(p.answers.map((a) => ({ q: questionFor(a.slot, p.seeds[a.slot]), slot: a.slot, ok: a.ok })));
      saveResult(result);
      writeProgress(null);
      location.hash = "#/plan";
      return;
    }
    setProg(p);
    window.scrollTo(0, 0);
  }

  const [sheetOn, setSheetOn] = useState(() => { try { return localStorage.getItem("aqm.sheetOn") !== "0"; } catch { return true; } });
  const sheetModel = useMemo(() => (q ? questionSheet(q, slot + 1) : null), [q, slot]);
  function toggleSheet() {
    setSheetOn((v) => { try { localStorage.setItem("aqm.sheetOn", v ? "0" : "1"); } catch { /* ignore */ } return !v; });
  }

  if (!q) return null;
  const isLast = slot === DIAGNOSTIC.length - 1;
  return (
    <div className="page practice diag">
      <div className="title-row">
        <div>
          <h1>Diagnostic</h1>
          <p className="sub">Question {slot + 1} of {DIAGNOSTIC.length}: {DIAGNOSTIC[slot].label}. Answer the way you would on the exam: full values or formulas, not rounded numbers. Skip what you don't know.</p>
        </div>
        <div className="row">
          <label className="check sheet-toggle"><input type="checkbox" checked={sheetOn} onChange={toggleSheet} /><span>Work in the Excel sheet</span></label>
          <a className="linkish" href="#/plan">Save and finish later</a>
        </div>
      </div>
      <ol className="diag-steps" aria-label="Progress">
        {DIAGNOSTIC.map((d, i) => (
          <li key={d.label} className={i < slot || (i === slot && answered) ? "done" : i === slot ? "now" : ""}>
            <span className="sr-only">{d.label}{i < slot ? ", answered" : i === slot ? ", current" : ""}</span>
          </li>
        ))}
      </ol>
      <QuestionCard key={q.id + slot} q={q} sheet={sheetOn && sheetModel ? { model: sheetModel, storageId: `diag-${slot}-${prog.seeds[slot]}` } : undefined} onDone={done} onNext={next} nextLabel={isLast ? "See my results and plan" : "Next question"} allowTutor={false} allowSkip />
    </div>
  );
}

// ---------------------------------------------------------------- intro (no result yet)
function Intro({ onGraded }: { onGraded: (g: WorkbookGrade) => void }) {
  const inProgress = readProgress();
  return (
    <div className="page plan">
      <header className="plan-intro">
        <span className="thinka-hop plan-thinka"><Thinka size={72} mood="thinking" /></span>
        <h1>Find your gaps before {longDate(examDate())}</h1>
        <p className="plan-lede">Nine exam-style questions, one for each kind the midterm asks. Each answer is graded part by part, and the results become a day-by-day plan that spends your time on what you got wrong.</p>
        <div className="row">
          <a className="btn btn-primary" href="#/plan/check">{inProgress?.answers.length ? `Continue: question ${inProgress.answers.length + 1} of ${DIAGNOSTIC.length}` : "Start the diagnostic"}<ArrowRight size={16} aria-hidden="true" /></a>
          <span className="hint">About 25 minutes · graded on this device · uses no API credit</span>
        </div>
      </header>
      <DiagExcel onGraded={onGraded} />
      <section className="panel plan-covers">
        <div className="panel-head"><h2>What it checks</h2></div>
        <table className="ledger">
          <tbody>
            {SKILLS.map((s) => (
              <tr key={s.id}><td className="lbl"><div className="formula-label">{s.name}</div><div className="hint">{s.task}</div></td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- results and plan
function SkillMap({ r, prev }: { r: DiagnosticResult; prev?: DiagnosticResult }) {
  return (
    <table className="ledger skill-map">
      <tbody>
        {r.scores.map((s) => {
          const p = prev?.scores.find((x) => x.id === s.id);
          const pct = s.total ? s.correct / s.total : 0;
          return (
            <tr key={s.id}>
              <td className="lbl">
                <div className="skill-name">{skillById(s.id).name}</div>
                <div className="skill-bar" aria-hidden="true"><span style={{ width: `${Math.round(pct * 100)}%` }} /></div>
              </td>
              <td className="val num">
                <div>{s.correct}/{s.total}</div>
                {p && p.total > 0 && <div className="hint">was {p.correct}/{p.total}</div>}
              </td>
              <td className="val"><span className={`pill ${LEVEL[s.level].cls}`}>{LEVEL[s.level].label}</span></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function DayRow({ d, done, today }: { d: PlanDay; done: Record<string, boolean>; today: string }) {
  const { askTutor } = useSession();
  const past = d.date < today;
  const isToday = d.date === today;
  const allDone = d.tasks.every((_, i) => done[`${d.date}:${i}`]);
  return (
    <li className={`day${isToday ? " today" : ""}${past && !allDone ? " missed" : ""}${allDone ? " complete" : ""}`} id={isToday ? "today" : undefined}>
      <div className="day-date">
        <span className="num">{dayLabel(d.date)}</span>
        {isToday && <span className="pill pill-neutral">Today</span>}
      </div>
      <div className="day-body">
        <h3>{d.title}</h3>
        <p className="hint">{d.why}</p>
        <ul className="tasks">
          {d.tasks.map((t, i) => {
            const id = `${d.date}:${i}`;
            return (
              <li key={id}>
                <label className="check task-check">
                  <input type="checkbox" checked={!!done[id]} onChange={(e) => setDone(id, e.target.checked)} aria-label={`Mark done: ${t.label}`} />
                </label>
                {t.kind === "tutor" ? (
                  <button className="task-link linkbtn" onClick={() => askTutor(t.tutorPrompt!)}><MessageSquare size={14} aria-hidden="true" />{t.label}</button>
                ) : (
                  <a className="task-link" href={t.href}>{t.label}</a>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </li>
  );
}

function Results({ r, onGraded }: { r: DiagnosticResult; onGraded: (g: WorkbookGrade) => void }) {
  const { askTutor } = useSession();
  const [done, setDoneState] = useState(readDone);
  useEffect(() => {
    const on = () => setDoneState(readDone());
    window.addEventListener("aqm:plan", on);
    return () => window.removeEventListener("aqm:plan", on);
  }, []);
  const plan = currentPlan() ?? [];
  const hist = readHistory();
  const prev = hist.length > 1 ? hist[hist.length - 2] : undefined;
  const today = todayIso();
  const gaps = r.scores.filter((s) => s.level === "gap").map((s) => skillById(s.id).name);
  const todayDay = plan.find((d) => d.date === today);
  const totalTasks = plan.reduce((s, d) => s + d.tasks.length, 0);
  const doneTasks = plan.reduce((s, d) => s + d.tasks.filter((_, i) => done[`${d.date}:${i}`]).length, 0);

  function aiRead() {
    askTutor(
      `I just took the site's diagnostic for Midterm 2 (exam on ${longDate(examDate())}). My results by skill:\n` +
      r.scores.map((s) => `- ${skillById(s.id).name}: ${s.correct}/${s.total} (${s.level})`).join("\n") +
      `\n\nThe site gave me this plan:\n` + plan.map((d) => `- ${dayLabel(d.date)}: ${d.title}`).join("\n") +
      `\n\nIn a few sentences, tell me what these results say about how I think about the material, which single misconception to fix first, and then give me one exam-style question on my weakest skill.`,
    );
  }

  return (
    <div className="page plan wide-plan">
      <header className="title-row plan-head">
        <div className="plan-head-main">
          <span className="thinka-hop"><Thinka size={56} mood={r.total && r.correct / r.total >= 0.8 ? "proud" : r.total && r.correct / r.total >= 0.5 ? "happy" : "thinking"} /></span>
          <div>
          <h1>Your plan to {longDate(examDate())}</h1>
          <p className="sub">
            {r.correct} of {r.total} parts right in the diagnostic.{" "}
            {gaps.length ? `Biggest gaps: ${gaps.slice(0, 3).join(", ")}${gaps.length > 3 ? ` and ${gaps.length - 3} more` : ""}.` : "No gaps: the plan keeps everything warm."}
            {todayDay ? ` Today: ${lcFirst(todayDay.title)}.` : ""}
          </p>
          </div>
        </div>
        <div className="row">
          <span className="hint num">{doneTasks} of {totalTasks} tasks done</span>
        </div>
      </header>

      <div className="plan-grid">
        <section className="panel">
          <div className="panel-head"><h2>Day by day</h2>{plan[0] && <span className="hint">Built {dayLabel(plan[0].date)}</span>}</div>
          <ol className="days">{plan.map((d) => <DayRow key={d.date} d={d} done={done} today={today} />)}</ol>
        </section>
        <aside className="stack">
          <section className="panel">
            <div className="panel-head"><h2>Skill map</h2>{prev && <span className="hint">vs your last attempt</span>}</div>
            <SkillMap r={r} prev={prev} />
          </section>
          <section className="panel stack">
            <button className="btn btn-secondary" onClick={aiRead}><MessageSquare size={16} aria-hidden="true" />Ask Claude to read my results</button>
            <a className="btn btn-ghost" href="#/plan/check"><RotateCcw size={16} aria-hidden="true" />Retake the diagnostic</a>
            <p className="hint">A retake writes a new plan from that day, based on the new results.</p>
          </section>
          <DiagExcel onGraded={onGraded} compact />
        </aside>
      </div>
    </div>
  );
}

export default function Plan({ sub }: { sub?: string }) {
  const [graded, setGraded] = useState<WorkbookGrade | null>(null);
  if (sub === "check") return <Diagnostic />;
  const show = (g: WorkbookGrade) => { setGraded(g); window.scrollTo(0, 0); };
  if (graded) {
    const diag = graded.kind === "diag";
    return (
      <div className="page plan">
        <div className="title-row">
          <div>
            <h1>{diag ? "Your diagnostic, graded" : graded.title}</h1>
            <p className="sub">{diag ? "Every yellow cell checked on the full value. Your study plan has been rebuilt from these results." : "That's not the diagnostic workbook, so your plan is unchanged. Here's its grade anyway."}</p>
          </div>
          <button className="btn btn-primary" onClick={() => setGraded(null)}>{diag ? "See my results and plan" : "Back to the plan"}<ArrowRight size={16} aria-hidden="true" /></button>
        </div>
        <GradeReport g={graded} />
      </div>
    );
  }
  const r = readResult();
  return r ? <Results r={r} onGraded={show} /> : <Intro onGraded={show} />;
}
