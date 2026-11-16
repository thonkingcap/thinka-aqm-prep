// Home: start with Exam 3, then the plan it builds, then the four areas and full practice exams.
import { useEffect, useState } from "react";
import { ArrowRight, Download, FileSpreadsheet, Timer } from "lucide-react";
import { AREAS, AREA_VERSIONS } from "../lib/areas.ts";
import { EXAM_COUNT, EXAM_MINUTES } from "../lib/sets.ts";
import { examDate, daysUntil } from "../lib/progress.ts";
import { readResult, currentPlan, todayIso, readDone } from "../lib/plan.ts";
import { downloadById } from "../lib/download.ts";
import { readScores } from "../components/UploadGrade.tsx";
import { DayRow } from "../components/PlanDays.tsx";
import PageHint from "../components/PageHint.tsx";
import { areaProgress } from "./Area.tsx";
import "./screens.css";
import "./home.css";

function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function usePlanState() {
  const [, bump] = useState(0);
  useEffect(() => {
    const on = () => bump((x) => x + 1);
    window.addEventListener("aqm:plan", on);
    window.addEventListener("storage", on);
    return () => { window.removeEventListener("aqm:plan", on); window.removeEventListener("storage", on); };
  }, []);
}

export default function Home() {
  usePlanState();
  const exam = examDate();
  const days = daysUntil(exam);
  const result = readResult();
  const plan = currentPlan();
  const done = readDone();
  const today = todayIso();
  const scores = readScores();
  const [allDays, setAllDays] = useState(false);

  const upcoming = plan?.filter((d) => d.date >= today) ?? [];
  const shown = allDays ? (plan ?? []) : upcoming.slice(0, 3);
  const totalTasks = plan?.reduce((s, d) => s + d.tasks.length, 0) ?? 0;
  const doneTasks = plan?.reduce((s, d) => s + d.tasks.filter((_, i) => done[`${d.date}:${i}`]).length, 0) ?? 0;

  return (
    <div className="page home">
      <header className="home-head stagger">
        <p className="home-count">
          <span className="home-count-n num">{Math.max(0, days)}</span>
          <span>{days > 0 ? `day${days === 1 ? "" : "s"} until Midterm 2 · ${longDate(exam)}` : days === 0 ? "Midterm 2 is today. You've got this." : "Midterm 2 has passed"}</span>
        </p>
        <h1>Get ready for Midterm 2, in Excel, the way the exam works.</h1>
        <PageHint>start with Exam 3. Drop in your finished copy and the site marks it, then builds a plan from what you missed. After that, work through the four areas below.</PageHint>
      </header>

      <section className={`home-hero lift${result ? " has-result" : ""}`} aria-labelledby="hero-h">
        <div className="home-hero-text">
          <p className="home-hero-eyebrow"><FileSpreadsheet size={14} aria-hidden="true" /> Step 1 · the diagnostic</p>
          <h2 id="hero-h">{result ? "Exam 3 is marked" : "Start with Exam 3"}</h2>
          <p>
            {result
              ? `${result.points ? `You scored ${Math.round(result.points.got * 10) / 10} of ${result.points.total} points.` : `You got ${result.correct} of ${result.total} parts right.`} Your plan below is built from it. Did more practice? Drop Exam 3 in again any time to rebuild the plan.`
              : "Last spring's Exam 3 is the closest thing to the midterm. Do it in Excel (or use the copy you already finished), drop the file in, and get every answer marked, the likely slip on each mistake, and a study plan."}
          </p>
        </div>
        <ol className="home-hero-steps">
          <li><span className="num">1</span>Finish Exam 3 in Excel</li>
          <li><span className="num">2</span>Drop the file in</li>
          <li><span className="num">3</span>Get your marks and plan</li>
        </ol>
        <a className="btn btn-primary home-hero-cta" href="#/exam3">{result ? "Open Exam 3" : "Go to Exam 3"}<ArrowRight size={16} aria-hidden="true" /></a>
      </section>

      <section className="panel home-plan" aria-labelledby="plan-h">
        <div className="panel-head">
          <h2 id="plan-h">Your plan</h2>
          {plan && <span className="hint num">{doneTasks} of {totalTasks} tasks done</span>}
        </div>
        {plan && totalTasks > 0 && <div className="bar home-plan-bar" aria-hidden="true"><span style={{ width: `${Math.round((100 * doneTasks) / totalTasks)}%` }} /></div>}
        {!plan ? (
          <div className="home-empty">
            <p>Your day-by-day plan appears here once Exam 3 is marked. It puts your time on the questions you missed, area by area, up to the exam.</p>
            <a className="btn btn-ghost btn-small" href="#/exam3">Mark Exam 3 first<ArrowRight size={14} aria-hidden="true" /></a>
          </div>
        ) : (
          <>
            <ol className="days stagger">{shown.map((d) => <DayRow key={d.date} d={d} done={done} today={today} />)}</ol>
            {plan.length > shown.length || allDays ? (
              <button className="btn btn-ghost btn-small home-more" onClick={() => setAllDays(!allDays)}>{allDays ? "Show the next few days" : `Show all ${plan.length} days`}</button>
            ) : null}
          </>
        )}
      </section>

      <section aria-labelledby="areas-h" className="home-areas-wrap">
        <div className="home-sec-head"><h2 id="areas-h">The four areas of the exam</h2><span className="hint">Notes and {AREA_VERSIONS} Excel sets in each</span></div>
        <div className="home-areas stagger">
          {AREAS.map((a) => {
            const p = areaProgress(a.id);
            return (
              <a key={a.id} className="home-area lift" href={`#/area/${a.id}`}>
                <span className="home-area-n num">{a.n}</span>
                <b>{a.title}</b>
                <span className="home-area-blurb">{a.blurb}</span>
                <span className="home-area-foot">
                  <span className="bar" aria-hidden="true"><span style={{ width: `${p ? Math.round(p.best * 100) : 0}%` }} /></span>
                  <span className="hint num">{p ? `Best ${Math.round(p.best * 100)}% · ${p.done}/${AREA_VERSIONS} sets` : `Exam 3 Q${a.exam3[0]}${a.exam3.length > 1 ? `–Q${a.exam3[a.exam3.length - 1]}` : ""}`}</span>
                </span>
              </a>
            );
          })}
        </div>
      </section>

      <section className="panel" aria-labelledby="mocks-h" id="mocks">
        <div className="panel-head"><h2 id="mocks-h">Full practice exams</h2><span className="hint"><Timer size={12} aria-hidden="true" /> {EXAM_MINUTES} minutes each, like Exam 3</span></div>
        <p className="hint home-lead">All four areas in one workbook, laid out like the real exam. Set a timer, no calculator, then drop it into any upload box on the site.</p>
        <div className="home-mocks stagger">
          {Array.from({ length: EXAM_COUNT }, (_, k) => k + 1).map((n) => {
            const s = scores[`exam:${n}`];
            return (
              <div key={n} className="home-mock lift">
                <b>Exam {n}</b>
                <span className="hint num">{s ? `Best ${Math.round(s.best * 10) / 10}/${s.total}` : "Not tried yet"}</span>
                <button className="btn btn-ghost btn-small" onClick={() => downloadById(`exam:${n}`)} aria-label={`Download practice exam ${n}`}><Download size={13} aria-hidden="true" />Download</button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
