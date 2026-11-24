// Final review: #/final[/papers|/check|/defs]. The final is cumulative (Wed 16 Dec 2026, LGRAC).
import { useMemo, useState, type ReactNode } from "react";
import { BookMarked, CalendarClock, ClipboardCheck, FileSpreadsheet, Gauge, Printer, Route } from "lucide-react";
import Diagnostic from "../components/Diagnostic.tsx";
import { LESSONS, lessonsInUnit } from "../lib/lessons/index.ts";
import { finalBookId, VERSIONS } from "../lib/lessons/books.ts";
import { finalDate, daysTo } from "../lib/lessons/dates.ts";
import { quizBest } from "../lib/lessons/progress.ts";
import type { UnitId } from "../lib/lessons/types.ts";
import Quiz from "../components/Quiz.tsx";
import { PracticePanel } from "../components/Books.tsx";
import { pooledQuiz } from "./Unit.tsx";
import { lessonPracticeBest } from "./Lessons.tsx";
import "./screens.css";
import "./hub.css";

const TABS = [
  { id: "", label: "How to prepare", icon: Route },
  { id: "test", label: "Practice test", icon: Gauge },
  { id: "papers", label: "Review papers", icon: FileSpreadsheet },
  { id: "check", label: "Mixed check", icon: ClipboardCheck },
  { id: "defs", label: "Every definition", icon: BookMarked },
] as const;

function UnitBar({ u, label, href }: { u: UnitId; label: string; href: string }) {
  const ls = lessonsInUnit(u);
  const done = ls.filter((L) => quizBest(`lesson:${L.n}`) || lessonPracticeBest(L) !== null).length;
  return (
    <a className="final-unit lift" href={href}>
      <b>{label}</b>
      <span className="bar" aria-hidden="true"><span style={{ width: `${ls.length ? (100 * done) / ls.length : 0}%` }} /></span>
      <span className="hint num">{done} of {ls.length} lessons started</span>
    </a>
  );
}

function Prepare() {
  return (
    <div className="stack">
      <section className="panel" aria-labelledby="what-h">
        <div className="panel-head"><h2 id="what-h">What's on it</h2><span className="hint">From the syllabus</span></div>
        <ul className="watch-list">
          <li>Wednesday 16 December, in LGRAC. It's worth 30% of the grade (Exams 1 and 2 are 20% each).</li>
          <li>It's cumulative: Unit 1, Unit 2, and what's taught after Thanksgiving (introduction to regression, residual analysis, multiple linear regression).</li>
          <li>Last spring's final was two hours in Excel with one double-sided handwritten note sheet allowed. Check the professor's announcement for this term's rules.</li>
        </ul>
      </section>
      <section className="panel" aria-labelledby="how-h">
        <div className="panel-head"><h2 id="how-h">How he told students to revise last spring</h2><span className="hint">In his order of importance</span></div>
        <ol className="final-steps">
          <li><b>Read every class notes file and note every definition.</b> <span>The <a href="#/final/defs">Every definition</a> tab has them all in one place, by lesson. Use it to build your handwritten sheet.</span></li>
          <li><b>Redo every exam under exam conditions, timed.</b> <span>His past papers are on Canvas (Files › Past Exams). The <a href="#/final/test">practice test</a> here is marked when you upload it.</span></li>
          <li><b>Know each homework well enough to repeat a question quickly.</b> <span>Homework solutions are on Canvas. Each lesson's Excel practice mirrors the homework style.</span></li>
          <li><b>Look over the past exams and make sure you can answer every question.</b> <span>Use the <a href="#/final/check">mixed check</a> to find weak lessons, then open that lesson.</span></li>
          <li><b>Practise saving the file to your computer (not OneDrive) and uploading it to Canvas.</b> <span>He gives no consideration for late or wrong uploads.</span></li>
        </ol>
      </section>
      <section aria-labelledby="units-h">
        <div className="hub-sec-head"><h2 id="units-h">Where you are</h2></div>
        <div className="final-units">
          <UnitBar u={1} label="Unit 1" href="#/unit/1" />
          <UnitBar u={2} label="Unit 2" href="#/unit/2" />
          <UnitBar u={3} label="Get Ahead (BETA)" href="#/ahead" />
        </div>
      </section>
    </div>
  );
}

