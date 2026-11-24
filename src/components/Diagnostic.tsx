// A diagnostic: the Word question paper, the workbook, the answer key (after you've tried it), your best
// score, and an upload box whose report lists the lessons to go back to.
import { useState } from "react";
import { FileSpreadsheet, FileText, KeyRound, Timer } from "lucide-react";
import { diagById } from "../lib/diag/index.ts";
import { paperPoints } from "../lib/diag/kit.ts";
import { downloadDiag, downloadDiagDocx } from "../lib/diag/download.ts";
import { DIAG_PAPER, paper, paperId, PAPER_MINUTES } from "../lib/paper.ts";
import { downloadPaperDocx, downloadPaperWorkbook, downloadPaperKey } from "../lib/download.ts";
import { UploadBox, GradeReport, readScores } from "./UploadGrade.tsx";
import type { WorkbookGrade } from "../lib/grade.ts";

/** A diagnostic by id: "dx:u1", "dx:u3", "dx:final", or "paper:7" (the Unit 2 diagnostic, Exam 3's layout). */
function info(id: string) {
  if (id === paperId(DIAG_PAPER)) {
    const P = paper(DIAG_PAPER)!;
    return {
      title: P.title, minutes: PAPER_MINUTES, points: P.questions.reduce((t, q) => t + q.points, 0), beta: false,
      docx: () => downloadPaperDocx(DIAG_PAPER), xlsx: () => downloadPaperWorkbook(DIAG_PAPER), key: () => downloadPaperKey(DIAG_PAPER),
    };
  }
  const D = diagById(id);
  if (!D) return null;
  return {
    title: D.title, minutes: D.minutes, points: paperPoints(D), beta: !!D.beta,
    docx: () => downloadDiagDocx(id), xlsx: () => downloadDiag(id), key: () => downloadDiag(id, true),
  };
}

export default function Diagnostic({ id, like }: { id: string; like: string }) {
  const d = info(id);
  const [graded, setGraded] = useState<WorkbookGrade | null>(null);
  const [scores, setScores] = useState(readScores);
  const [keyShown, setKeyShown] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!d) return <p className="notice">This diagnostic is on its way.</p>;
  const s = scores[id];
  return (
    <section className="panel diag" aria-labelledby="dg-h">
      <div className="diag-head">
        <div>
          <h2 id="dg-h">{d.title}</h2>
          <p className="hint num"><Timer size={12} aria-hidden="true" /> {d.minutes} minutes · {d.points} points · {like}</p>
        </div>
        {s && <span className="pill pill-neutral num">Best {Math.round(s.best * 10) / 10}/{s.total}</span>}
      </div>
      <div className="row diag-actions">
        <button className="btn btn-secondary btn-small" onClick={() => { setErr(null); d.docx().catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e))); }}><FileText size={13} aria-hidden="true" />Questions (Word)</button>
        <button className="btn btn-secondary btn-small" onClick={d.xlsx}><FileSpreadsheet size={13} aria-hidden="true" />Workbook (Excel)</button>
        {keyShown
          ? <button className="btn btn-ghost btn-small" onClick={d.key}><KeyRound size={13} aria-hidden="true" />Answer key</button>
          : <button className="linkish" onClick={() => setKeyShown(true)}>Done? Get the key</button>}
      </div>
      {err && <p className="hint error-text" role="alert">{err}</p>}
      <div className="hub-upload"><UploadBox onGraded={(g) => { setGraded(g); setScores(readScores()); }} /></div>
      {graded && <div className="hub-report"><GradeReport g={graded} onClose={() => setGraded(null)} /></div>}
    </section>
  );
}
