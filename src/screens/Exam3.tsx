// Exam 3: the site's diagnostic. Download a blank copy (or use the professor's), finish it in Excel,
// drop it here. It's marked on this device; Claude marks the written parts and coaches on the student's
// key if they want. The result becomes the study plan, plus a practice set aimed at the lost points.
import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, Download, ListChecks, LoaderCircle, Sparkles, Target, Timer } from "lucide-react";
import { buildXlsx, downloadXlsx } from "../lib/xlsx.ts";
import { exam3Sheets, EXAM3_ID, EXAM3_INTRO, EXAM3_TEXT, SECTIONS, targetedSpec } from "../lib/exam3.ts";
import { specId, workbookById, EXAM_MINUTES, type WorkbookDef } from "../lib/sets.ts";
import { downloadWorkbook } from "../lib/download.ts";
import { AREAS, areaById } from "../lib/areas.ts";
import { UploadBox, GradeReport } from "../components/UploadGrade.tsx";
import type { WorkbookGrade } from "../lib/grade.ts";
import { coachExam3, designCustomSet, type CoachAdvice } from "../lib/ai.ts";
import { useSession } from "../session.tsx";
import { useOnline } from "../lib/online.ts";
import PageHint from "../components/PageHint.tsx";
import PhilCorner from "../components/PhilCorner.tsx";
import "./screens.css";
import "./exam3.css";

const LAST = "aqm.exam3.last";
type Saved = { g: WorkbookGrade; marks: Record<string, number>; advice?: CoachAdvice; setId?: string; ts: number };
function readSaved(): Saved | null {
  try { const raw = localStorage.getItem(LAST); return raw ? (JSON.parse(raw) as Saved) : null; } catch { return null; }
}
function writeSaved(s: Saved | null) {
  try { if (s) localStorage.setItem(LAST, JSON.stringify(s)); else localStorage.removeItem(LAST); } catch { /* ignore */ }
}

function downloadBlank() {
  const bytes = buildXlsx(exam3Sheets(), { title: "AQM1000 · Exam 3 (Spring 2026), blank copy", intro: EXAM3_INTRO, id: EXAM3_ID });
  downloadXlsx(bytes, "AQM1000-Exam-3-blank.xlsx");
}

