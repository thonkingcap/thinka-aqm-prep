import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import { useOnline } from "../lib/online.ts";
import { ArrowUp, Calculator, Download, FileSpreadsheet, ImagePlus, LoaderCircle, Plus, Square, ThumbsDown, ThumbsUp, Upload, X } from "lucide-react";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { useSession } from "../session.tsx";
import { KEY_IN_TEXT } from "../lib/vault.ts";
import { runTutorTurn, type ToolRun, type TutorSet } from "../lib/claude.ts";
import { downloadById } from "../lib/download.ts";
import type { WorkbookGrade } from "../lib/grade.ts";
import { UploadBox, GradeReport } from "../components/UploadGrade.tsx";
import { money, balanceView } from "../lib/spend.ts";
import Markdown from "../components/Markdown.tsx";
import TutorGraphic from "../components/TutorGraphic.tsx";
import type { GraphicSpec } from "../lib/graphic.ts";
import { toShot, MAX_SHOTS, type Shot } from "../lib/screenshot.ts";
import { fmt } from "../components/ui.tsx";
import { SignIn } from "./Gate.tsx";
import DrPhil from "../components/DrPhil.tsx";
import { logRating, type RateReason } from "../lib/usage.ts";
import "./screens.css";
import "./tutor.css";

type Part = { type: "text"; text: string } | { type: "tool"; runs: ToolRun[] } | { type: "graphic"; spec: GraphicSpec } | { type: "set"; set: TutorSet };
type Turn = { role: "user"; text: string; shots?: string[] } | { role: "assistant"; parts: Part[]; error?: string; note?: string };

type Rated = { r: -1 | 1; reason?: RateReason };
const newChatId = () => Math.random().toString(36).slice(2, 10) || "chat";

// Kept at module level so the conversation survives switching screens (not page reloads).
// chatId + reply number name each reply for 👍/👎, so a changed mind replaces the earlier rating.
const store: { history: BetaMessageParam[]; turns: Turn[]; chatId: string; ratings: Record<number, Rated> } = { history: [], turns: [], chatId: newChatId(), ratings: {} };

const REASONS: [RateReason, string][] = [["wrong", "Wrong answer"], ["confusing", "Confusing"], ["long", "Too long"], ["off", "Not what I asked"]];

/** One tap: was this reply helpful? After 👎, an optional reason (one more tap, never required). */
function RateReply({ n }: { n: number }) {
  const [rated, setRated] = useState<Rated | undefined>(store.ratings[n]);
  const ref = `${store.chatId}:${n}`;
  function save(next: Rated | undefined) {
    setRated(next);
    if (next) store.ratings[n] = next; else delete store.ratings[n];
    logRating(ref, next ? next.r : 0, next?.reason);
  }
  const tap = (r: -1 | 1) => save(rated?.r === r ? undefined : { r });
  return (
    <div className="rate" role="group" aria-label="Was this reply helpful?">
      <span className="rate-q">{rated ? (rated.r === 1 ? "Glad it helped" : rated.reason ? "Thanks, noted" : "What was off?") : "Helpful?"}</span>
      <button type="button" className="rate-btn" aria-pressed={rated?.r === 1} aria-label="Helpful" title="Helpful" onClick={() => tap(1)}><ThumbsUp size={14} aria-hidden="true" /></button>
      <button type="button" className="rate-btn" aria-pressed={rated?.r === -1} aria-label="Not helpful" title="Not helpful" onClick={() => tap(-1)}><ThumbsDown size={14} aria-hidden="true" /></button>
      {rated?.r === -1 && (
        <span className="rate-reasons">
          {REASONS.map(([k, label]) => (
            <button key={k} type="button" className="rate-reason" aria-pressed={rated.reason === k} onClick={() => save({ r: -1, reason: rated.reason === k ? undefined : k })}>{label}</button>
          ))}
        </span>
      )}
    </div>
  );
}

