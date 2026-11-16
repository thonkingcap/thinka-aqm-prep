// Asked once, on first visit: the student's name, for the site's usage logs. Required, no skip.
// A native modal <dialog>: focus stays inside, and Escape is blocked because the name is required.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { setName } from "../lib/usage.ts";
import Thinka from "./Thinka.tsx";
export { useNeedsName } from "../lib/usage.ts";

export default function NamePrompt({ onDone }: { onDone?: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [name, setValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    input.current?.focus();
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) { setError("Type your name to continue."); input.current?.focus(); return; }
    setName(n);
    ref.current?.close();
    onDone?.();
  }

  return (
    <dialog ref={ref} className="problem name-prompt" aria-labelledby="name-title" aria-describedby="name-note" onCancel={(e) => e.preventDefault()}>
      <form className="problem-inner name-form" onSubmit={submit} noValidate>
        <div className="problem-head">
          <Thinka size={44} />
          <h2 id="name-title">What's your name?</h2>
        </div>
        <label className="name-field">
          <span className="sr-only">Your name</span>
          <input ref={input} className="input" type="text" autoComplete="name" maxLength={60} value={name}
            onChange={(e) => { setValue(e.target.value); if (error) setError(""); }}
            aria-invalid={!!error} aria-describedby={error ? "name-error" : undefined} placeholder="Your name" />
        </label>
        {error && <p id="name-error" className="notice upload-error" role="alert">{error}</p>}
        <p id="name-note" className="hint">So Daniel can see who this site is helping. The site logs your name, time on the site and how many Claude requests you make. Never your key or your answers.</p>
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>Continue</button>
      </form>
    </dialog>
  );
}
