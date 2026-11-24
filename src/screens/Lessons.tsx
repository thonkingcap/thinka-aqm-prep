// Lesson by lesson review: the list (#/lessons) and one lesson (#/lesson/<n>[/example|/check|/practice]).
import { useEffect, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ClipboardCheck, FileSpreadsheet, Lightbulb, MessageSquare, TriangleAlert } from "lucide-react";
import { LESSONS, lessonByN } from "../lib/lessons/index.ts";
import { lessonBookId, VERSIONS, UNIT_INFO } from "../lib/lessons/books.ts";
import { quizBest, markOpened } from "../lib/lessons/progress.ts";
import type { Lesson, UnitId } from "../lib/lessons/types.ts";
import { useSession } from "../session.tsx";
import Quiz from "../components/Quiz.tsx";
import { PracticePanel, bookBest } from "../components/Books.tsx";
import { Formula } from "../components/ui.tsx";
import "./screens.css";
import "./hub.css";

export function lessonPracticeBest(L: Lesson): number | null {
  let best: number | null = null;
  for (let v = 1; v <= VERSIONS; v++) { const b = bookBest(lessonBookId(L.n, v)); if (b !== null) best = Math.max(best ?? 0, b); }
  return best;
}

/** One row in a list of lessons, with the student's progress. */
export function LessonRow({ L }: { L: Lesson }) {
  const q = quizBest(`lesson:${L.n}`);
  const p = lessonPracticeBest(L);
  return (
    <li>
      <a className="lrow lift" href={`#/lesson/${L.n}`}>
        <span className="lrow-n num">{L.n}</span>
        <span className="lrow-text">
          <b>{L.title}{L.beta && <span className="beta-tag">BETA</span>}</b>
          <span className="hint">{L.week}</span>
        </span>
        <span className="lrow-progress">
          {q ? <span className={`pill ${q.best === q.total ? "pill-pos" : "pill-neutral"}`}>Check {q.best}/{q.total}</span> : null}
          {p !== null ? <span className={`pill ${p === 1 ? "pill-pos" : "pill-neutral"}`}>Excel {Math.round(p * 100)}%</span> : null}
        </span>
        <ArrowRight size={14} aria-hidden="true" className="lrow-go" />
      </a>
    </li>
  );
}

export function LessonList() {
  const groups: { u: UnitId; title: string; sub: string }[] = [
    { u: 1, title: "Unit 1", sub: `On ${UNIT_INFO[1].exam}` },
    { u: 2, title: "Unit 2", sub: `On ${UNIT_INFO[2].exam}` },
    { u: 3, title: "After Exam 2", sub: "Get Ahead (BETA): not taught yet" },
  ];
  return (
    <div className="page hub">
      <header className="hub-head stagger">
        <p className="hub-eyebrow"><BookOpen size={14} aria-hidden="true" /> Lesson by lesson</p>
        <h1>Pick a lesson</h1>
      </header>
      {!LESSONS.length && <p className="notice">Lessons are being added. Check back soon.</p>}
      {groups.map((g) => {
        const ls = LESSONS.filter((L) => L.unit === g.u);
        if (!ls.length) return null;
        return (
          <section key={g.u} className="hub-sec" aria-labelledby={`lg-${g.u}`}>
            <div className="hub-sec-head"><h2 id={`lg-${g.u}`}>{g.title}</h2><span className="hint">{g.sub}</span></div>
            <ol className="lrows stagger">{ls.map((L) => <LessonRow key={L.n} L={L} />)}</ol>
          </section>
        );
      })}
    </div>
  );
}

