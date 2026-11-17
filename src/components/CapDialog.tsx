// Shown when a student on Daniel's shared credit passes their $10: asks them to link their own Claude key.
// Opened by the "aqm:capped" event, which explainError (lib/claude.ts) fires on the proxy's 402.
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useSession } from "../session.tsx";
import { isCodeKey } from "../lib/provider.ts";
import { KeyForm } from "../screens/Gate.tsx";

export default function CapDialog() {
  const { apiKey } = useSession();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("aqm:capped", on);
    return () => window.removeEventListener("aqm:capped", on);
  }, []);
  // Once they've linked their own key, there's nothing left to ask.
  useEffect(() => { if (apiKey && !isCodeKey(apiKey)) setOpen(false); }, [apiKey]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="problem cap-dialog" onClose={() => setOpen(false)} aria-labelledby="cap-title">
      <div className="problem-inner cap-inner">
        <button type="button" className="btn btn-ghost btn-icon problem-x" onClick={() => setOpen(false)} aria-label="Close"><X size={16} aria-hidden="true" /></button>
        <div className="problem-head">
          <div>
            <h2 id="cap-title">You've used your free $10</h2>
            <p>To keep using Dr Phil, link your own Claude API key. Notes, workbooks and marking still work without it.</p>
          </div>
        </div>
        {open && <KeyForm onDone={() => setOpen(false)} />}
      </div>
    </dialog>
  );
}
