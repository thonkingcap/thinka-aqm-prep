// Kill switch for the old service worker. Before the site moved under /aqm/, it registered /sw.js with scope /
// on thinka-aqm-prep.vercel.app, and that worker kept the whole old site in its cache. Browsers re-check a
// worker's script on every visit in its scope (and the old page also checked every 15 minutes), so serving this
// file at /sw.js replaces the old worker. It deletes the old caches and unregisters itself, so nothing stale can be
// served again. It handles no requests, so everything goes to the network while it's briefly in charge.
// Open old tabs aren't reloaded (that could wipe a chat): their next navigation goes to the network, and / redirects
// to /aqm, where the new worker (/aqm/sw.js, scope /aqm) takes over.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("aqm-prep-")).map((k) => caches.delete(k)));
    await self.registration.unregister();
  })());
});
