// Upload a filled-in workbook, grade it on this device, and show the review: what went well, what to
// work on, every part with the formula that gets it, the likely slip behind each wrong number, and the
// written answers (marked by Claude on the student's key, or self-marked against the model answer).
import { useMemo, useRef, useState, type DragEvent } from "react";
import { Check, FileSpreadsheet, LoaderCircle, MessageSquare, Sparkles, Upload, X } from "lucide-react";
import { readXlsx } from "../lib/xlsxRead.ts";
import { gradeWorkbook, type PartGrade, type QuestionGrade, type WorkbookGrade } from "../lib/grade.ts";
import { addAttempt } from "../lib/progress.ts";
import { saveResult, scoreDiagnostic } from "../lib/plan.ts";
import { topicForKind } from "../lib/sets.ts";
import { markWritten } from "../lib/ai.ts";
import { useSession } from "../session.tsx";
import { Formula } from "./ui.tsx";
import "../screens/mocks.css";

const SCORES = "aqm.uploadScores.v1";
export type SavedScore = { got: number; total: number; best: number; ts: number };
export function readScores(): Record<string, SavedScore> {
  try { return JSON.parse(localStorage.getItem(SCORES) ?? "{}") as Record<string, SavedScore>; } catch { return {}; }
}
export function saveScore(key: string, got: number, total: number) {
  const all = readScores();
  const prev = all[key];
  all[key] = { got, total, best: Math.max(got, prev?.best ?? 0), ts: Date.now() };
  // Custom-set ids are long; keep only the 30 most recent of them.
  const specs = Object.entries(all).filter(([k]) => k.startsWith("spec:")).sort((a, b) => b[1].ts - a[1].ts);
  for (const [k] of specs.slice(30)) delete all[k];
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
      saveScore(g.id || `${g.kind}:${g.n}`, g.got, g.total);
      for (const qg of g.questions) {
        const marked = qg.parts.filter((p) => p.status !== "written");
        if (!marked.length) continue;
        addAttempt({ kind: qg.q.kind, topic: qg.q.topic, caseKey: qg.q.caseKey, correct: marked.filter((p) => p.ok).length, total: marked.length, ts: Date.now() });
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
        <span className="upload-main">{busy ? "Marking your workbook" : "Upload your finished workbook"}</span>
        <span className="hint">Drop the .xlsx here or click to choose it. It's marked on this device; only written answers go to Claude, and only if you ask.</span>
      </label>
      {error && <p className="notice upload-error" role="alert">{error}</p>}
    </div>
  );
}

// Where to read up and practise for each question topic.
const TOPIC_INFO: Record<string, { name: string; learn: string }> = {
  normal: { name: "The normal distribution", learn: "normal" },
  clt: { name: "Sample means and the CLT", learn: "clt" },
  "ci-z": { name: "Confidence intervals, σ known", learn: "ci-z" },
  t: { name: "Confidence intervals, σ unknown", learn: "t" },
  ht: { name: "Hypothesis tests for a mean", learn: "ht-logic" },
  var: { name: "Testing a variance (χ²)", learn: "variance" },
  two: { name: "Two samples and paired data", learn: "two-sample" },
  concept: { name: "Definitions and explanations", learn: "dictionary" },
};

const partKey = (q: QuestionGrade, p: PartGrade) => `${q.index}:${p.part.id}`;

