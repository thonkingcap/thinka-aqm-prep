// Where the site lives. It's served under /aqm/ so https://thonkingcap.dev/aqm can proxy to it with the same paths
// (the hub's vercel.json rewrites /aqm/* to this deployment's /aqm/*). vite.config.ts builds with this as `base`.
// A plain constant, not import.meta.env.BASE_URL, so the node tests can load files that use it.
export const BASE = "/aqm/";
/** The page itself, with no trailing slash: thonkingcap.dev redirects /aqm/ to /aqm, so the service worker and the
 * manifest use this as their scope to cover both. */
export const SCOPE = "/aqm";