export default function Exam3() {
  const [saved, setSaved] = useState<Saved | null>(readSaved);
  const [open, setOpen] = useState(false);

  function graded(g: WorkbookGrade) {
    const s = { g, marks: {}, ts: Date.now() };
    setSaved(s); writeSaved(s);
    window.setTimeout(() => document.getElementById("exam3-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }
  function update(patch: Partial<Saved>) {
    setSaved((prev) => { if (!prev) return prev; const next = { ...prev, ...patch }; writeSaved(next); return next; });
  }

  return (
    <div className="page exam3">
      <header className="exam3-head stagger">
        <PhilCorner line="Have a proper go first, then we'll mark it together." />
        <p className="eyebrow">The diagnostic · last spring's exam</p>
        <h1>Exam 3</h1>
        <p className="sub">The professor gave out last spring's Exam 3 as the sample exam, and the professor's key isn't released. Do it in Excel like the real thing, drop it here, and the site marks every part, names your slips, and builds your study plan and practice sets from what you missed.</p>
        <PageHint>download it (or use the professor's file), take {EXAM_MINUTES} minutes with no calculator, save, then drop the .xlsx below.</PageHint>
      </header>

      <ol className="exam3-steps stagger">
        <li className="exam3-step lift">
          <span className="exam3-num">1</span>
          <div>
            <b>Get the workbook</b>
            <p className="hint">Same tabs and cells as the professor's. Already have his file? Use that.</p>
            <button className="btn btn-secondary btn-small" onClick={downloadBlank}><Download size={14} aria-hidden="true" />Blank Exam 3 (.xlsx)</button>
          </div>
        </li>
        <li className="exam3-step lift">
          <span className="exam3-num">2</span>
          <div>
            <b>Do it in Excel</b>
            <p className="hint"><Timer size={12} aria-hidden="true" /> {EXAM_MINUTES} minutes, formulas only. In section 1, label your intervals "lower" and "upper"; elsewhere fill the cells beside the labels, and R or DR for decisions.</p>
            <button className="btn btn-ghost btn-small" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="exam3-qs"><ChevronDown size={14} className={open ? "rot" : ""} aria-hidden="true" />{open ? "Hide" : "Show"} the questions</button>
          </div>
        </li>
        <li className="exam3-step lift">
          <span className="exam3-num">3</span>
          <div>
            <b>Drop it here</b>
            <p className="hint">Marked on this device in a second. Your plan updates on Home.</p>
          </div>
        </li>
      </ol>

      <div id="exam3-qs" className={`exam3-qs${open ? " open" : ""}`} hidden={!open}>
        {SECTIONS.map((sec, si) => {
          const area = AREAS[si];
          return (
            <section key={sec} className="panel exam3-sec">
              <div className="panel-head"><h2>{sec}</h2><a className="linkish" href={`#/area/${area.id}`}>Study this section <ArrowRight size={12} aria-hidden="true" /></a></div>
              <ol className="exam3-qlist">
                {EXAM3_TEXT.filter((q) => q.section === si).map((q) => (
                  <li key={q.n} value={q.n}>
                    {q.lead && <p className="hint">{q.lead}</p>}
                    <p>{q.text} <span className="muted num">[{q.points}]</span></p>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>

      <section className="panel exam3-upload" aria-label="Upload your Exam 3">
        <UploadBox onGraded={graded} />
      </section>

      {saved && (
        <div id="exam3-result" className="exam3-result">
          <NextSteps saved={saved} update={update} />
          <GradeReport key={saved.ts} g={saved.g} onMarks={(marks) => update({ marks })} onClose={() => { setSaved(null); writeSaved(null); }} />
        </div>
      )}
    </div>
  );
}

function NextSteps({ saved, update }: { saved: Saved; update: (p: Partial<Saved>) => void }) {
  const { apiKey, fp } = useSession();
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [def, setDef] = useState<WorkbookDef | null>(() => (saved.setId ? workbookById(saved.setId) : null));
  useEffect(() => { setDef(saved.setId ? workbookById(saved.setId) : null); }, [saved.setId]);

  const { g, marks } = saved;
  const writtenGot = g.questions.reduce((s, q) => s + q.parts.reduce((x, p) => x + (p.status === "written" ? (marks[`${q.index}:${p.part.id}`] ?? 0) * p.points : 0), 0), 0);
  const bySection = SECTIONS.map((sec, i) => {
    const qs = g.questions.filter((q) => q.section === sec);
    const got = qs.reduce((s, q) => s + q.got, 0) + qs.reduce((s, q) => s + q.parts.reduce((x, p) => x + (p.status === "written" ? (marks[`${q.index}:${p.part.id}`] ?? 0) * p.points : 0), 0), 0);
    const total = qs.reduce((s, q) => s + q.total, 0);
    return { area: AREAS[i], got, total };
  });
  const got = g.got + writtenGot;

  function targeted() {
    const id = specId(targetedSpec(g, marks));
    update({ setId: id });
    const d = workbookById(id);
    if (d) downloadWorkbook(d);
  }

  async function coach() {
    if (!apiKey) return;
    setBusy(true); setError(null);
    try {
      const lines = g.questions.flatMap((q) => q.parts.map((p) => {
        const w = p.status === "written" ? marks[`${q.index}:${p.part.id}`] : undefined;
        const res = p.status === "written" ? (w === undefined ? "written, not marked" : `written, ${w}/1`) : p.ok ? "right" : `${p.status}${p.slip ? ` (slip: ${p.slip})` : ""}`;
        return `Q${q.index + 1} ${q.q.title} · ${p.part.label}: ${res}`;
      }));
      const advice = await coachExam3(apiKey, fp ?? "", lines, `${Math.round(got * 10) / 10}/${g.total}`);
      let setId: string | undefined;
      if (advice.practice) {
        try {
          const { spec } = await designCustomSet(apiKey, fp ?? "", advice.practice);
          const id = specId({ ...spec, t: "Your Exam 3 practice set (Claude)" });
          if (workbookById(id)) setId = id;
        } catch { /* fall back to the site's targeted set below */ }
      }
      update({ advice, setId: setId ?? specId(targetedSpec(g, marks)) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel exam3-next" aria-labelledby="next-h">
      <div className="panel-head"><h2 id="next-h">What's next</h2><span className="hint num">{Math.round(got * 10) / 10} / {g.total} so far</span></div>
      <ul className="exam3-bars stagger">
        {bySection.map(({ area, got: sg, total }) => (
          <li key={area.id}>
            <a href={`#/area/${area.id}`} className="exam3-bar-row">
              <span className="exam3-bar-label"><span className="area-badge" aria-hidden="true">{area.n}</span>{area.title}</span>
              <span className="bar" aria-hidden="true"><span style={{ width: `${total ? (100 * sg) / total : 0}%` }} /></span>
              <span className="num muted">{Math.round(sg * 10) / 10}/{total}</span>
            </a>
          </li>
        ))}
      </ul>

      {saved.advice && (
        <div className="exam3-advice">
          <p className="hint"><Sparkles size={12} aria-hidden="true" /> Claude's read of your exam</p>
          <p>{saved.advice.summary}</p>
          {saved.advice.focus.length > 0 && (
            <ol>{saved.advice.focus.map((f, i) => <li key={i}><a className="linkish" href={`#/area/${f.area}`}>{areaById(f.area)?.title}</a>: {f.why}</li>)}</ol>
          )}
        </div>
      )}

      <div className="exam3-actions">
        <a className="btn btn-primary" href="#/home"><ListChecks size={16} aria-hidden="true" />See my study plan</a>
        {def
          ? <button className="btn btn-secondary" onClick={() => downloadWorkbook(def)}><Download size={16} aria-hidden="true" />Download my practice set ({def.questions.length} questions)</button>
          : <button className="btn btn-secondary" onClick={targeted}><Target size={16} aria-hidden="true" />Practice set from my mistakes</button>}
        {apiKey && !saved.advice && (
          <button className="btn btn-ghost" onClick={coach} disabled={busy || !online} title={online ? undefined : "Needs internet"}>
            {busy ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}{busy ? "Claude is reading your exam" : "Ask Claude for advice + a custom set"}
          </button>
        )}
      </div>
      <p className="hint">{apiKey
        ? "Tip: mark your written answers below first (Claude can do it), so the plan and advice count them."
        : "Add your API key (the key icon) and Claude can mark your written answers, explain what to fix first, and design a set just for you. The plan and the practice set above work without it."}</p>
      {error && <p className="notice upload-error" role="alert">{error}</p>}
    </section>
  );
}
