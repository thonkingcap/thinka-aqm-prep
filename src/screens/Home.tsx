import { useEffect, useState } from "react";
import { ArrowRight, Download } from "lucide-react";
import { useSession } from "../session.tsx";
import { TOPICS } from "../lib/course.ts";
import { KINDS } from "../lib/practice.ts";
import { readAttempts, statsByTopic, statsByCase, examDate, daysUntil, type Attempt } from "../lib/progress.ts";
import { money, balanceView } from "../lib/spend.ts";
import { TwelveGrid } from "../components/ui.tsx";
import { readResult, currentPlan, todayIso, readDone, skillById } from "../lib/plan.ts";
import { dayLabel } from "./Plan.tsx";
import "./screens.css";
import "./home.css";

const TOPIC_NAME: Record<string, string> = { normal: "Normal curve", clt: "Sampling and CLT", "ci-z": "Z intervals", t: "t intervals", ht: "Hypothesis tests", var: "Variance (χ²)", two: "Two samples, paired", concept: "Written answers" };
/** Question topic (practice.ts) → the Excel topic set that practises it (sets.ts). */
const TOPIC_SET: Record<string, string> = { normal: "normal", clt: "sampling", "ci-z": "intervals", t: "intervals", ht: "one-sample", var: "variance", two: "two-sample", concept: "concepts" };
const setHref = (topic: string) => (TOPIC_SET[topic] ? `#/practice/topic/${TOPIC_SET[topic]}` : "#/practice");

function useAttempts(): Attempt[] {
  const [a, setA] = useState(readAttempts);
  useEffect(() => {
    const on = () => setA(readAttempts());
    window.addEventListener("aqm:progress", on);
    window.addEventListener("storage", on);
    return () => { window.removeEventListener("aqm:progress", on); window.removeEventListener("storage", on); };
  }, []);
  return a;
}

