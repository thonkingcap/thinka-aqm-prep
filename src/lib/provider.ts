// Which service a key belongs to, and which model it can use.
// Babson hands out LiteLLM gateway keys (sk- + 22 characters) that only work against Babson's gateway;
// keys made at platform.claude.com (sk-ant-…) go straight to Anthropic. Students without a key can
// enter an access code from Daniel: it is stored as "aqmcode:<CODE>" and sent only to this site's
// /api/claude function, which checks the code and uses Daniel's key on the server.
// Not every key can use every model (some Babson keys only get claude-sonnet-46), so the site asks the
// service which models the key has, picks the best, and remembers it per key on this device.

import { BASE } from "./base.ts";

export const BABSON_GATEWAY = "https://ca-litellm-mint-eus2.orangeflower-5d81efa8.eastus2.azurecontainerapps.io";

export type ProviderId = "babson" | "anthropic" | "code";
export const CODE_PREFIX = "aqmcode:";
/** Students without a key enter their Babson email instead; it is stored as "aqmemail:<email>". */
export const EMAIL_PREFIX = "aqmemail:";
export const BABSON_EMAIL = /^[a-z0-9._%+-]+@babson\.edu$/i;
export const isEmailKey = (k: string) => k.startsWith(EMAIL_PREFIX);
/** The default: everyone starts on Daniel's key, as "aqmuser:<this browser's visitor id>", capped at $10 per id. */
export const SHARED_PREFIX = "aqmuser:";
export const isSharedKey = (k: string) => k.startsWith(SHARED_PREFIX) || k.startsWith(EMAIL_PREFIX);
/** All of these go through this site's /api/claude, which uses Daniel's key. */
export const isCodeKey = (k: string) => k.startsWith(CODE_PREFIX) || isSharedKey(k);
export const emailOf = (k: string) => (isEmailKey(k) ? k.slice(EMAIL_PREFIX.length) : null);
export type Provider = {
  id: ProviderId;
  label: string;
  baseURL?: string;
  model: string;
  modelLabel: string;
};

export const PROVIDERS: Record<ProviderId, Provider> = {
  // Babson's gateway offers claude-sonnet-5 and claude-sonnet-46; Sonnet 5 is the newer one.
  babson: { id: "babson", label: "Babson's Claude gateway", baseURL: BABSON_GATEWAY, model: "claude-sonnet-5", modelLabel: "Claude Sonnet 5" },
  anthropic: { id: "anthropic", label: "Anthropic", model: "claude-sonnet-5-5", modelLabel: "Claude Sonnet 5.5" },
  code: { id: "code", label: "Daniel's shared access (this site's server)", baseURL: `${BASE}api/claude`, model: "claude-sonnet-5", modelLabel: "Claude Sonnet 5" },
};

// ---------- which model ----------
/** Best first. Anything else with "sonnet" in it, then any Claude model, comes after these. */
const PREFERRED = ["claude-sonnet-5-5", "claude-sonnet-5", "claude-sonnet-46", "claude-sonnet-4-6", "claude-sonnet-4-5", "claude-sonnet-45", "claude-sonnet-4"];
export function pickModel(ids: string[]): string | null {
  const have = ids.filter((id) => typeof id === "string");
  for (const p of PREFERRED) if (have.includes(p)) return p;
  for (const p of PREFERRED) { const hit = have.find((id) => id.startsWith(`${p}-`) || id.endsWith(`/${p}`)); if (hit) return hit; }
  return have.filter((id) => /sonnet/i.test(id)).sort().reverse()[0] ?? have.find((id) => /claude/i.test(id)) ?? null;
}
/** "claude-sonnet-46" → "Claude Sonnet 4.6", "claude-sonnet-5-5" → "Claude Sonnet 5.5". */
export function modelLabel(id: string): string {
  const parts = id.replace(/^.*\//, "").replace(/-\d{8}$/, "").split("-");
  const words = parts.filter((x) => !/^\d+$/.test(x)).map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  let nums = parts.filter((x) => /^\d+$/.test(x));
  if (nums.length === 1 && nums[0].length === 2) nums = [nums[0][0], nums[0][1]];
  return [...words, nums.join(".")].filter(Boolean).join(" ");
}
const MODELS_KEY = "aqm.models";
/** A short, non-reversible tag for a key, so the chosen model can be remembered per key. */
function keyTag(key: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
const memory = new Map<string, string>();
function readModels(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(MODELS_KEY) ?? "{}") as Record<string, string>; } catch { return {}; }
}
export function rememberModel(key: string, model: string) {
  memory.set(keyTag(key), model);
  try { localStorage.setItem(MODELS_KEY, JSON.stringify({ ...readModels(), [keyTag(key)]: model })); } catch { /* ignore */ }
}
function rememberedModel(key: string): string | undefined {
  return memory.get(keyTag(key)) ?? readModels()[keyTag(key)];
}

export function providerFor(key: string): Provider {
  const base = isCodeKey(key) ? PROVIDERS.code : key.startsWith("sk-ant-") ? PROVIDERS.anthropic : PROVIDERS.babson;
  const model = rememberedModel(key);
  return model ? { ...base, model, modelLabel: modelLabel(model) } : base;
}
/** The key as sent to the service: an access code goes as "aqmcode:<CODE>" to this site only. */
export const isCode = (raw: string) => !/^sk-/.test(raw.trim()) && /^[A-Za-z0-9-]{4,40}$/.test(raw.trim());

/** Asks the service which models this key can use, picks the best and remembers it. Throws if it can't tell. */
export async function resolveModel(key: string): Promise<string> {
  const p = providerFor(key);
  const url = p.id === "anthropic" ? "https://api.anthropic.com/v1/models?limit=100" : `${p.baseURL}/v1/models`;
  const headers: Record<string, string> = { "x-api-key": key };
  if (p.id === "anthropic") { headers["anthropic-version"] = "2023-06-01"; headers["anthropic-dangerous-direct-browser-access"] = "true"; }
  const res = await fetch(url, { headers });
  if (!res.ok) throw Object.assign(new Error(`models ${res.status}`), { status: res.status });
  const data = (await res.json().catch(() => ({}))) as { data?: { id: string }[] };
  const ids = (data.data ?? []).map((m) => m.id);
  const pick = pickModel(ids);
  if (!pick) throw Object.assign(new Error(`This key can't use any Claude model. It can use: ${ids.join(", ") || "nothing"}.`), { status: 404 });
  rememberModel(key, pick);
  return pick;
}

/** Real spend and budget, from the Babson gateway's /key/info. Null when unavailable. */
export type RemoteBalance = { spent: number; budget: number | null; at: number };

export async function fetchRemoteBalance(key: string): Promise<RemoteBalance | null> {
  const p = providerFor(key);
  if (p.id !== "babson") return null; // access codes: Daniel's key, not the student's to track
  try {
    const res = await fetch(`${p.baseURL}/key/info`, { headers: { "x-api-key": key } });
    if (!res.ok) return null;
    const data = (await res.json()) as { info?: { spend?: number; max_budget?: number | null } };
    const spent = Number(data.info?.spend);
    if (!Number.isFinite(spent)) return null;
    const budget = data.info?.max_budget == null ? null : Number(data.info.max_budget);
    return { spent, budget: Number.isFinite(budget) ? budget : null, at: Date.now() };
  } catch {
    return null;
  }
}
