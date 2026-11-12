// Claude in the browser, on the student's own key.
// Babson keys go straight from this page to Babson's Claude gateway; sk-ant- keys go to api.anthropic.com.
// There is no Thinka server in between.
import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam, BetaContentBlock, BetaToolUnion, BetaToolResultBlockParam, BetaTextBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { addUsage } from "./spend.ts";
import { evaluateSafe } from "./excel.ts";
import { courseNotesText } from "./course.ts";
import { providerFor, type Provider } from "./provider.ts";

export function makeClient(apiKey: string) {
  // dangerouslyAllowBrowser: this app is "bring your own key": each student uses their own key in
  // their own browser, so there is no shared secret to leak. The CSP limits where the key can go.
  // Babson's gateway authenticates with x-api-key, which is what apiKey sends.
  const p = providerFor(apiKey);
  return new Anthropic({ apiKey, baseURL: p.baseURL, dangerouslyAllowBrowser: true, maxRetries: 2 });
}

/** Checks the key against its service and that the model is available. Costs nothing. */
export async function verifyKey(apiKey: string): Promise<void> {
  const p = providerFor(apiKey);
  if (p.id === "babson") {
    let res: Response;
    try {
      res = await fetch(`${p.baseURL}/v1/models`, { headers: { "x-api-key": apiKey } });
    } catch {
      throw new Error("Couldn't reach Babson's Claude gateway. Check your internet connection and try again.");
    }
    if (res.status === 401 || res.status === 403) throw new Error("Babson's gateway didn't accept this key. Copy it again from Babson's email, the whole thing.");
    if (!res.ok) throw new Error(`Babson's gateway returned an error (${res.status}). Try again in a minute.`);
    const data = (await res.json().catch(() => ({}))) as { data?: { id: string }[] };
    const ids = (data.data ?? []).map((m) => m.id);
    if (ids.length && !ids.includes(p.model)) throw new Error(`This key works, but it can't use ${p.modelLabel}. It can use: ${ids.join(", ")}.`);
    return;
  }
  const client = makeClient(apiKey);
  try {
    await client.models.retrieve(p.model);
  } catch (e) {
    throw new Error(explainError(e, p));
  }
}

export function explainError(e: unknown, p?: Provider): string {
  const who = p?.id === "babson" ? "Babson's Claude gateway" : "Anthropic";
  const model = p?.modelLabel ?? "this model";
  if (e instanceof Anthropic.AuthenticationError) return `${who} didn't accept this key. Check that you copied the whole key and that it hasn't been revoked.`;
  if (e instanceof Anthropic.PermissionDeniedError) return `This key isn't allowed to use ${model}.`;
  if (e instanceof Anthropic.NotFoundError) return `${model} isn't available to this key.`;
  if (e instanceof Anthropic.RateLimitError) {
    if (/budget/i.test(e.message)) return "This key has used up its budget. Ask Babson about more credit.";
    return "Rate limit reached. Wait a minute and try again.";
  }
  if (e instanceof Anthropic.APIConnectionError) return `Couldn't reach ${who}. Check your internet connection.`;
  if (e instanceof Anthropic.APIError) {
    const msg = e.message || "";
    if (/budget.*exceeded|exceeded.*budget|max_budget/i.test(msg)) return "This key has used up its budget. Ask Babson about more credit.";
    if (/credit balance/i.test(msg)) return "Your Anthropic credit balance is too low. Add credits in the Claude Console billing page.";
    if (e.status === 529 || e.status === 503) return "Claude is overloaded right now. Try again in a moment.";
    return `${who} returned an error (${e.status ?? "?"}): ${msg.replace(/^\d+\s*/, "").slice(0, 200)}`;
  }
  if (e instanceof Error && e.name === "AbortError") return "Stopped.";
  return e instanceof Error ? e.message : String(e);
}

