// The access-code proxy (api/_proxy.ts): codes checked, the owner's key swapped in server-side and
// never echoed, only the two Claude routes allowed, limits enforced. Uses a fake upstream and a fake key.
import { handle, resetLimits } from "../../api/_proxy.ts";

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log("FAIL", m); } };
const OWNER = "sk-TESTOWNERKEY000000000000";
const env = { OWNER_API_KEY: OWNER, ACCESS_CODES: "AQM-TEST1, other-code" };
const SITE = "https://thinka-aqm-prep.vercel.app";

type Seen = { url: string; init: RequestInit };
let seen: Seen[] = [];
const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
  seen.push({ url: String(url), init: init ?? {} });
  return new Response('data: {"type":"message_start"}\n\n', { status: 200, headers: { "content-type": "text/event-stream" } });
}) as typeof fetch;

function req(path: string, o: { method?: string; key?: string; origin?: string | null; body?: unknown; ip?: string } = {}) {
  const headers: Record<string, string> = { "anthropic-version": "2023-06-01" };
  if (o.key !== undefined) headers["x-api-key"] = o.key;
  if (o.origin !== null) headers.origin = o.origin ?? SITE;
  if (o.ip) headers["x-forwarded-for"] = `${o.ip}, 10.0.0.1`;
  if (o.body !== undefined) headers["content-type"] = "application/json";
  return new Request(`${SITE}${path}`, { method: o.method ?? "POST", headers, body: o.body === undefined ? undefined : typeof o.body === "string" ? o.body : JSON.stringify(o.body) });
}
const msgBody = { model: "claude-sonnet-46", max_tokens: 64000, messages: [{ role: "user", content: "hi" }], fallbacks: "default" };
const bodies: string[] = [];
const run = async (r: Request, e = env) => { const res = await handle(r, e, fakeFetch); const t = await res.text(); bodies.push(t); return { res, t }; };

