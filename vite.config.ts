import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, existsSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { BASE, SCOPE } from "./src/lib/base.ts";

// The build goes in dist/aqm/ so Vercel serves it at /aqm/... as plain files (dist is still the output folder).
const ROOT = "dist";
const OUT = join(ROOT, BASE.replace(/^\/|\/$/g, ""));

// Content-Security-Policy for the built site. The browser itself refuses to send anything
// (including the API key) anywhere except Babson's Claude gateway, api.anthropic.com and the
// "Have a problem?" relay (formsubmit.co, which never receives the key), and refuses third-party scripts.
// Dev mode skips it because Vite's hot reload needs inline scripts and a websocket.
export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "connect-src 'self' https://api.anthropic.com https://ca-litellm-mint-eus2.orangeflower-5d81efa8.eastus2.azurecontainerapps.io https://formsubmit.co https://kxtdmgpecxlzyepshryw.supabase.co",
  "img-src 'self' data:",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
  // Trusted Types: the browser refuses any string-to-HTML/script injection, so even a bug that
  // let text reach innerHTML couldn't run code that reads the key.
  "require-trusted-types-for 'script'",
  "trusted-types sw",
  // The offline service worker (sw.js, same origin) and nothing else.
  "worker-src 'self'",
  "frame-src 'none'",
].join("; ");

function csp(): Plugin {
  return {
    name: "aqm-csp",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace("<!--CSP-->", `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    },
  };
}

// Writes dist/aqm/sw.js listing every built file, versioned by their contents, so the site works offline.
// Also writes dist/sw.js, a kill switch for the old service worker that was registered at / before the move to /aqm/.
function offline(): Plugin {
  return {
    name: "aqm-offline",
    apply: "build",
    // Clear all of dist, not just dist/aqm, so files from an older layout can't linger next to it.
    buildStart() { rmSync(ROOT, { recursive: true, force: true }); },
    closeBundle() {
      // _headers is for Netlify / Cloudflare Pages, which only read it from the top of the output folder.
      if (existsSync(join(OUT, "_headers"))) renameSync(join(OUT, "_headers"), join(ROOT, "_headers"));
      const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
      const files = walk(OUT).map((f) => relative(OUT, f).split("\\").join("/")).filter((f) => !["sw.js", "index.html"].includes(f)).sort();
      const template = readFileSync("src/sw-template.js", "utf8");
      const hash = createHash("sha256").update(template);
      for (const f of [...files, "index.html"]) hash.update(f).update(readFileSync(join(OUT, f)));
      // The page is cached as /aqm (no slash), which both hosts answer directly: thonkingcap.dev redirects
      // /aqm/ and /aqm/index.html to /aqm, and a redirected response can't be served to a page from the cache.
      const list = [SCOPE, ...files.map((f) => `${BASE}${f}`)];
      const sw = template.replace("__VERSION__", hash.digest("hex").slice(0, 12)).replace("__FILES__", JSON.stringify(list)).replace("__SCOPE__", JSON.stringify(SCOPE));
      writeFileSync(join(OUT, "sw.js"), sw);
      copyFileSync("src/sw-kill.js", join(ROOT, "sw.js"));
    },
  };
}

export default defineConfig({
  plugins: [react(), csp(), offline()],
  base: BASE,
  build: { sourcemap: false, outDir: OUT, emptyOutDir: true },
});
