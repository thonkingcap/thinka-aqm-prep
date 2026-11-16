import { useState, type FormEvent } from "react";
import KeyHelp from "../components/KeyHelp.tsx";
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle, Mail } from "lucide-react";
import { useSession } from "../session.tsx";
import { verifyKey } from "../lib/claude.ts";
import { looksLikeKey } from "../lib/vault.ts";
import { isCode, CODE_PREFIX, EMAIL_PREFIX, BABSON_EMAIL } from "../lib/provider.ts";
import { Mark } from "../App.tsx";
import ProblemDialog from "../components/ProblemDialog.tsx";
import "./gate.css";


export function KeyForm({ onDone }: { onDone?: () => void; compact?: boolean }) {
  const { useKey } = useSession();
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const raw = key.trim();
    const bad = looksLikeKey(raw);
    // An access code is stored as "aqmcode:<CODE>" and only ever sent to this site's own server.
    const k = isCode(raw) ? CODE_PREFIX + raw.toUpperCase() : raw;
    if (bad) return setError(bad);
    setBusy(true);
    setError(null);
    try {
      await verifyKey(k);
      setKey("");
      await useKey(k, { shared });
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="key-form" onSubmit={submit} autoComplete="off" noValidate>
      <KeyHelp id="key-help" />
      <div className="field">
        <label htmlFor="api-key">Paste your key or access code here</label>
        <div className="key-input">
          <input
            id="api-key"
            className="input mono-input"
            type={show ? "text" : "password"}
            placeholder="sk-… or your access code"
            value={key}
            onChange={(e) => { setKey(e.target.value); setError(null); }}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby="key-help"
            aria-invalid={!!error}
          />
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide key" : "Show key"}>
            {show ? <EyeOff size={16} strokeWidth={1.6} /> : <Eye size={16} strokeWidth={1.6} />}
          </button>
        </div>
      </div>

      <label className="check key-shared">
        <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
        <span>Shared computer? Forget my key when I close this tab</span>
      </label>
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
          {busy ? "Checking" : "Start studying"}
          {!busy && <ArrowRight size={16} aria-hidden="true" />}
        </button>
      </div>
    </form>
  );
}

/** No key handy: a Babson email gets full access on Daniel's shared key (capped on the server). */
function EmailForm() {
  const { useKey } = useSession();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!BABSON_EMAIL.test(v)) return setError("Use your Babson email: it ends in @babson.edu.");
    setBusy(true); setError(null);
    try {
      const k = EMAIL_PREFIX + v;
      await verifyKey(k);
      await useKey(k, { shared: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  }
  return (
    <form className="key-form" onSubmit={submit} autoComplete="off" noValidate>
      <p className="choice-note">No problem. Enter your Babson email and you get the whole site, including Dr Phil, on Daniel's shared credit. If you use a lot (over $10), you'll be asked to add your own key to keep chatting.</p>
      <div className="field">
        <label htmlFor="babson-email">Your Babson email</label>
        <input id="babson-email" className="input" type="email" inputMode="email" placeholder="you@babson.edu" value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null); }} autoComplete="email" autoCapitalize="off" spellCheck={false} aria-invalid={!!error} />
      </div>
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={busy || !email.trim()}>
          {busy ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}{busy ? "Checking" : "Start studying"}{!busy && <ArrowRight size={16} aria-hidden="true" />}
        </button>
      </div>
    </form>
  );
}

/** First question: is the key handy? Yes → paste it. No → Babson email. */
export function KeyChoice() {
  const [choice, setChoice] = useState<"key" | "email" | null>(null);
  if (!choice) {
    return (
      <div className="key-choice">
        <h2 className="choice-q">Do you have your Claude API key handy?</h2>
        <div className="choice-buttons">
          <button type="button" className="choice-btn lift" onClick={() => setChoice("key")}><KeyRound size={20} aria-hidden="true" /><span><b>Yes, I have it</b><span className="hint">Paste it in the next step</span></span></button>
          <button type="button" className="choice-btn lift" onClick={() => setChoice("email")}><Mail size={20} aria-hidden="true" /><span><b>No, not right now</b><span className="hint">Use your Babson email instead</span></span></button>
        </div>
      </div>
    );
  }
  return (
    <div className="key-choice">
      <button type="button" className="linkish choice-back" onClick={() => setChoice(null)}><ArrowLeft size={14} aria-hidden="true" />Back</button>
      {choice === "key" ? <KeyForm /> : <EmailForm />}
    </div>
  );
}

export default function Gate() {
  const { browse } = useSession();
  const [problem, setProblem] = useState(false);
  return (
    <div className="gate gate-clean">
      <section className="gate-col">
        <header className="gate-title">
          <span className="rail-mark" aria-hidden="true"><Mark /></span>
          <h1>AQM Prep</h1>
          <p className="gate-lede">Study for Dr. Phil's Midterm 2 utilizing this site.</p>
        </header>
        <KeyChoice />
        <p className="gate-safe">Your key is encrypted and stored locally; we don't have access to it.</p>
        <div className="row gate-links">
          <button type="button" className="linkish gate-browse" onClick={browse}>Look around first</button>
          <button type="button" className="linkish gate-browse" onClick={() => setProblem(true)}>Have a problem?</button>
        </div>
        <ProblemDialog open={problem} onClose={() => setProblem(false)} />
      </section>
    </div>
  );
}
