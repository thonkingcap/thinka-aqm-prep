// Usage logs, so the site's author can see how many students it helps.
// Logged: a random visitor id, the name the student types, active minutes on the site, and a count of
// Claude requests (which feature, nothing else). Never the API key, anything derived from it, or answers.
// Rows go to a Supabase function that can only append (log_event); this key can't read anything back.
// Everything here is fire-and-forget: it never throws and never blocks the page.
import { useEffect, useState } from "react";

const ENDPOINT = "https://kxtdmgpecxlzyepshryw.supabase.co/rest/v1/rpc/log_event";
const PUBLISHABLE = "sb_publishable_fDz6DAgzrVmsxMp_THba5g_swF5jxXH";
const VISITOR_KEY = "aqm.visitor";
const NAME_KEY = "aqm.name";

export type ClaudeFeature = "tutor" | "mark" | "design" | "plan" | "verify";
type Kind = "hello" | "time" | "claude" | "key";
export type UsagePayload = { p_visitor: string; p_kind: Kind; p_name?: string; p_seconds?: number; p_feature?: ClaudeFeature; p_page?: string };

const store = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

function uuid(): string {
  try { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); } catch { /* fall through */ }
  const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${h()}${h()}-${h()}-4${h().slice(1)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${h().slice(1)}-${h()}${h()}${h()}`;
}

export function visitorId(): string {
  let id = store.get(VISITOR_KEY);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) { id = uuid(); store.set(VISITOR_KEY, id); }
  return id;
}

/** Logging is off in development unless localStorage "aqm.logdev" is set, and off when offline. */
function enabled(): boolean {
  const dev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;
  if (dev && !store.get("aqm.logdev")) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  return typeof fetch === "function";
}

const page = () => {
  try { return (location.hash.replace(/^#\/?/, "").split("/")[0] || "home").slice(0, 40); } catch { return undefined; }
};

/** Builds the row. Exported for the test. */
export function payload(kind: Kind, extra: Omit<UsagePayload, "p_visitor" | "p_kind"> = {}): UsagePayload {
  const name = getName();
  return { p_visitor: visitorId(), p_kind: kind, ...(name ? { p_name: name } : {}), p_page: page(), ...extra };
}

function send(body: UsagePayload) {
  if (!enabled()) return;
  try {
    fetch(ENDPOINT, {
      method: "POST",
      keepalive: true,
      headers: { apikey: PUBLISHABLE, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => { /* ignore */ });
  } catch { /* ignore */ }
}

// ---------- name ----------
export function getName(): string | null {
  const n = store.get(NAME_KEY)?.trim();
  return n ? n.slice(0, 60) : null;
}
export const hasName = () => !!getName();
export function setName(name: string) {
  const n = name.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 60);
  if (!n) return;
  store.set(NAME_KEY, n);
  send(payload("hello", { p_name: n }));
  try { window.dispatchEvent(new CustomEvent("aqm:name")); } catch { /* ignore */ }
}
/** True until the student has typed a name. Re-renders when they do. */
export function useNeedsName(): boolean {
  const [need, setNeed] = useState(() => !hasName());
  useEffect(() => {
    const on = () => setNeed(!hasName());
    window.addEventListener("aqm:name", on);
    window.addEventListener("storage", on);
    return () => { window.removeEventListener("aqm:name", on); window.removeEventListener("storage", on); };
  }, []);
  return need;
}

// ---------- events ----------
/** One row per request sent to Claude (the tutor's tool-loop follow-ups count as requests too). */
export function logClaude(feature: ClaudeFeature) { send(payload("claude", { p_feature: feature })); }
export function logKeyAdded() { send(payload("key")); }

// ---------- time on site ----------
const TICK = 15_000;          // sample every 15 s
const IDLE = 10 * 60_000;     // no input for 10 min: stop counting (a forgotten tab)
const FLUSH = 5 * 60;         // send a row every 5 active minutes
let started = false;

/** Counts time while the tab is visible and the student has touched it in the last 10 minutes. */
export function startUsageClock() {
  if (started || typeof window === "undefined") return;
  started = true;
  let pending = 0;               // active seconds not yet sent
  let last = Date.now();
  let lastInput = Date.now();
  const visible = () => document.visibilityState === "visible";
  let wasVisible = visible();       // visibility since the last sample, so the moment of hiding still counts

  const sample = () => {
    const now = Date.now();
    const dt = Math.min(now - last, TICK * 2); // a sleeping laptop doesn't count
    last = now;
    if (wasVisible && now - lastInput < IDLE) pending += dt / 1000;
    wasVisible = visible();
  };
  const flush = (min = 5) => {
    sample();
    const s = Math.min(3600, Math.round(pending));
    if (s < min) return;
    pending -= s;
    send(payload("time", { p_seconds: s }));
  };

  for (const ev of ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"]) {
    window.addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true });
  }
  setInterval(() => { sample(); if (pending >= FLUSH) flush(); }, TICK);
  document.addEventListener("visibilitychange", () => {
    if (visible()) { last = Date.now(); lastInput = Date.now(); wasVisible = true; } else flush();
  });
  window.addEventListener("pagehide", () => flush());
}
