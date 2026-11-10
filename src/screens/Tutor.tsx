import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Calculator, LoaderCircle, Plus, Square } from "lucide-react";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { useSession } from "../session.tsx";
import { KEY_IN_TEXT } from "../lib/vault.ts";
import { runTutorTurn, type ToolRun } from "../lib/claude.ts";
import { money, balanceView } from "../lib/spend.ts";
import Markdown from "../components/Markdown.tsx";
import { fmt } from "../components/ui.tsx";
import { KeyForm } from "./Gate.tsx";
import Thinka from "../components/Thinka.tsx";
import "./screens.css";
import "./tutor.css";

type Part = { type: "text"; text: string } | { type: "tool"; runs: ToolRun[] };
type Turn = { role: "user"; text: string } | { role: "assistant"; parts: Part[]; error?: string; note?: string };

// Kept at module level so the conversation survives switching screens (not page reloads).
const store: { history: BetaMessageParam[]; turns: Turn[] } = { history: [], turns: [] };

const STARTERS = [
  "Quiz me on the 12 hypothesis test questions, one at a time.",
  "When do I use Z and when do I use T?",
  "Explain why the two-tailed p-value formula changes with the sign of the statistic.",
  "What's the difference between \"where will x̄ land\" and \"where is μ\"?",
  "Give me an exam-style left-tailed t-test with raw data.",
  "How do I read \"more than\", \"less than\" and \"different from\" into H₀ and H_A?",
];

