// usage.ts: the rows it sends, with storage and fetch stubbed. Checks nothing key-like is ever sent.
const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) };
(globalThis as any).location = { hash: "#/area/ci" };
(globalThis as any).window = { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} };
(globalThis as any).CustomEvent = class { type: string; constructor(t: string) { this.type = t; } };
const sent: { url: string; init: RequestInit }[] = [];
(globalThis as any).fetch = (url: string, init: RequestInit) => { sent.push({ url, init }); return Promise.resolve(new Response(null, { status: 204 })); };

const u = await import("./usage.ts");
let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log("FAIL", m); } };

ok(!u.hasName(), "no name at first");
const id = u.visitorId();
ok(/^[0-9a-f-]{36}$/.test(id) && u.visitorId() === id, "stable visitor id");
u.setName("  Ada\u0007 Lovelace  ");
ok(u.getName() === "Ada Lovelace" && u.hasName(), "name stored, trimmed, control chars gone");
u.logClaude("tutor");
u.logKeyAdded();
ok(sent.length === 3, `3 rows sent (${sent.length})`);
const rows = sent.map((s) => JSON.parse(String(s.init.body)));
ok(rows[0].p_kind === "hello" && rows[0].p_name === "Ada Lovelace" && rows[0].p_visitor === id, "hello row");
ok(rows[1].p_kind === "claude" && rows[1].p_feature === "tutor" && rows[1].p_page === "area", "claude row");
ok(rows[2].p_kind === "key", "key row");
ok(sent.every((s) => s.url.endsWith("/rpc/log_event") && (s.init as any).keepalive === true && (s.init.headers as any).apikey.startsWith("sb_publishable_")), "endpoint and headers");
ok(rows.every((r) => Object.keys(r).every((k) => ["p_visitor", "p_kind", "p_name", "p_seconds", "p_feature", "p_page"].includes(k))), "only the allowed fields");
ok(!sent.some((s) => /sk-|x-api-key|authorization/i.test(String(s.init.body) + JSON.stringify(s.init.headers))), "nothing key-like");
Object.defineProperty(globalThis, "navigator", { value: { onLine: false }, configurable: true });
u.logClaude("mark");
ok(sent.length === 3, "nothing sent offline");
console.log(`${fails === 0 ? "PASS" : "FAILED"}: usage logging, ${fails} failures`);
if (fails) process.exit(1);
