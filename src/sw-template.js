// Offline support. Generated into dist/sw.js at build time with the list of every file in the build,
// so after one visit the whole site (notes, workbooks, marking) works with no internet.
// Only same-origin GETs are handled: Claude API calls (including /api/) and the feedback form always go to the network.
const VERSION = "__VERSION__";
const FILES = __FILES__;
const CACHE = `aqm-prep-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("aqm-prep-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // The access-code proxy (/api/claude) is live data: never cache it.
  if (url.pathname.startsWith("/api/")) return;
  // Pages: try the network briefly so updates arrive, fall back to the saved copy offline.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(() => no(new Error("slow")), 4000))]);
        if (res.ok) cache.put("/index.html", res.clone());
        return res;
      } catch {
        return (await cache.match("/index.html", { ignoreVary: true })) || (await cache.match("/", { ignoreVary: true })) || Response.error();
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
