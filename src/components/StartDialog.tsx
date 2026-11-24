// The pop-up people see when they arrive: "What do you want to do?" with the four ways in.
// Shown once per visit (browser tab session) when landing on Home; reopened by the "aqm:start" event.
import { useEffect, useRef, useState } from "react";
import { BookOpen, CalendarClock, Layers, Rocket, X } from "lucide-react";
import { openHowTo } from "./Walkthrough.tsx";
import { finalDate, daysTo } from "../lib/lessons/dates.ts";
import "./start.css";

const SHOWN = "aqm.start.shown";
export const openStart = () => window.dispatchEvent(new CustomEvent("aqm:start"));

function shownThisVisit(): boolean {
  try { return sessionStorage.getItem(SHOWN) === "1"; } catch { return false; }
}
function markShown() {
  try { sessionStorage.setItem(SHOWN, "1"); } catch { /* ignore */ }
}

export default function StartDialog({ allowed, landing }: { allowed: boolean; landing: boolean }) {
  const [open, setOpen] = useState(() => allowed && landing && !shownThisVisit());
  const box = useRef<HTMLDivElement>(null);
  const days = daysTo(finalDate());

  useEffect(() => {
    if (allowed && landing && !shownThisVisit()) setOpen(true);
  }, [allowed, landing]);
  useEffect(() => {
    const on = () => setOpen(true);
    const off = () => setOpen(false);
    window.addEventListener("aqm:start", on);
    window.addEventListener("hashchange", off);
    return () => { window.removeEventListener("aqm:start", on); window.removeEventListener("hashchange", off); };
  }, []);
  useEffect(() => {
    if (!open) return;
    markShown();
    box.current?.querySelector<HTMLElement>(".start-choice")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
      if (e.key !== "Tab" || !box.current) return;
      const f = [...box.current.querySelectorAll<HTMLElement>("a[href], button")];
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  const close = () => setOpen(false);
  const CHOICES = [
    { href: "#/lessons", icon: BookOpen, title: "Review a lesson", body: "Pick a class: his definitions, a worked example, a two-minute quick check and Excel practice." },
    { href: "#/units", icon: Layers, title: "Review a unit", body: "Unit 1 (Exam 1) or Unit 2 (Exam 2): mixed questions across the unit and exam-style papers." },
    { href: "#/final", icon: CalendarClock, title: "Prepare for the final", body: `${days > 0 ? `${days} day${days === 1 ? "" : "s"} to go (Wed 16 Dec).` : "Wed 16 Dec."} Review papers across the course and every definition in one place.` },
    { href: "#/ahead", icon: Rocket, title: "Get ahead", beta: true, body: "Regression and the rest of the semester, before it's taught. Built from the syllabus and past finals." },
  ];
  return (
    <div className="start-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="start" role="dialog" aria-modal="true" aria-labelledby="start-title" ref={box}>
        <button className="start-x" onClick={close} aria-label="Close"><X size={16} aria-hidden="true" /></button>
        <h2 id="start-title">What do you want to do?</h2>
        <p className="hint">Midterm 2 is done. Everything here now builds towards the final.</p>
        <div className="start-grid">
          {CHOICES.map(({ href, icon: Icon, title, body, beta }) => (
            <a key={href} className="start-choice" href={href} onClick={close}>
              <span className="start-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.6} /></span>
              <span className="start-text">
                <b>{title}{beta && <span className="beta-tag">BETA</span>}</b>
                <span>{body}</span>
              </span>
            </a>
          ))}
        </div>
        <div className="start-foot">
          <button className="linkish" onClick={() => { close(); openHowTo(); }}>New here? 30-second guide</button>
          <span className="row">
            <a className="linkish" href="#/tutor" onClick={close}>Ask Dr Phil instead</a>
            <button className="btn btn-ghost btn-small" onClick={close}>Just look around</button>
          </span>
        </div>
      </div>
    </div>
  );
}