const SYSTEM_RULES = `You are the AQM 1000 tutor on Thinka's AQM Prep, a study site for Babson College first-year students taking AQM 1000, an Excel-based statistics course. They are preparing for Midterm 2 (Wednesday, November 18), which covers Lessons 12–18: the normal distribution and Z-scores, sampling distributions and the Central Limit Theorem, confidence intervals (Z and t), one-sample hypothesis tests for a mean (the 12 hypothesis test questions), the chi-squared test for a variance, two-sample tests, and paired data.

The exam:
- It is taken in real Excel. No calculators: every number comes from a formula typed in a cell, so teach the Excel way, not hand arithmetic or tables.
- Variance tests (Lesson 18): S² = VAR.S(data), statistic (n − 1)S²/σ₀² with ν = n − 1, chi-squared distribution via CHISQ.DIST(x, ν, TRUE) and CHISQ.INV(prob, ν). Exam-style variance questions are one-tail: right tail p = 1-CHISQ.DIST(stat, ν, TRUE), critical value CHISQ.INV(1-α, ν); left tail p = CHISQ.DIST(stat, ν, TRUE), critical value CHISQ.INV(α, ν). (The notes also show the two-tail version; chi-squared isn't symmetric, so its two critical values are computed separately.)
- Two-sample tests use the Data Analysis Toolpak (Data › Data Analysis): "z-Test: Two Sample for Means" when both population variances are known (enter σ₁² and σ₂²), and "t-Test: Two-Sample Assuming Equal Variances" (pooled variance) when they are unknown. Explain which output rows to read (statistic, one-tail or two-tail p-value, critical value) and how to match them to H_A.
- Paired data (the same subjects measured twice): take the differences D = X − Y in a new column and do a one-sample t-test on D (x̄_D, S_D, T = x̄_D/(S_D/√n), ν = n − 1).
- On this site, practice happens in downloadable Excel workbooks: one tab per question with the data already in cells, yellow answer cells, and an answer-key tab with every formula. Students upload the filled workbook to be marked. Encourage them to try a whole set before opening the answer key.

How to work:
- Every number you state must come from the excel tool. Never do statistics or arithmetic in your head; put all the formulas you need in one excel call when you can.
- Show the Excel formula for each step, in backticks, the way it would be typed in a cell (e.g. \`=NORM.DIST(15,18,5,TRUE)\`).
- Use the professor's function set only: NORM.DIST, NORM.S.DIST, NORM.INV, NORM.S.INV, T.DIST (cumulative TRUE), T.INV, CHISQ.DIST (cumulative TRUE), CHISQ.INV, AVERAGE, STDEV.S, VAR.S, COUNT, SQRT, plus the Toolpak for two-sample tests. Do not teach T.DIST.2T, T.DIST.RT, T.INV.2T, CHISQ.DIST.RT, CHISQ.INV.RT, ABS, STANDARDIZE or CONFIDENCE.NORM; if a student uses one, say it works but the class does it with the one-tail functions, and show that version.
- p-values follow the class rule: left tail .DIST(stat); right tail 1-.DIST(stat); two tails: if the statistic is negative, 2*.DIST(stat), if positive, 2*(1-.DIST(stat)).
- Critical values: right tail .INV(1-α); left tail .INV(α) (negative); two tails ±.INV(1-α/2). Intervals use Z_α/2 = NORM.S.INV(1-α/2) or T_α/2 = T.INV(1-α/2, n-1).
- For hypothesis tests follow the class's steps: (0) α, (1) H₀ and H_A (H₀ holds the equality; the claim to be shown goes in H_A), (2) test statistic and p-value or critical value, (3) decision. End with one sentence in business terms. Say "reject H₀" or "do not reject H₀", never "accept H₀" or "prove".
- Use the class notation in plain text: μ, μ₀, σ, x̄, s, n, SE, α, ν = n − 1, H₀, H_A, Z_α/2. Never use LaTeX or $…$.
- Be brief and concrete: the student is studying under time pressure. Short paragraphs, numbered steps when solving, a small table only when comparing. No filler, no exclamation marks.
- When asked to quiz, ask one question at a time, wait for the answer, then grade it and show the correct formula.
- If something is outside Lessons 12–18 (proportions, regression, ANOVA, unequal-variance t-tests), say it is probably outside this midterm, then help briefly.
- Don't predict what the professor will put on the exam. You can say which kinds of question the class practised.
- The student's messages may include a practice question from the site with its official answer and formulas; trust those values, and explain the method that leads to them.

The course notes below are the reference. Prefer their wording, examples and formulas.`;

/** Large, stable system prompt (rules + notes). Kept byte-identical between requests so it caches. */
const SYSTEM: BetaTextBlockParam[] = [{ type: "text", text: `${SYSTEM_RULES}\n\n# Course notes\n\n${courseNotesText()}` }];

