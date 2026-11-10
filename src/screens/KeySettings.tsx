import { useState } from "react";
import { ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { useSession } from "../session.tsx";
import { mask, isShared, IDLE_DAYS } from "../lib/vault.ts";
import { BILLING_URL, KEYS_URL, PRICE, money, readSpend, writeSpend, balanceView } from "../lib/spend.ts";
import { examDate, setExamDate, clearAttempts, DEFAULT_EXAM } from "../lib/progress.ts";
import { KeyForm } from "./Gate.tsx";
import "./screens.css";
import "./settings.css";

export default function KeySettings() {
  const { apiKey, fp, spend, remote, provider, refreshBalance, forget } = useSession();
  const [start, setStart] = useState(spend ? String(spend.start) : "100");
  const [exam, setExam] = useState(examDate());
  const [saved, setSaved] = useState<string | null>(null);
  const babson = provider?.id === "babson";
  const view = balanceView(remote, spend);

  function saveStart() {
    if (!fp) return;
    const v = parseFloat(start);
    if (!Number.isFinite(v) || v < 0) return;
    const s = readSpend(fp);
    s.start = v;
    writeSpend(fp, s);
    setSaved("balance");
  }
  function resetSpend() {
    if (!fp) return;
    const s = readSpend(fp);
    writeSpend(fp, { ...s, spent: 0, calls: 0, inTok: 0, outTok: 0, since: new Date().toISOString() });
  }

  return (
    <div className="page settings">
      <div className="title-row"><div><h1>API key and balance</h1><p className="sub">Everything here stays in this browser.</p></div></div>

      <section className="set-row">
        <div className="set-label">
          <h2>Your key</h2>
          <p>Paste the key from Babson's email. The tutor runs on {provider?.modelLabel ?? "Claude Sonnet"} with your own key, and the page sends it only to {babson ? "Babson's Claude gateway" : provider ? "api.anthropic.com" : "Babson's Claude gateway (or Anthropic, for keys made at platform.claude.com)"}. The site's security policy blocks every other destination.</p>
        </div>
        <div className="set-panel">
          {apiKey ? (
            <div className="stack">
              <div className="kv"><span>Key in use</span><code className="formula">{mask(apiKey)}</code></div>
              <div className="kv"><span>Goes to</span><span>{provider?.label} · {provider?.model}</span></div>
              <div className="kv"><span>Stored</span><span>{isShared() ? "Encrypted, in this tab only: closing the tab forgets it" : `Encrypted on this device; forgotten after ${IDLE_DAYS} days without a visit`}</span></div>
              <div className="row">
                <button className="btn btn-secondary" onClick={forget}><Trash2 size={16} aria-hidden="true" />Remove key from this device</button>
              </div>
              <p className="hint">Using a shared or library computer? Remove your key when you're done.</p>
              <p className="hint">
                {babson
                  ? "If you think your key leaked, ask Babson for a new one and stop using this one."
                  : <>If you think a key leaked, delete it at <a href={KEYS_URL} target="_blank" rel="noopener noreferrer">platform.claude.com <ExternalLink size={11} aria-hidden="true" /></a> and make a new one.</>}
              </p>
            </div>
          ) : (
            <KeyForm compact />
          )}
        </div>
      </section>

      <section className="set-row">
        <div className="set-label">
          <h2>Balance</h2>
          {babson ? (
            <p>Read live from Babson's gateway: what this key has spent and the budget Babson set for it. It updates a few seconds after each tutor reply.</p>
          ) : (
            <p>Anthropic doesn't let a regular API key read its remaining credit, so this is an estimate: each reply's exact token usage, priced at Sonnet rates, subtracted from your starting balance. For the exact figure, check <a href={BILLING_URL} target="_blank" rel="noopener noreferrer">Billing in the Claude Console</a>.</p>
          )}
        </div>
        <div className="set-panel">
          {!apiKey || !view ? (
            <p className="muted">Add your key to see it.</p>
          ) : view.real ? (
            <div className="stack">
              <div className="balance">
                <span className="balance-value num">{view.left === null ? money(view.spent) : money(view.left)}</span>
                <span className="muted">{view.left === null ? "spent so far (no budget set on this key)" : `left of ${money(view.total!)}`}</span>
              </div>
              <table className="ledger">
                <tbody>
                  <tr><td className="lbl">Spent, all devices</td><td className="val num">{money(view.spent, 4)}</td></tr>
                  {view.total !== null && <tr><td className="lbl">Budget</td><td className="val num">{money(view.total)}</td></tr>}
                  {spend && <tr><td className="lbl">Replies on this device</td><td className="val num">{spend.calls}</td></tr>}
                  {spend && spend.calls > 0 && <tr><td className="lbl">Average per reply, estimated</td><td className="val num">{money(spend.spent / spend.calls, 4)}</td></tr>}
                </tbody>
              </table>
              <div className="row">
                <button className="btn btn-ghost btn-small" onClick={refreshBalance}><RefreshCw size={14} aria-hidden="true" />Refresh</button>
                {remote && <span className="hint">Updated {new Date(remote.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
              </div>
            </div>
          ) : (
            <div className="stack">
              {babson && <p className="notice neutral">Babson's gateway didn't return a balance just now, so this is an estimate. <button className="linkish" onClick={refreshBalance}>Try again</button></p>}
              <div className="balance">
                <span className="balance-value num">{money(view.left!)}</span>
                <span className="muted">estimated left of {money(view.total!)}</span>
              </div>
              <table className="ledger">
                <tbody>
                  <tr><td className="lbl">Spent on this device</td><td className="val num">{money(spend!.spent, 4)}</td></tr>
                  <tr><td className="lbl">Replies</td><td className="val num">{spend!.calls}</td></tr>
                  <tr><td className="lbl">Average per reply</td><td className="val num">{spend!.calls ? money(spend!.spent / spend!.calls, 4) : "—"}</td></tr>
                </tbody>
              </table>
              <div className="field">
                <label htmlFor="start-bal">Starting balance (USD)</label>
                <div className="row">
                  <input id="start-bal" className="input num set-small" inputMode="decimal" value={start} onChange={(e) => { setStart(e.target.value); setSaved(null); }} />
                  <button className="btn btn-secondary" onClick={saveStart}>Save</button>
                  <button className="btn btn-ghost" onClick={resetSpend}>Reset spend</button>
                  {saved === "balance" && <span className="hint">Saved</span>}
                </div>
              </div>
              <p className="hint">Priced at ${PRICE.input} per million input tokens and ${PRICE.output} per million output tokens. A typical tutor reply costs a few cents.</p>
            </div>
          )}
        </div>
      </section>

      <section className="set-row">
        <div className="set-label">
          <h2>Exam date and progress</h2>
          <p>The home screen counts down to this date. Practice history lives only in this browser.</p>
        </div>
        <div className="set-panel stack">
          <div className="field">
            <label htmlFor="exam-date">Midterm 2 date</label>
            <div className="row">
              <input id="exam-date" type="date" className="input set-small" value={exam} onChange={(e) => { setExam(e.target.value); setExamDate(e.target.value || DEFAULT_EXAM); }} />
            </div>
          </div>
          <div><button className="btn btn-ghost" onClick={() => { if (confirm("Clear all practice history on this device?")) clearAttempts(); }}>Clear practice history</button></div>
        </div>
      </section>
    </div>
  );
}
