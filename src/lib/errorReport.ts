// Error reports (Nov 26): every error a visitor runs into is sent to this site's /api/errors (api/_errors.ts),
// which stores it in Supabase and has Claude diagnose new ones for Daniel's thonkingcap.dev/admin.
// Caught here: uncaught errors, failed promises, React crashes (ErrorScreen in App.tsx), and any error message
// a page shows (an element with role="alert" appearing; mark expected ones, like a wrong access code, with
// data-noreport). Each report carries the last few page changes and clicks, never typed text.
// Production builds only; never throws.
import { BASE } from "./base.ts";
import { getName, visitorId } from "./usage.ts";

export type ErrorKind = "client" | "ui" | "react";

const MAX_PER_LOAD = 15;
const crumbs: { at: string; what: string }[] = [];
const sent = new Set<string>();
let count = 0;

/** Browser noise that isn't the site's fault. */
export function isNoise(message: string, stack = ""): boolean {
  return /ResizeObserver loop|^Script error\.?$|Non-Error promise rejection captured|AbortError|The user aborted a request/i.test(message)
    || /(chrome|moz|safari(-web)?)-extension:\/\//.test(stack);
}

export function crumb(what: string) {
  crumbs.push({ at: new Date().toISOString().slice(11, 19), what: what.slice(0, 120) });
  if (crumbs.length > 15) crumbs.shift();
}

/** Sends one report. Repeats of the same message on the same page are sent once per page load. */
export function reportError(kind: ErrorKind, message: string, extra: { stack?: string; context?: Record<string, unknown> } = {}) {
  try {
    if (!import.meta.env?.PROD) { console.warn(`[report:${kind}]`, message); return; }
    if (!message || isNoise(message, extra.stack) || count >= MAX_PER_LOAD) return;
    const where = location.hash || "#/home";
    const id = `${kind}|${where}|${message}`;
    if (sent.has(id)) return;
    sent.add(id);
    count++;
    const body = JSON.stringify({
      kind, where, message: message.slice(0, 2000), stack: extra.stack?.slice(0, 4000),
      visitor: visitorId(), name: getName(),
      context: { ...extra.context, breadcrumbs: [...crumbs], ua: navigator.userAgent, online: navigator.onLine, viewport: `${innerWidth}x${innerHeight}` },
    });
    void fetch(`${BASE}api/errors`, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: body.length < 60000 }).catch(() => {});
  } catch { /* reporting must never become the error */ }
}

const fromError = (e: unknown): { message: string; stack?: string } =>
  e instanceof Error ? { message: `${e.name && e.name !== "Error" ? `${e.name}: ` : ""}${e.message}`, stack: e.stack } : { message: typeof e === "string" ? e : (() => { try { return JSON.stringify(e); } catch { return String(e); } })() };

export function reportCaught(kind: ErrorKind, e: unknown, context?: Record<string, unknown>) {
  const { message, stack } = fromError(e);
  reportError(kind, message, { stack, context });
}

/** Text of what was clicked: a button's or link's label, never an input's value. */
function label(el: Element | null): string | null {
  const t = el?.closest("button, a, [role=button], [role=tab], summary");
  if (!t) return null;
  const text = (t.getAttribute("aria-label") || t.textContent || "").replace(/\s+/g, " ").trim();
  return text ? `click "${text.slice(0, 60)}"` : null;
}

let installed = false;
export function installErrorReporting() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  crumb(`open ${location.hash || "#/home"}`);
  window.addEventListener("hashchange", () => crumb(`go ${location.hash}`));
  document.addEventListener("click", (e) => { const l = label(e.target as Element); if (l) crumb(l); }, { capture: true, passive: true });
  window.addEventListener("error", (e) => {
    if (e.error || e.message) reportError("client", e.error ? fromError(e.error).message : e.message, { stack: e.error instanceof Error ? e.error.stack : undefined, context: { source: e.filename, line: e.lineno, col: e.colno } });
  });
  window.addEventListener("unhandledrejection", (e) => reportCaught("client", e.reason, { promise: true }));

  // Error messages a page shows: role="alert" elements as they appear or change text.
  const seen = new WeakMap<Element, string>();
  const check = (el: Element) => {
    if (el.closest("[data-noreport]")) return;
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text || seen.get(el) === text) return;
    seen.set(el, text);
    reportError("ui", text.slice(0, 500));
  };
  const scan = (root: Node) => {
    if (!(root instanceof Element)) { if (root.parentElement?.closest("[role=alert]")) check(root.parentElement.closest("[role=alert]")!); return; }
    if (root.matches("[role=alert]")) check(root);
    root.querySelectorAll("[role=alert]").forEach(check);
    const up = root.closest("[role=alert]");
    if (up && up !== root) check(up);
  };
  new MutationObserver((list) => { for (const m of list) { if (m.type === "characterData") scan(m.target); else m.addedNodes.forEach(scan); } })
    .observe(document.body, { childList: true, subtree: true, characterData: true });
}
