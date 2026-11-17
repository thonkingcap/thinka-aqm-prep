// #/admin: Daniel's dashboard, not linked anywhere. The code is checked by the database (only a one-way
// hash of it is stored there), so nothing secret lives in this public code. The code is kept for this tab
// only, so a refresh doesn't ask again but closing the tab does.
import { useEffect, useState, type FormEvent } from "react";
import { Lock, LoaderCircle, RefreshCw } from "lucide-react";
import { money } from "../lib/spend.ts";
import "./screens.css";
import "./admin.css";

const RPC = "https://kxtdmgpecxlzyepshryw.supabase.co/rest/v1/rpc/admin_stats";
const PUBLISHABLE = "sb_publishable_fDz6DAgzrVmsxMp_THba5g_swF5jxXH";
const SESSION = "aqm.admin";

type Person = { visitor: string; name: string | null; email?: string | null; used_shared?: boolean | null; first_seen: string; last_seen: string; minutes: number; requests: number; spend: number; keys: number; used_code: boolean | null; days: number };
type Stats = {
  generated_at: string;
  totals: { people: number; named: number; minutes: number; claude_requests: number; unique_keys: number; code_users: number; spend: number; tokens_in: number; tokens_out: number; spend_since: string | null; shared_spend?: number; shared_users?: number };
  shared?: { email: string; name?: string | null; spent: number; requests: number; first_at: string; last_at: string }[];
  people: Person[];
  days: { day: string; people: number; minutes: number; requests: number; spend: number }[];
  features: Record<string, number>;
};

async function fetchStats(code: string): Promise<Stats> {
  const res = await fetch(RPC, { method: "POST", headers: { apikey: PUBLISHABLE, "Content-Type": "application/json" }, body: JSON.stringify({ p_code: code }) });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = String((data as { message?: string } | null)?.message ?? "");
    throw new Error(msg === "locked" ? "Too many wrong tries. Wait 10 minutes." : msg === "wrong code" ? "That code isn't right." : `Couldn't load the stats (${res.status}).`);
  }
  return data as Stats;
}

const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const hours = (min: number) => (min >= 60 ? `${(min / 60).toFixed(1)} h` : `${Math.round(min)} min`);
const usd = (n: number) => (n > 0 && n < 0.01 ? "<$0.01" : money(n));
const FEATURE: Record<string, string> = { tutor: "Dr Phil chat", verify: "Key checks", mark: "Written-answer marking", design: "Custom sets", plan: "Exam 3 advice" };

