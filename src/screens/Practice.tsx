// Practice happens in Excel, like the exam: download a workbook, solve it, upload it here.
// Topic sets, mixed sets and exam-style mocks are fixed (same for everyone); custom sets are built
// here from a pick list, or designed by Claude on the student's key. Every number and every answer
// key comes from the site's verified stats engine, never from Claude.
import { useEffect, useState } from "react";
import { Download, LoaderCircle, Sparkles, Timer } from "lucide-react";
import { buildXlsx, downloadXlsx } from "../lib/xlsx.ts";
import { KINDS, CONCEPTS, type QuestionKind } from "../lib/practice.ts";
import {
  TOPIC_SETS, TOPIC_VERSIONS, MIX_COUNT, EXAM_COUNT, EXAM_MINUTES,
  workbookById, workbookSheets, workbookIntro, specId, topicForKind, type CustomSpec, type WorkbookDef,
} from "../lib/sets.ts";
import { designCustomSet } from "../lib/ai.ts";
import { UploadBox, GradeReport, readScores, DownloadNote } from "../components/UploadGrade.tsx";
import type { WorkbookGrade } from "../lib/grade.ts";
import { useSession } from "../session.tsx";
import "./screens.css";
import "./practice.css";

export function downloadWorkbook(def: WorkbookDef) {
  const bytes = buildXlsx(workbookSheets(def), { title: `Thinka's AQM Prep · ${def.title}`, intro: workbookIntro(def), id: def.id });
  downloadXlsx(bytes, `${def.file}.xlsx`);
}
const download = (id: string) => { const d = workbookById(id); if (d) downloadWorkbook(d); };

function Score({ id }: { id: string }) {
  const s = readScores()[id];
  if (!s) return <span className="muted">—</span>;
  return <span className="num" title={`Best ${s.best}/${s.total}`}>{Math.round(s.got * 10) / 10}/{s.total}</span>;
}

/** Where a route points: a section, plus a topic set to highlight. */
function target(route: string[]): { section: string; topic?: string } {
  const [a, b] = route;
  if (!a) return { section: "" };
  if (a === "topic" && b) return { section: "topics", topic: b };
  if (a === "mixed" || a === "sets") return { section: "mixed" };
  if (a === "mocks") return { section: "mocks" };
  if (a === "custom") return { section: "custom" };
  return { section: "topics", topic: topicForKind(a) };
}

