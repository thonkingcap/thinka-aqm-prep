// Estimated spend. Anthropic has no endpoint that tells a regular API key its remaining credit,
// so every response's exact token usage is priced here and subtracted from the starting balance.

// Claude Sonnet 5 and 5.5 share this price, USD per million tokens (Anthropic first-party pricing).
// Only used when the real balance isn't available (keys made at platform.claude.com).
export const PRICE = { input: 2.0, output: 10.0, cacheWrite: 2.5, cacheRead: 0.2 };
export const BILLING_URL = "https://platform.claude.com/settings/billing";
export const KEYS_URL = "https://platform.claude.com/settings/keys";

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

export type SpendState = { start: number; spent: number; calls: number; inTok: number; outTok: number; since: string };

const KEY = (fp: string) => `aqm.spend.${fp}`;

export function costOf(u: Usage): number {
  return (
    (u.input_tokens * PRICE.input +
      (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite +
      (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
      u.output_tokens * PRICE.output) /
    1_000_000
  );
}

export function readSpend(fp: string): SpendState {
  try {
    const raw = localStorage.getItem(KEY(fp));
    if (raw) return JSON.parse(raw) as SpendState;
  } catch { /* storage blocked */ }
  return { start: 100, spent: 0, calls: 0, inTok: 0, outTok: 0, since: new Date().toISOString() };
}

export function writeSpend(fp: string, s: SpendState) {
  try { localStorage.setItem(KEY(fp), JSON.stringify(s)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("aqm:spend"));
}

export function addUsage(fp: string, u: Usage): SpendState {
  const s = readSpend(fp);
  s.spent += costOf(u);
  s.calls += 1;
  s.inTok += u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  s.outTok += u.output_tokens;
  writeSpend(fp, s);
  return s;
}

export type BalanceView = { real: boolean; spent: number; total: number | null; left: number | null };

/** The balance to show: the gateway's real numbers when there are some, otherwise the local estimate. */
export function balanceView(remote: { spent: number; budget: number | null } | null, spend: SpendState | null): BalanceView | null {
  if (remote) return { real: true, spent: remote.spent, total: remote.budget, left: remote.budget == null ? null : Math.max(0, remote.budget - remote.spent) };
  if (spend) return { real: false, spent: spend.spent, total: spend.start, left: Math.max(0, spend.start - spend.spent) };
  return null;
}

export function money(n: number, digits = 2): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