export default function Admin() {
  const [code, setCode] = useState(() => { try { return sessionStorage.getItem(SESSION) ?? ""; } catch { return ""; } });
  const [draft, setDraft] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<"last" | "minutes" | "requests">("last");

  async function load(c: string) {
    setBusy(true); setError(null);
    try {
      const s = await fetchStats(c);
      setStats(s); setCode(c);
      try { sessionStorage.setItem(SESSION, c); } catch { /* ignore */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStats(null); setCode("");
      try { sessionStorage.removeItem(SESSION); } catch { /* ignore */ }
    } finally { setBusy(false); }
  }
  useEffect(() => { if (code) load(code); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function submit(e: FormEvent) { e.preventDefault(); if (draft.trim()) load(draft.trim()); setDraft(""); }

  if (!stats) {
    return (
      <div className="page admin-gate">
        <form className="panel admin-lock" onSubmit={submit} autoComplete="off">
          <Lock size={22} aria-hidden="true" />
          <h1>Admin</h1>
          <label htmlFor="admin-code" className="sr-only">Admin code</label>
          <input id="admin-code" className="input" type="password" placeholder="Admin code" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
          <button className="btn btn-primary" type="submit" disabled={busy || !draft.trim()}>{busy ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}Open</button>
          {error && <p className="error-text" role="alert">{error}</p>}
        </form>
      </div>
    );
  }

  const t = stats.totals;
  const people = [...stats.people].sort((a, b) => sort === "minutes" ? b.minutes - a.minutes : sort === "requests" ? b.requests - a.requests : b.last_seen.localeCompare(a.last_seen));
  const tiles: [string, string, string?][] = [
    ["People", String(t.people), `${t.named} gave a name`],
    ["Time on the site", hours(t.minutes), "active time, all visitors"],
    ["Claude requests", String(t.claude_requests), "chat, marking, key checks"],
    ["Spent (estimate)", usd(t.spend), t.spend_since ? `since ${when(t.spend_since)}` : "counting from this update"],
    ["Unique API keys", String(t.unique_keys), t.spend_since ? "since key tags began" : "counting from this update"],
    ["On your shared credit", String((t.shared_users ?? 0) + t.code_users), `${usd(t.shared_spend ?? 0)} of your key · ${t.code_users} by code`],
  ];

  return (
    <div className="page admin">
      <div className="title-row">
        <div>
          <h1>Who's using AQM Prep</h1>
          <p className="hint">Updated {when(stats.generated_at)}. Spend is estimated from tokens at Sonnet prices; unique keys and spend count from Nov 16, when they started being logged.</p>
        </div>
        <div className="row">
          <button className="btn btn-ghost btn-small" onClick={() => load(code)} disabled={busy}><RefreshCw size={14} className={busy ? "spin" : ""} aria-hidden="true" />Refresh</button>
          <button className="btn btn-ghost btn-small" onClick={() => { setStats(null); setCode(""); try { sessionStorage.removeItem(SESSION); } catch { /* ignore */ } }}><Lock size={14} aria-hidden="true" />Lock</button>
        </div>
      </div>

      <div className="admin-tiles stagger">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="admin-tile">
            <span className="hint">{label}</span>
            <b className="num">{value}</b>
            {sub && <span className="hint">{sub}</span>}
          </div>
        ))}
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>People ({people.length})</h2>
          <div className="row" role="group" aria-label="Sort people">
            {(["last", "minutes", "requests"] as const).map((k) => (
              <button key={k} className={`btn btn-small ${sort === k ? "btn-primary" : "btn-ghost"}`} aria-pressed={sort === k} onClick={() => setSort(k)}>{k === "last" ? "Recent" : k === "minutes" ? "Most time" : "Most requests"}</button>
            ))}
          </div>
        </div>
        <div className="admin-scroll">
          <table className="ledger admin-table">
            <thead><tr><th>Name</th><th>First visit</th><th>Last visit</th><th className="val">Time</th><th className="val">Requests</th><th className="val">Spent</th><th>Access</th></tr></thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.visitor}>
                  <td className="lbl">{p.name ?? <span className="muted">No name</span>}{p.days > 1 && <span className="hint"> · {p.days} days</span>}{p.email && <div className="hint">{p.email}</div>}</td>
                  <td className="num">{when(p.first_seen)}</td>
                  <td className="num">{when(p.last_seen)}</td>
                  <td className="val num">{hours(p.minutes)}</td>
                  <td className="val num">{p.requests}</td>
                  <td className="val num">{p.spend ? usd(p.spend) : "—"}</td>
                  <td>{p.email || p.used_shared ? "Shared credit" : p.used_code ? "Access code" : p.keys ? `Own key${p.keys > 1 ? ` (${p.keys})` : ""}` : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {stats.shared && stats.shared.length > 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head"><h2>Shared credit</h2><span className="hint">Each student is cut off at $10 and asked to link their own key</span></div>
          <div className="admin-scroll">
            <table className="ledger admin-table">
              <thead><tr><th>Student</th><th className="val">Spent</th><th className="val">Requests</th><th>First</th><th>Last</th></tr></thead>
              <tbody>
                {stats.shared.map((x) => (
                  <tr key={x.email}><td className="lbl">{x.email.startsWith("v:") ? (x.name ?? <span className="muted">No name</span>) : x.email}</td><td className="val num">{usd(x.spent)}{x.spent >= 10 ? " · capped" : ""}</td><td className="val num">{x.requests}</td><td className="num">{when(x.first_at)}</td><td className="num">{when(x.last_at)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="admin-split">
        <section className="panel">
          <div className="panel-head"><h2>By day</h2></div>
          <table className="ledger">
            <thead><tr><th>Day</th><th className="val">People</th><th className="val">Time</th><th className="val">Requests</th><th className="val">Spent</th></tr></thead>
            <tbody>
              {stats.days.map((d) => (
                <tr key={d.day}><td className="lbl num">{new Date(`${d.day}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</td><td className="val num">{d.people}</td><td className="val num">{hours(d.minutes)}</td><td className="val num">{d.requests}</td><td className="val num">{d.spend ? usd(d.spend) : "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Claude requests by feature</h2></div>
          <table className="ledger">
            <tbody>
              {Object.entries(stats.features).sort((a, b) => b[1] - a[1]).map(([f, n]) => (
                <tr key={f}><td className="lbl">{FEATURE[f] ?? f}</td><td className="val num">{n}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