export default function Practice({ route = [] }: { route?: string[] }) {
  const [graded, setGraded] = useState<WorkbookGrade | null>(null);
  const [, refresh] = useState(0);
  const t = target(route);

  useEffect(() => {
    const el = document.getElementById(t.topic ? `set-${t.topic}` : t.section ? `sec-${t.section}` : "");
    if (el) el.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [t.section, t.topic]);

  return (
    <div className="page practice">
      <div className="title-row">
        <div>
          <h1>Practice in Excel</h1>
          <p className="sub">The exam is answered in Excel with no calculator, so every practice set is a workbook. Download one, solve it in Excel with formulas pointing at the data, then upload it here. Each workbook has an answer key as its last tab.</p>
        </div>
      </div>

      <ol className="steps-strip" aria-label="How it works">
        <li><b>1. Download</b><span>a set below</span></li>
        <li><b>2. Solve in Excel</b><span>formulas, no calculator</span></li>
        <li><b>3. Upload</b><span>the saved .xlsx</span></li>
        <li><b>4. Review</b><span>what went well, what slipped</span></li>
      </ol>

      <section className="panel hub-upload" aria-label="Upload a workbook">
        <UploadBox onGraded={(g) => { setGraded(g); refresh((x) => x + 1); }} />
        <p className="hint">Any workbook from this site works here, including older problem sets, mocks and the diagnostic.</p>
      </section>
      {graded && <GradeReport g={graded} onClose={() => setGraded(null)} />}

      <section className="panel hub-section" id="sec-topics">
        <div className="panel-head"><h2>By topic</h2><DownloadNote /></div>
        <p className="hint hub-lead">Three versions of each, built from the notes' tasks and last spring's Exam 3. Same numbers for everyone, so you can compare with classmates.</p>
        <table className="ledger hub-table">
          <thead><tr><th>Topic</th><th className="hide-sm">Covers</th><th>Download</th><th className="val">Last score</th></tr></thead>
          <tbody>
            {TOPIC_SETS.map((s) => (
              <tr key={s.id} id={`set-${s.id}`} className={t.topic === s.id ? "hub-hit" : ""}>
                <td className="lbl"><b>{s.title}</b><div className="hint show-sm">{s.covers}</div></td>
                <td className="lbl hint hide-sm">{s.covers}</td>
                <td>
                  <div className="row">
                    {Array.from({ length: TOPIC_VERSIONS }, (_, v) => v + 1).map((v) => (
                      <button key={v} className={`btn btn-small ${t.topic === s.id && Number(route[2]) === v ? "btn-primary" : "btn-ghost"}`} onClick={() => download(`topic:${s.id}:${v}`)} aria-label={`Download ${s.title}, set ${v}`}>
                        <Download size={13} aria-hidden="true" />Set {v}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="val">
                  <div className="hub-scores">
                    {Array.from({ length: TOPIC_VERSIONS }, (_, v) => <Score key={v} id={`topic:${s.id}:${v + 1}`} />)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel hub-section" id="sec-mocks">
        <div className="panel-head"><h2>Exam-style mocks</h2><span className="hint"><Timer size={12} aria-hidden="true" /> {EXAM_MINUTES} minutes each</span></div>
        <p className="hint hub-lead">Laid out like last spring's Exam 3: confidence intervals, hypothesis testing I and II, two-sample tests, plus a variance test. Set a timer and use no calculator.</p>
        <div className="hub-grid">
          {Array.from({ length: EXAM_COUNT }, (_, k) => k + 1).map((n) => (
            <div key={n} className="hub-card">
              <b>Mock {n}</b>
              <span className="hint">Last score: <Score id={`exam:${n}`} /></span>
              <button className="btn btn-secondary btn-small" onClick={() => download(`exam:${n}`)}><Download size={13} aria-hidden="true" />Download</button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel hub-section" id="sec-mixed">
        <div className="panel-head"><h2>Mixed sets</h2></div>
        <p className="hint hub-lead">Ten questions each, one from every syllabus topic: normal, sample means, intervals, tests for a mean, variance, two samples and a written part.</p>
        <div className="hub-grid">
          {Array.from({ length: MIX_COUNT }, (_, k) => k + 1).map((n) => (
            <div key={n} className="hub-card">
              <b>Mixed set {n}</b>
              <span className="hint">Last score: <Score id={`mix:${n}`} /></span>
              <button className="btn btn-ghost btn-small" onClick={() => download(`mix:${n}`)}><Download size={13} aria-hidden="true" />Download</button>
            </div>
          ))}
        </div>
      </section>

      <CustomBuilder />
    </div>
  );
}

// ---------- build your own ----------
const GROUPS: { title: string; kinds: QuestionKind[] }[] = [
  { title: "Normal distribution", kinds: ["normal-less", "normal-more", "normal-between", "normal-inverse", "zscore"] },
  { title: "Sample means and intervals", kinds: ["sample-mean", "xbar-range", "ci-z", "ci-t"] },
  { title: "Tests for a mean", kinds: ["ht-full", "bernoulli"] },
  { title: "Lesson 18", kinds: ["var-test", "two-z", "two-t", "paired"] },
  { title: "Written", kinds: ["concept"] },
];
const label = (k: QuestionKind) => KINDS.find((x) => x.id === k)?.label ?? k;
const rand = () => 1000 + Math.floor(Math.random() * 1e9);

function CustomBuilder() {
  const { apiKey, fp } = useSession();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [designed, setDesigned] = useState<{ def: WorkbookDef; summary: string } | null>(null);
  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  function buildPicked() {
    const q: CustomSpec["q"] = [];
    const concepts = [...CONCEPTS.keys()].sort(() => Math.random() - 0.5);
    for (const [k, n] of Object.entries(counts)) for (let i = 0; i < n; i++) q.push([k as QuestionKind, k === "concept" ? concepts[i % concepts.length] : rand()]);
    const def = workbookById(specId({ t: `Custom set (${total} questions)`, q }));
    if (def) downloadWorkbook(def);
  }

  async function design() {
    if (!apiKey || !request.trim()) return;
    setBusy(true); setError(null); setDesigned(null);
    try {
      const { spec, summary } = await designCustomSet(apiKey, fp ?? "", request.trim());
      const def = workbookById(specId(spec));
      if (!def) throw new Error("Claude's plan couldn't be built into a set. Try rewording it.");
      setDesigned({ def, summary });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel hub-section" id="sec-custom">
      <div className="panel-head"><h2>Build your own</h2></div>
      <p className="hint hub-lead">Pick question types for a fresh set with new numbers every time. It has its own answer key and is marked here like the others.</p>
      <div className="pick-groups">
        {GROUPS.map((g) => (
          <fieldset key={g.title} className="pick-group">
            <legend>{g.title}</legend>
            {g.kinds.map((k) => (
              <label key={k} className="pick">
                <span>{label(k)}</span>
                <select className="input pick-n" value={counts[k] ?? 0} onChange={(e) => setCounts({ ...counts, [k]: Number(e.target.value) })} aria-label={`How many: ${label(k)}`}>
                  {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <div className="row">
        <button className="btn btn-primary" disabled={!total || total > 30} onClick={buildPicked}><Download size={16} aria-hidden="true" />Download {total ? `${total} question${total === 1 ? "" : "s"}` : "a custom set"}</button>
        {total > 30 && <span className="hint">30 questions at most.</span>}
      </div>

      <div className="ask-claude">
        <h3><Sparkles size={14} aria-hidden="true" /> Or describe it to Claude</h3>
        <p className="hint">For example: "12 hypothesis tests about sports, mostly σ unknown", or "drill me on chi-squared and paired data". Claude only chooses the mix and the stories; the numbers and the answer key come from the site's checked stats engine. Uses a little of your API credit.</p>
        {apiKey ? (
          <>
            <textarea className="input ask-box" rows={3} maxLength={600} value={request} onChange={(e) => setRequest(e.target.value)} placeholder="What do you want to practise?" />
            <div className="row">
              <button className="btn btn-secondary" disabled={busy || !request.trim()} onClick={design}>{busy ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}{busy ? "Designing" : "Design my set"}</button>
            </div>
          </>
        ) : <p className="notice">Add your API key (the key icon) to use this. The pick list above works without one.</p>}
        {error && <p className="notice upload-error" role="alert">{error}</p>}
        {designed && (
          <div className="designed">
            <p><b>{designed.def.title}</b>: {designed.def.questions.length} questions. {designed.summary}</p>
            <ol className="hint">{designed.def.questions.map((q, i) => <li key={i}>{q.title}</li>)}</ol>
            <button className="btn btn-primary" onClick={() => downloadWorkbook(designed.def)}><Download size={16} aria-hidden="true" />Download this set</button>
          </div>
        )}
      </div>
    </section>
  );
}
