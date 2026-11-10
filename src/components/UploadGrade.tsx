// Upload a filled-in workbook, grade it on this device, and show the report.
import { useRef, useState, type DragEvent } from "react";
import { Check, FileSpreadsheet, LoaderCircle, MessageSquare, Upload, X } from "lucide-react";
import { readXlsx } from "../lib/xlsxRead.ts";
import { gradeWorkbook, type WorkbookGrade } from "../lib/grade.ts";
import { addAttempt } from "../lib/progress.ts";
import { KINDS } from "../lib/practice.ts";
import { saveResult, scoreDiagnostic } from "../lib/plan.ts";
import { useSession } from "../session.tsx";
import { Formula } from "./ui.tsx";

const SCORES = "aqm.uploadScores.v1";
export type SavedScore = { got: number; total: number; best: number; ts: number };
export function readScores(): Record<string, SavedScore> {
  try { return JSON.parse(localStorage.getItem(SCORES) ?? "{}") as Record<string, SavedScore>; } catch { return {}; }
}
function saveScore(key: string, got: number, total: number) {
  const all = readScores();
  const prev = all[key];
  all[key] = { got, total, best: Math.max(got, prev?.best ?? 0), ts: Date.now() };
  try { localStorage.setItem(SCORES, JSON.stringify(all)); } catch { /* ignore */ }
}

export function UploadBox({ onGraded }: { onGraded: (g: WorkbookGrade) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error("That file is over 15 MB, which is too big for a practice workbook.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const g = gradeWorkbook(readXlsx(bytes));
      saveScore(`${g.kind}:${g.n}`, g.got, g.total);
      for (const qg of g.questions) {
        addAttempt({ kind: qg.q.kind, topic: qg.q.topic, caseKey: qg.q.caseKey, correct: qg.parts.filter((p) => p.ok).length, total: qg.parts.length, ts: Date.now() });
      }
      // A diagnostic workbook becomes the diagnostic result, which rebuilds the study plan.
      if (g.kind === "diag") saveResult(scoreDiagnostic(g.questions.map((qg) => ({ q: qg.q, slot: qg.index, ok: qg.parts.map((p) => p.ok) }))));
      onGraded(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault(); setOver(false);
    handle(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="upload">
      <label
        className={`upload-drop${over ? " over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => handle(e.target.files?.[0])} className="sr-only" />
        {busy ? <LoaderCircle size={20} className="spin" aria-hidden="true" /> : <Upload size={20} aria-hidden="true" />}
        <span className="upload-main">{busy ? "Grading your workbook" : "Upload your finished workbook"}</span>
        <span className="hint">Drop the .xlsx here or click to choose it. It's read on this device and never sent anywhere.</span>
      </label>
      {error && <p className="notice upload-error" role="alert">{error}</p>}
    </div>
  );
}

export function GradeReport({ g, onClose }: { g: WorkbookGrade; onClose?: () => void }) {
  const { askTutor } = useSession();
  const pct = g.total ? Math.round((100 * g.got) / g.total) : 0;
  const bySection = new Map<string, { got: number; total: number }>();
  for (const q of g.questions) {
    const key = q.section ?? `Q${q.index + 1}`;
    const s = bySection.get(key) ?? { got: 0, total: 0 };
    s.got += q.got; s.total += q.total;
    bySection.set(key, s);
  }
  const wrong = g.questions.flatMap((q) => q.parts.filter((p) => !p.ok).map((p) => ({ q, p })));

  function explain() {
    askTutor(
      `I uploaded my ${g.title} workbook and scored ${g.got}/${g.total}. These are the parts I got wrong. For each, tell me in one or two lines what I probably did, then the fix, using the class's Excel functions.\n\n` +
      wrong.slice(0, 12).map(({ q, p }) => `Q${q.index + 1} (${q.q.title}) ${p.part.label}: I had ${p.mine}; the answer is ${p.answer} via ${p.part.excel}`).join("\n"),
    );
  }

  return (
    <section className="panel report" aria-label="Your results">
      <div className="report-head">
        <div>
          <p className="muted">{g.title}</p>
          <p className="report-score num"><b>{g.got}</b> / {g.total} points <span className="muted">· {pct}%</span></p>
        </div>
        {onClose && <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close the report"><X size={16} aria-hidden="true" /></button>}
      </div>
      {g.notes.map((n) => <p key={n} className="notice">{n}</p>)}
      {g.kind === "mock" && (
        <table className="ledger report-sections">
          <tbody>
            {[...bySection.entries()].map(([s, v]) => (
              <tr key={s}><td className="lbl">{s}</td><td className="val num">{v.got} / {v.total}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <ol className="report-qs">
        {g.questions.map((q) => {
          const practice = KINDS.find((k) => k.id === q.q.kind)?.id ?? "mixed";
          return (
            <li key={q.index} className="report-q">
              <div className="report-q-head">
                <h3>Q{q.index + 1}. {q.q.title}</h3>
                <span className={`pill ${q.got === q.total ? "pill-pos" : q.got === 0 ? "pill-neg" : "pill-warn"}`}>{q.got} / {q.total}</span>
              </div>
              <table className="ledger report-parts">
                <thead><tr><th>Part</th><th>Cell</th><th>Yours</th><th>Answer</th><th aria-label="Result" /></tr></thead>
                <tbody>
                  {q.parts.map((p) => (
                    <tr key={p.part.id} className={p.ok ? "" : "miss"}>
                      <td className="lbl">
                        <div>{p.part.id}) {p.part.label}</div>
                        {!p.ok && (
                          <div className="report-fix">
                            {p.part.excel.startsWith("=") ? <Formula f={p.part.excel} /> : <span className="hint">{p.part.excel}</span>}
                            {p.roundedTo !== undefined && <span className="round-note">Right method, rounded to {p.roundedTo} decimal{p.roundedTo === 1 ? "" : "s"}: use the full value.</span>}
                            <span className="hint">{p.part.explain}</span>
                          </div>
                        )}
                      </td>
                      <td className="num muted">{p.cell}</td>
                      <td className="num">{p.mine}</td>
                      <td className="num">{p.answer}</td>
                      <td className="val">{p.ok ? <Check size={16} className="ok-mark" aria-label="Right" /> : <X size={16} className="no-mark" aria-label="Wrong" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {q.got < q.total && <a className="linkish" href={`#/practice/${q.q.caseKey ? `case:${q.q.caseKey}` : practice}`}>Practise this kind of question</a>}
            </li>
          );
        })}
      </ol>
      {wrong.length > 0 && (
        <div className="row">
          <button className="btn btn-secondary" onClick={explain}><MessageSquare size={16} aria-hidden="true" />Ask the tutor about my mistakes</button>
        </div>
      )}
    </section>
  );
}

export function DownloadNote() {
  return <span className="hint"><FileSpreadsheet size={12} aria-hidden="true" /> Opens in Excel, Google Sheets or Numbers. Save it as .xlsx before uploading.</span>;
}
