import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";

// Content-Security-Policy for the built site. The browser itself refuses to send anything
// (including the API key) anywhere except Babson's Claude gateway, api.anthropic.com and the
// "Have a problem?" relay (formsubmit.co, which never receives the key), and refuses third-party scripts.
// Dev mode skips it because Vite's hot reload needs inline scripts and a websocket.
export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "connect-src 'self' https://api.anthropic.com https://ca-litellm-mint-eus2.orangeflower-5d81efa8.eastus2.azurecontainerapps.io https://formsubmit.co",
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

// Writes dist/sw.js listing every built file, versioned by their contents, so the site works offline.
function offline(): Plugin {
  return {
    name: "aqm-offline",
    apply: "build",
    closeBundle() {
      const dist = "dist";
      const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
      const files = walk(dist).map((f) => relative(dist, f).split("\\").join("/")).filter((f) => !["sw.js", "_headers"].includes(f)).sort();
      const template = readFileSync("src/sw-template.js", "utf8");
      const hash = createHash("sha256").update(template);
      for (const f of files) hash.update(f).update(readFileSync(join(dist, f)));
      const list = ["/", ...files.map((f) => `/${f}`)];
      const sw = template.replace("__VERSION__", hash.digest("hex").slice(0, 12)).replace("__FILES__", JSON.stringify(list));
      writeFileSync(join(dist, "sw.js"), sw);
    },
  };
}

export default defineConfig({
  plugins: [react(), csp(), offline()],
  build: { sourcemap: false },
});
