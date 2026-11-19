// "Suggest a feature": a dialog that stores the idea in Supabase (the admin page lists them), opened from
// the rail's lightbulb or from a small nudge that appears after 20 active minutes on the site.
// The nudge asks at most 3 times, 45 active minutes apart, and never again once an idea is sent.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, X } from "lucide-react";
import { KEY_IN_TEXT } from "../lib/vault.ts";
import { activeSeconds, sendIdea } from "../lib/usage.ts";
import DrPhil from "./DrPhil.tsx";

type Source = "prompt" | "button";
const STATE_KEY = "aqm.ideas";
const FIRST_ASK = 20 * 60;   // active seconds before the first nudge
const AGAIN = 45 * 60;       // more active seconds after "Not now"
const MAX_ASKS = 3;

type NudgeState = { sent?: boolean; asks: number; nextAt: number };
function readState(): NudgeState {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY) ?? "null") as NudgeState | null;
    if (s && typeof s.asks === "number" && typeof s.nextAt === "number") return s;
  } catch { /* ignore */ }
  return { asks: 0, nextAt: FIRST_ASK };
}
function writeState(s: NudgeState) { try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch { /* ignore */ } }

/** Opens the ideas dialog from anywhere. */
export const openIdeas = (source: Source = "button") => window.dispatchEvent(new CustomEvent("aqm:idea", { detail: source }));

const EXAMPLES = ["Flashcards for the Excel functions", "A timer for practice exams", "More two-sample questions", "Dr Phil could…"];

export function IdeaDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const [source, setSource] = useState<Source>("button");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const on = (e: Event) => { setSource((e as CustomEvent<Source>).detail === "prompt" ? "prompt" : "button"); setOpen(true); };
    window.addEventListener("aqm:idea", on);
    return () => window.removeEventListener("aqm:idea", on);
  }, []);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function close() {
    setOpen(false);
    if (state === "sent") { setText(""); setState("idle"); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (KEY_IN_TEXT.test(text)) { setError("Please take your API key out of the message. Never share it, even with us."); setState("error"); return; }
    setState("sending"); setError("");
    try {
      await sendIdea(text, source);
      writeState({ ...readState(), sent: true });
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  return (
    <dialog ref={ref} className="problem idea" onClose={close} onClick={(e) => { if (e.target === ref.current) close(); }} aria-labelledby="idea-title">
      <div className="problem-inner">
        <button type="button" className="btn btn-ghost btn-icon problem-x" onClick={close} aria-label="Close"><X size={16} aria-hidden="true" /></button>
        {state === "sent" ? (
          <div className="problem-sent">
            <DrPhil size={64} tea />
            <h2 id="idea-title">Idea sent</h2>
            <p>Thanks. The developer reads every one, and the best ones get built.</p>
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={close}>Back to studying</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setText(""); setState("idle"); }}>Send another</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="problem-form">
            <div className="problem-head">
              <DrPhil size={48} />
              <div>
                <h2 id="idea-title">Suggest a feature</h2>
                <p className="hint">What should AQM Prep add or change? Big or small, it all helps.</p>
              </div>
            </div>
            <div className="field">
              <label htmlFor="idea-text">Your idea</label>
              <textarea id="idea-text" className="input problem-text" rows={4} maxLength={1000} value={text} autoFocus
                onChange={(e) => { setText(e.target.value); if (state === "error") setState("idle"); }}
                placeholder="I wish the site could…" />
            </div>
            {!text && (
              <div className="idea-examples" aria-label="Examples">
                {EXAMPLES.map((x) => <button key={x} type="button" className="rate-reason" onClick={() => setText(x.endsWith("…") ? `${x.slice(0, -1)} ` : x)}>{x}</button>)}
              </div>
            )}
            <p className="hint">Sent with your name and the page you're on. Never your API key.</p>
            {state === "error" && <p className="error-text" role="alert">{error}</p>}
            <div className="row">
              <button className="btn btn-primary" type="submit" disabled={state === "sending" || text.trim().length < 3}>
                {state === "sending" && <LoaderCircle size={16} className="spin" aria-hidden="true" />}
                {state === "sending" ? "Sending" : "Send idea"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={close}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}

/** The gentle ask: a small card in the corner, never a modal. `allowed` is false on pages where it would get in the way. */
export function IdeaNudge({ allowed }: { allowed: boolean }) {
  const [due, setDue] = useState(false);
  useEffect(() => {
    const check = () => { const s = readState(); setDue(!s.sent && s.asks < MAX_ASKS && activeSeconds() >= s.nextAt); };
    check();
    window.addEventListener("aqm:active", check);
    return () => window.removeEventListener("aqm:active", check);
  }, []);
  if (!due || !allowed) return null;

  const later = () => { const s = readState(); writeState({ ...s, asks: s.asks + 1, nextAt: activeSeconds() + AGAIN }); setDue(false); };
  const go = () => { later(); openIdeas("prompt"); };
  return (
    <aside className="idea-nudge" aria-label="Suggest a feature">
      <DrPhil size={36} />
      <div className="idea-nudge-body">
        <p><b>Got ten seconds?</b> What would make AQM Prep better for your next exam?</p>
        <div className="row">
          <button type="button" className="btn btn-primary btn-small" onClick={go}>Suggest an idea</button>
          <button type="button" className="btn btn-ghost btn-small" onClick={later}>Not now</button>
        </div>
      </div>
      <button type="button" className="btn btn-ghost btn-icon idea-nudge-x" onClick={later} aria-label="Close"><X size={14} aria-hidden="true" /></button>
    </aside>
  );
}
