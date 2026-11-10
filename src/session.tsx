import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as vault from "./lib/vault.ts";
import { readSpend, type SpendState } from "./lib/spend.ts";
import { fetchRemoteBalance, providerFor, type Provider, type RemoteBalance } from "./lib/provider.ts";

type Session = {
  apiKey: string | null;
  /** False until the remembered key has been decrypted (a few ms after load). */
  ready: boolean;
  fp: string | null;
  browsing: boolean;
  spend: SpendState | null;
  /** Real spend and budget from Babson's gateway, when the key is a Babson key. */
  remote: RemoteBalance | null;
  provider: Provider | null;
  refreshBalance: () => void;
  useKey: (key: string, opts: { shared: boolean }) => Promise<void>;
  browse: () => void;
  forget: () => Promise<void>;
  askTutor: (prompt: string) => void;
  takePending: () => string | null;
};

const Ctx = createContext<Session | null>(null);
const BROWSE = "aqm.browse";
const PENDING = "aqm.tutor.pending";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    vault.loadKey().then((k) => { if (live) { setApiKey(k); setReady(true); } });
    return () => { live = false; };
  }, []);
  const [fp, setFp] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(() => {
    try { return sessionStorage.getItem(BROWSE) === "1"; } catch { return false; }
  });
  const [spend, setSpend] = useState<SpendState | null>(null);
  const [remote, setRemote] = useState<RemoteBalance | null>(null);
  const provider = apiKey ? providerFor(apiKey) : null;

  const refreshBalance = useCallback(() => {
    if (!apiKey) { setRemote(null); return; }
    fetchRemoteBalance(apiKey).then(setRemote);
  }, [apiKey]);
  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  useEffect(() => {
    let live = true;
    if (!apiKey) { setFp(null); setSpend(null); return; }
    vault.fingerprint(apiKey).then((f) => { if (live) { setFp(f); setSpend(readSpend(f)); } });
    return () => { live = false; };
  }, [apiKey]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = () => {
      if (fp) setSpend(readSpend(fp));
      // The gateway records spend a moment after a reply ends; ask again shortly after.
      clearTimeout(t);
      t = setTimeout(refreshBalance, 2500);
    };
    window.addEventListener("aqm:spend", on);
    window.addEventListener("storage", on);
    return () => { clearTimeout(t); window.removeEventListener("aqm:spend", on); window.removeEventListener("storage", on); };
  }, [fp, refreshBalance]);

  const useKey = useCallback(async (key: string, opts: { shared: boolean }) => {
    await vault.storeKey(key, opts);
    setApiKey(key);
  }, []);

  const browse = useCallback(() => {
    try { sessionStorage.setItem(BROWSE, "1"); } catch { /* ignore */ }
    setBrowsing(true);
  }, []);

  const forget = useCallback(async () => { setApiKey(null); await vault.removeKey(); }, []);

  const askTutor = useCallback((prompt: string) => {
    try { sessionStorage.setItem(PENDING, prompt); } catch { /* ignore */ }
    location.hash = "#/tutor";
  }, []);

  const takePending = useCallback(() => {
    try {
      const p = sessionStorage.getItem(PENDING);
      sessionStorage.removeItem(PENDING);
      return p;
    } catch { return null; }
  }, []);

  const value = useMemo(
    () => ({ apiKey, ready, fp, browsing, spend, remote, provider, refreshBalance, useKey, browse, forget, askTutor, takePending }),
    [apiKey, ready, fp, browsing, spend, remote, provider, refreshBalance, useKey, browse, forget, askTutor, takePending],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside provider");
  return s;
}

export function useRoute(): string[] {
  const read = () => location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