export function GradeReport({ g, onClose }: { g: WorkbookGrade; onClose?: () => void }) {
  const { askTutor, apiKey, fp } = useSession();
  // Written parts: score 0, 0.5 or 1 each, from Claude or the student.
  const [marks, setMarks] = useState<Record<string, { score: number; feedback?: string; by: "claude" | "self" }>>({});
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  const written = useMemo(() => g.questions.flatMap((q) => q.parts.filter((p) => p.status === "written").map((p) => ({ q, p }))), [g]);
  const writtenGot = written.reduce((s, { q, p }) => s + (marks[partKey(q, p)]?.score ?? 0) * p.points, 0);
  const got = g.got + writtenGot;
  const pct = g.total ? Math.round((100 * got) / g.total) : 0;
  const allMarked = written.every(({ q, p }) => marks[partKey(q, p)]);

  function setMark(k: string, m: { score: number; feedback?: string; by: "claude" | "self" }) {
    setMarks((prev) => {
      const next = { ...prev, [k]: m };
      const extra = written.reduce((s, w) => s + (next[partKey(w.q, w.p)]?.score ?? 0) * w.p.points, 0);
      saveScore(g.id || `${g.kind}:${g.n}`, g.got + extra, g.total);
      return next;
    });
  }

  async function markWithClaude() {
    if (!apiKey) return;
    setMarking(true); setMarkError(null);
    try {
      const items = written.map(({ q, p }) => ({ id: partKey(q, p), question: p.part.label, model: String(p.part.answer), keyPoints: p.part.keyPoints ?? [], answer: p.mine }));
      const res = await markWritten(apiKey, fp ?? "", items);
      setMarks((prev) => {
        const next = { ...prev };
        for (const m of res) next[m.id] = { score: m.score, feedback: m.feedback, by: "claude" };
        const extra = written.reduce((s, w) => s + (next[partKey(w.q, w.p)]?.score ?? 0) * w.p.points, 0);
        saveScore(g.id || `${g.kind}:${g.n}`, g.got + extra, g.total);
        return next;
      });
    } catch (e) {
      setMarkError(e instanceof Error ? e.message : String(e));
    } finally {
      setMarking(false);
    }
  }

  // What went well and what to work on, by topic (numbers and choices only; written parts once marked).
  const byTopic = new Map<string, { got: number; total: number; slips: string[] }>();
  for (const q of g.questions) {
    const t = byTopic.get(q.q.topic) ?? { got: 0, total: 0, slips: [] };
    for (const p of q.parts) {
      if (p.status === "written") {
        const m = marks[partKey(q, p)];
        if (!m) continue;
        t.total += 1; t.got += m.score;
        continue;
      }
      t.total += 1;
      if (p.ok) t.got += 1;
      else if (p.slip && !t.slips.includes(p.slip)) t.slips.push(p.slip);
      else if (p.roundedTo !== undefined && !t.slips.includes("Rounded answers: leave the formula or the full value in the cell.")) t.slips.push("Rounded answers: leave the formula or the full value in the cell.");
    }
    byTopic.set(q.q.topic, t);
  }
  const topics = [...byTopic.entries()].filter(([, v]) => v.total > 0);
  const strong = topics.filter(([, v]) => v.got === v.total);
  const weak = topics.filter(([, v]) => v.got < v.total).sort((a, b) => a[1].got / a[1].total - b[1].got / b[1].total);

  const bySection = new Map<string, { got: number; total: number }>();
  for (const q of g.questions) {
    if (!q.section) continue;
    const s = bySection.get(q.section) ?? { got: 0, total: 0 };
    s.got += q.got + q.parts.reduce((x, p) => x + (p.status === "written" ? (marks[partKey(q, p)]?.score ?? 0) * p.points : 0), 0);
    s.total += q.total;
    bySection.set(q.section, s);
  }
  const wrong = g.questions.flatMap((q) => q.parts.filter((p) => !p.ok && p.status !== "written").map((p) => ({ q, p })));

  function explain() {
    askTutor(
      `I uploaded my ${g.title} workbook and scored ${got}/${g.total}. These are the parts I got wrong. For each, tell me in one or two lines what I probably did, then the fix, using the class's Excel functions.\n\n` +
      wrong.slice(0, 12).map(({ q, p }) => `Q${q.index + 1} (${q.q.title}) ${p.part.label}: I had ${p.mine}; the answer is ${p.answer} via ${p.part.excel}${p.slip ? ` (the site thinks: ${p.slip})` : ""}`).join("\n"),
    );
  }

  return (
    <section className="panel report" aria-label="Your results">
      <div className="report-head">
        <div>
          <p className="muted">{g.title}</p>
          <p className="report-score num"><b>{Number.isInteger(got) ? got : got.toFixed(1)}</b> / {g.total} points <span className="muted">· {pct}%</span></p>
          {written.length > 0 && !allMarked && <p className="hint">{written.length} written answer{written.length === 1 ? "" : "s"} still to mark (below).</p>}
        </div>
        {onClose && <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close the report"><X size={16} aria-hidden="true" /></button>}
      </div>
      {g.notes.filter((n) => !(allMarked && n.includes("written answer"))).map((n) => <p key={n} className="notice">{n}</p>)}

      {topics.length > 0 && (
        <div className="review-split">
          <div>
            <h3 className="review-h">What went well</h3>
            {strong.length ? (
              <ul className="review-list">{strong.map(([t, v]) => <li key={t}><Check size={14} className="ok-mark" aria-hidden="true" /> {TOPIC_INFO[t]?.name ?? t} <span className="muted num">{v.got}/{v.total}</span></li>)}</ul>
            ) : <p className="hint">Nothing fully right yet. Start with the first topic below.</p>}
          </div>
          <div>
            <h3 className="review-h">What to work on</h3>
            {weak.length ? (
              <ul className="review-list">
                {weak.map(([t, v]) => (
                  <li key={t}>
                    <div><b>{TOPIC_INFO[t]?.name ?? t}</b> <span className="muted num">{Number.isInteger(v.got) ? v.got : v.got.toFixed(1)}/{v.total}</span></div>
                    {v.slips.slice(0, 3).map((s) => <div key={s} className="hint">• {s}</div>)}
                    <div className="row review-links">
                      <a className="linkish" href={`#/learn/${TOPIC_INFO[t]?.learn ?? ""}`}>Reread the notes</a>
                      <a className="linkish" href={`#/practice/topic/${topicForKind(g.questions.find((q) => q.q.topic === t)?.q.kind ?? "")}`}>Download a set on it</a>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="hint">Everything marked so far is right.</p>}
          </div>
        </div>
      )}

      {bySection.size > 1 && (
        <table className="ledger report-sections">
          <tbody>
            {[...bySection.entries()].map(([s, v]) => (
              <tr key={s}><td className="lbl">{s}</td><td className="val num">{Number.isInteger(v.got) ? v.got : v.got.toFixed(1)} / {v.total}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      {written.length > 0 && (
        <div className="row">
          {apiKey
            ? <button className="btn btn-secondary" onClick={markWithClaude} disabled={marking}>{marking ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}{marking ? "Claude is marking" : `Mark my ${written.length} written answer${written.length === 1 ? "" : "s"} with Claude`}</button>
            : <span className="hint">Add your API key to have Claude mark written answers. Until then, mark them yourself against the model answer.</span>}
          {markError && <p className="notice upload-error" role="alert">{markError}</p>}
        </div>
      )}

      <ol className="report-qs">
        {g.questions.map((q) => {
          const wGot = q.parts.reduce((x, p) => x + (p.status === "written" ? (marks[partKey(q, p)]?.score ?? 0) * p.points : 0), 0);
          const qGot = q.got + wGot;
          return (
            <li key={q.index} className="report-q">
              <div className="report-q-head">
                <h3>Q{q.index + 1}. {q.q.title}</h3>
                <span className={`pill ${qGot === q.total ? "pill-pos" : qGot === 0 ? "pill-neg" : "pill-warn"}`}>{Number.isInteger(qGot) ? qGot : qGot.toFixed(1)} / {q.total}</span>
              </div>
              <table className="ledger report-parts">
                <thead><tr><th>Part</th><th>Cell</th><th>Yours</th><th>Answer</th><th aria-label="Result" /></tr></thead>
                <tbody>
                  {q.parts.map((p) => p.status === "written"
                    ? <WrittenRow key={p.part.id} p={p} mark={marks[partKey(q, p)]} onMark={(score) => setMark(partKey(q, p), { score, by: "self" })} />
                    : (
                    <tr key={p.part.id} className={p.ok ? "" : "miss"}>
                      <td className="lbl">
                        <div>{p.part.id}) {p.part.label}</div>
                        {!p.ok && (
                          <div className="report-fix">
                            {p.slip && <span className="slip-note"><b>Likely slip:</b> {p.slip}</span>}
                            {p.roundedTo !== undefined && <span className="round-note">Right method, rounded to {p.roundedTo} decimal{p.roundedTo === 1 ? "" : "s"}: use the full value.</span>}
                            {p.part.excel.startsWith("=") ? <Formula f={p.part.excel} /> : <span className="hint">{p.part.excel}</span>}
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

function WrittenRow({ p, mark, onMark }: { p: PartGrade; mark?: { score: number; feedback?: string; by: "claude" | "self" }; onMark: (score: number) => void }) {
  return (
    <tr className={mark && mark.score === 1 ? "" : "miss"}>
      <td className="lbl" colSpan={4}>
        <div>{p.part.id}) {p.part.label}</div>
        <div className="written">
          <div><span className="hint">Yours</span><p>{p.mine}</p></div>
          <div><span className="hint">Model answer</span><p>{String(p.part.answer)}</p></div>
          {p.part.keyPoints && <div className="hint">Full marks needs: {p.part.keyPoints.join("; ")}.</div>}
          {mark?.feedback && <div className="slip-note"><b>Claude:</b> {mark.feedback}</div>}
          <div className="row" role="group" aria-label="Mark this answer">
            <span className="hint">{mark ? (mark.by === "claude" ? "Claude's mark (change it if you disagree):" : "Your mark:") : "Mark it yourself:"}</span>
            {[1, 0.5, 0].map((s) => (
              <button key={s} className={`btn btn-small ${mark?.score === s ? "btn-primary" : "btn-ghost"}`} aria-pressed={mark?.score === s} onClick={() => onMark(s)}>
                {s === 1 ? "Full" : s === 0.5 ? "Half" : "None"}
              </button>
            ))}
          </div>
        </div>
      </td>
      <td className="val">{mark ? (mark.score === 1 ? <Check size={16} className="ok-mark" aria-label="Right" /> : <X size={16} className="no-mark" aria-label="Not full marks" />) : <span className="muted">?</span>}</td>
    </tr>
  );
}

export function DownloadNote() {
  return <span className="hint"><FileSpreadsheet size={12} aria-hidden="true" /> Opens in Excel, Google Sheets or Numbers. Save it as .xlsx before uploading.</span>;
}
