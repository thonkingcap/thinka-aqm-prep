// Error reports from the AQM Prep pages (Nov 26), like SAT Practice's: the browser sends each error it
// sees (uncaught errors, failed promises, React crashes, error messages a page showed) to /api/errors.
// Here they're scrubbed of anything key-like, grouped by a fingerprint, stored in Supabase (schema aqm,
// through aqm_error_add, which only answers to AQM_ERRORS_KEY), and the first time a group is seen Claude
// writes a plain-English diagnosis on Daniel's key (OWNER_API_KEY). Daniel reads them in thonkingcap.dev/admin.
// A pure function so it can be tested without Vercel; never throws, and always answers 204 to a good report.

export type ErrorsEnv = { OWNER_API_KEY?: string; AQM_ERRORS_KEY?: string; VERCEL_GIT_COMMIT_SHA?: string };
export type ErrorKind = "client" | "ui" | "react";
const KINDS: readonly ErrorKind[] = ["client", "ui", "react"];

const SUPABASE = "https://kxtdmgpecxlzyepshryw.supabase.co/rest/v1/rpc";
const PUBLISHABLE = "sb_publishable_fDz6DAgzrVmsxMp_THba5g_swF5jxXH";
const BABSON = "https://ca-litellm-mint-eus2.orangeflower-5d81efa8.eastus2.azurecontainerapps.io";
const ANTHROPIC = "https://api.anthropic.com";
const MAX_BODY = 32 * 1024;
const MAX_WHERE = 200;
const MAX_MESSAGE = 2000;
const MAX_CONTEXT_CHARS = 8000;
const MAX_STACK = 4000;
const WINDOW_MS = 10 * 60 * 1000;
const PER_IP = 30;
const VISITOR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const empty = (status: number) => new Response(null, { status, headers: { "cache-control": "no-store" } });

function originOk(origin: string | null): boolean {
  if (!origin) return false;
  if (origin === "https://thinka-aqm-prep.vercel.app" || origin === "https://thonkingcap.dev" || origin === "https://www.thonkingcap.dev") return true;
  if (/^https:\/\/[a-z0-9-]+-thonkingcap\.vercel\.app$/.test(origin)) return true;
  return /^http:\/\/localhost(:\d{1,5})?$/.test(origin);
}

const hits = new Map<string, number[]>();
function limited(key: string, now: number): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.set(key, recent);
  if (recent.length >= PER_IP) return true;
  recent.push(now);
  if (hits.size > 5000) hits.clear();
  return false;
}
/** For tests. */
export function resetErrorLimits() { hits.clear(); }

/* ---------------------------------------------------------------- grouping */

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const HEX = /\b(?=[0-9a-f]*\d)[0-9a-f]{8,}\b/gi;

