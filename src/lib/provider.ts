// Which service a key belongs to.
// Babson hands out LiteLLM gateway keys (sk- + 22 characters) that only work against Babson's gateway;
// keys made at platform.claude.com (sk-ant-…) go straight to Anthropic.

export const BABSON_GATEWAY = "https://ca-litellm-mint-eus2.orangeflower-5d81efa8.eastus2.azurecontainerapps.io";

export type ProviderId = "babson" | "anthropic";
export type Provider = {
  id: ProviderId;
  label: string;
  baseURL?: string;
  model: string;
  modelLabel: string;
};

export const PROVIDERS: Record<ProviderId, Provider> = {
  // Babson's gateway offers claude-sonnet-5 and claude-sonnet-46; Sonnet 5 is the newer one.
  babson: { id: "babson", label: "Babson's Claude gateway", baseURL: BABSON_GATEWAY, model: "claude-sonnet-5", modelLabel: "Claude Sonnet 5" },
  anthropic: { id: "anthropic", label: "Anthropic", model: "claude-sonnet-5-5", modelLabel: "Claude Sonnet 5.5" },
};

export function providerFor(key: string): Provider {
  return key.startsWith("sk-ant-") ? PROVIDERS.anthropic : PROVIDERS.babson;
}

/** Real spend and budget, from the Babson gateway's /key/info. Null when unavailable. */
export type RemoteBalance = { spent: number; budget: number | null; at: number };

export async function fetchRemoteBalance(key: string): Promise<RemoteBalance | null> {
  const p = providerFor(key);
  if (p.id !== "babson") return null;
  try {
    const res = await fetch(`${p.baseURL}/key/info`, { headers: { "x-api-key": key } });
    if (!res.ok) return null;
    const data = (await res.json()) as { info?: { spend?: number; max_budget?: number | null } };
    const spent = Number(data.info?.spend);
    if (!Number.isFinite(spent)) return null;
    const budget = data.info?.max_budget == null ? null : Number(data.info.max_budget);
    return { spent, budget: Number.isFinite(budget) ? budget : null, at: Date.now() };
  } catch {
    return null;
  }
}
