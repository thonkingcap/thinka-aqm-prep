// The access-code proxy, as a pure function so it can be tested without Vercel.
// Students without a Claude key enter an access code from Daniel. The site sends their requests here
// with x-api-key "aqmcode:<CODE>"; this checks the code and forwards the request with Daniel's key,
// which lives only in Vercel's environment (OWNER_API_KEY) and never reaches a browser.

export type ProxyEnv = { OWNER_API_KEY?: string; ACCESS_CODES?: string };

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

export async function handle(request: Request, env: ProxyEnv, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<Response> {
  const owner = (env.OWNER_API_KEY ?? "").trim();
  const codes = (env.ACCESS_CODES ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  if (!owner || !codes.length) return err(503, "api_error", "Shared access isn't set up.");

  const url = new URL(request.url);
  const path = pathOf(url);
  const method = request.method.toUpperCase();
  const route = method === "GET" && path === "v1/models" ? "models" : method === "POST" && path === "v1/messages" ? "messages" : null;
  if (!route) return err(404, "not_found_error", "Not found.");

  if (!originOk(request.headers.get("origin"))) return err(403, "permission_error", "Requests must come from the AQM Prep site.");

  const sent = (request.headers.get("x-api-key") ?? "").trim();
  const code = sent.toLowerCase().startsWith("aqmcode:") ? sent.slice(8).trim().toUpperCase() : "";
  if (!code || !codes.includes(code)) return err(401, "authentication_error", "That access code isn't valid.");

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(`ip:${ip}`, PER_IP, now) || limited(`code:${code}`, PER_CODE, now)) {
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

  let up: Response;
  try {
    up = await fetchImpl(`${upstream}/${path}`, { method, headers, body });
  } catch {
    return err(502, "api_error", "Couldn't reach Claude. Try again in a moment.");
  }
  return new Response(up.body, {
    status: up.status,
    headers: { "content-type": up.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
  });
}
