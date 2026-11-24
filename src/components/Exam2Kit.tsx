// The Midterm 2 tools the site was built with, kept under Unit 2: the Exam 3 diagnostic, the exam's four
// areas, the six practice exams in the Exam 3 format, Lesson 18 sets and chi-squared practice.
import { useState } from "react";
import { ArrowRight, FileSpreadsheet, FileText, KeyRound } from "lucide-react";
import { AREAS, AREA_VERSIONS } from "../lib/areas.ts";
import { PAPER_COUNT, PAPER_MINUTES, paperId } from "../lib/paper.ts";
import { readResult } from "../lib/plan.ts";
import { downloadPaperWorkbook, downloadPaperDocx, downloadPaperKey } from "../lib/download.ts";
import { readScores } from "./UploadGrade.tsx";
import { areaProgress } from "../screens/Area.tsx";
import L18Panel from "./L18Panel.tsx";
import "../screens/home.css";

function PaperCard({ n, best }: { n: number; best?: { best: number; total: number } }) {
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="home-mock lift">
      <b>Practice exam {n}</b>
      <span className="hint num">{best ? `Best ${Math.round(best.best * 10) / 10}/${best.total}` : "Not tried yet"}</span>
      <button className="btn btn-ghost btn-small" onClick={() => { setErr(null); downloadPaperDocx(n).catch((e) => setErr(e instanceof Error ? e.message : String(e))); }} aria-label={`Download the questions for practice exam ${n} (Word)`}><FileText size={13} aria-hidden="true" />Questions</button>
      <button className="btn btn-ghost btn-small" onClick={() => downloadPaperWorkbook(n)} aria-label={`Download the workbook for practice exam ${n} (Excel)`}><FileSpreadsheet size={13} aria-hidden="true" />Workbook</button>
      <button className="btn btn-ghost btn-small" onClick={() => downloadPaperKey(n)} aria-label={`Download the answer key for practice exam ${n}`}><KeyRound size={13} aria-hidden="true" />Answer key</button>
      {err && <span className="hint error-text" role="alert">{err}</span>}
    </div>
  );
}

export default function Exam2Kit() {
  const scores = readScores();
  const result = readResult();
  return (
    <div className="stack">
      <a className="kit-exam3 lift" href="#/exam3">
        <span className="kit-exam3-icon" aria-hidden="true"><FileSpreadsheet size={18} /></span>
        <span><b>Last spring's Exam 3, marked for you</b><span className="hint">{result ? "You've done it: open it to see your marks again." : "The closest past paper to Exam 2. Finish it in Excel, drop it in, get every answer marked."}</span></span>
        <ArrowRight size={14} aria-hidden="true" />
      </a>

      <section aria-labelledby="areas-h">
        <div className="home-sec-head"><h2 id="areas-h">Exam 2's four areas</h2><span className="hint">Short notes and {AREA_VERSIONS} Excel sets in each</span></div>
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
                  <span className="hint num">{p ? `Best ${Math.round(p.best * 100)}% · ${p.done}/${AREA_VERSIONS} sets` : "Not started"}</span>
                </span>
              </a>
            );
          })}
        </div>
      </section>

      <section className="panel" aria-labelledby="mocks-h" id="mocks">
        <div className="panel-head"><h2 id="mocks-h">Practice exams in the Exam 3 format</h2><span className="hint">{PAPER_MINUTES} minutes each</span></div>
        <p className="hint home-lead">A Word question paper and a four-tab workbook laid out like last spring's Exam 3. Set a timer, try it all, then drop the workbook into any upload box to have it marked.</p>
        <div className="home-mocks stagger">
          {Array.from({ length: PAPER_COUNT }, (_, k) => k + 1).map((n) => <PaperCard key={n} n={n} best={scores[paperId(n)]} />)}
        </div>
      </section>

      <L18Panel scores={scores} />

      <a className="chi-callout lift" href="#/area/ht2/chi">
        <span className="chi-badge" aria-hidden="true">χ²</span>
        <span><b>Struggling with chi-squared?</b><span className="hint">Four practice sets of chi-squared tests on a variance, marked when you upload them.</span></span>
        <span className="chi-go" aria-hidden="true">Practise χ² →</span>
      </a>
    </div>
  );
}