const TABS = [
  { id: "learn", label: "Learn", icon: BookOpen },
  { id: "example", label: "Worked example", icon: Lightbulb },
  { id: "check", label: "Quick check", icon: ClipboardCheck },
  { id: "practice", label: "Excel practice", icon: FileSpreadsheet },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function LessonPage({ n, tab }: { n: number; tab?: string }) {
  const L = lessonByN(n);
  const { askTutor } = useSession();
  useEffect(() => { if (L) markOpened(L.n, L.title); }, [L]);
  if (!L) return <LessonList />;
  const t: Tab = (TABS.find((x) => x.id === tab)?.id ?? "learn") as Tab;
  const i = LESSONS.indexOf(L);
  const prev = LESSONS[i - 1], next = LESSONS[i + 1];
  const ask = () => askTutor(`Teach me AQM 1000 Lesson ${L.n}, "${L.title}", the way Dr Arathoon taught it: the key definitions, then one example in Excel, then quiz me one question at a time.`);

  let body: ReactNode;
  if (t === "learn") body = <Learn L={L} />;
  else if (t === "example") body = <Examples L={L} />;
  else if (t === "check") body = (
    <section className="panel" aria-labelledby="qc-h">
      <div className="panel-head"><h2 id="qc-h">Quick check</h2><span className="hint">{L.quiz.length} questions</span></div>
      <Quiz id={`lesson:${L.n}`} items={L.quiz} />
    </section>
  );
  else body = (
    <PracticePanel headId="pr-h" ids={Array.from({ length: VERSIONS }, (_, k) => lessonBookId(L.n, k + 1))} />
  );

  return (
    <div className="page hub lesson">
      <header className="hub-head stagger">
        <p className="hub-eyebrow"><a href="#/lessons" className="linkish">Lessons</a> <span aria-hidden="true">/</span> Lesson {L.n} · {L.unit === 3 ? "Get Ahead" : `Unit ${L.unit}`}</p>
        <h1>{L.title}{L.beta && <span className="beta-tag big">BETA</span>}</h1>
        <p className="hint">{L.week}</p>
        <p className="lesson-summary">{L.summary}</p>
        {L.beta && <p className="notice beta-note"><TriangleAlert size={14} aria-hidden="true" /> Not taught yet: built from the syllabus, last spring's final and the textbook, so details may differ from how he teaches it.</p>}
      </header>
      <nav className="seg lesson-tabs" aria-label="Parts of this lesson">
        {TABS.map(({ id, label, icon: Icon }) => (
          <a key={id} href={`#/lesson/${L.n}${id === "learn" ? "" : `/${id}`}`} aria-current={t === id ? "page" : undefined} className="seg-link">
            <Icon size={14} aria-hidden="true" />{label}
          </a>
        ))}
      </nav>
      <div className="lesson-body" key={t}>{body}</div>
      <div className="row lesson-ask">
        <button className="btn btn-ghost btn-small" onClick={ask}><MessageSquare size={14} aria-hidden="true" />Ask Dr Phil to teach this lesson</button>
        <span className="hint" title={L.sources.join(", ")}>{L.beta ? "Built from the syllabus and past finals" : "Built from his notes, homework and past exams"}</span>
      </div>
      <nav className="hub-pager" aria-label="Other lessons">
        {prev ? <a className="hub-pager-link lift" href={`#/lesson/${prev.n}${t === "learn" ? "" : `/${t}`}`}><ArrowLeft size={14} aria-hidden="true" /><span><span className="hint">Lesson {prev.n}</span><b>{prev.title}</b></span></a> : <span />}
        {next ? <a className="hub-pager-link next lift" href={`#/lesson/${next.n}${t === "learn" ? "" : `/${t}`}`}><span><span className="hint">Lesson {next.n}</span><b>{next.title}</b></span><ArrowRight size={14} aria-hidden="true" /></a> : <a className="hub-pager-link next lift" href="#/final"><span><span className="hint">That's every lesson</span><b>Go to the final review</b></span><ArrowRight size={14} aria-hidden="true" /></a>}
      </nav>
    </div>
  );
}

function Learn({ L }: { L: Lesson }) {
  const red = L.defs.filter((d) => d.red).length;
  return (
    <div className="lesson-learn">
      <section className="panel" aria-labelledby="defs-h">
        <div className="panel-head"><h2 id="defs-h">Definitions and key facts</h2><span className="hint">{red ? `${red} highlighted red in his notes` : ""}</span></div>
        <dl className="defs">
          {L.defs.map((d, k) => (
            <div key={k} className="def">
              <dt>{d.term}{d.red && <span className="pill pill-warn def-red">In red</span>}</dt>
              <dd>{d.text}{d.source && <span className="def-src">{d.source}</span>}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="lesson-side">
        {L.excel.length > 0 && (
          <section className="panel" aria-labelledby="xl-h">
            <div className="panel-head"><h2 id="xl-h">In Excel</h2></div>
            <ul className="xl-list">{L.excel.map((x) => <li key={x.fn}><code>{x.fn}</code><span>{x.use}</span></li>)}</ul>
          </section>
        )}
        {L.watch.length > 0 && (
          <section className="panel" aria-labelledby="watch-h">
            <div className="panel-head"><h2 id="watch-h">On the exams</h2></div>
            <ul className="watch-list">{L.watch.map((w, k) => <li key={k}>{w}</li>)}</ul>
          </section>
        )}
      </div>
    </div>
  );
}

function Examples({ L }: { L: Lesson }) {
  return (
    <div className="stack">
      {L.examples.map((ex, k) => (
        <section key={k} className="panel example" aria-labelledby={`ex-${k}`}>
          <div className="panel-head"><h2 id={`ex-${k}`}>{ex.title}</h2>{ex.source && <span className="hint">{ex.source}</span>}</div>
          <p className="example-setup">{ex.setup}</p>
          {ex.table && (
            <div className="example-table-wrap">
              <table className="ledger example-table">
                <thead><tr>{ex.table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{ex.table.rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className={typeof c === "number" ? "num" : ""}>{c}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
          <ol className="steps">
            {ex.steps.map((s, si) => (
              <li key={si}>
                <span className="step-n num">{si + 1}</span>
                <div className="step-body">
                  <p>{s.say}</p>
                  {(s.formula || s.result) && <div className="row step-calc">{s.formula && <Formula f={s.formula} />}{s.result && <span className="step-result">→ <b className="num">{s.result}</b></span>}</div>}
                </div>
              </li>
            ))}
          </ol>
          {ex.takeaway && <p className="example-take"><b>Remember:</b> {ex.takeaway}</p>}
        </section>
      ))}
    </div>
  );
}
