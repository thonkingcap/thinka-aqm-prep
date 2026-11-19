// usage.ts: the rows it sends, with storage and fetch stubbed. Checks nothing key-like is ever sent.
const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) };
(globalThis as any).location = { hash: "#/area/ci" };
(globalThis as any).window = { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} };
(globalThis as any).CustomEvent = class { type: string; constructor(t: string) { this.type = t; } };
const sent: { url: string; init: RequestInit }[] = [];
let ideaReply = "true";
(globalThis as any).fetch = (url: string, init: RequestInit) => {
  sent.push({ url, init });
  return Promise.resolve(url.endsWith("/rpc/suggest_idea") ? new Response(ideaReply, { status: 200 }) : new Response(null, { status: 204 }));
};

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
// 👍/👎
sent.length = 0;
u.logRating("k3x9a:4", 1);
u.logRating("k3x9a:4", -1, "confusing");
u.logRating("k3x9a:6", 1, "wrong");          // a reason only goes with 👎
u.logRating("k3x9a:6", 0);                   // taken back
u.logRating("not a ref", 1);                 // ignored
const rr = sent.map((s) => JSON.parse(String(s.init.body)));
ok(rr.length === 4, `4 rating rows (${rr.length})`);
ok(rr.every((r) => r.p_kind === "rate" && r.p_ref.startsWith("k3x9a:")), "rate rows with refs");
ok(rr[0].p_rating === 1 && !("p_detail" in rr[0]), "👍 row");
ok(rr[1].p_rating === -1 && rr[1].p_detail === "confusing", "👎 row with a reason");
ok(!("p_detail" in rr[2]) && rr[3].p_rating === 0, "no reason on 👍, 0 for taken back");
ok(rr.every((r) => Object.keys(r).every((k) => ["p_visitor", "p_kind", "p_name", "p_page", "p_rating", "p_ref", "p_detail"].includes(k))), "rating rows: only the allowed fields");

// Ideas
sent.length = 0;
await u.sendIdea("  Flashcards for the Excel functions  ", "prompt");
const idea = JSON.parse(String(sent[0]?.init.body));
ok(sent.length === 1 && sent[0].url.endsWith("/rpc/suggest_idea"), "idea goes to suggest_idea");
ok(idea.p_body === "Flashcards for the Excel functions" && idea.p_source === "prompt" && idea.p_visitor === id && idea.p_name === "Ada Lovelace", "idea row");
let threw = "";
try { await u.sendIdea("hi", "button"); } catch (e) { threw = String(e); }
ok(/few more words/.test(threw) && sent.length === 1, "too-short idea refused before sending");
ideaReply = "false";
threw = "";
try { await u.sendIdea("Another idea", "button"); } catch (e) { threw = String(e); }
ok(/a lot of ideas/.test(threw), "rate-limited idea reported");
ok(u.activeSeconds() === 0, "active seconds start at 0");

Object.defineProperty(globalThis, "navigator", { value: { onLine: false }, configurable: true });
u.logClaude("mark");
const before = sent.length;
u.logClaude("mark");
u.logRating("k3x9a:8", 1);
ok(sent.length === before, "nothing sent offline");
threw = "";
try { await u.sendIdea("Offline idea", "button"); } catch (e) { threw = String(e); }
ok(/offline/.test(threw), "offline idea refused");
console.log(`${fails === 0 ? "PASS" : "FAILED"}: usage logging, ${fails} failures`);
if (fails) process.exit(1);
