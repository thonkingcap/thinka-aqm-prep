import { useEffect, useRef, useState, type FormEvent } from "react";
import { KEY_IN_TEXT } from "../lib/vault.ts";
import { LoaderCircle, X } from "lucide-react";
import { sendFeedback, mailtoFallback } from "../lib/feedback.ts";
import Thinka from "./Thinka.tsx";

const TOPICS = ["My API key isn't working", "An answer looks wrong", "Something is broken", "An idea for the site", "Something else"];

/** A modal for "Have a problem?". Uses the native <dialog> so focus and Escape work for free. */
export default function ProblemDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function close() {
    onClose();
    if (state === "sent") { setMessage(""); setState("idle"); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (message.trim().length < 5) { setError("Tell us a little more first"); setState("error"); return; }
    if (KEY_IN_TEXT.test(message)) { setError("Please remove your API key from the message. Never share it, even with us."); setState("error"); return; }
    setState("sending"); setError("");
    try {
      await sendFeedback({ topic, message, replyTo });
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  return (
    <dialog ref={ref} className="problem" onClose={close} onClick={(e) => { if (e.target === ref.current) close(); }} aria-labelledby="problem-title">
      <div className="problem-inner">
        <button type="button" className="btn btn-ghost btn-icon problem-x" onClick={close} aria-label="Close"><X size={16} aria-hidden="true" /></button>
        {state === "sent" ? (
          <div className="problem-sent">
            <Thinka size={72} mood="proud" />
            <h2 id="problem-title">Message sent</h2>
            <p>Thanks. The developer reads every one{replyTo.trim() ? ` and will reply to ${replyTo.trim()}` : ""}.</p>
            <button type="button" className="btn btn-primary" onClick={close}>Back to studying</button>
          </div>
        ) : (
          <form onSubmit={submit} className="problem-form">
            <div className="problem-head">
              <Thinka size={48} mood="thinking" />
              <div>
                <h2 id="problem-title">Have a problem?</h2>
                <p className="hint">Write it here and it goes straight to the developer's inbox.</p>
              </div>
            </div>
            <div className="field">
              <label htmlFor="problem-topic">What's it about?</label>
              <select id="problem-topic" className="input" value={topic} onChange={(e) => setTopic(e.target.value)}>
                {TOPICS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="problem-msg">What happened?</label>
              <textarea id="problem-msg" className="input problem-text" rows={5} value={message} onChange={(e) => { setMessage(e.target.value); if (state === "error") setState("idle"); }} placeholder="What you did, what you expected, what you saw" />
            </div>
            <div className="field">
              <label htmlFor="problem-email">Your email, if you want a reply</label>
              <input id="problem-email" className="input" type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="optional" autoComplete="email" />
            </div>
            <p className="hint">Sent with the page you're on and your browser name. Never your API key.</p>
            {state === "error" && (
              <p className="error-text" role="alert">
                {error}{" "}
                {!/API key from/.test(error) && message.trim().length >= 5 && <a href={mailtoFallback({ topic, message })}>Send it from your email app instead</a>}
              </p>
            )}
            <div className="row">
              <button className="btn btn-primary" type="submit" disabled={state === "sending"}>
                {state === "sending" && <LoaderCircle size={16} className="spin" aria-hidden="true" />}
                {state === "sending" ? "Sending" : "Send message"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={close}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
