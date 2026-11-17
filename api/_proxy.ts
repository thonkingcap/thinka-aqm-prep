// The shared-access proxy, as a pure function so it can be tested without Vercel.
// Students without a Claude key reach Claude through here on Daniel's key, which lives only in Vercel's
// environment (OWNER_API_KEY) and never reaches a browser. Two ways in, sent as x-api-key or
// "Authorization: Bearer …":
//   aqmcode:<CODE>     an access code from Daniel (ACCESS_CODES, comma-separated), no spend cap
//   aqmuser:<uuid>     the default: anyone, by their browser's random visitor id, capped at $10 each.
//   aqmemail:<email>   older sign-ins by Babson email (no verification), capped at $10 each too.
// Shared spend lives in Supabase (shared_spend), read and charged through two functions that only answer
// to PROXY_SECRET (the database stores just its SHA-256). Cost is worked out here from each reply's usage.

export type ProxyEnv = { OWNER_API_KEY?: string; ACCESS_CODES?: string; PROXY_SECRET?: string; SHARED_LIMIT_USD?: string };

const SUPABASE = "https://kxtdmgpecxlzyepshryw.supabase.co/rest/v1/rpc";
const PUBLISHABLE = "sb_publishable_fDz6DAgzrVmsxMp_THba5g_swF5jxXH";
const EMAIL = /^[a-z0-9._%+-]+@babson\.edu$/i;
const VISITOR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Dollars per million tokens, as in src/lib/spend.ts. */
const PRICE = { input: 2.0, output: 10.0, cacheWrite: 2.5, cacheRead: 0.2 };
export const CAP_MESSAGE = "You've used your free $10 of shared credit. Link your own Claude API key to keep using Dr Phil.";

const BABSON = "https://ca-litellm-mint-eus2.orangeflower-5d81efa8.eastus2.azurecontainerapps.io";
const ANTHROPIC = "https://api.anthropic.com";
const MAX_BODY = 4 * 1024 * 1024;
const MAX_TOKENS = 16000;
const WINDOW_MS = 10 * 60 * 1000;
const PER_IP = 60;
const PER_CODE = 600;
const MAX_TRACKED = 5000;

