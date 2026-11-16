// Where a student finds their key, as three big steps people actually read. Shown wherever the key is pasted.
import { Mail, Search, ClipboardPaste, Ticket } from "lucide-react";

export default function KeyHelp({ id }: { id?: string }) {
  return (
    <div id={id} className="key-help">
      <div className="key-find">
        <p className="key-find-title">Freshman? Get your key in 30 seconds</p>
        <ol className="key-steps">
          <li><Mail size={18} aria-hidden="true" /><span>Open your <b>Babson email</b> (Outlook)</span></li>
          <li><Search size={18} aria-hidden="true" /><span>Search <b className="key-search">Ian Cox</b></span></li>
          <li><ClipboardPaste size={18} aria-hidden="true" /><span>Copy the key that starts with <code>sk-</code> and <b>paste it below</b></span></li>
        </ol>
      </div>
      <p className="key-code-line"><Ticket size={16} aria-hidden="true" /><span><b>Sophomore, or no key?</b> Type the <b>access code</b> Daniel gave you in the same box.</span></p>
      <p className="hint">The key lets you chat with Dr Phil, an AI tutor that knows the class notes, and have Claude mark written answers. Every Babson freshman gets $100 of Claude credit. Everything else on the site works without a key.</p>
    </div>
  );
}