/** A message with what changes between occurrences folded (ids, paths, numbers), so repeats group. */
export function normalizeMessage(message: string): string {
  return message
    .replace(UUID, "<uuid>")
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/(['"`])(?:[A-Za-z]:)?[/\\][^'"`]*\1/g, "$1<path>$1")
    .replace(HEX, "<hex>")
    .replace(/\d+(?:\.\d+)?/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** A page ("#/lesson/17/practice") with numbers folded: "#/lesson/:n/practice". Query strings dropped. */
export function foldWhere(where: string): string {
  const [page, ...rest] = where.split(" · ");
  const clean = page.split("?")[0].split("/").map((s) => (/^\d+$/.test(s) || UUID.test(s) ? ":n" : s)).join("/");
  UUID.lastIndex = 0;
  return [clean, ...rest].join(" · ").slice(0, MAX_WHERE);
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A short stable id for a group: "<kind>-<16 hex>". */
export async function fingerprint(kind: string, where: string, message: string): Promise<string> {
  return `${kind}-${(await sha256Hex(`${kind}\n${foldWhere(where)}\n${normalizeMessage(message)}`)).slice(0, 16)}`;
}

/* ---------------------------------------------------------------- secrets */

const SECRET_KEY = /cookie|authorization|auth[-_]?token|api[-_]?key|apikey|secret|password|passwd|token|session|^headers?$|^p_key$|access[-_]?code|^key$/i;

/** A string with anything key-like replaced by [redacted]: Claude/Babson keys, access codes, sign-in values, tokens. */
export function scrubText(text: string, secrets: string[] = []): string {
  let out = text;
  for (const s of secrets) if (s && s.length >= 6) out = out.split(s).join("[redacted]");
  return out
    .replace(/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{8,}/g, "[redacted]")
    .replace(/\baqm(?:code|user|email):\S+/gi, "[redacted]")
    .replace(/\bsb_(?:publishable|secret)_[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "$1 [redacted]")
    .replace(/\b(api[-_]?key|apikey|x-api-key|token|secret|password|session|cookie|authorization|p_key)(["']?\s*[:=]\s*["']?)[^\s"',;&}]+/gi, "$1$2[redacted]");
}

/** A copy safe to store: secret-looking keys dropped, strings scrubbed and cut, depth and lengths limited. */
export function scrub(value: unknown, secrets: string[] = [], depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return scrubText(value, secrets).slice(0, 1500);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= 4) return "[…]";
  if (Array.isArray(value)) return value.slice(-30).map((v) => scrub(v, secrets, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
      if (SECRET_KEY.test(k)) continue;
      out[k] = scrub(v, secrets, depth + 1);
    }
    return out;
  }
  return String(value).slice(0, 200);
}

function fitContext(ctx: Record<string, unknown>): Record<string, unknown> {
  if (JSON.stringify(ctx).length <= MAX_CONTEXT_CHARS) return ctx;
  const small: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    const next = { ...small, [k]: typeof v === "string" ? v.slice(0, 800) : Array.isArray(v) ? v.slice(-8) : v };
    if (JSON.stringify(next).length <= MAX_CONTEXT_CHARS) Object.assign(small, next);
  }
  return small;
}

/* ---------------------------------------------------------------- diagnosis */

export const APP_MAP = `The site: "AQM Prep" (thonkingcap.dev/aqm, also thinka-aqm-prep.vercel.app/aqm), a Vite + React 19 + TypeScript single-page app for Babson's AQM 1000 statistics course (Excel-based). Hash routes (#/…), base path /aqm/. Hosted on Vercel; the only server code is api/claude.ts + api/_proxy.ts (shared Claude proxy on the owner's key, $10 cap per visitor, Supabase shared_spend) and api/errors.ts + api/_errors.ts (this error log).
Everything else runs in the browser; progress is in localStorage (src/lib/progress.ts). The student's own Claude key is AES-GCM encrypted in IndexedDB (src/lib/vault.ts). Strict CSP with Trusted Types (vercel.json); service worker from src/sw-template.js.
Screens (src/screens): Home.tsx hub; Lessons.tsx (#/lessons, #/lesson/<n>/<tab>, content in src/lib/lessons/lNN.ts, kit.ts, books.ts); Unit.tsx (#/unit/<u>/<tab>); Final.tsx (#/final); Ahead.tsx (#/ahead BETA regression); Exam3.tsx (#/exam3, src/lib/exam3.ts); Area.tsx (#/area/<id>); Tutor.tsx (#/tutor, "Dr Phil" AI tutor chat); KeySettings.tsx (#/key); Admin.tsx (#/admin); Learn.tsx, Lab.tsx, Practice.tsx (older pages).
Components (src/components): Sheet.tsx (in-browser Excel), UploadGrade.tsx (upload a filled .xlsx to be marked), Quiz.tsx, Diagnostic.tsx, Books.tsx (workbook downloads), StartDialog.tsx, NamePrompt.tsx, CapDialog.tsx (shared credit used up), Ideas.tsx, ProblemDialog.tsx.
Libraries (src/lib): claude.ts (Claude calls: tutor, practice_set tool), ai.ts/aiParse.ts (AI marking and custom sets), provider.ts (key → Babson gateway, Anthropic, or this site's proxy; pickModel), excel.ts (formula evaluator), stats.ts, xlsx.ts/xlsxRead.ts (build and read workbooks), grade.ts (marking uploads), workbook.ts, sets.ts, paper.ts, docx.ts, diag/*, usage.ts (Supabase log_event usage logs), spend.ts.`;

const DIAGNOSE_SYSTEM = `You diagnose errors on a small study website for its owner, a college freshman who built it with AI help for his statistics class. You get one error report and a map of the app. Write plain text (no markdown headings, no code fences longer than 3 lines), in exactly these sections, each starting with its label on its own line:
What happened
Likely cause
How to fix
How sure
Who it affects

- What happened: two or three sentences in plain English. No jargon without explaining it.
- Likely cause: name the file and function when the stack, page or message points to it; otherwise say what kind of code to look in. Say when it's a guess.
- How to fix: concrete steps. If it's not a bug in the site (a network blip, the AI service being down, a browser extension, an old cached version after a deploy, a student's own key out of credit), say so and say whether anything needs doing.
- How sure: low, medium or high, and why in one sentence.
- Who it affects: everyone, one person, one page or feature, and how badly.
Keep the whole thing under 300 words. Don't make up file names that aren't in the map or the stack.`;

export type Report = { kind: ErrorKind; where: string; message: string; stack?: string; context: Record<string, unknown> };

export function diagnosisPrompt(r: Report): string {
  const { stack, ...rest } = r.context;
  return [
    `Kind: ${r.kind} (${{ client: "uncaught in the browser", ui: "an error message the page showed the person", react: "a React render error caught by the error screen" }[r.kind]})`,
    `Where (hash route): ${r.where}`,
    `Message: ${r.message}`,
    stack ? `Stack:\n${String(stack).slice(0, 2500)}` : "Stack: none",
    `Context (breadcrumbs are the person's last page changes and clicks, oldest first):\n${JSON.stringify(rest, null, 1).slice(0, 3000)}`,
  ].join("\n\n");
}

const PREFERRED = ["claude-sonnet-5-5", "claude-sonnet-5", "claude-sonnet-46"];

/** One Claude call on the owner's key that explains an error. Null when it can't. */
export async function diagnose(r: Report, owner: string, fetchImpl: typeof fetch): Promise<string | null> {
  const base = owner.startsWith("sk-ant-") ? ANTHROPIC : BABSON;
  const headers = { "x-api-key": owner, "anthropic-version": "2023-06-01", "content-type": "application/json" };
  try {
    let model = PREFERRED[0];
    const list = await fetchImpl(`${base}/v1/models`, { headers }).then((res) => (res.ok ? (res.json() as Promise<{ data?: { id?: string }[] }>) : null)).catch(() => null);
    const ids = (list?.data ?? []).map((m) => m.id).filter((x): x is string => typeof x === "string");
    if (ids.length) model = PREFERRED.find((p) => ids.includes(p)) ?? ids.filter((i) => /sonnet/i.test(i)).sort().reverse()[0] ?? ids[0];
    const res = await fetchImpl(`${base}/v1/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        system: [{ type: "text", text: DIAGNOSE_SYSTEM }, { type: "text", text: `Map of the app:\n${APP_MAP}` }],
        messages: [{ role: "user", content: diagnosisPrompt(r) }],
      }),
    });
    if (!res.ok) return null;
    const msg = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (msg.content ?? []).map((b) => (b.type === "text" ? b.text ?? "" : "")).join("").trim();
    return text || null;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- the route */

async function rpc(fetchImpl: typeof fetch, fn: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetchImpl(`${SUPABASE}/${fn}`, { method: "POST", headers: { apikey: PUBLISHABLE, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${fn} ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export async function handleErrors(request: Request, env: ErrorsEnv, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<Response> {
  if (request.method.toUpperCase() !== "POST") return empty(405);
  if (!originOk(request.headers.get("origin"))) return empty(403);
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(ip, now)) return empty(429);
  const text = await request.text().catch(() => "");
  if (!text || text.length > MAX_BODY) return empty(413);
  let body: Record<string, unknown>;
  try {
    const p = JSON.parse(text);
    if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("not an object");
    body = p as Record<string, unknown>;
  } catch {
    return empty(400);
  }

  const secrets = [env.OWNER_API_KEY ?? "", env.AQM_ERRORS_KEY ?? ""];
  const kind = KINDS.includes(body.kind as ErrorKind) ? (body.kind as ErrorKind) : "client";
  const where = foldWhere(scrubText(str(body.where, 500), secrets)) || "(unknown page)";
  const message = scrubText(str(body.message, 4000) || "(no message)", secrets).slice(0, MAX_MESSAGE);
  const visitor = VISITOR.test(str(body.visitor, 40)) ? str(body.visitor, 40) : null;
  const name = scrubText(str(body.name, 80), secrets).trim() || null;
  const rawCtx = body.context && typeof body.context === "object" && !Array.isArray(body.context) ? (body.context as Record<string, unknown>) : {};
  const stack = str(body.stack, MAX_STACK);
  const context = fitContext((scrub({ ...rawCtx, ...(stack ? { stack } : {}), build: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local" }, secrets) ?? {}) as Record<string, unknown>);

  console.error(`[error:${kind}] ${where}: ${message}`);
  const key = (env.AQM_ERRORS_KEY ?? "").trim();
  if (!key) return empty(204);
  try {
    const fp = await fingerprint(kind, where, message);
    const res = (await rpc(fetchImpl, "aqm_error_add", { p_key: key, p_fingerprint: fp, p_visitor: visitor, p_name: name, p_kind: kind, p_where: where, p_message: message, p_context: context })) as { diagnose?: boolean } | null;
    const owner = (env.OWNER_API_KEY ?? "").trim();
    if (res?.diagnose && owner) {
      const d = await diagnose({ kind, where, message, stack, context }, owner, fetchImpl);
      if (d) await rpc(fetchImpl, "aqm_error_diagnose", { p_key: key, p_fingerprint: fp, p_diagnosis: d.slice(0, 8000) });
    }
  } catch (e) {
    console.error("error report failed:", e instanceof Error ? e.message : e);
  }
  return empty(204);
}
