import { MessageSquare, PencilLine } from "lucide-react";
import { TOPICS, topicById, type Topic } from "../lib/course.ts";
import { useSession } from "../session.tsx";
import { Formula, StepsLedger, TwelveGrid } from "../components/ui.tsx";
import Curve, { type CurveProps } from "../components/Curve.tsx";
import Markdown from "../components/Markdown.tsx";
import { readAttempts, statsByCase } from "../lib/progress.ts";
import { normInv, tInv } from "../lib/stats.ts";
import "./screens.css";

/** The Excel topic set (sets.ts TOPIC_SETS id) that practises each Learn topic. */
export const PRACTICE_FOR: Record<string, string> = {
  normal: "normal",
  clt: "sampling",
  "ci-z": "intervals",
  t: "intervals",
  "ht-logic": "one-sample",
  twelve: "one-sample",
  "sigma-n": "one-sample",
  variance: "variance",
  "two-sample": "two-sample",
  paired: "two-sample",
  dictionary: "concepts",
};

function figureFor(id: string): (CurveProps & { caption: string }) | null {
  const z975 = normInv(0.975);
  switch (id) {
    case "normal":
      return {
        dist: { kind: "normal", mean: 18, sd: 5 },
        regions: [{ from: 16, to: 20, kind: "fill" }],
        markers: [{ x: 16, label: "16 s" }, { x: 20, label: "20 s" }],
        ariaLabel: "Normal curve with mean 18 and sd 5, the area between 16 and 20 seconds shaded",
        caption: "P(16 < X < 20) is the shaded area: NORM.DIST(20,…) − NORM.DIST(16,…).",
      };
    case "clt": {
      const se = 0.5 / Math.sqrt(5);
      return {
        dist: { kind: "normal", mean: 11, sd: se },
        regions: [{ from: -Infinity, to: 10.5, kind: "fill" }],
        markers: [{ x: 10.5, label: "10.5 oz" }, { x: 11, label: "μ = 11", tone: "muted", dashed: true }],
        ariaLabel: "Sampling distribution of the mean of five cereal boxes, the area below 10.5 ounces shaded",
        caption: "X̄ for five boxes has SE = 0.5/√5 ≈ 0.224, so 10.5 oz is far out in the tail.",
      };
    }
    case "ci-z":
      return {
        dist: { kind: "z" },
        regions: [{ from: -Infinity, to: -z975, kind: "alpha" }, { from: z975, to: Infinity, kind: "alpha" }],
        markers: [{ x: -z975, label: "−1.96" }, { x: z975, label: "+1.96" }],
        ariaLabel: "Standard normal with 2.5% hatched in each tail beyond ±1.96",
        caption: "95% in the middle, α/2 = 2.5% in each tail: Z_α/2 = NORM.S.INV(0.975) = 1.96.",
      };
    case "t": {
      const c = tInv(0.95, 6);
      return {
        dist: { kind: "t", df: 6 },
        regions: [{ from: -Infinity, to: -c, kind: "alpha" }, { from: c, to: Infinity, kind: "alpha" }],
        markers: [{ x: -c, label: `−${c.toFixed(3)}` }, { x: c, label: `+${c.toFixed(3)}` }],
        ariaLabel: "t distribution with 6 degrees of freedom, 5% hatched in each tail",
        caption: "With ν = 6 the 90% critical value is T.INV(0.95, 6) = 1.943, wider than Z's 1.645.",
      };
    }
    case "ht-logic":
      return {
        dist: { kind: "z" },
        regions: [{ from: -Infinity, to: -2.5758, kind: "alpha" }, { from: 2.5758, to: Infinity, kind: "alpha" }, { from: -Infinity, to: -3.724, kind: "p" }, { from: 3.724, to: Infinity, kind: "p" }],
        markers: [{ x: -3.724, label: "Z = −3.72", tone: "accent" }, { x: -2.5758, label: "−2.576", tone: "muted", dashed: true }, { x: 2.5758, label: "+2.576", tone: "muted", dashed: true }],
        ariaLabel: "Standard normal: Z = −3.72 lies beyond the 1% two-tailed critical values ±2.576",
        caption: "Z = −3.72 lands beyond −2.576, deep in the hatched 1% region: reject H₀.",
      };
    case "sigma-n":
      return {
        dist: { kind: "z" },
        regions: [{ from: -Infinity, to: -1.6398, kind: "p" }, { from: 1.6398, to: Infinity, kind: "p" }, { from: -Infinity, to: -z975, kind: "alpha" }, { from: z975, to: Infinity, kind: "alpha" }],
        markers: [{ x: -1.6398, label: "σ = 0.3: Z = −1.64", tone: "accent" }, { x: -0.246, label: "σ = 2: Z = −0.25", tone: "muted" }],
        ariaLabel: "Standard normal comparing Z = −1.64 with sigma 0.3 and Z = −0.25 with sigma 2",
        caption: "Same five boxes. σ = 0.3 puts Z at −1.64 (p ≈ 0.10); σ = 2 puts it at −0.25 (p ≈ 0.81).",
      };
    default:
      return null;
  }
}

