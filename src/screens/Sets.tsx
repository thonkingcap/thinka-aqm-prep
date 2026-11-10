import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Download } from "lucide-react";
import { SET_COUNT, setQuestions, setSheets, questionSheet } from "../lib/workbook.ts";
import { buildXlsx, downloadXlsx } from "../lib/xlsx.ts";
import { QuestionCard, caseName } from "./Practice.tsx";
import { UploadBox, GradeReport } from "../components/UploadGrade.tsx";
import type { WorkbookGrade } from "../lib/grade.ts";
import "./screens.css";
import "./practice.css";
import "./sets.css";

type SetProgress = Record<number, Record<number, { correct: number; total: number }>>;
const KEY = "aqm.sets.v1";
function readSets(): SetProgress {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") as SetProgress; } catch { return {}; }
}
function saveResult(set: number, i: number, correct: number, total: number) {
  const all = readSets();
  all[set] = { ...(all[set] ?? {}), [i]: { correct, total } };
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* ignore */ }
}

export function downloadSet(n: number) {
  const bytes = buildXlsx(setSheets(n), {
    title: `Thinka's AQM Prep · Midterm 2 problem set ${n}`,
    intro: [
      "Each tab is one question. The numbers you need are already in their cells (column B, and data in column D).",
      "Solve it the way you would on the exam: write Excel formulas that point at those cells, in the yellow answer cells or anywhere to the right.",
      "Don't round. Leave the formula (or the full value) in each yellow cell: like class, the underlying value is graded.",
      "Then upload this file on the set's page at thinka-aqm-prep.vercel.app to check every answer at once (or type them in question by question).",
      "Class conventions: NORM.DIST, NORM.S.DIST, NORM.INV, NORM.S.INV, T.DIST(…,TRUE), T.INV, AVERAGE, STDEV.S, SQRT.",
    ],
    id: `set:${n}`,
  });
  downloadXlsx(bytes, `AQM-Midterm2-Problem-Set-${n}.xlsx`);
}

const SLOT_NAMES = ["Normal probability", "Percentile", "Z-scores", "Sample mean", "Interval, σ known", "Interval, σ unknown", "Z-test", "t-test"];