function err(status: number, type: string, message: string): Response {
  return new Response(JSON.stringify({ type: "error", error: { type, message } }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function originOk(origin: string | null): boolean {
  if (!origin) return true;
  if (origin === "https://thinka-aqm-prep.vercel.app") return true;
  if (/^https:\/\/[a-z0-9-]+-thonkingcap\.vercel\.app$/.test(origin)) return true;
  return /^http:\/\/localhost(:\d{1,5})?$/.test(origin);
}

// In-memory, per instance: a speed bump, not a guarantee.
const hits = new Map<string, number[]>();
function limited(key: string, max: number, now: number): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= max) { hits.set(key, recent); return true; }
  recent.push(now);
  hits.delete(key);
  hits.set(key, recent);
  if (hits.size > MAX_TRACKED) {
    for (const k of hits.keys()) { hits.delete(k); if (hits.size <= MAX_TRACKED * 0.8) break; }
  }
  return false;
}
/** For tests. */
export function resetLimits() { hits.clear(); }

function pathOf(url: URL): string {
  const q = url.searchParams.get("path");
  const raw = q ?? url.pathname.replace(/^\/api\/claude\/?/, "");
  return raw.replace(/^\/+|\/+$/g, "");
}

type Usage = { input_tokens: number; output_tokens: number; cache_creation_input_tokens: number; cache_read_input_tokens: number };
const ZERO = (): Usage => ({ input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 });
function mergeUsage(into: Usage, u: unknown) {
  if (!u || typeof u !== "object") return;
  for (const k of Object.keys(into) as (keyof Usage)[]) {
    const v = Number((u as Record<string, unknown>)[k]);
    if (Number.isFinite(v) && v > into[k]) into[k] = v;
  }
}
export function costOf(u: Usage): number {
  return (u.input_tokens * PRICE.input + u.cache_creation_input_tokens * PRICE.cacheWrite + u.cache_read_input_tokens * PRICE.cacheRead + u.output_tokens * PRICE.output) / 1_000_000;
}

async function rpc(fetchImpl: typeof fetch, fn: string, body: Record<string, unknown>): Promise<number> {
  const res = await fetchImpl(`${SUPABASE}/${fn}`, { method: "POST", headers: { apikey: PUBLISHABLE, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${fn} ${res.status}`);
  const n = Number(await res.json());
  if (!Number.isFinite(n)) throw new Error(`${fn} returned no number`);
  return n;
}

export async function handle(request: Request, env: ProxyEnv, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<Response> {
  const owner = (env.OWNER_API_KEY ?? "").trim();
  const codes = (env.ACCESS_CODES ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  const secret = (env.PROXY_SECRET ?? "").trim();
  const limitUsd = Number(env.SHARED_LIMIT_USD) > 0 ? Number(env.SHARED_LIMIT_USD) : 10;
  if (!owner) return err(503, "api_error", "Shared access isn't set up.");

  const url = new URL(request.url);
  const path = pathOf(url);
  const method = request.method.toUpperCase();
  const route = method === "GET" && path === "v1/models" ? "models" : method === "POST" && path === "v1/messages" ? "messages" : null;
  if (!route) return err(404, "not_found_error", "Not found.");

  if (!originOk(request.headers.get("origin"))) return err(403, "permission_error", "Requests must come from the AQM Prep site.");

  // The site's own fetches send the code as x-api-key; the Claude SDK sends it as "Authorization: Bearer …".
  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  const sent = (request.headers.get("x-api-key") || bearer).trim();
  let user: string;
  let email: string | null = null;
  if (sent.toLowerCase().startsWith("aqmuser:")) {
    const v = sent.slice(8).trim().toLowerCase();
    if (!secret) return err(503, "api_error", "Shared access isn't set up.");
    if (!VISITOR.test(v)) return err(401, "authentication_error", "Sign in again from the welcome screen.");
    email = `v:${v}`;
    user = `visitor:${v}`;
  } else if (sent.toLowerCase().startsWith("aqmemail:")) {
    const e = sent.slice(9).trim().toLowerCase();
    if (!secret) return err(503, "api_error", "Shared access isn't set up.");
    if (!EMAIL.test(e)) return err(401, "authentication_error", "Use your Babson email (ending in @babson.edu).");
    email = e;
    user = `email:${e}`;
  } else {
    const code = sent.toLowerCase().startsWith("aqmcode:") ? sent.slice(8).trim().toUpperCase() : "";
    if (!codes.length) return err(503, "api_error", "Shared access isn't set up.");
    if (!code || !codes.includes(code)) return err(401, "authentication_error", "That access code isn't valid.");
    user = `code:${code}`;
  }

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(`ip:${ip}`, PER_IP, now) || limited(user, PER_CODE, now)) {
    return err(429, "rate_limit_error", "Too many requests. Wait a few minutes and try again.");
  }

  const upstream = owner.startsWith("sk-ant-") ? ANTHROPIC : BABSON;
  const headers: Record<string, string> = {
    "x-api-key": owner,
    "anthropic-version": request.headers.get("anthropic-version") || "2023-06-01",
  };
  const beta = request.headers.get("anthropic-beta");
  if (beta) headers["anthropic-beta"] = beta;

  let body: string | undefined;
  if (route === "messages") {
    const len = Number(request.headers.get("content-length") ?? 0);
    if (len > MAX_BODY) return err(413, "request_too_large", "That request is too large.");
    const text = await request.text();
    if (text.length > MAX_BODY) return err(413, "request_too_large", "That request is too large.");
    let json: Record<string, unknown>;
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
      json = parsed as Record<string, unknown>;
    } catch {
      return err(400, "invalid_request_error", "The request body must be JSON.");
    }
    if (typeof json.model !== "string" || !/^claude-[a-z0-9.-]+$/.test(json.model)) {
      return err(400, "invalid_request_error", "Only Claude models can be used.");
    }
    const mt = Number(json.max_tokens);
    json.max_tokens = Number.isFinite(mt) && mt > 0 ? Math.min(Math.floor(mt), MAX_TOKENS) : MAX_TOKENS;
    delete json.fallbacks;
    body = JSON.stringify(json);
    headers["content-type"] = "application/json";
  }

  // Email users: refuse once they've used their share. If the check itself fails, refuse too (the
  // money is Daniel's), with a message that it's temporary.
  if (email && route === "messages") {
    let spent: number;
    try {
      spent = await rpc(fetchImpl, "proxy_spent", { p_secret: secret, p_email: email });
    } catch (e) {
      console.error("shared spend check failed", e instanceof Error ? e.message : e);
      return err(503, "api_error", "Couldn't check your shared credit just now. Try again in a minute.");
    }
    if (spent >= limitUsd) return err(402, "billing_error", CAP_MESSAGE);
  }

  let up: Response;
  try {
    up = await fetchImpl(`${upstream}/${path}`, { method, headers, body });
  } catch {
    return err(502, "api_error", "Couldn't reach Claude. Try again in a moment.");
  }
  const contentType = up.headers.get("content-type") ?? "application/json";
  const outHeaders = { "content-type": contentType, "cache-control": "no-store" };
  if (!email || route !== "messages" || !up.ok || !up.body) return new Response(up.body, { status: up.status, headers: outHeaders });

  // Charge the email for this reply once it's finished. A failed charge never breaks the reply.
  const usage = ZERO();
  const charge = async () => {
    const cost = Math.max(0, Math.min(5, costOf(usage)));
    try {
      await rpc(fetchImpl, "proxy_charge", {
        p_secret: secret, p_email: email, p_cost: Math.round(cost * 1e6) / 1e6,
        p_tokens_in: usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens, p_tokens_out: usage.output_tokens,
      });
    } catch (e) {
      console.error("shared spend charge failed", e instanceof Error ? e.message : e);
    }
  };

  if (!/event-stream/i.test(contentType)) {
    const text = await up.text();
    try { mergeUsage(usage, (JSON.parse(text) as { usage?: unknown }).usage); } catch { /* not JSON: nothing to charge */ }
    await charge();
    return new Response(text, { status: up.status, headers: outHeaders });
  }

  // Streaming: pass every byte through unchanged while reading the usage out of the SSE data lines.
  const decoder = new TextDecoder();
  let carry = "";
  const scan = (chunk: string) => {
    const lines = (carry + chunk).split("\n");
    carry = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      try {
        const ev = JSON.parse(line.slice(5).trim()) as { type?: string; message?: { usage?: unknown }; usage?: unknown };
        if (ev.type === "message_start") mergeUsage(usage, ev.message?.usage);
        else if (ev.type === "message_delta") mergeUsage(usage, ev.usage);
      } catch { /* not JSON */ }
    }
  };
  const tap = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) { controller.enqueue(chunk); scan(decoder.decode(chunk, { stream: true })); },
    async flush() { scan(decoder.decode() + "\n"); await charge(); },
  });
  return new Response(up.body.pipeThrough(tap), { status: up.status, headers: outHeaders });
}
