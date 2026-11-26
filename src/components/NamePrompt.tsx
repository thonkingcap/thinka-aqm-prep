// Asked once, on first visit: the student's full name (first and last), for the site's usage logs. Required, no skip.
// A native modal <dialog>: focus stays inside, and Escape is blocked because the name is required.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { setName } from "../lib/usage.ts";
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
    if (!n) { setError("Type your full name to continue."); input.current?.focus(); return; }
    if (n.split(/\s+/).filter((w) => w.length > 0).length < 2) { setError("Please type your first and last name."); input.current?.focus(); return; }
    setName(n);
    ref.current?.close();
    onDone?.();
  }

  return (
    <dialog ref={ref} className="problem name-prompt" aria-labelledby="name-title" onCancel={(e) => e.preventDefault()}>
      <form className="problem-inner name-form" onSubmit={submit} noValidate>
        <div className="problem-head">
          <h2 id="name-title">What's your full name?</h2>
        </div>
        <label className="name-field">
          <span className="sr-only">Your full name</span>
          <input ref={input} className="input" type="text" autoComplete="name" maxLength={60} value={name}
            onChange={(e) => { setValue(e.target.value); if (error) setError(""); }}
            aria-invalid={!!error} aria-describedby={error ? "name-error" : undefined} placeholder="First and last name" />
        </label>
        {error && <p id="name-error" className="notice upload-error" role="alert" data-noreport>{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>Continue</button>
      </form>
    </dialog>
  );
}