function SetList() {
  const progress = readSets();
  return (
    <div className="page practice">
      <div className="title-row">
        <div>
          <h1>Problem sets</h1>
          <p className="sub">Eight exam-style questions per set, the same numbers for everyone. Download the set as one Excel workbook, solve it in Excel, and check your answers here. Or work in the sheet on each question.</p>
        </div>
        <PracticeTabs on="sets" />
      </div>
      <section className="panel">
        <table className="ledger sets-table">
          <thead><tr><th>Set</th><th>Covers</th><th className="val">Done</th><th className="val">Parts right</th><th /></tr></thead>
          <tbody>
            {Array.from({ length: SET_COUNT }, (_, k) => k + 1).map((n) => {
              const p = progress[n] ?? {};
              const done = Object.keys(p).length;
              const c = Object.values(p).reduce((s, x) => s + x.correct, 0);
              const t = Object.values(p).reduce((s, x) => s + x.total, 0);
              const tests = setQuestions(n).slice(6).map((q) => caseName(q.caseKey!).split(",")[0]);
              return (
                <tr key={n}>
                  <td className="lbl"><a href={`#/practice/sets/${n}`} className="set-name">Set {n}</a></td>
                  <td className="lbl hint">Normal, percentiles, Z-scores, x̄, both intervals; tests {tests.join(" and ")}</td>
                  <td className="val num">{done ? `${done} of 8` : <span className="muted">—</span>}</td>
                  <td className="val num">{t ? `${c}/${t}` : <span className="muted">—</span>}</td>
                  <td className="val">
                    <div className="row set-actions">
                      <button className="btn btn-ghost btn-small" onClick={() => downloadSet(n)} aria-label={`Download set ${n} as Excel`}><Download size={14} aria-hidden="true" />Excel</button>
                      <a className="btn btn-primary btn-small" href={`#/practice/sets/${n}`}>{done ? (done === 8 ? "Review" : "Continue") : "Start"}</a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function SetRun({ n }: { n: number }) {
  const questions = useMemo(() => setQuestions(n), [n]);
  const sheets = useMemo(() => questions.map((q, i) => questionSheet(q, i + 1)), [questions]);
  const [progress, setProgress] = useState(() => readSets()[n] ?? {});
  const firstOpen = questions.findIndex((_, i) => !progress[i]);
  const [i, setI] = useState(firstOpen === -1 ? 0 : firstOpen);
  const q = questions[i];
  const c = Object.values(progress).reduce((s, x) => s + x.correct, 0);
  const t = Object.values(progress).reduce((s, x) => s + x.total, 0);
  const [graded, setGraded] = useState<WorkbookGrade | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="page practice">
      <div className="title-row">
        <div>
          <a className="linkish set-back" href="#/practice/sets"><ArrowLeft size={14} aria-hidden="true" />All problem sets</a>
          <h1>Problem set {n}</h1>
          <p className="sub">Question {i + 1} of 8: {SLOT_NAMES[i]}. {t ? `${c} of ${t} parts right so far.` : "Same numbers as everyone else's Set " + n + "."}</p>
        </div>
        <div className="row">
          <button className="btn btn-secondary" onClick={() => downloadSet(n)}><Download size={16} aria-hidden="true" />Download Set {n} for Excel</button>
          <button className="btn btn-ghost" onClick={() => setShowUpload((v) => !v)}>Upload my workbook</button>
        </div>
      </div>
      {showUpload && <div className="panel set-upload"><UploadBox onGraded={(g) => { setGraded(g); setShowUpload(false); setProgress(readSets()[n] ?? {}); }} /></div>}
      {graded && <GradeReport g={graded} onClose={() => setGraded(null)} />}
      <ol className="set-steps" aria-label="Questions in this set">
        {questions.map((qq, k) => {
          const r = progress[k];
          const state = r ? (r.correct === r.total ? "right" : r.correct === 0 ? "wrong" : "part") : "";
          return (
            <li key={qq.id}>
              <button className={`set-step ${state}${k === i ? " on" : ""}`} onClick={() => setI(k)} aria-current={k === i ? "step" : undefined}>
                <span className="num">Q{k + 1}</span>
                <span className="set-step-score num">{r ? `${r.correct}/${r.total}` : SLOT_NAMES[k]}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <QuestionCard
        key={`${n}-${i}`}
        q={q}
        sheet={{ model: sheets[i], storageId: `set-${n}-q${i + 1}` }}
        onDone={(correct, total) => { saveResult(n, i, correct, total); setProgress(readSets()[n] ?? {}); }}
        onNext={i < 7 ? () => { setI(i + 1); window.scrollTo(0, 0); } : () => { location.hash = "#/practice/sets"; }}
        nextLabel={i < 7 ? `Question ${i + 2}` : "Back to all sets"}
      />
      {i < 7 && (
        <div className="row set-skip"><button className="linkish" onClick={() => setI(i + 1)}>Skip to question {i + 2} <ArrowRight size={12} aria-hidden="true" /></button></div>
      )}
    </div>
  );
}

export function PracticeTabs({ on }: { on: "quick" | "sets" | "mocks" }) {
  return (
    <div className="seg" role="group" aria-label="Practice mode">
      <button aria-pressed={on === "quick"} onClick={() => { location.hash = "#/practice"; }}>Quick practice</button>
      <button aria-pressed={on === "sets"} onClick={() => { location.hash = "#/practice/sets"; }}>Problem sets</button>
      <button aria-pressed={on === "mocks"} onClick={() => { location.hash = "#/practice/mocks"; }}>Mock exams</button>
    </div>
  );
}

export default function Sets({ n }: { n?: string }) {
  const num = Number(n);
  if (Number.isInteger(num) && num >= 1 && num <= SET_COUNT) return <SetRun n={num} key={num} />;
  return <SetList />;
}