const STARTERS = [
  "Make me a practice set on hypothesis tests, mixed tails, Z and T.",
  "Quiz me on the 12 hypothesis test questions, one at a time.",
  "When do I use Z and when do I use T?",
  "Explain why the two-tailed p-value formula changes with the sign of the statistic.",
  "What's the difference between \"where will x̄ land\" and \"where is μ\"?",
  "How do I tell from H₀ whether it's a left, right or two-tailed test?",
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

/** A practice set Dr Phil built: download it, and upload the finished file right here to have it marked. */
function SetCard({ set }: { set: TutorSet }) {
  const [marking, setMarking] = useState(false);
  const [graded, setGraded] = useState<WorkbookGrade | null>(null);
  return (
    <section className="tutor-set" aria-label={`Practice set: ${set.title}`}>
      <div className="tutor-set-head">
        <FileSpreadsheet size={20} aria-hidden="true" />
        <div>
          <h3>{set.title}</h3>
          <p className="hint">{set.summary}</p>
        </div>
      </div>
      <div className="tutor-set-actions">
        <button type="button" className="btn btn-primary btn-small" onClick={() => downloadById(set.id)}><Download size={14} aria-hidden="true" />Download workbook ({set.questions} question{set.questions === 1 ? "" : "s"})</button>
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setMarking((m) => !m)} aria-expanded={marking}><Upload size={14} aria-hidden="true" />Mark my file</button>
      </div>
      {marking && !graded && <UploadBox onGraded={setGraded} />}
      {graded && <GradeReport g={graded} onClose={() => { setGraded(null); setMarking(false); }} />}
      {!marking && !graded && <p className="hint">Answer key on the last tab. Try the whole set first, then upload it here to have every answer marked.</p>}
    </section>
  );
}