function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function Home() {
  const { apiKey, spend, remote } = useSession();
  const attempts = useAttempts();
  const exam = examDate();
  const days = daysUntil(exam);
  const parts = attempts.reduce((s, a) => s + a.total, 0);
  const right = attempts.reduce((s, a) => s + a.correct, 0);
  const byTopic = statsByTopic(attempts);
  const byCase = statsByCase(attempts);

  // The finding: the weakest topic with at least 4 parts answered.
  const weakest = [...byTopic.values()].filter((s) => s.total >= 4).sort((a, b) => a.correct / a.total - b.correct / b.total)[0];
  const finding = attempts.length === 0
    ? "Nothing marked yet. The 12 test questions below are the heart of the exam."
    : weakest && weakest.correct / weakest.total < 0.8
      ? `Weakest so far: ${TOPIC_NAME[weakest.topic] ?? weakest.topic}, ${weakest.correct} of ${weakest.total} parts right.`
      : `${right} of ${parts} parts right so far. Keep mixing topics.`;

  const recent = attempts.slice(-5).reverse();
  const bal = balanceView(remote, spend);

  // v2: the diagnostic and plan lead the screen once they exist.
  const result = readResult();
  const plan = currentPlan();
  const today = todayIso();
  const todayDay = plan?.find((d) => d.date === today) ?? plan?.find((d) => d.date > today);
  const done = readDone();
  const gaps = result?.scores.filter((s) => s.level === "gap").map((s) => skillById(s.id).name) ?? [];

  return (
    <div className="page home">
      <header className="home-head">
        <h1>{days > 0 ? `Midterm 2 is ${longDate(exam)}, ${days} day${days === 1 ? "" : "s"} away` : days === 0 ? "Midterm 2 is today" : "Midterm 2 has passed"}</h1>
        <p className="home-finding">
          {!result
            ? "Start with the 25-minute diagnostic in Excel: it finds your gaps across Lessons 12–18 and builds a plan for the days you have left."
            : gaps.length
              ? `Your diagnostic found ${gaps.length} gap${gaps.length === 1 ? "" : "s"}: ${gaps.slice(0, 3).join(", ")}${gaps.length > 3 ? "…" : ""}. ${finding}`
              : `No gaps in your diagnostic. ${finding}`}
        </p>
        <div className="row">
          {!result ? (
            <a className="btn btn-primary" href="#/plan"><Download size={16} aria-hidden="true" />Take the diagnostic in Excel</a>
          ) : (
            <a className="btn btn-primary" href="#/plan">Open my plan<ArrowRight size={16} aria-hidden="true" /></a>
          )}
          <a className="btn btn-secondary" href={weakest ? setHref(weakest.topic) : "#/practice"}>{weakest ? "Practice my weakest topic" : "Practice in Excel"}</a>
        </div>
      </header>

      <section className="panel home-how" aria-labelledby="how-h">
        <div className="panel-head"><h2 id="how-h">How practice works</h2><a href="#/practice">Practice sets</a></div>
        <ol className="home-steps">
          <li><span className="num">1</span><span><b>Download</b> a workbook: a topic set, a mixed set or a 60-minute exam-style mock.</span></li>
          <li><span className="num">2</span><span><b>Solve it in Excel</b> with formulas that point at the data. No calculators on the exam, so none here.</span></li>
          <li><span className="num">3</span><span><b>Upload</b> the saved file. Every yellow cell is marked on the full value.</span></li>
          <li><span className="num">4</span><span><b>See what went wrong</b>: the likely slip on each wrong answer, and what to redo. The answer key is the last tab.</span></li>
        </ol>
      </section>

      {todayDay && (
        <section className="panel home-today" aria-label="Today's plan">
          <div className="panel-head">
            <h2>{todayDay.date === today ? "Today" : dayLabel(todayDay.date)}: {todayDay.title}</h2>
            <a href="#/plan">Full plan</a>
          </div>
          <ul className="home-tasks">
            {todayDay.tasks.filter((t) => t.kind !== "tutor").map((t, i) => (
              <li key={t.label} className={done[`${todayDay.date}:${i}`] ? "done" : ""}>
                <a href={t.href}>{t.label}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="tiles" aria-label="Your numbers">
        <div className="tile"><span className="tile-label">Days to the exam</span><span className="tile-value">{Math.max(0, days)}</span><span className="tile-cap">{longDate(exam)}</span></div>
        <div className="tile"><span className="tile-label">Parts marked</span><span className={`tile-value${parts === 0 ? " zero" : ""}`}>{parts}</span><span className="tile-cap">{attempts.length ? `${attempts.length} question${attempts.length === 1 ? "" : "s"}` : "Upload a workbook to start"}</span></div>
        <div className="tile"><span className="tile-label">Accuracy</span><span className={`tile-value${parts === 0 ? " zero" : ""}`}>{parts ? `${Math.round((100 * right) / parts)}%` : "—"}</span><span className="tile-cap">{parts ? `${right} of ${parts} parts` : "Ready when you are"}</span></div>
        <a className="tile tile-link" href="#/key"><span className="tile-label">{bal?.real ? "API balance" : "API balance, estimated"}</span><span className={`tile-value${!bal ? " zero" : ""}`}>{!bal ? "—" : money(bal.left ?? bal.spent)}</span><span className="tile-cap">{!apiKey ? "Add your key to use the tutor" : bal?.real ? (bal.total !== null ? `left of ${money(bal.total)}, from Babson` : "spent so far, from Babson") : `${money(spend?.spent ?? 0, 3)} used on this device`}</span></a>
      </section>

      <div className="home-row home-row-a">
        <section className="panel">
          <div className="panel-head"><h2>The 12 hypothesis test questions</h2><a href="#/learn/twelve">How they work</a></div>
          <TwelveGrid stats={byCase} compact />
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Topics, Lessons 12–18</h2><a href="#/learn">Open notes</a></div>
          <ol className="topic-list">
            {TOPICS.filter((t) => t.id !== "dictionary").map((t) => (
              <li key={t.id}><a href={`#/learn/${t.id}`}><span>{t.title}</span><span className="hint">{t.lesson}</span></a></li>
            ))}
          </ol>
        </section>
      </div>

      <div className="home-row home-row-b">
        <section className="panel">
          <div className="panel-head"><h2>By topic</h2><a href="#/practice/mixed">Mixed sets</a></div>
          <table className="ledger">
            <thead><tr><th>Topic</th><th className="val">Parts right</th><th className="val">Accuracy</th></tr></thead>
            <tbody>
              {Object.entries(TOPIC_NAME).map(([id, name]) => {
                const s = byTopic.get(id);
                return (
                  <tr key={id}>
                    <td className="lbl"><a href={setHref(id)}>{name}</a></td>
                    <td className="val num">{s ? `${s.correct} / ${s.total}` : <span className="muted">—</span>}</td>
                    <td className="val num">{s ? `${Math.round((100 * s.correct) / s.total)}%` : <span className="muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Recent questions</h2><a href="#/practice/mocks">Exam-style mocks</a></div>
          {recent.length === 0 ? (
            <div className="empty">Upload a solved workbook and its last five questions show here.</div>
          ) : (
            <table className="ledger">
              <tbody>
                {recent.map((a) => (
                  <tr key={a.ts}>
                    <td className="lbl">{KINDS.find((k) => k.id === a.kind)?.label ?? a.kind}{a.caseKey ? <span className="hint"> · {a.caseKey}</span> : null}</td>
                    <td className="val num"><span className={`pill ${a.correct === a.total ? "pill-pos" : a.correct === 0 ? "pill-neg" : "pill-warn"}`}>{a.correct}/{a.total}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
