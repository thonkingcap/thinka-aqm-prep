// Keys and models: each key gets the best model it can use; access codes are told apart from keys.
// vault.ts reads location.origin when it loads, so give it one first.
(globalThis as { location?: { origin: string } }).location = { origin: "http://localhost" };
const { pickModel, modelLabel, isCode, providerFor, rememberModel, CODE_PREFIX } = await import("./provider.ts");
const { looksLikeKey, mask } = await import("./vault.ts");
{
  let f = 0;
  const eq = (a: unknown, b: unknown, m: string) => { if (a !== b) { f++; console.log("FAIL", m, a, b); } };
  eq(pickModel(["claude-sonnet-46"]), "claude-sonnet-46", "the student's key: only Sonnet 4.6");
  eq(pickModel(["claude-sonnet-46", "claude-sonnet-5"]), "claude-sonnet-5", "Sonnet 5 preferred");
  eq(pickModel(["gpt-4o", "claude-haiku-4-5"]), "claude-haiku-4-5", "any Claude model as a last resort");
  eq(pickModel(["claude-sonnet-4-5-20250929"]), "claude-sonnet-4-5-20250929", "dated ids");
  eq(pickModel(["gpt-4o"]), null, "no Claude model");
  eq(modelLabel("claude-sonnet-46"), "Claude Sonnet 4.6", "label 46");
  eq(modelLabel("claude-sonnet-5-5"), "Claude Sonnet 5.5", "label 5-5");
  eq(modelLabel("claude-sonnet-5"), "Claude Sonnet 5", "label 5");
  eq(isCode("AQM-7K3Q"), true, "code");
  eq(isCode("sk-abcdefghijklmnopqrstuv"), false, "key is not a code");
  eq(looksLikeKey("AQM-7K3Q"), null, "codes pass the key check");
  eq(looksLikeKey("aq"), "Babson keys start with sk- followed by letters and numbers. Copy it again from Babson's email", "too short to be a code");
  eq(providerFor(CODE_PREFIX + "AQM-7K3Q").id, "code", "code provider");
  eq(providerFor(CODE_PREFIX + "AQM-7K3Q").baseURL, "/aqm/api/claude", "codes go to this site only, under /aqm");
  eq(mask(CODE_PREFIX + "AQM-7K3Q").startsWith("Access code"), true, "mask");
  rememberModel("sk-testtesttesttesttest00", "claude-sonnet-46");
  eq(providerFor("sk-testtesttesttesttest00").model, "claude-sonnet-46", "remembered per key");
  eq(providerFor("sk-othertesttesttesttest0").model, "claude-sonnet-5", "other keys keep the default");
  console.log(`${f ? "FAILED" : "PASS"}: keys, codes and models`);
  if (f) process.exit(1);
}