function TopicBody({ t }: { t: Topic }) {
  const { askTutor, apiKey } = useSession();
  const fig = figureFor(t.id);
  return (
    <article className="topic">
      <header className="topic-head">
        <p className="muted">{t.lesson}</p>
        <h1>{t.title}</h1>
        <p className="topic-summary">{t.summary}</p>
        <div className="row topic-actions">
          <a className="btn btn-primary" href={PRACTICE_FOR[t.id] ? `#/practice/topic/${PRACTICE_FOR[t.id]}` : "#/practice"} title="Download the set, solve it in Excel, upload it to be marked"><PencilLine size={16} aria-hidden="true" />Practice this in Excel</a>
          <button
            className="btn btn-secondary"
            onClick={() => askTutor(`Teach me "${t.title}" (${t.lesson}) in a few short steps, then give me one exam-style question to try.`)}
            title={apiKey ? undefined : "Needs your API key"}
          >
            <MessageSquare size={16} aria-hidden="true" />Ask the tutor
          </button>
        </div>
      </header>

      {t.id === "twelve" && (
        <section className="panel topic-twelve">
          <TwelveGrid stats={statsByCase(readAttempts())} />
        </section>
      )}

      <div className="topic-grid">
        <section className="topic-notes">
          {t.notes.map((n) => (
            <div className="note" key={n.heading}>
              <h2>{n.heading}</h2>
              <Markdown text={n.body} />
            </div>
          ))}
          {t.pitfalls.length > 0 && (
            <div className="note">
              <h2>Mistakes that cost points</h2>
              <ul className="pitfalls">{t.pitfalls.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          )}
        </section>

        <aside className="topic-side">
          {fig && (
            <figure className="panel topic-figure">
              <Curve {...fig} height={200} compact />
              <figcaption className="hint">{fig.caption}</figcaption>
            </figure>
          )}
          <section className="panel">
            <div className="panel-head"><h2>Formulas</h2></div>
            <table className="ledger">
              <tbody>
                {t.formulas.map((f) => (
                  <tr key={f.label}>
                    <td className="lbl">
                      <div className="formula-label">{f.label} <span className="muted">{f.math}</span></div>
                      <div className="f">{/^[=.]|^NORM|^T\./.test(f.excel) ? <Formula f={f.excel} copy={f.excel.startsWith("=")} /> : <span className="hint">{f.excel}</span>}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </aside>
      </div>

      {t.example && (
        <section className="panel topic-example">
          <div className="panel-head">
            <h2>Worked example: {t.example.title}</h2>
            <span className="hint">{t.example.source}</span>
          </div>
          <p className="example-setup">{t.example.setup}</p>
          {t.example.data && (
            <p className="example-data"><span className="muted">Data </span><span className="num">{t.example.data.join(", ")}</span></p>
          )}
          <StepsLedger steps={t.example.steps} />
          <p className="example-conclusion">{t.example.conclusion}</p>
        </section>
      )}
    </article>
  );
}

export default function Learn({ topicId }: { topicId?: string }) {
  const t = (topicId && topicById(topicId)) || TOPICS[0];
  return (
    <div className="page wide learn">
      <nav className="learn-nav" aria-label="Topics">
        <h2 className="learn-nav-title">Midterm 2 topics</h2>
        <ol>
          {TOPICS.map((x) => (
            <li key={x.id}>
              <a href={`#/learn/${x.id}`} aria-current={x.id === t.id ? "page" : undefined}>
                <span>{x.title}</span>
                <span className="hint">{x.lesson}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <TopicBody t={t} key={t.id} />
    </div>
  );
}
