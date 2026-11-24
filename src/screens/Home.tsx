// Home: the four ways in (the same as the start pop-up), how long until the final, and where you left off.
import { ArrowRight, BookOpen, CalendarClock, Layers, MessageSquare, Rocket } from "lucide-react";
import { lastLesson } from "../lib/lessons/progress.ts";
import { finalDate, daysTo } from "../lib/lessons/dates.ts";
import PhilCorner from "../components/PhilCorner.tsx";
import { openHowTo } from "../components/Walkthrough.tsx";
import "./screens.css";
import "./home.css";
import "./hub.css";

const WAYS = [
  { href: "#/lessons", icon: BookOpen, title: "Lesson by lesson", body: "His definitions, a worked example, a quick check and marked Excel practice for every class." },
  { href: "#/units", icon: Layers, title: "Unit by unit", body: "A diagnostic for each unit, laid out like the real exam, then the lessons it says to review." },
  { href: "#/final", icon: CalendarClock, title: "Final review", body: "A two-hour practice test laid out like last spring's final, and every definition in one place." },
  { href: "#/ahead", icon: Rocket, title: "Get ahead", beta: true, body: "Regression and the rest of the term, before it's taught." },
];

export default function Home() {
  const days = daysTo(finalDate());
  const last = lastLesson();
  const L = last ? { n: last.n, title: last.title ?? "" } : null;
  return (
    <div className="page home">
      <header className="home-head stagger">
        <PhilCorner line="Midterm's done. Kettle's on for the final." />
        <p className="home-count">
          <span className="home-count-n num">{Math.max(0, days)}</span>
          <span>{days > 0 ? `day${days === 1 ? "" : "s"} until the final · Wednesday 16 December` : days === 0 ? "The final is today. You've got this." : "The final has passed"}</span>
        </p>
        <h1>Review any lesson, any unit, or the whole course.</h1>
      </header>

      {L && (
        <a className="hub-callout carry lift" href={`#/lesson/${L.n}`}>
          <span><span className="hint">Carry on where you left off</span><b>Lesson {L.n}{L.title ? `: ${L.title}` : ""}</b></span>
          <ArrowRight size={14} aria-hidden="true" />
        </a>
      )}

      <div className="ways stagger">
        {WAYS.map(({ href, icon: Icon, title, body, beta }) => (
          <a key={href} className="way lift" href={href}>
            <span className="way-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.6} /></span>
            <b>{title}{beta && <span className="beta-tag">BETA</span>}</b>
            <span className="way-body">{body}</span>
            <span className="way-go" aria-hidden="true">Open <ArrowRight size={14} /></span>
          </a>
        ))}
      </div>

      <div className="row home-small">
        <a className="btn btn-ghost btn-small" href="#/tutor"><MessageSquare size={14} aria-hidden="true" />Ask Dr Phil (AI tutor)</a>
        <button className="btn btn-ghost btn-small" onClick={openHowTo}>How this site works</button>
        <a className="linkish" href="#/unit/2/kit">Looking for the Midterm 2 tools? They're in Unit 2.</a>
      </div>
    </div>
  );
}
