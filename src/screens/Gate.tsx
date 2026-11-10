import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useSession } from "../session.tsx";
import { verifyKey } from "../lib/claude.ts";
import { looksLikeKey, IDLE_DAYS } from "../lib/vault.ts";
import { KEYS_URL } from "../lib/spend.ts";
import { runTest } from "../lib/tests12.ts";
import { mean } from "../lib/stats.ts";
import Curve from "../components/Curve.tsx";
import { Mark } from "../App.tsx";
import Thinka from "../components/Thinka.tsx";
import ProblemDialog from "../components/ProblemDialog.tsx";
import "./gate.css";

// Lesson 17, question 2: five cereal boxes, σ = 0.3, H₀: μ = 10 at α = 5%.
const BOXES = [10.1, 9.8, 9.7, 9.1, 10.2];
const L17 = runTest({ h0: "eq", sigma: "known", xbar: mean(BOXES), mu0: 10, sd: 0.3, n: 5, alpha: 0.05 });

export function KeyForm({ onDone }: { onDone?: () => void; compact?: boolean }) {
  const { useKey } = useSession();
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const k = key.trim();
    const bad = looksLikeKey(k);
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
      <div className="field">
        <label htmlFor="api-key">Your Claude API key</label>
        <div className="key-input">
          <input
            id="api-key"
            className="input mono-input"
            type={show ? "text" : "password"}
            placeholder="sk-…"
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
        <span id="key-help" className="hint">
          Paste the key from Babson's email. A key made at <a href={KEYS_URL} target="_blank" rel="noopener noreferrer">platform.claude.com</a> works too.
        </span>
      </div>

      <label className="check key-shared">
        <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
        <span>This is a shared or library computer: forget my key when I close this tab</span>
      </label>
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
          {busy ? "Checking your key" : "Start studying"}
          {!busy && <ArrowRight size={16} aria-hidden="true" />}
        </button>
      </div>
    </form>
  );
}

export default function Gate() {
  const { browse } = useSession();
  const [problem, setProblem] = useState(false);
  const c = L17.crit[1];

  return (
    <div className="gate">
      <section className="gate-left">
        <div className="gate-brand"><span className="rail-mark"><Mark /></span><span>Thinka</span></div>
        <div className="gate-copy">
          <span className="thinka-hop gate-thinka"><Thinka size={88} mood="happy" title="Thinka, a bell curve with a face" /></span>
          <h1>Thinka's AQM Prep</h1>
          <p className="gate-lede">Study for AQM 1000 Midterm 2: class notes, exact Excel practice and a Claude tutor that runs on your own API key.</p>
        </div>

        <KeyForm />

        <ul className="gate-trust">
          <li><strong>Your key never touches a Thinka server.</strong> There isn't one. This page sends it straight to Babson's Claude gateway, and the browser is told to block every other destination.</li>
          <li><strong>Stored encrypted, only on this device.</strong> It's locked with a key your browser keeps and won't hand out, and forgotten after {IDLE_DAYS} days without a visit. On a shared computer, tick the box above.</li>
          <li><strong>You see what you spend.</strong> Your real balance comes straight from Babson's gateway, so you can watch your $100 of credit.</li>
        </ul>
        <div className="row gate-links">
          <button type="button" className="linkish gate-browse" onClick={browse}>Look around without a key</button>
          <button type="button" className="linkish gate-browse" onClick={() => setProblem(true)}>Have a problem?</button>
        </div>
        <ProblemDialog open={problem} onClose={() => setProblem(false)} />
      </section>

      <section className="gate-right" aria-label="A class example">
        <figure className="gate-figure">
          <figcaption>
            <h2>Five cereal boxes, one question</h2>
            <p>Lesson 17: the boxes weigh {BOXES.join(", ")} oz. If σ is 0.3, is the true mean different from 10 at α = 5%?</p>
          </figcaption>
          <Curve
            dist={{ kind: "z" }}
            regions={[
              { from: -Infinity, to: L17.stat, kind: "p" },
              { from: -L17.stat, to: Infinity, kind: "p" },
              { from: -Infinity, to: -c, kind: "alpha" },
              { from: c, to: Infinity, kind: "alpha" },
            ]}
            markers={[
              { x: L17.stat, label: `Z = ${L17.stat.toFixed(2)}`, tone: "accent" },
              { x: -c, label: `−${c.toFixed(2)}`, tone: "muted", dashed: true },
              { x: c, label: `+${c.toFixed(2)}`, tone: "muted", dashed: true },
            ]}
            height={260}
            ariaLabel={`Standard normal curve. The test statistic Z = ${L17.stat.toFixed(2)}; the shaded p-value is ${L17.pValue.toFixed(3)}; the rejection regions start at ±${c.toFixed(2)}.`}
          />
          <table className="ledger gate-ledger">
            <tbody>
              <tr><td className="lbl">Test statistic</td><td><code className="formula">=(9.78-10)/(0.3/SQRT(5))</code></td><td className="val num">{L17.stat.toFixed(4)}</td></tr>
              <tr><td className="lbl">p-value, Z &lt; 0</td><td><code className="formula">=2*NORM.S.DIST(Z,TRUE)</code></td><td className="val num gate-p">{L17.pValue.toFixed(4)}</td></tr>
              <tr><td className="lbl">Critical value</td><td><code className="formula">=NORM.S.INV(1-0.05/2)</code></td><td className="val num">±{c.toFixed(4)}</td></tr>
            </tbody>
          </table>
          <p className="gate-verdict">p = {L17.pValue.toFixed(3)} is above α = 0.05, and Z sits inside ±{c.toFixed(2)}: do not reject H₀.</p>
        </figure>
      </section>
    </div>
  );
}
