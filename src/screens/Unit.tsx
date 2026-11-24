// Unit by unit review: #/units (pick a unit) and #/unit/<1|2>[/check|/papers|/kit].
import type { ReactNode } from "react";
import { ArrowRight, ClipboardCheck, FileSpreadsheet, Layers, ListChecks, Wrench } from "lucide-react";
import { lessonsInUnit } from "../lib/lessons/index.ts";
import { unitBookId, VERSIONS, UNIT_INFO } from "../lib/lessons/books.ts";
import { quizBest } from "../lib/lessons/progress.ts";
import type { UnitId } from "../lib/lessons/types.ts";
import Quiz, { type QuizItem } from "../components/Quiz.tsx";
import { PracticePanel, bookBest } from "../components/Books.tsx";
import Exam2Kit from "../components/Exam2Kit.tsx";
import PageHint from "../components/PageHint.tsx";
import { LessonRow, lessonPracticeBest } from "./Lessons.tsx";
import "./screens.css";
import "./hub.css";

/** Every quick-check question from a set of lessons, labelled with where it's from. */
export function pooledQuiz(units: UnitId[]): QuizItem[] {
  return units.flatMap((u) => lessonsInUnit(u)).flatMap((L) => L.quiz.map((q) => ({ ...q, from: `Lesson ${L.n}` })));
}

function unitProgress(u: UnitId) {
  const ls = lessonsInUnit(u);
  const touched = ls.filter((L) => quizBest(`lesson:${L.n}`) || lessonPracticeBest(L) !== null).length;
  return { total: ls.length, touched };
}

export function UnitList() {
  return (
    <div className="page hub">
      <header className="hub-head stagger">
        <p className="hub-eyebrow"><Layers size={14} aria-hidden="true" /> Unit by unit</p>
        <h1>Pick a unit</h1>
        <PageHint>a unit is everything on one midterm. Each has a mixed quick check across its lessons and exam-style review papers the site marks.</PageHint>
      </header>
      <div className="unit-cards stagger">
        {([1, 2] as UnitId[]).map((u) => {
          const p = unitProgress(u);
          return (
            <a key={u} className="unit-card lift" href={`#/unit/${u}`}>
              <span className="unit-card-n num">{u}</span>
              <b>Unit {u}</b>
              <span className="hint">Everything on {UNIT_INFO[u].exam}</span>
              <span className="unit-card-blurb">{UNIT_INFO[u].blurb}</span>
              <span className="unit-card-foot">
                <span className="hint num">{p.total ? `${p.touched} of ${p.total} lessons started` : "Lessons on their way"}</span>
                <ArrowRight size={14} aria-hidden="true" />
              </span>
            </a>
          );
        })}
      </div>
      <a className="hub-callout lift" href="#/final">
        <span><b>Revising for the final?</b><span className="hint">The final review mixes both units with the regression material.</span></span>
        <ArrowRight size={14} aria-hidden="true" />
      </a>
    </div>
  );
}

const TABS = [
  { id: "", label: "Lessons", icon: ListChecks },
  { id: "check", label: "Mixed check", icon: ClipboardCheck },
  { id: "papers", label: "Review papers", icon: FileSpreadsheet },
] as const;

export default function UnitPage({ u: raw, tab }: { u?: string; tab?: string }) {
  const u = Number(raw) as UnitId;
  if (u !== 1 && u !== 2) return <UnitList />;
  const U = UNIT_INFO[u];
  const ls = lessonsInUnit(u);
  const tabs = u === 2 ? [...TABS, { id: "kit", label: "Midterm 2 toolkit", icon: Wrench } as const] : TABS;
  const t = tabs.find((x) => x.id === (tab ?? ""))?.id ?? "";
  const pool = pooledQuiz([u]);
  const papers = Array.from({ length: VERSIONS }, (_, k) => unitBookId(u, k + 1));
  const bestPaper = Math.max(-1, ...papers.map((id) => bookBest(id) ?? -1));

  let body: ReactNode;
  if (t === "check") body = (
    <section className="panel" aria-labelledby="mc-h">
      <div className="panel-head"><h2 id="mc-h">Mixed quick check</h2><span className="hint">10 questions drawn from all {ls.length} lessons · new ones each time</span></div>
      {pool.length ? <Quiz id={`unit:${u}`} items={pool} pick={10} /> : <p className="hint">Questions are on their way.</p>}
    </section>
  );
  else if (t === "papers") body = (
    <>
      <PracticePanel headId="up-h" title="Review papers" ids={papers}
        lead={`A question from each area of the unit, laid out like ${U.exam}. Give yourself an hour, Excel only, formulas in the yellow cells.`} />
      {u === 1 && <p className="notice hub-canvas">The professor's own past Exam 1s (Fall 2025, Spring 2026 and this term's) with solutions are on Canvas under Files › Past Exams. Do at least one under exam conditions: 60 minutes, Excel only.</p>}
      {u === 2 && <p className="notice hub-canvas">More exam-style papers are in the <a href="#/unit/2/kit">Midterm 2 toolkit</a>, and the professor's past papers are on Canvas under Files › Past Exams.</p>}
    </>
  );
  else if (t === "kit") body = <Exam2Kit />;
  else body = (
    <section className="hub-sec" aria-labelledby="ul-h">
      <div className="hub-sec-head"><h2 id="ul-h">Lessons in Unit {u}</h2><span className="hint">Work down the list, then try the mixed check and a review paper</span></div>
      {ls.length ? <ol className="lrows stagger">{ls.map((L) => <LessonRow key={L.n} L={L} />)}</ol> : <p className="notice">Lessons are being added.</p>}
    </section>
  );

  const q = quizBest(`unit:${u}`);
  return (
    <div className="page hub">
      <header className="hub-head stagger">
        <p className="hub-eyebrow"><a href="#/units" className="linkish">Units</a> <span aria-hidden="true">/</span> Unit {u}</p>
        <h1>Unit {u}: everything on {U.exam}</h1>
        <p className="lesson-summary">{U.blurb}</p>
        <div className="row hub-stats">
          <span className="pill pill-neutral num">{ls.length} lessons</span>
          {q && <span className="pill pill-neutral num">Mixed check best {q.best}/{q.total}</span>}
          {bestPaper >= 0 && <span className="pill pill-neutral num">Best paper {Math.round(bestPaper * 100)}%</span>}
        </div>
      </header>
      <nav className="seg lesson-tabs" aria-label={`Parts of Unit ${u}`}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <a key={id || "lessons"} href={`#/unit/${u}${id ? `/${id}` : ""}`} aria-current={t === id ? "page" : undefined} className="seg-link"><Icon size={14} aria-hidden="true" />{label}</a>
        ))}
      </nav>
      <div className="lesson-body" key={t}>{body}</div>
    </div>
  );
}
