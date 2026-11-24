// Get Ahead (BETA): what's taught after Exam 2, before it's taught. #/ahead[/check|/papers]
import type { ReactNode } from "react";
import { ClipboardCheck, FileSpreadsheet, ListChecks, Rocket, TriangleAlert } from "lucide-react";
import { lessonsInUnit } from "../lib/lessons/index.ts";
import { unitBookId, VERSIONS } from "../lib/lessons/books.ts";
import Quiz from "../components/Quiz.tsx";
import { PracticePanel } from "../components/Books.tsx";
import PageHint from "../components/PageHint.tsx";
import { pooledQuiz } from "./Unit.tsx";
import { LessonRow } from "./Lessons.tsx";
import "./screens.css";
import "./hub.css";

const TABS = [
  { id: "", label: "Lessons", icon: ListChecks },
  { id: "check", label: "Quick check", icon: ClipboardCheck },
  { id: "papers", label: "Practice paper", icon: FileSpreadsheet },
] as const;

const COMING = [
  { when: "Mon 30 Nov", what: "Introduction to regression" },
  { when: "Wed 2 Dec", what: "Residual analysis" },
  { when: "Mon 7 Dec", what: "Multiple linear regression" },
  { when: "Wed 9 Dec", what: "Review" },
];

export default function Ahead({ tab }: { tab?: string }) {
  const t = TABS.find((x) => x.id === (tab ?? ""))?.id ?? "";
  const ls = lessonsInUnit(3);
  let body: ReactNode;
  if (t === "check") body = (
    <section className="panel" aria-labelledby="ac-h">
      <div className="panel-head"><h2 id="ac-h">Quick check</h2><span className="hint">10 questions across the Get Ahead lessons</span></div>
      <Quiz id="unit:3" items={pooledQuiz([3])} pick={10} />
    </section>
  );
  else if (t === "papers") body = (
    <PracticePanel headId="ap-h" title="Practice paper" ids={Array.from({ length: VERSIONS }, (_, k) => unitBookId(3, k + 1))}
      lead="One tab per Get Ahead lesson. BETA: built from last spring's final, so the layout may differ from this term's." />
  );
  else body = (
    <div className="stack">
      <section className="hub-sec" aria-labelledby="al-h">
        <div className="hub-sec-head"><h2 id="al-h">The lessons</h2></div>
        {ls.length ? <ol className="lrows stagger">{ls.map((L) => <LessonRow key={L.n} L={L} />)}</ol> : <p className="notice">These lessons are being written.</p>}
      </section>
      <section className="panel" aria-labelledby="sch-h">
        <div className="panel-head"><h2 id="sch-h">Still to come in class</h2><span className="hint">From the syllabus</span></div>
        <ul className="coming">{COMING.map((c) => <li key={c.when}><span className="num">{c.when}</span><span>{c.what}</span></li>)}</ul>
      </section>
    </div>
  );
  return (
    <div className="page hub">
      <header className="hub-head stagger">
        <p className="hub-eyebrow"><Rocket size={14} aria-hidden="true" /> Get ahead <span className="beta-tag">BETA</span></p>
        <h1>Learn it before it's taught</h1>
        <p className="notice beta-note"><TriangleAlert size={14} aria-hidden="true" /> BETA: there are no class notes for these yet. They're built from the syllabus, last spring's final (which had a regression section) and the course textbook, so details may differ from how the professor teaches it. Each lesson will be rebuilt from his notes once the class happens.</p>
        <PageHint>read a lesson, try its quick check, then the Excel practice. Everything works like the other lessons; it's just earlier.</PageHint>
      </header>
      <nav className="seg lesson-tabs" aria-label="Parts of Get Ahead">
        {TABS.map(({ id, label, icon: Icon }) => (
          <a key={id || "lessons"} href={`#/ahead${id ? `/${id}` : ""}`} aria-current={t === id ? "page" : undefined} className="seg-link"><Icon size={14} aria-hidden="true" />{label}</a>
        ))}
      </nav>
      <div className="lesson-body" key={t}>{body}</div>
    </div>
  );
}