export default function Tutor() {
  const { apiKey, fp, spend, remote, provider, takePending } = useSession();
  const online = useOnline();
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
  const [shots, setShots] = useState<Shot[]>([]);
  const [shotError, setShotError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addShots(files: Iterable<File>) {
    setShotError(null);
    const imgs = [...files].filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) { setShotError("Only images can be attached (PNG, JPG, GIF or WebP screenshots)."); return; }
    const room = MAX_SHOTS - shots.length;
    if (room <= 0 || imgs.length > room) setShotError(`Up to ${MAX_SHOTS} screenshots per message.`);
    try {
      const made = await Promise.all(imgs.slice(0, Math.max(0, room)).map(toShot));
      setShots((prev) => [...prev, ...made].slice(0, MAX_SHOTS));
    } catch (e) {
      setShotError(e instanceof Error ? e.message : String(e));
    }
  }
  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
    if (files.length) { e.preventDefault(); addShots(files); }
  }
  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files?.length) addShots(e.dataTransfer.files);
  }

  async function send(text: string) {
    const t = text.trim();
    const attached = shots;
    if ((!t && !attached.length) || busy || !apiKey || !fp) return;
    // Never send an API key as chat text: it would end up in the conversation history.
    if (KEY_IN_TEXT.test(t)) { setKeyWarn(true); return; }
    setKeyWarn(false);
    if (startSpent.current === null) startSpent.current = spend?.spent ?? 0;
    setDraft("");
    setShots([]); setShotError(null);
    const ask = t || `Here's a screenshot. What is it asking, and how do I do it in Excel?`;
    store.history.push({
      role: "user",
      content: attached.length
        ? [...attached.map((s) => ({ type: "image" as const, source: { type: "base64" as const, media_type: s.mediaType, data: s.data } })), { type: "text" as const, text: ask }]
        : ask,
    });
    const assistant: Turn = { role: "assistant", parts: [] };
    setTurns((ts) => [...ts, { role: "user", text: t, ...(attached.length ? { shots: attached.map((s) => s.url) } : {}) }, assistant]);
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
        onGraphic: (spec) => update((a) => { a.parts.push({ type: "graphic", spec }); }),
        onSet: (set) => update((a) => { a.parts.push({ type: "set", set }); }),
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
    store.chatId = newChatId();
    store.ratings = {};
    setTurns([]);
    startSpent.current = null;
    setChatCost(0);
  }

  if (!apiKey) {
    return (
      <div className="page tutor-nokey">
        <div className="title-row"><div><h1>Dr Phil</h1><p className="sub">Dr Phil is an AI tutor (Claude Sonnet) running on your own API key. Paste the key from Babson's email to start. This device remembers it, so you only do this once.</p></div></div>
        <div className="panel tutor-key"><SignIn /></div>
      </div>
    );
  }

  return (
    <div className="tutor">
      <header className="tutor-head">
        <div>
          <div className="tutor-who">
            <DrPhil size={40} title="Dr Phil" />
            <div>
              <h1>Dr Phil</h1>
              <p className="hint">AI tutor · {provider?.modelLabel ?? "Claude Sonnet"} · every number is computed with the class's Excel functions</p>
            </div>
          </div>
        </div>
        <div className="row">
          {bal && provider?.id !== "code" && <span className="hint num" title={bal.real ? "Balance from Babson's gateway" : "Estimated from token usage"}>This chat about {money(chatCost, chatCost < 1 ? 3 : 2)} · {bal.left !== null ? `${money(bal.left)} left` : `${money(bal.spent)} spent`}{bal.real ? "" : " (estimate)"}</span>}
          <button className="btn btn-ghost btn-small" onClick={newChat} disabled={turns.length === 0}><Plus size={14} aria-hidden="true" />New chat</button>
        </div>
      </header>

      <div className="tutor-scroll">
        <div className="tutor-col">
          {turns.length === 0 && (
            <div className="starters">
              <span className="thinka-hop starters-thinka"><DrPhil size={88} tea title="Dr Phil with a cup of tea" /></span>
              <h2>Right then, ask me anything, or start with one of these</h2>
              <div className="starter-list">
                {STARTERS.map((s) => <button key={s} className="starter" onClick={() => send(s)}>{s}</button>)}
              </div>
            </div>
          )}
          {turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="msg msg-user">
                {t.shots && <div className="msg-shots">{t.shots.map((u, k) => <img key={k} src={u} alt={`Screenshot ${k + 1}`} />)}</div>}
                {t.text && <p>{t.text}</p>}
              </div>
            ) : (
              <div key={i} className="msg msg-ai">
                <div className="msg-who"><DrPhil size={22} /><span>Dr Phil</span></div>
                {t.parts.map((p, j) => (p.type === "text" ? <Markdown key={j} text={p.text} /> : p.type === "graphic" ? <TutorGraphic key={j} spec={p.spec} /> : p.type === "set" ? <SetCard key={j} set={p.set} /> : <ToolLedger key={j} runs={p.runs} />))}
                {i === turns.length - 1 && busy && (
                  <p className="tutor-status"><LoaderCircle size={14} className="spin" aria-hidden="true" /> {status === "calculating" ? "Working it out in Excel" : status === "thinking" ? "Dr Phil is thinking" : "Writing"}</p>
                )}
                {t.note && <p className="notice neutral">{t.note}</p>}
                {t.error && <p className="notice" role="alert">{t.error}</p>}
                {!t.error && t.parts.length > 0 && !(i === turns.length - 1 && busy) && <RateReply key={`${store.chatId}:${i}`} n={i} />}
              </div>
            ),
          )}
          <div ref={endRef} />
        </div>
      </div>

      {keyWarn && <p className="notice" role="alert">That message has an API key in it, so it wasn't sent. Remove the key: Dr Phil never needs it in the chat.</p>}
      {shotError && <p className="notice" role="alert">{shotError}</p>}
      <form className="composer" onSubmit={submit}>
        {shots.length > 0 && (
          <div className="composer-shots">
            {shots.map((s, k) => (
              <div key={k} className="composer-shot">
                <img src={s.url} alt={`Screenshot ${k + 1} to send`} />
                <button type="button" className="composer-shot-x" onClick={() => setShots((prev) => prev.filter((_, j) => j !== k))} aria-label={`Remove screenshot ${k + 1}`}><X size={12} aria-hidden="true" /></button>
              </div>
            ))}
          </div>
        )}
        <div className={`composer-box${dragging ? " dragging" : ""}`} onDragOver={(e) => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); setDragging(true); } }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
          <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} onChange={(e) => { if (e.target.files) addShots(e.target.files); e.target.value = ""; }} />
          <button type="button" className="btn btn-ghost btn-icon composer-attach" onClick={() => fileRef.current?.click()} disabled={shots.length >= MAX_SHOTS} aria-label="Attach a screenshot" title="Attach a screenshot (or paste one)"><ImagePlus size={17} aria-hidden="true" /></button>
          <label htmlFor="composer" className="sr-only">Message Dr Phil</label>
          <textarea id="composer" rows={1} placeholder="Ask Dr Phil anything, ask for a practice set, or paste a screenshot" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onPaste={onPaste} />
          {busy ? (
            <button type="button" className="btn btn-primary btn-icon" onClick={() => abortRef.current?.abort()} aria-label="Stop"><Square size={14} aria-hidden="true" /></button>
          ) : (
            <button type="submit" className="btn btn-primary btn-icon" disabled={(!draft.trim() && !shots.length) || !online} aria-label={online ? "Send" : "Send (needs internet)"}><ArrowUp size={16} aria-hidden="true" /></button>
          )}
        </div>
        <p className="hint composer-hint">Enter to send, Shift+Enter for a new line. Paste, drop or attach screenshots of a question or your Excel sheet. Claude can be wrong; the formulas show how each number was made.</p>
      </form>
    </div>
  );
}
