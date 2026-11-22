// Offline support. Generated into dist/aqm/sw.js (served at /aqm/sw.js) at build time with the list of every file in the build,
// so after one visit the whole site (notes, workbooks, marking) works with no internet.
// Only same-origin GETs under /aqm are handled: Claude API calls (including /aqm/api/) and the feedback form always go to the network.
// The site lives under /aqm (thonkingcap.dev/aqm proxies to it), and this worker's scope is /aqm.
const VERSION = "__VERSION__";
const FILES = __FILES__;
/** The page (/aqm, no slash). Saved under this one key and served for every navigation when offline. */
const PAGE = __SCOPE__;
// "aqm-v2-": a new prefix, so the kill switch for the old root worker (src/sw-kill.js), which deletes
// "aqm-prep-" caches, never touches this one. Activating here also clears those old caches.
const CACHE = `aqm-v2-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => (k.startsWith("aqm-v2-") || k.startsWith("aqm-prep-")) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Only this site's own files. On thonkingcap.dev everything outside /aqm belongs to the hub.
  if (url.pathname !== PAGE && !url.pathname.startsWith(`${PAGE}/`)) return;
  // The shared-access proxy (/aqm/api/claude) is live data: never cache it.
  if (url.pathname.startsWith(`${PAGE}/api/`)) return;
  // Pages: try the network briefly so updates arrive, fall back to the saved copy offline.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(() => no(new Error("slow")), 4000))]);
        // Only a direct answer is saved: /aqm/ on thonkingcap.dev comes back as a redirect to /aqm.
        if (res.ok && !res.redirected) cache.put(PAGE, res.clone());
        return res;
      } catch {
        return (await cache.match(PAGE, { ignoreVary: true })) || Response.error();
      }
    })());
    return;
  }
  // Built files have content hashes in their names, so the saved copy is always right.
  event.respondWith((async () => {
    // ignoreVary: script and style tags send an Origin header, and hosts may answer with "Vary: Origin".
    const hit = await caches.match(req, { ignoreVary: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && res.type === "basic") (await caches.open(CACHE)).put(req, res.clone());
    return res;
  })());
});