function AllDefs() {
  const [onlyRed, setOnlyRed] = useState(false);
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    return LESSONS.map((L) => ({
      L, defs: L.defs.filter((d) => (!onlyRed || d.red) && (!s || `${d.term} ${d.text}`.toLowerCase().includes(s))),
    })).filter((g) => g.defs.length);
  }, [onlyRed, q]);
  const total = groups.reduce((s, g) => s + g.defs.length, 0);
  return (
    <section className="panel all-defs" aria-labelledby="ad-h">
      <div className="panel-head"><h2 id="ad-h">Every definition, by lesson</h2><span className="hint num">{total} shown</span></div>
      <div className="row all-defs-tools">
        <input className="input" type="search" placeholder="Search, e.g. variance" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search definitions" />
        <label className="check"><input type="checkbox" checked={onlyRed} onChange={(e) => setOnlyRed(e.target.checked)} /> Only the ones in red</label>
        <button className="btn btn-ghost btn-small" onClick={() => window.print()}><Printer size={14} aria-hidden="true" />Print</button>
      </div>
      {groups.map(({ L, defs }) => (
        <div key={L.n} className="all-defs-group">
          <h3><a href={`#/lesson/${L.n}`}>Lesson {L.n}: {L.title}</a>{L.beta && <span className="beta-tag">BETA</span>}</h3>
          <dl className="defs compact">
            {defs.map((d, k) => (
              <div key={k} className="def"><dt>{d.term}{d.red && <span className="pill pill-warn def-red">In red</span>}</dt><dd>{d.text}</dd></div>
            ))}
          </dl>
        </div>
      ))}
      {!groups.length && <p className="hint">Nothing matches.</p>}
    </section>
  );
}

export default function Final({ tab }: { tab?: string }) {
  const t = TABS.find((x) => x.id === (tab ?? ""))?.id ?? "";
  const days = daysTo(finalDate());
  let body: ReactNode;
  if (t === "test") body = <Diagnostic id="dx:final" like="laid out like last spring's final" />;
  else if (t === "papers") body = <PracticePanel headId="fp-h" title="Final review papers" ids={Array.from({ length: VERSIONS }, (_, k) => finalBookId(k + 1))} />;
  else if (t === "check") body = (
    <section className="panel" aria-labelledby="fc-h">
      <div className="panel-head"><h2 id="fc-h">Mixed quick check</h2><span className="hint">15 questions</span></div>
      <Quiz id="final" items={pooledQuiz([1, 2, 3])} pick={15} />
    </section>
  );
  else if (t === "defs") body = <AllDefs />;
  else body = <Prepare />;
  return (
    <div className="page hub">
      <header className="hub-head stagger">
        <p className="hub-eyebrow"><CalendarClock size={14} aria-hidden="true" /> Final review</p>
        <p className="home-count"><span className="home-count-n num">{Math.max(0, days)}</span><span>{days > 0 ? `day${days === 1 ? "" : "s"} until the final · Wednesday 16 December` : days === 0 ? "The final is today. You've got this." : "The final has passed"}</span></p>
        <h1>Get ready for the final</h1>
      </header>
      <nav className="seg lesson-tabs" aria-label="Parts of the final review">
        {TABS.map(({ id, label, icon: Icon }) => (
          <a key={id || "prep"} href={`#/final${id ? `/${id}` : ""}`} aria-current={t === id ? "page" : undefined} className="seg-link"><Icon size={14} aria-hidden="true" />{label}</a>
        ))}
      </nav>
      <div className="lesson-body" key={t}>{body}</div>
    </div>
  );
}
