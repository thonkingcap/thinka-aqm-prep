// The error log (api/_errors.ts): grouping, scrubbing keys and sign-in values, storing through Supabase with the
// server key, diagnosing only new groups, and refusing what isn't a report from the site. Fake upstreams and keys.
import { handleErrors, resetErrorLimits, fingerprint, foldWhere, normalizeMessage, scrubText } from "../../api/_errors.ts";
import { isNoise } from "./errorReport.ts";

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log("FAIL", m); } };
const OWNER = "sk-TESTOWNERKEY000000000000";
const KEY = "test-errors-key-123456";
const env = { OWNER_API_KEY: OWNER, AQM_ERRORS_KEY: KEY };
const SITE = "https://thonkingcap.dev";
const VIS = "0b6e2f9c-1d2e-4f3a-9b8c-7d6e5f4a3b2c";

type Call = { url: string; body: Record<string, unknown> | null };
function fake(diagnose: boolean) {
  const calls: Call[] = [];
  const f = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (u.endsWith("/aqm_error_add")) return new Response(JSON.stringify({ diagnose, count: 1 }), { status: 200 });
    if (u.endsWith("/aqm_error_diagnose")) return new Response(null, { status: 204 });
    if (u.endsWith("/v1/models")) return new Response(JSON.stringify({ data: [{ id: "claude-haiku-5" }, { id: "claude-sonnet-5" }] }), { status: 200 });
    if (u.endsWith("/v1/messages")) return new Response(JSON.stringify({ content: [{ type: "text", text: "What happened\nIt broke." }] }), { status: 200 });
    return new Response("nope", { status: 500 });
  }) as typeof fetch;
  return { f, calls };
}
const req = (body: unknown, origin: string | null = SITE, ip = "1.1.1.1") =>
  new Request("https://thinka-aqm-prep.vercel.app/api/errors", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip, ...(origin ? { origin } : {}) }, body: typeof body === "string" ? body : JSON.stringify(body) });

// Grouping.
ok(normalizeMessage("Cannot read 'x' of undefined at 12:34") === normalizeMessage("Cannot read 'x' of undefined at 99:1"), "numbers fold");
ok(foldWhere("#/lesson/17/practice") === "#/lesson/:n/practice", "lesson numbers fold");
ok((await fingerprint("ui", "#/lesson/3", "Failed 2")) === (await fingerprint("ui", "#/lesson/9", "Failed 5")), "same error, same group");
ok((await fingerprint("ui", "#/tutor", "Failed")) !== (await fingerprint("client", "#/tutor", "Failed")), "kind splits groups");

// Secrets never stored.
const s = scrubText(`key sk-ant-abcdefghijklmnop and aqmuser:${VIS} and aqmcode:AQM-QHBA9V and Bearer abcdefghijk1234 and x-api-key: zzzzzzzz`);
ok(!/sk-ant|aqmuser:|AQM-QHBA9V|abcdefghijk1234|zzzzzzzz/.test(s), `scrubbed: ${s}`);
ok(scrubText(`oops ${OWNER.slice(0, 10)}MYSECRET`, ["MYSECRET"]).includes("[redacted]"), "env secret values removed");

// A report: stored with the server key, diagnosed once, keys scrubbed out of everything.
{
  resetErrorLimits();
  const { f, calls } = fake(true);
  const res = await handleErrors(req({ kind: "ui", where: "#/tutor", message: `Claude said no for key ${OWNER}`, visitor: VIS, name: "Sam", stack: "Error\n at x", context: { apiKey: "sk-secret-aaaaaaaa", breadcrumbs: [{ at: "1", what: "click \"Send\"" }] } }), env, f);
  ok(res.status === 204, `stored: ${res.status}`);
  const add = calls.find((c) => c.url.endsWith("/aqm_error_add"));
  ok(!!add && add.body?.p_key === KEY && add.body?.p_kind === "ui" && add.body?.p_visitor === VIS && add.body?.p_name === "Sam", "add call shape");
  const all = JSON.stringify(calls.map((c) => ({ ...c.body, p_key: undefined })));
  ok(!all.includes(OWNER) && !all.includes("sk-secret"), "owner key and context keys never sent to the database");
  ok(!JSON.stringify(add?.body?.p_context).includes("apiKey"), "secret-looking context keys dropped");
  const msg = calls.find((c) => c.url.endsWith("/v1/messages"));
  ok(msg?.body?.model === "claude-sonnet-5", `picks a sonnet the key has: ${msg?.body?.model}`);
  ok(!JSON.stringify(msg?.body).includes(OWNER), "owner key not in the prompt");
  ok(calls.some((c) => c.url.endsWith("/aqm_error_diagnose") && c.body?.p_diagnosis === "What happened\nIt broke."), "diagnosis saved");
}
// A known group: no Claude call.
{
  resetErrorLimits();
  const { f, calls } = fake(false);
  await handleErrors(req({ kind: "client", where: "#/home", message: "x is not defined" }), env, f);
  ok(!calls.some((c) => /\/v1\/(messages|models)$/.test(c.url)), "no diagnosis for a group already diagnosed");
  ok(calls.find((c) => c.url.endsWith("/aqm_error_add"))?.body?.p_visitor === null, "a bad visitor id is dropped");
}
// Refusals.
{
  resetErrorLimits();
  const { f, calls } = fake(true);
  ok((await handleErrors(req({ message: "x" }, "https://evil.example"), env, f)).status === 403, "other sites refused");
  ok((await handleErrors(req({ message: "x" }, null), env, f)).status === 403, "no origin refused");
  ok((await handleErrors(req("not json"), env, f)).status === 400, "bad JSON refused");
  ok((await handleErrors(req("x".repeat(40000)), env, f)).status === 413, "too big refused");
  ok((await handleErrors(new Request("https://x/api/errors", { method: "GET", headers: { origin: SITE } }), env, f)).status === 405, "GET refused");
  ok(calls.length === 0, "nothing stored for refusals");
  let last = 0;
  for (let i = 0; i < 31; i++) last = (await handleErrors(req({ message: `m${i}` }, SITE, "9.9.9.9"), env, f)).status;
  ok(last === 429, "rate limited per IP");
}
// Not set up (local): accepted, nothing stored.
{
  resetErrorLimits();
  const { f, calls } = fake(true);
  ok((await handleErrors(req({ message: "x" }), { OWNER_API_KEY: OWNER }, f)).status === 204 && calls.length === 0, "no key: logged only");
}
// Browser noise.
ok(isNoise("ResizeObserver loop completed with undelivered notifications."), "ResizeObserver is noise");
ok(isNoise("boom", "at chrome-extension://abc/x.js:1"), "extensions are noise");
ok(!isNoise("Cannot read properties of undefined"), "real errors aren't noise");

if (fails) { console.log(`${fails} failing`); process.exit(1); }
console.log("errors: all passed");
