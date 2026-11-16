import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./components/components.css";
import "./motion.css";
import App from "./App.tsx";
import { SessionProvider } from "./session.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
);

// Offline: after one visit the service worker keeps every file on this device (production builds only).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    try {
      // Trusted Types is enforced, so the worker URL goes through one policy that allows exactly /sw.js.
      type TT = { createPolicy: (n: string, r: { createScriptURL: (u: string) => string }) => { createScriptURL: (u: string) => unknown } };
      const tt = (window as unknown as { trustedTypes?: TT }).trustedTypes;
      const url = tt ? tt.createPolicy("sw", { createScriptURL: (u) => { if (u !== "/sw.js") throw new TypeError("Blocked script URL"); return u; } }).createScriptURL("/sw.js") : "/sw.js";
      navigator.serviceWorker.register(url as string).catch(() => { /* offline support is optional */ });
    } catch { /* offline support is optional */ }
  });
}
