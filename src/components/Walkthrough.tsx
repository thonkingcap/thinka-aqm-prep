// "How to use this site": three short steps, shown once on the first visit and reopened from the
// "?" button in the nav (or anything that dispatches the "aqm:howto" event).
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, FileSpreadsheet, ListChecks, PencilLine, X } from "lucide-react";
import { AREAS } from "../lib/areas.ts";
import "./walkthrough.css";

const SEEN = "aqm.howto.seen";
export const openHowTo = () => window.dispatchEvent(new CustomEvent("aqm:howto"));

const STEPS = [
  {
    icon: FileSpreadsheet,
    title: "Start with Exam 3",
    body: "Download last spring's Exam 3 (or use the copy you already did), finish it in Excel with formulas, no calculator, then drop the file in. The site marks every answer.",
    cta: { label: "Open Exam 3", href: "#/exam3" },
  },
  {
    icon: ListChecks,
    title: "Get your plan",
    body: "Your marked Exam 3 becomes a day-by-day plan up to the midterm. It spends your time on the parts you missed, and it shows up on Home.",
    cta: { label: "Go Home", href: "#/home" },
  },
  {
    icon: PencilLine,
    title: "Practise the four areas",
    body: `The exam has four sections: ${AREAS.map((a) => a.title.toLowerCase()).join(", ").replace(/, ([^,]*)$/, " and $1")}. Each has short notes and Excel sets: download one, solve it, upload it to see what went right and what slipped.`,
    cta: { label: "Open area 1", href: "#/area/ci" },
  },
] as const;

function seen(): boolean {
  try { return localStorage.getItem(SEEN) === "1"; } catch { return true; }
}
function markSeen() {
  try { localStorage.setItem(SEEN, "1"); } catch { /* ignore */ }
}

export default function Walkthrough() {
  const [open, setOpen] = useState(() => !seen());
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const box = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<Element | null>(null);

  useEffect(() => {
    const on = () => { setStep(0); setDir(1); setOpen(true); };
    window.addEventListener("aqm:howto", on);
    return () => window.removeEventListener("aqm:howto", on);
  }, []);

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement;
    box.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key !== "Tab" || !box.current) return;
      const f = [...box.current.querySelectorAll<HTMLElement>("button, a[href]")].filter((el) => !el.hasAttribute("disabled"));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep focus inside when the focused button is swapped out (Next → Got it).
  useEffect(() => {
    if (open && box.current && !box.current.contains(document.activeElement)) box.current.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, [open, step]);

  function close() {
    markSeen();
    setOpen(false);
    (lastFocus.current as HTMLElement | null)?.focus?.();
  }
  function go(d: 1 | -1) {
    setDir(d);
    setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + d)));
  }

  if (!open) return null;
  const s = STEPS[step];
  const Icon = s.icon;
  const lastStep = step === STEPS.length - 1;

  return (
    <div className="howto-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="howto" role="dialog" aria-modal="true" aria-labelledby="howto-title" aria-describedby="howto-body" ref={box}>
        <button className="howto-x" onClick={close} aria-label="Close the walkthrough"><X size={16} aria-hidden="true" /></button>
        <p className="howto-eyebrow">How to use this site · {step + 1} of {STEPS.length}</p>
        <div className={`howto-step ${dir > 0 ? "from-right" : "from-left"}`} key={step}>
          <span className="howto-icon" aria-hidden="true"><Icon size={22} strokeWidth={1.6} /></span>
          <h2 id="howto-title">{s.title}</h2>
          <p id="howto-body">{s.body}</p>
          <a className="howto-cta" href={s.cta.href} onClick={close}>{s.cta.label}<ArrowRight size={14} aria-hidden="true" /></a>
        </div>
        <p className="howto-note">Got a Babson Claude API key? Add it with the key button for Dr Phil (the AI tutor) and for Claude's feedback on your written answers. Everything else works without one.</p>
        <div className="howto-foot">
          <div className="howto-dots" aria-hidden="true">
            {STEPS.map((_, i) => <span key={i} className={i === step ? "on" : i < step ? "done" : ""} />)}
          </div>
          <div className="row">
            {step > 0 ? (
              <button className="btn btn-ghost btn-small" onClick={() => go(-1)}><ArrowLeft size={14} aria-hidden="true" />Back</button>
            ) : (
              <button className="btn btn-ghost btn-small" onClick={close}>Skip</button>
            )}
            {lastStep ? (
              <button className="btn btn-primary btn-small" onClick={close} data-autofocus>Got it</button>
            ) : (
              <button className="btn btn-primary btn-small" onClick={() => go(1)} data-autofocus>Next<ArrowRight size={14} aria-hidden="true" /></button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