const TOOLS: BetaToolUnion[] = [
  {
    name: "excel",
    description:
      "Evaluates Excel formulas exactly as Excel does, with verified implementations. Supports NORM.DIST, NORM.S.DIST, NORM.INV, NORM.S.INV, T.DIST, T.INV, CHISQ.DIST, CHISQ.INV, AVERAGE, STDEV.S, VAR.S, COUNT, SUM, SQRT, POWER, ROUND, + - * / ^ and %. Arguments are numbers (no cell references): write data lists inline, e.g. =AVERAGE(10.1,9.8,9.7). Returns one result per formula, or an Excel-style error. Use it for every number you report.",
    input_schema: {
      type: "object",
      properties: {
        formulas: {
          type: "array",
          items: { type: "string", description: "One Excel formula, starting with =" },
          description: "Formulas to evaluate, in order",
        },
      },
      required: ["formulas"],
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  } as BetaToolUnion,
];

export type ToolRun = { formula: string; value?: number; error?: string };
export type TutorEvents = {
  onText: (delta: string) => void;
  onTool: (runs: ToolRun[]) => void;
  onStatus: (s: "thinking" | "writing" | "calculating" | "idle") => void;
};

// Request shapes, richest first. A gateway may not pass every newer field through, so on a 400 the
// tutor steps down one level and remembers the level that worked for the rest of the session.
//  0: Anthropic only: server-side refusal fallbacks (beta)
//  1: adaptive thinking, effort, automatic prompt caching, strict tool schema
//  2: adaptive thinking, system-prompt caching, plain tool
//  3: plain request: no thinking, no caching
const PLAIN_TOOLS = TOOLS.map((t) => {
  const { strict: _s, eager_input_streaming: _e, ...rest } = t as BetaToolUnion & { strict?: boolean; eager_input_streaming?: boolean };
  return rest as BetaToolUnion;
});
const levelFor: Record<string, number> = { anthropic: 0, babson: 1 };

function paramsAt(level: number, model: string, history: BetaMessageParam[]) {
  const base = { model, max_tokens: 16000, messages: history };
  if (level <= 1) {
    return {
      ...base,
      system: SYSTEM,
      tools: TOOLS,
      thinking: { type: "adaptive" as const },
      output_config: { effort: "medium" as const },
      cache_control: { type: "ephemeral" as const },
      ...(level === 0 ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    };
  }
  if (level === 2) {
    return { ...base, system: [{ ...SYSTEM[0], cache_control: { type: "ephemeral" as const } }], tools: PLAIN_TOOLS, thinking: { type: "adaptive" as const } };
  }
  return { ...base, system: SYSTEM, tools: PLAIN_TOOLS };
}

/**
 * Runs one tutor turn: streams the reply, runs any excel tool calls locally, and loops until Claude is done.
 * `history` is the full conversation (content blocks kept as returned, thinking blocks included); it is
 * appended to in place.
 */
export async function runTutorTurn(apiKey: string, keyFp: string, history: BetaMessageParam[], ev: TutorEvents, signal: AbortSignal): Promise<{ stop: string }> {
  const client = makeClient(apiKey);
  const p = providerFor(apiKey);
  for (let round = 0; round < 6; round++) {
    ev.onStatus("thinking");
    const level = levelFor[p.id];
    const params = paramsAt(level, p.model, history);
    let final;
    try {
      // Anthropic: the beta endpoint (needed for fallbacks). Babson's gateway: the plain /v1/messages.
      const onText = (delta: string) => {
        ev.onStatus("writing");
        ev.onText(delta);
      };
      const stream = level === 0
        ? client.beta.messages.stream(params as Parameters<typeof client.beta.messages.stream>[0], { signal }).on("text", onText)
        : client.messages.stream(params as unknown as Parameters<typeof client.messages.stream>[0], { signal }).on("text", onText);
      final = (await stream.finalMessage()) as Awaited<ReturnType<ReturnType<typeof client.beta.messages.stream>["finalMessage"]>>;
    } catch (e) {
      const budget = e instanceof Anthropic.APIError && /budget/i.test(e.message);
      if (!budget && e instanceof Anthropic.BadRequestError && level < 3) {
        levelFor[p.id] = level + 1;
        round--;
        continue;
      }
      ev.onStatus("idle");
      throw new Error(explainError(e, p));
    }
    addUsage(keyFp, final.usage);
    history.push({ role: "assistant", content: final.content as BetaContentBlock[] });

    if (final.stop_reason === "refusal") {
      ev.onStatus("idle");
      return { stop: "refusal" };
    }
    if (final.stop_reason !== "tool_use") {
      ev.onStatus("idle");
      return { stop: final.stop_reason ?? "end_turn" };
    }

    ev.onStatus("calculating");
    const results: BetaToolResultBlockParam[] = [];
    for (const block of final.content) {
      if (block.type !== "tool_use") continue;
      const input = block.input as { formulas?: unknown };
      const formulas = Array.isArray(input?.formulas) ? input.formulas.filter((f): f is string => typeof f === "string").slice(0, 40) : null;
      if (block.name !== "excel" || !formulas) {
        results.push({ type: "tool_result", tool_use_id: block.id, is_error: true, content: "Invalid input: expected {\"formulas\": [\"=...\"]}" });
        continue;
      }
      const runs = formulas.map((f) => evaluateSafe(f));
      ev.onTool(runs);
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: runs.map((r) => (r.error ? `${r.formula} -> ERROR ${r.error}` : `${r.formula} -> ${r.value}`)).join("\n"),
      });
    }
    history.push({ role: "user", content: results });
  }
  ev.onStatus("idle");
  return { stop: "too_many_rounds" };
}