function ToolLedger({ runs }: { runs: ToolRun[] }) {
  return (
    <details className="tool-ledger">
      <summary><Calculator size={14} aria-hidden="true" /> Calculated in Excel · {runs.length} formula{runs.length === 1 ? "" : "s"}</summary>
      <table className="ledger">
        <tbody>
          {runs.map((r, i) => (
            <tr key={i}>
              <td className="lbl"><code className="formula">{r.formula}</code></td>
              <td className="val num">{r.error ? <span className="error-text">{r.error}</span> : fmt(r.value!)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export default function Tutor() {
  const { apiKey, fp, spend, remote, provider, takePending } = useSession();
  const bal = balanceView(remote, spend);
  const [turns, setTurns] = useState<Turn[]>(store.turns);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"thinking" | "writing" | "calculating" | "idle">("idle");
  const [chatCost, setChatCost] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const startSpent = useRef<number | null>(null);
  const busy = status !== "idle";

  useEffect(() => { store.turns = turns; }, [turns]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [turns, status]);
  useEffect(() => {
    if (spend && startSpent.current !== null) setChatCost(spend.spent - startSpent.current);
  }, [spend]);

  const [keyWarn, setKeyWarn] = useState(false);
  async function send(text: string) {
    const t = text.trim();
    if (!t || busy || !apiKey || !fp) return;
    // Never send an API key as chat text: it would end up in the conversation history.
    if (KEY_IN_TEXT.test(t)) { setKeyWarn(true); return; }
    setKeyWarn(false);
    if (startSpent.current === null) startSpent.current = spend?.spent ?? 0;
    setDraft("");
    store.history.push({ role: "user", content: t });
    const assistant: Turn = { role: "assistant", parts: [] };
    setTurns((ts) => [...ts, { role: "user", text: t }, assistant]);
    const update = (fn: (a: Extract<Turn, { role: "assistant" }>) => void) =>
      setTurns((ts) => {
        const copy = ts.slice();
        const last = { ...(copy[copy.length - 1] as Extract<Turn, { role: "assistant" }>) };
        last.parts = last.parts.map((p) => ({ ...p })) as Part[];
        fn(last);
        copy[copy.length - 1] = last;
        return copy;
      });

    const ac = new AbortController();
    abortRef.current = ac;
    const historyLen = store.history.length;
    try {
      const { stop } = await runTutorTurn(apiKey, fp, store.history, {
        onText: (d) => update((a) => {
          const lastPart = a.parts[a.parts.length - 1];
          if (lastPart && lastPart.type === "text") lastPart.text += d;
          else a.parts.push({ type: "text", text: d });
        }),
        onTool: (runs) => update((a) => { a.parts.push({ type: "tool", runs }); }),
        onStatus: setStatus,
      }, ac.signal);
      if (stop === "refusal") update((a) => { a.note = "Claude declined to answer this one. Try rephrasing the question."; });
      if (stop === "max_tokens") update((a) => { a.note = "The answer hit its length limit. Ask Claude to continue."; });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Roll the API history back so a failed turn can simply be retried.
      store.history.length = historyLen - 1;
      update((a) => { a.error = msg; });
      setStatus("idle");
    } finally {
      abortRef.current = null;
    }
  }

  // A prompt handed over from Learn, Practice or the Lab.
  useEffect(() => {
    if (!apiKey || !fp) return;
    const p = takePending();
    if (p) send(p);
  }, [apiKey, fp]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit(e: FormEvent) { e.preventDefault(); send(draft); }
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(draft); }
  }
  function newChat() {
    abortRef.current?.abort();
    store.history = [];
    setTurns([]);
    startSpent.current = null;
    setChatCost(0);
  }

  if (!apiKey) {
    return (
      <div className="page tutor-nokey">
        <div className="title-row"><div><h1>Tutor</h1><p className="sub">The tutor is Claude Sonnet, running on your own API key. Paste the key from Babson's email to start. This device remembers it, so you only do this once.</p></div></div>
        <div className="panel tutor-key"><KeyForm compact /></div>
      </div>
    );
  }

  return (
    <div className="tutor">
      <header className="tutor-head">
        <div>
          <h1>Tutor</h1>
          <p className="hint">{provider?.modelLabel ?? "Claude Sonnet"} · every number is computed with the class's Excel functions</p>
        </div>
        <div className="row">
          {bal && <span className="hint num" title={bal.real ? "Balance from Babson's gateway" : "Estimated from token usage"}>This chat about {money(chatCost, chatCost < 1 ? 3 : 2)} · {bal.left !== null ? `${money(bal.left)} left` : `${money(bal.spent)} spent`}{bal.real ? "" : " (estimate)"}</span>}
          <button className="btn btn-ghost btn-small" onClick={newChat} disabled={turns.length === 0}><Plus size={14} aria-hidden="true" />New chat</button>
        </div>
      </header>

      <div className="tutor-scroll">
        <div className="tutor-col">
          {turns.length === 0 && (
            <div className="starters">
              <span className="thinka-hop starters-thinka"><Thinka size={64} mood="thinking" /></span>
              <h2>Start with one of these</h2>
              <div className="starter-list">
                {STARTERS.map((s) => <button key={s} className="starter" onClick={() => send(s)}>{s}</button>)}
              </div>
            </div>
          )}
          {turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="msg msg-user"><p>{t.text}</p></div>
            ) : (
              <div key={i} className="msg msg-ai">
                {t.parts.map((p, j) => (p.type === "text" ? <Markdown key={j} text={p.text} /> : <ToolLedger key={j} runs={p.runs} />))}
                {i === turns.length - 1 && busy && (
                  <p className="tutor-status"><LoaderCircle size={14} className="spin" aria-hidden="true" /> {status === "calculating" ? "Running the Excel formulas" : status === "thinking" ? "Thinking" : "Writing"}</p>
                )}
                {t.note && <p className="notice neutral">{t.note}</p>}
                {t.error && <p className="notice" role="alert">{t.error}</p>}
              </div>
            ),
          )}
          <div ref={endRef} />
        </div>
      </div>

      {keyWarn && <p className="notice" role="alert">That message has an API key in it, so it wasn't sent. Remove the key: the tutor never needs it in the chat.</p>}
      <form className="composer" onSubmit={submit}>
        <div className="composer-box">
          <label htmlFor="composer" className="sr-only">Message the tutor</label>
          <textarea id="composer" rows={1} placeholder="Ask about any Midterm 2 topic, or paste a question" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} />
          {busy ? (
            <button type="button" className="btn btn-primary btn-icon" onClick={() => abortRef.current?.abort()} aria-label="Stop"><Square size={14} aria-hidden="true" /></button>
          ) : (
            <button type="submit" className="btn btn-primary btn-icon" disabled={!draft.trim()} aria-label="Send"><ArrowUp size={16} aria-hidden="true" /></button>
          )}
        </div>
        <p className="hint composer-hint">Enter to send, Shift+Enter for a new line. Claude can be wrong; the formulas show how each number was made.</p>
      </form>
    </div>
  );
}
