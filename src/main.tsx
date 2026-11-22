import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./components/components.css";
import "./motion.css";
import App from "./App.tsx";
import { SessionProvider } from "./session.tsx";
import { BASE, SCOPE } from "./lib/base.ts";

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
      // Trusted Types is enforced, so the worker URL goes through one policy that allows exactly /aqm/sw.js.
      const SW = `${BASE}sw.js`;
      type TT = { createPolicy: (n: string, r: { createScriptURL: (u: string) => string }) => { createScriptURL: (u: string) => unknown } };
      const tt = (window as unknown as { trustedTypes?: TT }).trustedTypes;
      const url = tt ? tt.createPolicy("sw", { createScriptURL: (u) => { if (u !== SW) throw new TypeError("Blocked script URL"); return u; } }).createScriptURL(SW) : SW;
      // Open tabs pick up a new version on their own: check for one every 15 minutes and whenever the tab comes
      // back into view, and reload once when the new version takes over (never on the very first visit).
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      const busy = () => location.hash.startsWith("#/tutor")
        || [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("textarea, input[type=text], input[type=password]")].some((el) => el.value.trim() !== "");
      const reload = () => { if (reloaded) return; reloaded = true; window.location.reload(); };
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadController || reloaded) return;
        // Don't wipe a chat or something being typed: wait until the tab is in the background.
        if (!busy()) return reload();
        document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") reload(); });
      });
      // Scope /aqm (no slash) so it also covers thonkingcap.dev/aqm; /aqm/sw.js is served with
      // Service-Worker-Allowed: /aqm to allow that (vercel.json).
      navigator.serviceWorker.register(url as string, { scope: SCOPE }).then((reg) => {
        const check = () => { reg.update().catch(() => {}); };
        window.setInterval(check, 15 * 60 * 1000);
        document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
      }).catch(() => { /* offline support is optional */ });
    } catch { /* offline support is optional */ }
  });
}
