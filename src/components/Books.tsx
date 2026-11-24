// Practice workbooks for the Lessons / Units / Final / Get Ahead pages: a card per version (download,
// answer key, best score), and one upload box that marks any of them.
import { useState } from "react";
import { Download, KeyRound } from "lucide-react";
import { bookById } from "../lib/lessons/books.ts";
import { downloadBook } from "../lib/lessons/download.ts";
import { UploadBox, GradeReport, readScores } from "./UploadGrade.tsx";
import type { WorkbookGrade } from "../lib/grade.ts";

export function bookBest(id: string): number | null {
  const s = readScores()[id];
  return s && s.total ? s.best / s.total : null;
}

function BookCard({ id, label, scores }: { id: string; label: string; scores: ReturnType<typeof readScores> }) {
  const b = bookById(id);
  const [keyShown, setKeyShown] = useState(false);
  if (!b) return null;
  const s = scores[id];
  const pct = s && s.total ? Math.round((100 * s.best) / s.total) : null;
  return (
    <div className="book lift">
      <div className="book-top"><b>{label}</b><span className="hint num">{s ? `Best ${Math.round(s.best * 10) / 10}/${s.total}` : `${b.blocks.length} tab${b.blocks.length === 1 ? "" : "s"}`}</span></div>
      <div className="bar" aria-hidden="true"><span style={{ width: `${pct ?? 0}%` }} /></div>
      <div className="row">
        <button className="btn btn-secondary btn-small" onClick={() => downloadBook(id)} aria-label={`Download ${b.title}`}><Download size={13} aria-hidden="true" />Download</button>
        {keyShown ? (
          <button className="btn btn-ghost btn-small" onClick={() => downloadBook(id, true)} aria-label={`Download the answer key for ${b.title}`}><KeyRound size={13} aria-hidden="true" />Answer key</button>
        ) : (
          <button className="linkish book-key" onClick={() => setKeyShown(true)}>Done? Get the key</button>
        )}
      </div>
    </div>
  );
}

/** Version cards for some workbook ids, an upload box that marks any site workbook, and the report. */
export function PracticePanel({ ids, labels, lead, title = "Practice in Excel", headId }: { ids: string[]; labels?: string[]; lead?: string; title?: string; headId: string }) {
  const [graded, setGraded] = useState<WorkbookGrade | null>(null);
  const [scores, setScores] = useState(readScores);
  const live = ids.filter((id) => bookById(id));
  return (
    <section className="panel" aria-labelledby={headId}>
      <div className="panel-head"><h2 id={headId}>{title}</h2></div>
      {lead && <p className="hint hub-lead">{lead}</p>}
      {live.length ? (
        <div className="books stagger">{live.map((id, k) => <BookCard key={id} id={id} label={labels?.[ids.indexOf(id)] ?? `Version ${k + 1}`} scores={scores} />)}</div>
      ) : <p className="hint">Practice for this is on its way.</p>}
      <div className="hub-upload"><UploadBox onGraded={(g) => { setGraded(g); setScores(readScores()); }} /></div>
      {graded && <div className="hub-report"><GradeReport g={graded} onClose={() => setGraded(null)} /></div>}
    </section>
  );
}
