// One of the exam's four areas: its notes, its Excel practice sets, and an upload box to mark them.
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Download, MessageSquare } from "lucide-react";
import { AREAS, AREA_VERSIONS, areaById, type Area as AreaT } from "../lib/areas.ts";
import { topicById } from "../lib/course.ts";
import { downloadById } from "../lib/download.ts";
import { UploadBox, GradeReport, readScores, DownloadNote } from "../components/UploadGrade.tsx";
import type { WorkbookGrade } from "../lib/grade.ts";
import { useSession } from "../session.tsx";
import PageHint from "../components/PageHint.tsx";
import "./screens.css";
import "./area.css";

const qRange = (a: AreaT) => (a.exam3.length > 1 ? `Q${a.exam3[0]}–Q${a.exam3[a.exam3.length - 1]}` : `Q${a.exam3[0]}`);
export const areaSetId = (id: string, v: number) => `area:${id}:${v}`;

/** Best score across an area's sets, as a fraction (null if none uploaded yet). */
export function areaProgress(id: string): { best: number; done: number } | null {
  const s = readScores();
  let best = -1, done = 0;
  for (let v = 1; v <= AREA_VERSIONS; v++) {
    const r = s[areaSetId(id, v)];
    if (!r || !r.total) continue;
    done++;
    best = Math.max(best, r.best / r.total);
  }
  return done ? { best, done } : null;
}

export default function Area({ id, route = [] }: { id?: string; route?: string[] }) {
  const a = areaById(id ?? "") ?? AREAS[0];
  const hitSet = route[0] === "set" ? Number(route[1]) : NaN;
  const [graded, setGraded] = useState<WorkbookGrade | null>(null);
  const [scores, setScores] = useState(readScores);
  const { askTutor } = useSession();
  const i = AREAS.indexOf(a);
  const prev = AREAS[i - 1], next = AREAS[i + 1];

  useEffect(() => {
    if (!Number.isFinite(hitSet)) return;
    const t = window.setTimeout(() => document.getElementById(`set-${hitSet}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
    return () => window.clearTimeout(t);
  }, [hitSet]);

  return (
    <div className="page area">
      <header className="area-head stagger">
        <p className="area-eyebrow"><span className="area-badge" aria-hidden="true">{a.n}</span>Section {a.n} of {AREAS.length} · Exam 3 {qRange(a)}</p>
        <h1>{a.title}</h1>
        <p className="area-blurb">{a.blurb}</p>
        <PageHint>read the notes, download a set, solve it in Excel with formulas (no calculator), then drop the saved file below to see what went right and what slipped.</PageHint>
      </header>

      <div className="area-grid">
        <section className="panel area-learn" aria-labelledby="learn-h">
          <div className="panel-head"><h2 id="learn-h"><BookOpen size={15} aria-hidden="true" /> Learn</h2><span className="hint">{a.learn.length} short topics</span></div>
          <ol className="area-topics stagger">
            {a.learn.map((tid, k) => {
              const t = topicById(tid);
              if (!t) return null;
              return (
                <li key={tid}>
                  <a href={`#/learn/${tid}`} className="area-topic">
                    <span className="area-topic-n num">{k + 1}</span>
                    <span className="area-topic-text"><b>{t.title}</b><span className="hint">{t.lesson} · notes, formulas and a worked example</span></span>
                    <ArrowRight size={14} aria-hidden="true" className="area-go" />
                  </a>
                </li>
              );
            })}
          </ol>
          <button className="btn btn-ghost btn-small area-ask" onClick={() => askTutor(`Quiz me on ${a.title.toLowerCase()} for Midterm 2, one exam-style question at a time, using the class's Excel functions.`)}>
            <MessageSquare size={14} aria-hidden="true" />Ask the tutor to quiz me on this
          </button>
        </section>

        <section className="panel area-practice" aria-labelledby="practice-h">
          <div className="panel-head"><h2 id="practice-h">Practice in Excel</h2><span className="hint">{AREA_VERSIONS} sets</span></div>
          <p className="hint area-lead">Each set is laid out like this section of the exam. The answer key is the last tab: try the set first.</p>
          <div className="area-sets stagger">
            {Array.from({ length: AREA_VERSIONS }, (_, k) => k + 1).map((v) => {
              const s = scores[areaSetId(a.id, v)];
              const pct = s && s.total ? Math.round((100 * s.best) / s.total) : null;
              return (
                <div key={v} id={`set-${v}`} className={`area-set lift${hitSet === v ? " is-hit" : ""}`}>
                  <div className="area-set-top">
                    <b>Set {v}</b>
                    <span className="hint num">{s ? `Best ${Math.round(s.best * 10) / 10}/${s.total}` : "Not tried yet"}</span>
                  </div>
                  <div className="bar" aria-hidden="true"><span style={{ width: `${pct ?? 0}%` }} /></div>
                  <button className={`btn btn-small ${hitSet === v ? "btn-primary" : "btn-secondary"}`} onClick={() => downloadById(areaSetId(a.id, v))} aria-label={`Download ${a.title}, set ${v}`}>
                    <Download size={13} aria-hidden="true" />Download
                  </button>
                </div>
              );
            })}
          </div>
          <div className="area-note"><DownloadNote /></div>
          <p className="hint area-exam3">This section is <a href="#/exam3">Exam 3 {qRange(a)}</a>. Full timed practice exams are on <a href="#/home">Home</a>.</p>
        </section>
      </div>

      <section className="panel area-upload" aria-label="Upload a finished workbook">
        <div className="panel-head"><h2>Drop in a finished set</h2><span className="hint">Any workbook from this site works</span></div>
        <UploadBox onGraded={(g) => { setGraded(g); setScores(readScores()); }} />
      </section>
      {graded && <div className="area-report"><GradeReport g={graded} onClose={() => setGraded(null)} /></div>}

      <nav className="area-pager" aria-label="Other sections">
        {prev ? <a className="area-pager-link lift" href={`#/area/${prev.id}`}><ArrowLeft size={14} aria-hidden="true" /><span><span className="hint">Section {prev.n}</span><b>{prev.title}</b></span></a> : <span />}
        {next ? <a className="area-pager-link next lift" href={`#/area/${next.id}`}><span><span className="hint">Section {next.n}</span><b>{next.title}</b></span><ArrowRight size={14} aria-hidden="true" /></a> : <a className="area-pager-link next lift" href="#/home"><span><span className="hint">Done all four?</span><b>Take a full practice exam</b></span><ArrowRight size={14} aria-hidden="true" /></a>}
      </nav>
    </div>
  );
}
