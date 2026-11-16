// The access-code proxy (api/_proxy.ts): codes checked, the owner's key swapped in server-side and
// never echoed, only the two Claude routes allowed, limits enforced. Uses a fake upstream and a fake key.
import { handle, resetLimits, CAP_MESSAGE, costOf } from "../../api/_proxy.ts";

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
// The Claude SDK sends the code as "Authorization: Bearer …" (this is what broke chat on Nov 16).
{
  seen = [];
  const r = new Request(`${SITE}/api/claude/v1/messages`, { method: "POST", headers: { authorization: "Bearer aqmcode:AQM-TEST1", "content-type": "application/json", origin: SITE, "x-forwarded-for": "6.6.6.6", "anthropic-version": "2026-10-21" }, body: JSON.stringify(msgBody) });
  const { res } = await run(r);
  ok(res.status === 200, `code in Authorization: Bearer accepted (${res.status})`);
  const h = (seen[0]?.init.headers ?? {}) as Record<string, string>;
  ok(h["x-api-key"] === OWNER && !Object.keys(h).some((k) => k.toLowerCase() === "authorization"), "Bearer code not forwarded; owner key sent");
  ok((await run(new Request(`${SITE}/api/claude/v1/messages`, { method: "POST", headers: { authorization: "Bearer aqmcode:WRONG", "content-type": "application/json", origin: SITE }, body: JSON.stringify(msgBody) }))).res.status === 401, "wrong Bearer code refused");
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
// Babson-email shared access: spend checked before, charged after, capped at $10.
{
  resetLimits();
  const SECRET = "test-proxy-secret-0123456789abcdef0123456789ab";
  const envE = { ...env, PROXY_SECRET: SECRET };
  let spent = 3.2;
  const rpcs: { fn: string; body: Record<string, unknown> }[] = [];
  let upstreamCalls = 0;
  const sse = [
    'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":1000,"cache_creation_input_tokens":2000,"cache_read_input_tokens":40000,"output_tokens":1}}}\n\n',
    'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n',
    'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":500}}\n\n',
    'event: message_stop\ndata: {"type":"message_stop"}\n\n',
  ];
  const fake = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/rpc/")) {
      const fn = u.split("/rpc/")[1];
      const body = JSON.parse(String(init?.body));
      rpcs.push({ fn, body });
      if (fn === "proxy_spent") return new Response(String(spent), { status: 200 });
      spent += Number(body.p_cost); return new Response(String(spent), { status: 200 });
    }
    upstreamCalls++;
    // Split the stream mid-line to check the parser stitches chunks back together.
    const all = new TextEncoder().encode(sse.join(""));
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(all.slice(0, 37)); c.enqueue(all.slice(37, 300)); c.enqueue(all.slice(300)); c.close(); } });
    return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" } });
  }) as typeof fetch;
  const emailReq = (email: string, how: "x" | "bearer" = "x") => new Request(`${SITE}/api/claude/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: SITE, "x-forwarded-for": "5.5.5.5", ...(how === "x" ? { "x-api-key": `aqmemail:${email}` } : { authorization: `Bearer aqmemail:${email}` }) },
    body: JSON.stringify({ ...msgBody, stream: true }),
  });

  const res = await handle(emailReq("Student.One@Babson.edu", "bearer"), envE, fake);
  const text = await res.text(); bodies.push(text);
  ok(res.status === 200 && text === sse.join(""), `email user under the cap streams through unchanged (${res.status})`);
  const charge = rpcs.find((r) => r.fn === "proxy_charge");
  const want = costOf({ input_tokens: 1000, cache_creation_input_tokens: 2000, cache_read_input_tokens: 40000, output_tokens: 500 });
  ok(rpcs[0]?.fn === "proxy_spent" && rpcs[0].body.p_email === "student.one@babson.edu", "spend checked first, email lowercased");
  ok(!!charge && Math.abs(Number(charge.body.p_cost) - want) < 1e-9 && Math.abs(want - 0.02) < 1e-9, `charged the right cost (${charge?.body.p_cost} vs ${want})`);
  ok(charge?.body.p_tokens_in === 43000 && charge?.body.p_tokens_out === 500 && charge?.body.p_secret === SECRET, "tokens and secret sent to the charge");

  spent = 10; upstreamCalls = 0;
  const capped = await handle(emailReq("student.one@babson.edu"), envE, fake);
  const capText = await capped.text(); bodies.push(capText);
  ok(capped.status === 402 && JSON.parse(capText).error.type === "billing_error" && JSON.parse(capText).error.message === CAP_MESSAGE && upstreamCalls === 0, `at the cap: 402, upstream never called (${capped.status})`);
  ok((await handle(emailReq("student.one@babson.edu"), { ...envE, SHARED_LIMIT_USD: "25" }, fake)).status === 200, "SHARED_LIMIT_USD raises the cap");

  const bad = await handle(emailReq("someone@gmail.com"), envE, fake);
  bodies.push(await bad.text());
  ok(bad.status === 401, `non-Babson email refused (${bad.status})`);
  const noSecret = await handle(emailReq("student.one@babson.edu"), env, fake);
  bodies.push(await noSecret.text());
  ok(noSecret.status === 503, `no PROXY_SECRET: email access off (${noSecret.status})`);
  const failing = (async (url: string | URL | Request) => { if (String(url).includes("/rpc/")) return new Response("nope", { status: 500 }); upstreamCalls++; return new Response("{}"); }) as typeof fetch;
  upstreamCalls = 0;
  const down = await handle(emailReq("student.one@babson.edu"), envE, failing);
  bodies.push(await down.text());
  ok(down.status === 503 && upstreamCalls === 0, `spend check down: refused, not forwarded (${down.status})`);
  // Non-streamed replies are charged too; models list is free.
  rpcs.length = 0; spent = 0;
  const jsonFake = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes("/rpc/")) { const b = JSON.parse(String(init?.body)); rpcs.push({ fn: String(url).split("/rpc/")[1], body: b }); return new Response("0"); }
    return new Response(JSON.stringify({ content: [], usage: { input_tokens: 500000, output_tokens: 0 } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const nr = await handle(new Request(`${SITE}/api/claude/v1/messages`, { method: "POST", headers: { "content-type": "application/json", "x-api-key": "aqmemail:student.two@babson.edu" }, body: JSON.stringify(msgBody) }), envE, jsonFake);
  bodies.push(await nr.text());
  ok(nr.status === 200 && Math.abs(Number(rpcs.find((r) => r.fn === "proxy_charge")?.body.p_cost) - 1) < 1e-9, "non-streamed reply charged ($1 for 500k input tokens)");
  rpcs.length = 0;
  const models = await handle(new Request(`${SITE}/api/claude/v1/models`, { method: "GET", headers: { "x-api-key": "aqmemail:student.two@babson.edu" } }), envE, jsonFake);
  bodies.push(await models.text());
  ok(models.status === 200 && rpcs.length === 0, "models list is free, no spend calls");
  ok(bodies.every((b) => !b.includes(SECRET)), "the proxy secret never appears in a response");
}
ok(bodies.every((b) => !b.includes(OWNER) && !b.includes("TESTOWNERKEY")), "the owner key never appears in a response");
console.log(`${fails === 0 ? "PASS" : "FAILED"}: access-code proxy, ${fails} failures`);
if (fails) process.exit(1);