// A valid code streams through, with the owner's key upstream and the limits applied.
{
  seen = [];
  const { res, t } = await run(req("/api/claude/v1/messages", { key: "aqmcode:aqm-test1", body: msgBody, ip: "1.1.1.1" }));
  ok(res.status === 200 && t.includes("message_start"), `valid code streams through (${res.status})`);
  ok(res.headers.get("content-type") === "text/event-stream" && res.headers.get("cache-control") === "no-store", "content-type passed, no-store");
  const up = seen[0];
  ok(!!up && up.url === "https://ca-litellm-mint-eus2.orangeflower-5d81efa8.eastus2.azurecontainerapps.io/v1/messages", `upstream URL ${up?.url}`);
  const h = (up?.init.headers ?? {}) as Record<string, string>;
  ok(h["x-api-key"] === OWNER, "owner key sent upstream");
  ok(!JSON.stringify(h).includes("aqmcode") && !JSON.stringify(h).toLowerCase().includes("aqm-test1"), "the code is not forwarded");
  ok(!("origin" in h) && !("cookie" in h), "no other client headers forwarded");
  const sent = JSON.parse(String(up?.init.body));
  ok(sent.max_tokens === 16000 && !("fallbacks" in sent) && sent.model === "claude-sonnet-46", "max_tokens clamped, fallbacks dropped");
}
// The rewrite form (?path=) and the models list.
{
  seen = [];
  const { res } = await run(req("/api/claude?path=v1/models", { method: "GET", key: "aqmcode:OTHER-CODE", ip: "1.1.1.2" }));
  ok(res.status === 200 && seen[0]?.url.endsWith("/v1/models") && seen[0]?.init.method === "GET", "GET v1/models via ?path=");
}
// An Anthropic owner key goes to Anthropic.
{
  seen = [];
  await run(req("/api/claude/v1/messages", { key: "aqmcode:AQM-TEST1", body: msgBody, ip: "1.1.1.3" }), { ...env, OWNER_API_KEY: "sk-ant-TESTFAKE" });
  ok(seen[0]?.url === "https://api.anthropic.com/v1/messages", "sk-ant- owner key → api.anthropic.com");
}
// Refusals.
{
  seen = [];
  ok((await run(req("/api/claude/v1/messages", { key: "aqmcode:WRONG", body: msgBody }))).res.status === 401, "bad code 401");
  ok((await run(req("/api/claude/v1/messages", { key: OWNER, body: msgBody }))).res.status === 401, "a raw key instead of a code 401");
  ok((await run(req("/api/claude/v1/messages", { body: msgBody }))).res.status === 401, "no key 401");
  ok((await run(req("/api/claude/v1/messages", { key: "aqmcode:AQM-TEST1", body: msgBody }), {})).res.status === 503, "missing env 503");
  ok((await run(req("/api/claude/v1/messages", { key: "aqmcode:AQM-TEST1", body: msgBody }), { OWNER_API_KEY: OWNER })).res.status === 503, "missing codes 503");
  ok((await run(req("/api/claude/v1/complete", { key: "aqmcode:AQM-TEST1", body: msgBody }))).res.status === 404, "other path 404");
  ok((await run(req("/api/claude/v1/messages", { method: "GET", key: "aqmcode:AQM-TEST1" }))).res.status === 404, "GET messages 404");
  ok((await run(req("/api/claude/key/info", { method: "GET", key: "aqmcode:AQM-TEST1" }))).res.status === 404, "key/info 404");
  ok((await run(req("/api/claude/v1/messages", { key: "aqmcode:AQM-TEST1", body: msgBody, origin: "https://evil.example" }))).res.status === 403, "bad origin 403");
  ok((await run(req("/api/claude/v1/messages", { key: "aqmcode:AQM-TEST1", body: msgBody, origin: "http://localhost:3300", ip: "1.1.1.4" }))).res.status === 200, "localhost origin allowed");
  ok((await run(req("/api/claude/v1/messages", { key: "aqmcode:AQM-TEST1", body: msgBody, origin: "https://thinka-aqm-prep-abc123-thonkingcap.vercel.app", ip: "1.1.1.4" }))).res.status === 200, "preview origin allowed");
  ok((await run(req("/api/claude/v1/messages", { key: "aqmcode:AQM-TEST1", body: { ...msgBody, model: "gpt-4o" } }))).res.status === 400, "non-Claude model 400");
  ok((await run(req("/api/claude/v1/messages", { key: "aqmcode:AQM-TEST1", body: "not json" }))).res.status === 400, "bad JSON 400");
  ok((await run(req("/api/claude/v1/messages", { key: "aqmcode:AQM-TEST1", body: "x".repeat(4 * 1024 * 1024 + 10) }))).res.status === 413, "too large 413");
  ok(seen.length === 2, `only the two allowed requests reached upstream (${seen.length})`);
}
// Rate limit per IP.
{
  resetLimits();
  let last = 0;
  for (let i = 0; i < 61; i++) last = (await handle(req("/api/claude/v1/messages", { key: "aqmcode:AQM-TEST1", body: msgBody, ip: "9.9.9.9" }), env, fakeFetch)).status;
  ok(last === 429, `61st request in 10 minutes is 429 (${last})`);
  ok((await handle(req("/api/claude/v1/messages", { key: "aqmcode:AQM-TEST1", body: msgBody, ip: "8.8.8.8" }), env, fakeFetch)).status === 200, "another IP still allowed");
  ok((await handle(req("/api/claude/v1/messages", { key: "aqmcode:AQM-TEST1", body: msgBody, ip: "9.9.9.9" }), env, fakeFetch, Date.now() + 11 * 60 * 1000)).status === 200, "allowed again after the window");
}
// Upstream down.
{
  const down = (async () => { throw new Error(`boom ${OWNER}`); }) as typeof fetch;
  const res = await handle(req("/api/claude/v1/messages", { key: "aqmcode:AQM-TEST1", body: msgBody, ip: "7.7.7.7" }), env, down);
  const t = await res.text(); bodies.push(t);
  ok(res.status === 502, "upstream down 502");
}
ok(bodies.every((b) => !b.includes(OWNER) && !b.includes("TESTOWNERKEY")), "the owner key never appears in a response");
console.log(`${fails === 0 ? "PASS" : "FAILED"}: access-code proxy, ${fails} failures`);
if (fails) process.exit(1);
