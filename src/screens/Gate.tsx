import { useState, type FormEvent } from "react";
import KeyHelp from "../components/KeyHelp.tsx";
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle } from "lucide-react";
import { setName as saveName, useNeedsName, visitorId } from "../lib/usage.ts";
import { useSession } from "../session.tsx";
import { verifyKey } from "../lib/claude.ts";
import { looksLikeKey } from "../lib/vault.ts";
import { isCode, CODE_PREFIX, SHARED_PREFIX } from "../lib/provider.ts";
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

/** The default way in: just their name. Everyone starts on Daniel's shared key, capped at $10 per browser on the server. */
function StartForm() {
  const { useKey } = useSession();
  const needsName = useNeedsName();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (needsName && n.split(/\s+/).filter(Boolean).length < 2) return setError("Please type your first and last name.");
    setBusy(true); setError(null);
    try {
      const k = SHARED_PREFIX + visitorId();
      await verifyKey(k);
      if (needsName) saveName(n);
      await useKey(k, { shared: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  }
  return (
    <form className="key-form" onSubmit={submit} autoComplete="off" noValidate>
      {needsName && (
        <div className="field">
          <label htmlFor="full-name">Your full name</label>
          <input id="full-name" className="input" type="text" autoComplete="name" maxLength={60} placeholder="First and last name" value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }} aria-invalid={!!error} />
        </div>
      )}
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={busy || (needsName && !name.trim())}>
          {busy ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}{busy ? "Starting" : "Start studying"}{!busy && <ArrowRight size={16} aria-hidden="true" />}
        </button>
      </div>
      <p className="choice-note muted">Dr Phil is free to use up to $10 each. After that, you'll link your own Claude API key.</p>
    </form>
  );
}

/** Sign in: name only by default (shared credit); students who'd rather use their own key can. */
export function SignIn() {
  const [own, setOwn] = useState(false);
  return (
    <div className="key-choice">
      {own ? <KeyForm /> : <StartForm />}
      <button type="button" className="linkish choice-back" onClick={() => setOwn((o) => !o)}>
        {own ? <><ArrowLeft size={14} aria-hidden="true" />Just use my name instead</> : <><KeyRound size={14} aria-hidden="true" />I'd rather use my own Claude key</>}
      </button>
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
          <p className="gate-lede">Review Dr. Phil's AQM 1000 lesson by lesson, unit by unit, and for the final.</p>
        </header>
        <SignIn />
        <div className="row gate-links">
          <button type="button" className="linkish gate-browse" onClick={browse}>Look around first</button>
          <button type="button" className="linkish gate-browse" onClick={() => setProblem(true)}>Have a problem?</button>
        </div>
        <ProblemDialog open={problem} onClose={() => setProblem(false)} />
      </section>
    </div>
  );
}
