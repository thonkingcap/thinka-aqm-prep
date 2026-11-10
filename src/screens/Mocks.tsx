import { useMemo, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { MOCK_COUNT, MOCK_MINUTES, mockExam, mockIntro } from "../lib/mock.ts";
import { buildXlsx, downloadXlsx } from "../lib/xlsx.ts";
import { UploadBox, GradeReport, readScores, DownloadNote } from "../components/UploadGrade.tsx";
import type { WorkbookGrade } from "../lib/grade.ts";
import { PracticeTabs } from "./Sets.tsx";
import Thinka from "../components/Thinka.tsx";
import "./screens.css";
import "./practice.css";
import "./sets.css";
import "./mocks.css";

export function downloadMock(n: number) {
  const m = mockExam(n);
  downloadXlsx(buildXlsx(m.sheets, { title: `Thinka's AQM Prep · ${m.title}`, intro: mockIntro(m), id: m.id }), `AQM-Midterm2-Mock-Exam-${n}.xlsx`);
}

function MockList() {
  const scores = readScores();
  const [graded, setGraded] = useState<WorkbookGrade | null>(null);
  return (
    <div className="page practice">
      <div className="title-row">
        <div>
          <h1>Mock exams</h1>
          <p className="sub">Full-length practice midterms in the style of the class's Exam 2 practice files: sections, points and one tab per question. Download one, solve it in Excel, then upload it here for your score.</p>
        </div>
        <PracticeTabs on="mocks" />
      </div>
      <div className="mock-grid">
        <section className="panel">
          <table className="ledger sets-table">
            <thead><tr><th>Mock</th><th>Covers</th><th className="val">Last score</th><th /></tr></thead>
            <tbody>
              {Array.from({ length: MOCK_COUNT }, (_, k) => k + 1).map((n) => {
                const s = scores[`mock:${n}`];
                return (
                  <tr key={n}>
                    <td className="lbl"><a href={`#/practice/mocks/${n}`} className="set-name">Mock exam {n}</a></td>
                    <td className="lbl hint">Normal, sampling, both intervals, a t-test and a Z-test · {mockExam(n).totalPoints} points</td>
                    <td className="val num">{s ? `${s.got}/${s.total}` : <span className="muted">—</span>}</td>
                    <td className="val">
                      <div className="row set-actions">
                        <button className="btn btn-ghost btn-small" onClick={() => downloadMock(n)} aria-label={`Download mock exam ${n}`}><Download size={14} aria-hidden="true" />Excel</button>
                        <a className="btn btn-primary btn-small" href={`#/practice/mocks/${n}`}>Open</a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <aside className="stack">
          <section className="panel stack">
            <h2>Already finished one?</h2>
            <p className="hint">Upload any mock exam or problem-set workbook from this site. It knows which one it is.</p>
            <UploadBox onGraded={setGraded} />
          </section>
        </aside>
      </div>
      {graded && <GradeReport g={graded} onClose={() => setGraded(null)} />}
    </div>
  );
}

function MockDetail({ n }: { n: number }) {
  const m = useMemo(() => mockExam(n), [n]);
  const [graded, setGraded] = useState<WorkbookGrade | null>(null);
  const best = readScores()[`mock:${n}`];
  return (
    <div className="page practice">
      <div className="title-row">
        <div>
          <a className="linkish set-back" href="#/practice/mocks"><ArrowLeft size={14} aria-hidden="true" />All mock exams</a>
          <h1>Mock exam {n}</h1>
          <p className="sub">{m.totalPoints} points · {m.questions.length} questions · about {MOCK_MINUTES} minutes{best ? ` · your best so far ${best.best}/${best.total}` : ""}</p>
        </div>
      </div>

      <ol className="mock-steps">
        <li className="panel">
          <h2>1. Download</h2>
          <p>One workbook, one tab per question, the numbers already in their cells.</p>
          <button className="btn btn-primary" onClick={() => downloadMock(n)}><Download size={16} aria-hidden="true" />Download mock exam {n}</button>
          <DownloadNote />
        </li>
        <li className="panel">
          <h2>2. Solve it in Excel</h2>
          <p>Set a timer for {MOCK_MINUTES} minutes. Work with formulas that point at the cells, and put each answer in its yellow cell.</p>
          <ul className="mock-sections">
            {[...new Set(m.sections)].map((s) => <li key={s}>{s}: {m.questions.filter((_, i) => m.sections[i] === s).reduce((t, q) => t + q.parts.length * 2, 0)} points</li>)}
          </ul>
        </li>
        <li className="panel">
          <h2>3. Upload for your score</h2>
          <UploadBox onGraded={setGraded} />
        </li>
      </ol>

      {graded ? <GradeReport g={graded} onClose={() => setGraded(null)} /> : (
        <div className="mock-empty"><Thinka size={56} mood="thinking" /><p className="hint">Your score, a part-by-part report and the class formula for anything you missed will show here.</p></div>
      )}
    </div>
  );
}

export default function Mocks({ n }: { n?: string }) {
  const num = Number(n);
  if (Number.isInteger(num) && num >= 1 && num <= MOCK_COUNT) return <MockDetail n={num} key={num} />;
  return <MockList />;
}
