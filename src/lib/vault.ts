// Where the student's API key lives, and how it's protected.
//
// - The key is never stored in plain text. It's encrypted with AES-256-GCM using a key the browser
//   generates as *non-extractable*: page code can ask the browser to decrypt with it, but nothing
//   (not this page, not devtools, not a copied browser profile on another machine) can read the
//   encryption key's bytes. The encrypted key sits in localStorage; the encryption key in IndexedDB.
// - "Shared computer" keeps the encrypted key in this tab only (sessionStorage): closing the tab forgets it.
// - A remembered key is forgotten automatically after IDLE_DAYS without a visit.
// - "Remove key" deletes the encrypted key *and* the encryption key, so nothing left behind can be decrypted.
// - The key is only ever sent to Babson's Claude gateway or api.anthropic.com (enforced by the
//   site's Content-Security-Policy), never to a Thinka server: there isn't one.
//
// Honest limit: a page can't protect a key from malware or a malicious browser extension on the
// same device, since those can act as the page itself. Encryption protects the key at rest.

const ENC = "aqm.key.enc";           // { v, iv, ct, ts } in localStorage, or sessionStorage when shared
const PLAIN = "aqm.key";             // older versions stored the key in plain text: migrated, then deleted
const OLD_SESSION_KEY = "aqm.key.session";
const OLD_VAULT_KEY = "aqm.key.vault";
export const IDLE_DAYS = 14;
const DAY = 86_400_000;

const DB = "thinka-vault";
const STORE = "wrap";
const WRAP_ID = "aes-gcm";

type Blob1 = { v: 1; iv: string; ct: string; ts: number };

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function safeGet(store: Storage, k: string): string | null {
  try { return store.getItem(k); } catch { return null; }
}
function safeSet(store: Storage, k: string, v: string): boolean {
  try { store.setItem(k, v); return true; } catch { return false; }
}
function safeDel(store: Storage, k: string) {
  try { store.removeItem(k); } catch { /* ignore */ }
}

// ---------------------------------------------------------------- the non-extractable wrapping key
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req.result as T); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}
async function wrappingKey(create: boolean): Promise<CryptoKey | null> {
  const existing = await idb<CryptoKey | undefined>("readonly", (s) => s.get(WRAP_ID));
  if (existing || !create) return existing ?? null;
  const k = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await idb("readwrite", (s) => s.put(k, WRAP_ID));
  return k;
}
async function dropWrappingKey() {
  try { await idb("readwrite", (s) => s.delete(WRAP_ID)); } catch { /* ignore */ }
}

// The additional data ties a ciphertext to this site and format, so it can't be replayed elsewhere.
const AAD = new TextEncoder().encode(`thinka-aqm-prep:key:v1:${location.origin}`);

async function encrypt(key: string): Promise<Blob1> {
  const wk = await wrappingKey(true);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: AAD }, wk!, new TextEncoder().encode(key));
  return { v: 1, iv: b64(iv), ct: b64(ct), ts: Date.now() };
}
async function decrypt(b: Blob1): Promise<string | null> {
  const wk = await wrappingKey(false);
  if (!wk) return null;
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(b.iv), additionalData: AAD }, wk, unb64(b.ct));
    return new TextDecoder().decode(pt);
  } catch { return null; }
}

// ---------------------------------------------------------------- public API
let memoryKey: string | null = null;   // this tab's copy while the page is open

function readBlob(): { blob: Blob1; shared: boolean } | null {
  for (const [store, shared] of [[sessionStorage, true], [localStorage, false]] as const) {
    const raw = safeGet(store, ENC);
    if (!raw) continue;
    try {
      const b = JSON.parse(raw) as Blob1;
      if (b.v === 1 && b.iv && b.ct) return { blob: b, shared };
    } catch { /* corrupt: fall through and clear */ }
    safeDel(store, ENC);
  }
  return null;
}

/** Loads the remembered key, if any. Forgets it if it's been idle too long or can't be decrypted. */
export async function loadKey(): Promise<string | null> {
  if (memoryKey) return memoryKey;
  safeDel(sessionStorage, OLD_SESSION_KEY);
  safeDel(localStorage, OLD_VAULT_KEY);
  try {
    // Migrate a plain-text key from an earlier version, then delete the plain text.
    const plain = safeGet(localStorage, PLAIN);
    if (plain) {
      safeDel(localStorage, PLAIN);
      if (!looksLikeKey(plain)) { await storeKey(plain, { shared: false }); return plain; }
    }
    const found = readBlob();
    if (!found) return null;
    if (!found.shared && Date.now() - found.blob.ts > IDLE_DAYS * DAY) { await removeKey(); return null; }
    const key = await decrypt(found.blob);
    if (!key || looksLikeKey(key)) { await removeKey(); return null; }
    memoryKey = key;
    // A visit counts as use: push the idle timer back.
    safeSet(found.shared ? sessionStorage : localStorage, ENC, JSON.stringify({ ...found.blob, ts: Date.now() }));
    return key;
  } catch {
    return null; // no IndexedDB / WebCrypto (some private windows): the key lives in memory only
  }
}

/** Remembers the key, encrypted. shared: keep it in this tab only. */
export async function storeKey(key: string, { shared }: { shared: boolean }): Promise<void> {
  memoryKey = key;
  safeDel(localStorage, PLAIN);
  safeDel(localStorage, ENC);
  safeDel(sessionStorage, ENC);
  try {
    const blob = JSON.stringify(await encrypt(key));
    safeSet(shared ? sessionStorage : localStorage, ENC, blob);
  } catch { /* no IndexedDB / WebCrypto: memory only, the key is asked for again next visit */ }
}

/** Deletes the key everywhere, and the encryption key with it. */
export async function removeKey(): Promise<void> {
  memoryKey = null;
  safeDel(localStorage, PLAIN);
  safeDel(localStorage, ENC);
  safeDel(sessionStorage, ENC);
  await dropWrappingKey();
}

export function isShared(): boolean {
  return !!safeGet(sessionStorage, ENC);
}

/** Finds anything that looks like an API key in free text (feedback, chat), so it can be blocked. */
export const KEY_IN_TEXT = /\bsk-(ant-)?[A-Za-z0-9_-]{16,}/;

export function looksLikeKey(k: string): string | null {
  const key = k.trim();
  if (!key) return "Paste your API key";
  if (key.length > 300) return "That's too long to be an API key. Copy just the key";
  if (/\s/.test(key)) return "The key has a space or line break in it. Copy just the key";
  if (key.startsWith("sk-ant-admin")) return "That is an Admin key. Use a regular API key: it can only make requests, not manage your account";
  if (key.startsWith("sk-ant-")) return key.length < 40 ? "That key looks too short. Copy the whole key" : null;
  // Babson's gateway keys: sk- followed by about 22 letters and digits.
  if (!/^sk-[A-Za-z0-9_-]{16,}$/.test(key)) return "Babson keys start with sk- followed by letters and numbers. Copy it again from Babson's email";
  return null;
}

export function mask(key: string): string {
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

/** Short, non-reversible fingerprint so spend can be tracked per key on a shared computer. */
export async function fingerprint(key: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return b64(h).replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
}
