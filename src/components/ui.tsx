import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { evaluateSafe } from "../lib/excel.ts";
import { NULLS, genericFormulas, type Null, type Sigma, type Method } from "../lib/tests12.ts";
import type { Step } from "../lib/course.ts";

export function fmt(v: number, format?: "prob" | "num" | "pct"): string {
  if (!Number.isFinite(v)) return "—";
  if (format === "prob") return v < 0.0001 && v > 0 ? v.toExponential(2) : v.toFixed(4);
  if (format === "pct") return `${(v * 100).toFixed(2)}%`;
  const a = Math.abs(v);
  const d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : 4;
  return Number(v.toFixed(d)).toLocaleString("en-US", { maximumFractionDigits: d });
}

export function CopyButton({ text, label = "Copy formula" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="copy-btn"
      aria-label={done ? "Copied" : label}
      title={done ? "Copied" : label}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        }).catch(() => { /* clipboard blocked */ });
      }}
    >
      {done ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
    </button>
  );
}

export function Formula({ f, copy = true }: { f: string; copy?: boolean }) {
  return (
    <span className="formula-wrap">
      <code className="formula">{f}</code>
      {copy && <CopyButton text={f} />}
    </span>
  );
}

/** A worked example's steps: label, the Excel formula, and its value computed live. */
export function StepsLedger({ steps }: { steps: Step[] }) {
  return (
    <table className="ledger steps">
      <tbody>
        {steps.map((s) => {
          const r = evaluateSafe(s.formula);
          return (
            <tr key={s.label}>
              <td className="lbl">
                <div>{s.label}</div>
                <div className="f"><Formula f={s.formula} /></div>
                {s.note && <div className="hint">{s.note}</div>}
              </td>
              <td className="val num">{r.error ? <span className="error-text">{r.error}</span> : fmt(r.value!, s.format)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const COLS: { sigma: Sigma; method: Method; label: string }[] = [
  { sigma: "known", method: "p", label: "σ known · p-value" },
  { sigma: "known", method: "crit", label: "σ known · critical value" },
  { sigma: "unknown", method: "p", label: "σ unknown · p-value" },
  { sigma: "unknown", method: "crit", label: "σ unknown · critical value" },
];

/** The whiteboard's 12 hypothesis test questions. Each cell links to the Excel set for tests of a mean. */
export function TwelveGrid({ stats, compact = false }: { stats?: Map<string, { correct: number; total: number }>; compact?: boolean }) {
  return (
    <div className={`twelve${compact ? " compact" : ""}`} role="table" aria-label="The 12 hypothesis test questions">
      <div className="twelve-row twelve-head" role="row">
        <div role="columnheader" className="twelve-corner">Null hypothesis</div>
        {COLS.map((c) => <div key={c.label} role="columnheader">{c.label}</div>)}
      </div>
      {NULLS.map((n) => (
        <div className="twelve-row" role="row" key={n.id}>
          <div role="rowheader" className="twelve-null">
            <span className="twelve-h0">{n.h0}</span>
            <span className="hint">{n.tail}</span>
          </div>
          {COLS.map((c) => {
            const key = `${n.id}-${c.sigma}-${c.method}`;
            const full = (s: 1 | -1) => genericFormulas(n.id as Null, c.sigma, s);
            // Compact: the whiteboard's own shorthand, .DIST(stat) and .INV(p).
            const short = (s: 1 | -1) => {
              const f = full(s);
              const sh = (x: string) => x.replace(/NORM\.S\.DIST\((\w),TRUE\)|T\.DIST\((\w),ν,TRUE\)/g, ".DIST($1$2)").replace(/NORM\.S\.INV\(([^)]*)\)|T\.INV\(([^,]*),ν\)/g, ".INV($1$2)").replace(/^=/, "");
              return { ...f, p: sh(f.p), crit: sh(f.crit) };
            };
            const g = compact ? short(-1) : full(-1);
            const g2 = compact ? short(1) : full(1);
            const s = stats?.get(key);
            return (
              <a role="cell" key={key} className="twelve-cell" href="#/practice/topic/one-sample" aria-label={`${n.h0}, ${c.label}: practise the hypothesis test set in Excel`}>
                <span className="twelve-sr">{c.label}</span>
                {c.method === "p" ? (
                  n.id === "eq" ? (
                    <>
                      <code className="formula">{g.p}</code>
                      <span className="hint">stat &lt; 0; if &gt; 0:</span>
                      <code className="formula">{g2.p}</code>
                    </>
                  ) : (
                    <code className="formula">{g.p}</code>
                  )
                ) : (
                  <>
                    <code className="formula">{g.crit}</code>
                    {!compact && <span className="hint">{g.rule}</span>}
                  </>
                )}
                <span className="twelve-score num">{s ? `${s.correct}/${s.total} right` : "Not tried"}</span>
              </a>
            );
          })}
        </div>
      ))}
    </div>
  );
}
