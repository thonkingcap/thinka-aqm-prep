import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, MessageSquare, RotateCcw } from "lucide-react";
import { generate, generateCase, gradeNumber, KINDS, type Question, type Part, type QuestionKind } from "../lib/practice.ts";
import { addAttempt } from "../lib/progress.ts";
import { NULLS } from "../lib/tests12.ts";
import { questionSheet, matchChoice, type SheetModel } from "../lib/workbook.ts";
import Sheet, { type SheetValue } from "../components/Sheet.tsx";
import { PracticeTabs } from "./Sets.tsx";
import { useSession } from "../session.tsx";
import { Formula, fmt } from "../components/ui.tsx";
import "./screens.css";
import "./practice.css";

type Result = { ok: boolean; shown: string; error?: string; roundedTo?: number };

export function caseName(key: string): string {
  const [h0, sigma, method] = key.split("-");
  const n = NULLS.find((x) => x.id === h0);
  if (!n) return key;
  return `${n.h0}, σ ${sigma}, ${method === "p" ? "p-value" : "critical value"}`;
}

function showAnswer(p: Part): string {
  if (typeof p.answer === "string") return p.answer;
  return p.format === "prob" ? fmt(p.answer, "prob") : fmt(p.answer);
}

export function QuestionCard({ q, onDone, nextLabel = "Next question", onNext, allowTutor = true, allowSkip = false, sheet }: {
  q: Question;
  /** Show the practice spreadsheet with this layout; answers can come from its yellow cells. */
  sheet?: { model: SheetModel; storageId: string };
  onDone?: (correct: number, total: number, ok: boolean[]) => void;
  onNext?: () => void;
  nextLabel?: string;
  allowTutor?: boolean;
  allowSkip?: boolean;
}) {
  const { askTutor } = useSession();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, Result> | null>(null);
  const sheetGet = useRef<((a: string) => SheetValue) | null>(null);
  const onValues = useCallback((g: (a: string) => SheetValue) => { sheetGet.current = g; }, []);
  const ctx = sheet ? { get: (a: string) => sheetGet.current?.(a) ?? null } : undefined;

  useEffect(() => { setVals({}); setResults(null); }, [q.id]);

  function check(e: FormEvent | null, skip = false) {
    e?.preventDefault();
    if (results) return;
    const r: Record<string, Result> = {};
    for (const p of q.parts) {
      let v = skip ? "" : vals[p.id] ?? "";
      // An empty box falls back to the part's yellow answer cell in the sheet.
      const cellAddr = sheet?.model.answerCells[p.id];
      const cellVal = cellAddr ? sheetGet.current?.(cellAddr) ?? null : null;
      if (!skip && !v.trim() && cellVal !== null) {
        if (p.kind === "choice") v = matchChoice(String(cellVal), p.options!) ?? String(cellVal);
        else v = typeof cellVal === "number" ? String(cellVal) : String(cellVal);
      }
      if (skip) r[p.id] = { ok: false, shown: "Skipped" };
      else if (p.kind === "choice") r[p.id] = { ok: v === p.answer, shown: v || "No answer" };
      else {
        const g = gradeNumber(v, p, ctx);
        r[p.id] = { ok: g.ok, shown: g.value === null ? (v || "No answer") : g.roundedTo !== undefined ? v.trim() : fmt(g.value, p.format), error: g.error, roundedTo: g.roundedTo };
      }
    }
    setResults(r);
    const correct = Object.values(r).filter((x) => x.ok).length;
    addAttempt({ kind: q.kind, topic: q.topic, caseKey: q.caseKey, correct, total: q.parts.length, ts: Date.now() });
    onDone?.(correct, q.parts.length, q.parts.map((p) => r[p.id].ok));
  }

  const correct = results ? Object.values(results).filter((x) => x.ok).length : 0;

  function explain() {
    const lines = q.parts.map((p) => {
      const r = results?.[p.id];
      return `${p.id}) ${p.label}\n   my answer: ${r?.shown ?? "none"} (${r?.ok ? "right" : "wrong"})\n   official answer: ${showAnswer(p)} via ${p.excel}`;
    });
    askTutor(
      `Help me understand this practice question. Explain the method for the parts I got wrong, and where my answer likely went wrong.\n\n${q.title}\n${q.prompt}` +
      (q.data ? `\nData: ${q.data.join(", ")}` : "") +
      (q.given?.length ? `\nGiven: ${q.given.map((g) => `${g.label} = ${g.value}`).join(", ")}` : "") +
      `\n\n${lines.join("\n")}`,
    );
  }

  return (
    <form className="panel qcard" onSubmit={check} noValidate>
      <div className="qcard-head">
        <h2>{q.title}</h2>
        {results && <span className={`pill ${correct === q.parts.length ? "pill-pos" : correct === 0 ? "pill-neg" : "pill-warn"}`}>{correct} of {q.parts.length} right</span>}
      </div>
      <p className="qcard-prompt">{q.prompt}</p>
      {sheet && <Sheet model={sheet.model} storageId={sheet.storageId} onValues={onValues} />}
      {!sheet && (q.data || q.given?.length) && (
        <div className="qcard-given">
          {q.given?.map((g) => <span key={g.label} className="given"><span className="muted">{g.label}</span> <span className="num">{g.value}</span></span>)}
          {q.data && (
            <span className="given given-data">
              <span className="muted">Data</span> <span className="num">{q.data.join(", ")}</span>
            </span>
          )}
        </div>
      )}

      <ol className="parts">
        {q.parts.map((p) => {
          const r = results?.[p.id];
          return (
            <li key={p.id} className={`part${r ? (r.ok ? " is-right" : " is-wrong") : ""}`}>
              <div className="part-q">
                <label htmlFor={`${q.id}-${p.id}`} className="part-label">{p.label}</label>
                {p.kind === "choice" ? (
                  <div className="choices" role="radiogroup" aria-label={p.label}>
                    {p.options!.map((o) => (
                      <label key={o} className={`choice${vals[p.id] === o ? " on" : ""}`}>
                        <input type="radio" name={`${q.id}-${p.id}`} value={o} checked={vals[p.id] === o} disabled={!!results} onChange={() => setVals((v) => ({ ...v, [p.id]: o }))} />
                        <span>{o}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="part-input">
                    <input
                      id={`${q.id}-${p.id}`}
                      className="input"
                      placeholder={sheet ? `Full value, =formula, or =${sheet.model.answerCells[p.id]}` : "Full value (4+ decimals) or =formula"}
                      value={vals[p.id] ?? ""}
                      disabled={!!results}
                      onChange={(e) => setVals((v) => ({ ...v, [p.id]: e.target.value }))}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {p.unit && <span className="hint">{p.unit}</span>}
                  </div>
                )}
              </div>
              {r && (
                <div className="part-feedback">
                  <p>
                    <strong>{r.ok ? "Right." : r.roundedTo !== undefined ? "Close, but rounded." : "Not quite."}</strong>{" "}
                    {!r.ok && <>You had <span className="num">{r.shown}</span>{r.error ? ` (${r.error})` : ""}. </>}
                    Answer: <strong className="num">{showAnswer(p)}</strong>
                  </p>
                  {r.roundedTo !== undefined && (
                    <p className="round-note">Your method is right: that's the answer rounded to {r.roundedTo} decimal place{r.roundedTo === 1 ? "" : "s"}. Class grades the full value, so enter at least 4 decimals, or better, the formula or a cell like =B10.</p>
                  )}
                  {p.excel.startsWith("=") ? <Formula f={p.excel} /> : <p className="hint">{p.excel}</p>}
                  <p className="part-explain">{p.explain}</p>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="row qcard-actions">
        {!results ? (
          <button className="btn btn-primary" type="submit">Check answers</button>
        ) : (
          <>
            {onNext && <button type="button" className="btn btn-primary" onClick={onNext}>{nextLabel}<ArrowRight size={16} aria-hidden="true" /></button>}
            {allowTutor && correct < q.parts.length && (
              <button type="button" className="btn btn-secondary" onClick={explain}><MessageSquare size={16} aria-hidden="true" />Explain my mistakes</button>
            )}
          </>
        )}
        {!results && allowSkip && <button type="button" className="btn btn-ghost" onClick={() => check(null, true)}>I don't know this one</button>}
        {!results && <span className="hint">{sheet ? "Work in the sheet, then fill the yellow cells, or point a box at a cell like =B12. Don't round: like class, the full value is graded." : "Enter the full value (at least 4 decimals) or an Excel formula like =NORM.S.INV(0.975). Like class, hand-rounded answers count as wrong."}</span>}
      </div>
    </form>
  );
}

export default function Practice({ initial }: { initial?: string }) {
  const caseKey = initial?.startsWith("case:") ? initial.slice(5) : undefined;
  const startKind = (!caseKey && initial && (KINDS.some((k) => k.id === initial) || initial === "mixed") ? initial : "mixed") as QuestionKind | "mixed";
  const [kind, setKind] = useState<QuestionKind | "mixed">(startKind);
  const [lockCase, setLockCase] = useState<string | undefined>(caseKey);
  const [n, setN] = useState(0);
  const [score, setScore] = useState({ c: 0, t: 0 });

  useEffect(() => { setLockCase(caseKey); if (!caseKey) setKind(startKind); setN((x) => x + 1); }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = useMemo(() => (lockCase ? generateCase(lockCase) : generate(kind)), [kind, lockCase, n]);
  const [sheetOn, setSheetOn] = useState(() => { try { return localStorage.getItem("aqm.sheetOn") !== "0"; } catch { return true; } });
  const sheetModel = useMemo(() => questionSheet(q, 1), [q]);
  function toggleSheet() {
    setSheetOn((v) => { try { localStorage.setItem("aqm.sheetOn", v ? "0" : "1"); } catch { /* ignore */ } return !v; });
  }

  return (
    <div className="page practice">
      <div className="title-row">
        <div>
          <h1>Practice</h1>
          <p className="sub">Fresh numbers every time, graded on the full value like class: enter 4+ decimals, a formula, or a cell reference, never a rounded number.</p>
        </div>
        <div className="row">
          <PracticeTabs on="quick" />
          <label className="check sheet-toggle"><input type="checkbox" checked={sheetOn} onChange={toggleSheet} /><span>Work in the Excel sheet</span></label>
          <span className="hint num">This session: {score.c} of {score.t} parts right</span>
          <button className="btn btn-ghost btn-small" onClick={() => setScore({ c: 0, t: 0 })} aria-label="Reset session score"><RotateCcw size={14} aria-hidden="true" /></button>
        </div>
      </div>

      <div className="practice-grid">
        <nav className="practice-kinds" aria-label="Question types">
          <button className={`kind${!lockCase && kind === "mixed" ? " on" : ""}`} onClick={() => { setLockCase(undefined); setKind("mixed"); setN((x) => x + 1); location.hash = "#/practice/mixed"; }}>Mixed: all topics</button>
          {KINDS.map((k) => (
            <button key={k.id} className={`kind${!lockCase && kind === k.id ? " on" : ""}`} onClick={() => { setLockCase(undefined); setKind(k.id); setN((x) => x + 1); location.hash = `#/practice/${k.id}`; }}>{k.label}</button>
          ))}
          {lockCase && <p className="hint kind-case">Drilling one of the 12 cases: {caseName(lockCase)}</p>}
        </nav>
        <QuestionCard key={q.id} q={q} sheet={sheetOn ? { model: sheetModel, storageId: `quick-${q.id}` } : undefined} onDone={(c, t) => setScore((s) => ({ c: s.c + c, t: s.t + t }))} onNext={() => setN((x) => x + 1)} />
      </div>
    </div>
  );
}
