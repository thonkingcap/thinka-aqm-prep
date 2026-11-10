import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Content-Security-Policy for the built site. The browser itself refuses to send anything
// (including the API key) anywhere except Babson's Claude gateway, api.anthropic.com and the
// "Have a problem?" relay (formsubmit.co, which never receives the key), and refuses third-party scripts.
// Dev mode skips it because Vite's hot reload needs inline scripts and a websocket.
export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "connect-src https://api.anthropic.com https://ca-litellm-mint-eus2.orangeflower-5d81efa8.eastus2.azurecontainerapps.io https://formsubmit.co",
  "img-src 'self' data:",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
  // Trusted Types: the browser refuses any string-to-HTML/script injection, so even a bug that
  // let text reach innerHTML couldn't run code that reads the key.
  "require-trusted-types-for 'script'",
  "trusted-types 'none'",
  "worker-src 'none'",
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

export default defineConfig({
  plugins: [react(), csp()],
  build: { sourcemap: false },
});
