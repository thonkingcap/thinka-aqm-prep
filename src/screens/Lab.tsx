import { useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import Curve, { type Region, type Marker } from "../components/Curve.tsx";
import { Formula, fmt } from "../components/ui.tsx";
import { runTest, NULLS, type Null, type Sigma, type TestResult } from "../lib/tests12.ts";
import { mean, stdevS, normDist, normInvGeneral, normInv, tInv } from "../lib/stats.ts";
import { useSession } from "../session.tsx";
import "./screens.css";
import "./lab.css";

type Mode = "test" | "normal" | "ci";

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

function NumField({ id, label, value, onChange, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input num" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

const parseNum = (s: string) => {
  const v = parseFloat(s.replace(/,/g, "").trim());
  return Number.isFinite(v) ? v : NaN;
};
const parseData = (s: string) => s.split(/[\s,;]+/).map((x) => parseFloat(x)).filter((x) => Number.isFinite(x));

// ---------------------------------------------------------------- Hypothesis test
function TestMode() {
  const { askTutor } = useSession();
  const [h0, setH0] = useState<Null>("eq");
  const [sigma, setSigma] = useState<Sigma>("unknown");
  const [input, setInput] = useState<"data" | "summary">("data");
  const [data, setData] = useState("10.1, 9.8, 9.7, 9.1, 10.2");
  const [xbar, setXbar] = useState("9.78");
  const [sd, setSd] = useState("0.3");
  const [n, setN] = useState("5");
  const [mu0, setMu0] = useState("10");
  const [alpha, setAlpha] = useState("0.05");

  const result = useMemo((): { r?: TestResult; err?: string; xs?: number[] } => {
    try {
      const a = parseNum(alpha), m0 = parseNum(mu0);
      let xb: number, s: number, nn: number, xs: number[] | undefined;
      if (input === "data") {
        xs = parseData(data);
        if (xs.length < 2) return { err: "Paste at least two numbers" };
        xb = mean(xs);
        nn = xs.length;
        s = sigma === "known" ? parseNum(sd) : stdevS(xs);
      } else {
        xb = parseNum(xbar); s = parseNum(sd); nn = Math.round(parseNum(n));
      }
      if ([a, m0, xb, s, nn].some((v) => !Number.isFinite(v))) return { err: "Fill in every number" };
      return { r: runTest({ h0, sigma, xbar: xb, mu0: m0, sd: s, n: nn, alpha: a }), xs };
    } catch (e) {
      return { err: e instanceof Error ? e.message : String(e) };
    }
  }, [h0, sigma, input, data, xbar, sd, n, mu0, alpha]);

  const r = result.r;
  const nl = NULLS.find((x) => x.id === h0)!;
  let regions: Region[] = [];
  let markers: Marker[] = [];
  if (r) {
    if (h0 === "le") regions = [{ from: r.crit[0], to: Infinity, kind: "alpha" }, { from: r.stat, to: Infinity, kind: "p" }];
    else if (h0 === "ge") regions = [{ from: -Infinity, to: r.crit[0], kind: "alpha" }, { from: -Infinity, to: r.stat, kind: "p" }];
    else regions = [
      { from: -Infinity, to: r.crit[0], kind: "alpha" }, { from: r.crit[1], to: Infinity, kind: "alpha" },
      { from: -Infinity, to: -Math.abs(r.stat), kind: "p" }, { from: Math.abs(r.stat), to: Infinity, kind: "p" },
    ];
    markers = [
      { x: r.stat, label: `${r.statName} = ${r.stat.toFixed(3)}`, tone: "accent" },
      ...r.crit.map((c) => ({ x: c, label: c.toFixed(3), tone: "muted" as const, dashed: true })),
    ];
  }
  const sName = sigma === "known" ? "σ" : "s";

  return (
    <div className="lab-grid">
      <section className="panel lab-inputs" aria-label="Test setup">
        <div className="field">
          <span className="label">Null hypothesis</span>
          <Seg label="Null hypothesis" value={h0} onChange={setH0} options={NULLS.map((x) => ({ id: x.id, label: x.h0.replace("H₀: ", "") }))} />
          <span className="hint">{nl.ha} · {nl.tail.toLowerCase()}</span>
        </div>
        <div className="field">
          <span className="label">Population σ</span>
          <Seg label="Population sigma" value={sigma} onChange={setSigma} options={[{ id: "known", label: "Known: Z-test" }, { id: "unknown", label: "Unknown: t-test" }]} />
        </div>
        <div className="field">
          <span className="label">Sample</span>
          <Seg label="Sample input" value={input} onChange={setInput} options={[{ id: "data", label: "Raw data" }, { id: "summary", label: "x̄, sd and n" }]} />
        </div>
        {input === "data" ? (
          <div className="field">
            <label htmlFor="lab-data">Data, separated by commas or spaces</label>
            <textarea id="lab-data" className="input lab-data" rows={3} value={data} onChange={(e) => setData(e.target.value)} spellCheck={false} />
            {result.xs && <span className="hint num">n = {result.xs.length} · x̄ = {fmt(mean(result.xs))}{result.xs.length > 1 ? ` · s = ${fmt(stdevS(result.xs))}` : ""}</span>}
          </div>
        ) : (
          <div className="lab-pair">
            <NumField id="lab-xbar" label="x̄" value={xbar} onChange={setXbar} />
            <NumField id="lab-n" label="n" value={n} onChange={setN} />
          </div>
        )}
        <div className="lab-pair">
          <NumField id="lab-mu0" label="μ₀" value={mu0} onChange={setMu0} />
          {(sigma === "known" || input === "summary") && <NumField id="lab-sd" label={sigma === "known" ? "σ" : "s"} value={sd} onChange={setSd} />}
        </div>
        <div className="field">
          <span className="label">Significance α</span>
          <Seg label="Significance" value={["0.01", "0.05", "0.1"].includes(alpha) ? alpha : "custom"} onChange={(v) => v !== "custom" && setAlpha(v)} options={[{ id: "0.01", label: "1%" }, { id: "0.05", label: "5%" }, { id: "0.1", label: "10%" }, { id: "custom", label: "Other" }]} />
          {!["0.01", "0.05", "0.1"].includes(alpha) && <input aria-label="Custom alpha" className="input num" value={alpha} onChange={(e) => setAlpha(e.target.value)} />}
        </div>
      </section>

      <section className="lab-out" aria-live="polite">
        {result.err || !r ? (
          <div className="empty">{result.err ?? "Fill in the test"}</div>
        ) : (
          <>
            <div className="panel lab-verdict-panel">
              <div className="lab-verdict">
                <span className={`pill ${r.reject ? "pill-neg" : "pill-neutral"}`}>{r.reject ? "Reject H₀" : "Do not reject H₀"}</span>
                <p>
                  p-value <strong className="lab-p num">{fmt(r.pValue, "prob")}</strong> is {r.reject ? "below" : "not below"} α = {r.alpha}, and {r.statName} = {r.stat.toFixed(3)} is {r.reject ? "inside" : "outside"} the rejection region.
                </p>
              </div>
              <Curve
                dist={sigma === "known" ? { kind: "z" } : { kind: "t", df: r.df! }}
                regions={regions}
                markers={markers}
                height={240}
                ariaLabel={`${sigma === "known" ? "Standard normal" : `t distribution with ${r.df} degrees of freedom`}; test statistic ${r.stat.toFixed(3)}; p-value ${r.pValue.toFixed(4)}`}
              />
              <p className="hint lab-legend"><span className="sw sw-p" aria-hidden="true" /> p-value area <span className="sw sw-a" aria-hidden="true" /> rejection region, α {h0 === "eq" ? "split in two tails" : "in one tail"}</p>
            </div>

            <div className="panel">
              <div className="panel-head"><h2>In Excel, the class way</h2><span className="hint">{nl.h0.replace("μ₀", String(r.mu0))} · {sigma === "known" ? "Z" : `T, ν = ${r.df}`}</span></div>
              <table className="ledger steps">
                <tbody>
                  <tr><td className="lbl"><div>Standard error, {sName}/√n</div><div className="f"><Formula f={r.excel.se} /></div></td><td className="val num">{fmt(r.se)}</td></tr>
                  <tr><td className="lbl"><div>Test statistic {r.statName}</div><div className="f"><Formula f={r.excel.stat} /></div></td><td className="val num">{r.stat.toFixed(4)}</td></tr>
                  <tr><td className="lbl"><div>p-value{h0 === "eq" ? (r.stat < 0 ? ", statistic negative" : ", statistic positive") : ""}</div><div className="f"><Formula f={r.excel.p} /></div></td><td className="val num lab-p">{fmt(r.pValue, "prob")}</td></tr>
                  <tr><td className="lbl"><div>Critical value{h0 === "eq" ? "s" : ""}</div><div className="f"><Formula f={r.excel.crit} /></div><div className="hint">{r.excel.rule}</div></td><td className="val num">{h0 === "eq" ? `±${r.crit[1].toFixed(4)}` : r.crit[0].toFixed(4)}</td></tr>
                </tbody>
              </table>
              <div className="row lab-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => askTutor(
                    `Walk me through this hypothesis test step by step, the way class does it, and explain the decision in business terms.\n\n${nl.h0.replace("μ₀", String(r.mu0))}, ${nl.ha.replace("μ₀", String(r.mu0))}, α = ${r.alpha}. σ ${sigma}. ` +
                    (result.xs ? `Data: ${result.xs.join(", ")}.` : `x̄ = ${r.xbar}, ${sName} = ${r.sd}, n = ${r.n}.`) +
                    `\n\nThe site computed ${r.statName} = ${r.stat.toFixed(4)}, p-value = ${r.pValue.toFixed(4)}, critical value ${h0 === "eq" ? "±" + r.crit[1].toFixed(4) : r.crit[0].toFixed(4)}.`,
                  )}
                >
                  <MessageSquare size={16} aria-hidden="true" />Explain this test
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Normal & .INV
type NQ = "less" | "more" | "between" | "top" | "bottom";
function NormalMode() {
  const [mu, setMu] = useState("18");
  const [sd, setSd] = useState("5");
  const [q, setQ] = useState<NQ>("between");
  const [a, setA] = useState("16");
  const [b, setB] = useState("20");
  const [p, setP] = useState("10");
  const m = parseNum(mu), s = parseNum(sd), av = parseNum(a), bv = parseNum(b), pv = parseNum(p) / 100;
  const ok = [m, s].every(Number.isFinite) && s > 0;
  let value = NaN, formula = "", regions: Region[] = [], markers: Marker[] = [], label = "";
  if (ok) {
    if (q === "less" && Number.isFinite(av)) { value = normDist(av, m, s); formula = `=NORM.DIST(${av},${m},${s},TRUE)`; regions = [{ from: -Infinity, to: av, kind: "fill" }]; markers = [{ x: av, label: String(av) }]; label = `P(X < ${av})`; }
    if (q === "more" && Number.isFinite(av)) { value = 1 - normDist(av, m, s); formula = `=1-NORM.DIST(${av},${m},${s},TRUE)`; regions = [{ from: av, to: Infinity, kind: "fill" }]; markers = [{ x: av, label: String(av) }]; label = `P(X > ${av})`; }
    if (q === "between" && Number.isFinite(av) && Number.isFinite(bv)) { const lo = Math.min(av, bv), hi = Math.max(av, bv); value = normDist(hi, m, s) - normDist(lo, m, s); formula = `=NORM.DIST(${hi},${m},${s},TRUE)-NORM.DIST(${lo},${m},${s},TRUE)`; regions = [{ from: lo, to: hi, kind: "fill" }]; markers = [{ x: lo, label: String(lo) }, { x: hi, label: String(hi) }]; label = `P(${lo} < X < ${hi})`; }
    if ((q === "top" || q === "bottom") && pv > 0 && pv < 1) {
      const left = q === "top" ? 1 - pv : pv;
      value = normInvGeneral(left, m, s);
      formula = `=NORM.INV(${Number(left.toFixed(6))},${m},${s})`;
      regions = [q === "top" ? { from: value, to: Infinity, kind: "fill" } : { from: -Infinity, to: value, kind: "fill" }];
      markers = [{ x: value, label: fmt(value), tone: "accent" }];
      label = q === "top" ? `Value that starts the top ${p}%` : `Value that ends the bottom ${p}%`;
    }
  }
  const isProb = q === "less" || q === "more" || q === "between";
  return (
    <div className="lab-grid">
      <section className="panel lab-inputs" aria-label="Normal question">
        <div className="lab-pair">
          <NumField id="n-mu" label="Mean μ" value={mu} onChange={setMu} />
          <NumField id="n-sd" label="Standard deviation σ" value={sd} onChange={setSd} />
        </div>
        <div className="field">
          <span className="label">Question</span>
          <Seg label="Question" value={q} onChange={setQ} options={[{ id: "less", label: "Less than" }, { id: "more", label: "More than" }, { id: "between", label: "Between" }, { id: "top", label: "Top %" }, { id: "bottom", label: "Bottom %" }]} />
          <span className="hint">{isProb ? "A value goes in, a probability comes out: .DIST" : "A probability goes in, a value comes out: .INV"}</span>
        </div>
        {isProb ? (
          <div className="lab-pair">
            <NumField id="n-a" label={q === "between" ? "From" : "Value"} value={a} onChange={setA} />
            {q === "between" && <NumField id="n-b" label="To" value={b} onChange={setB} />}
          </div>
        ) : (
          <NumField id="n-p" label="Percent" value={p} onChange={setP} hint={q === "top" ? `NORM.INV needs the area to the left: 1 − ${p}%` : undefined} />
        )}
      </section>
      <section className="lab-out" aria-live="polite">
        {!Number.isFinite(value) ? <div className="empty">Fill in the numbers</div> : (
          <div className="panel lab-verdict-panel">
            <div className="lab-verdict">
              <p>{label} = <strong className="num lab-big">{isProb ? fmt(value, "prob") : fmt(value)}</strong></p>
            </div>
            <Curve dist={{ kind: "normal", mean: m, sd: s }} regions={regions} markers={markers} height={240} ariaLabel={`Normal curve, mean ${m}, sd ${s}; ${label} = ${value}`} />
            <div className="lab-formula-line"><Formula f={formula} /></div>
            {Number.isFinite(av) && isProb && <p className="hint">Z-score of {av}: <code className="formula">=({av}-{m})/{s}</code> = {fmt((av - m) / s)}</p>}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Confidence interval
function CiMode() {
  const [sigma, setSigma] = useState<Sigma>("known");
  const [center, setCenter] = useState("691.8");
  const [sd, setSd] = useState("156");
  const [n, setN] = useState("10");
  const [conf, setConf] = useState("95");
  const [which, setWhich] = useState<"mu" | "xbar">("mu");
  const c = parseNum(center), s = parseNum(sd), nn = Math.round(parseNum(n)), cl = parseNum(conf) / 100;
  const ok = [c, s, nn, cl].every(Number.isFinite) && s > 0 && nn >= 2 && cl > 0 && cl < 1;
  const alpha = 1 - cl;
  const crit = ok ? (sigma === "known" ? normInv(1 - alpha / 2) : tInv(1 - alpha / 2, nn - 1)) : NaN;
  const se = ok ? s / Math.sqrt(nn) : NaN;
  const lo = c - crit * se, hi = c + crit * se;
  const a = Number(alpha.toFixed(6));
  const critF = sigma === "known" ? `=NORM.S.INV(1-${a}/2)` : `=T.INV(1-${a}/2,${nn - 1})`;
  return (
    <div className="lab-grid">
      <section className="panel lab-inputs" aria-label="Interval setup">
        <div className="field">
          <span className="label">Question</span>
          <Seg label="Interval question" value={which} onChange={(v) => { setWhich(v); if (v === "xbar") setSigma("known"); }} options={[{ id: "mu", label: "μ unknown: where is μ?" }, { id: "xbar", label: "μ known: where will x̄ land?" }]} />
        </div>
        {which === "mu" && (
          <div className="field">
            <span className="label">Population σ</span>
            <Seg label="Population sigma" value={sigma} onChange={setSigma} options={[{ id: "known", label: "Known: Z" }, { id: "unknown", label: "Unknown: T" }]} />
          </div>
        )}
        <div className="lab-pair">
          <NumField id="ci-c" label={which === "mu" ? "Sample mean x̄" : "True mean μ"} value={center} onChange={setCenter} />
          <NumField id="ci-sd" label={sigma === "known" ? "σ" : "s"} value={sd} onChange={setSd} />
        </div>
        <div className="lab-pair">
          <NumField id="ci-n" label="n" value={n} onChange={setN} />
          <NumField id="ci-conf" label="Confidence %" value={conf} onChange={setConf} />
        </div>
      </section>
      <section className="lab-out" aria-live="polite">
        {!ok ? <div className="empty">Fill in the numbers</div> : (
          <>
            <div className="panel lab-verdict-panel">
              <div className="lab-verdict">
                <p>{which === "mu" ? `We are ${conf}% confident μ is between` : `There is a ${conf}% chance x̄ lands between`} <strong className="num lab-big">{fmt(lo)}</strong> and <strong className="num lab-big">{fmt(hi)}</strong></p>
              </div>
              <Curve
                dist={sigma === "known" ? { kind: "z" } : { kind: "t", df: nn - 1 }}
                regions={[{ from: -Infinity, to: -crit, kind: "alpha" }, { from: crit, to: Infinity, kind: "alpha" }, { from: -crit, to: crit, kind: "fill" }]}
                markers={[{ x: -crit, label: `−${crit.toFixed(3)}` }, { x: crit, label: `+${crit.toFixed(3)}` }]}
                height={220}
                ariaLabel={`Middle ${conf}% between ±${crit.toFixed(3)}`}
              />
            </div>
            <div className="panel">
              <div className="panel-head"><h2>In Excel</h2></div>
              <table className="ledger steps">
                <tbody>
                  <tr><td className="lbl"><div>Standard error</div><div className="f"><Formula f={`=${s}/SQRT(${nn})`} /></div></td><td className="val num">{fmt(se)}</td></tr>
                  <tr><td className="lbl"><div>{sigma === "known" ? "Z_α/2" : `T_α/2, ν = ${nn - 1}`}</div><div className="f"><Formula f={critF} /></div></td><td className="val num">{crit.toFixed(4)}</td></tr>
                  <tr><td className="lbl"><div>Lower limit</div><div className="f"><Formula f={`=${c}-${crit.toFixed(4)}*${s}/SQRT(${nn})`} /></div></td><td className="val num">{fmt(lo)}</td></tr>
                  <tr><td className="lbl"><div>Upper limit</div><div className="f"><Formula f={`=${c}+${crit.toFixed(4)}*${s}/SQRT(${nn})`} /></div></td><td className="val num">{fmt(hi)}</td></tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default function Lab() {
  const [mode, setMode] = useState<Mode>("test");
  return (
    <div className="page wide">
      <div className="title-row">
        <div>
          <h1>Test lab</h1>
          <p className="sub">Set up any of the 12 test questions, a normal probability or an interval, and see the curve, the numbers and the exact Excel formulas.</p>
        </div>
        <Seg label="Lab mode" value={mode} onChange={setMode} options={[{ id: "test", label: "Hypothesis test" }, { id: "normal", label: "Normal & .INV" }, { id: "ci", label: "Confidence interval" }]} />
      </div>
      {mode === "test" ? <TestMode /> : mode === "normal" ? <NormalMode /> : <CiMode />}
    </div>
  );
}
