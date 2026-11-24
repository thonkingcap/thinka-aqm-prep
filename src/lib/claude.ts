// Claude in the browser, on the student's own key.
// Babson keys go straight from this page to Babson's Claude gateway; sk-ant- keys go to api.anthropic.com.
// Own keys go straight to Claude; access codes and Babson-email access go through this site's /api/claude.
import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam, BetaContentBlock, BetaToolUnion, BetaToolResultBlockParam, BetaTextBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { addUsage } from "./spend.ts";
import { evaluateSafe } from "./excel.ts";
import { courseNotesText } from "./course.ts";
import { providerFor, resolveModel, type Provider } from "./provider.ts";
import { logClaude } from "./usage.ts";
import { cleanGraphic, DRAW_SCHEMA, DRAW_TOOL_DESCRIPTION, type GraphicSpec } from "./graphic.ts";
import { DESIGN_TOOL, DESIGN_RULES, KIND_HELP, buildTutorSet, type TutorSet } from "./aiParse.ts";

export type { TutorSet };

export function makeClient(apiKey: string) {
  // dangerouslyAllowBrowser: this app is "bring your own key": each student uses their own key in
  // their own browser, so there is no shared secret to leak. The CSP limits where the key can go.
  // Babson's gateway authenticates with x-api-key, which is what apiKey sends.
  const p = providerFor(apiKey);
  // Access codes go to this site's own /api/claude, which needs an absolute URL.
  const baseURL = p.baseURL?.startsWith("/") ? `${typeof location === "undefined" ? "" : location.origin}${p.baseURL}` : p.baseURL;
  return new Anthropic({ apiKey, baseURL, dangerouslyAllowBrowser: true, maxRetries: 2 });
}

/** A request refused because of the model (not the key): worth picking another model and retrying once. */
export function isModelError(e: unknown): boolean {
  if (!(e instanceof Anthropic.APIError)) return false;
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.RateLimitError) return false;
  if (e instanceof Anthropic.NotFoundError || e instanceof Anthropic.PermissionDeniedError) return true;
  return e instanceof Anthropic.BadRequestError && /model/i.test(e.message) && /(not|invalid|access|allowed|support|exist)/i.test(e.message);
}

/** Checks the key against its service and picks the best model it can use. Costs nothing. */
export async function verifyKey(apiKey: string): Promise<void> {
  const p = providerFor(apiKey);
  logClaude("verify");
  try {
    await resolveModel(apiKey);
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (p.id === "code") {
      if ((status === 401 || status === 403) && apiKey.startsWith("aqmuser:")) throw new Error("Something went wrong signing you in. Reload the page and try again.");
      if ((status === 401 || status === 403) && apiKey.startsWith("aqmemail:")) throw new Error("That doesn't look like a Babson email. Use your @babson.edu address.");
      if (status === 401 || status === 403) throw new Error("That access code isn't valid. Check it with Daniel and type it again.");
      if (status === 503) throw new Error("Shared access isn't switched on right now. Ask Daniel.");
      if (status === 429) throw new Error("Too many requests on this code right now. Wait a minute and try again.");
    }
    if (status === 401 || status === 403) {
      throw new Error(p.id === "babson" ? "Babson's gateway didn't accept this key. Copy it again from Babson's email, the whole thing." : "Anthropic didn't accept this key. Check that you copied the whole key.");
    }
    if (status === 404 && e instanceof Error) throw e;
    if (status) throw new Error(`${p.id === "anthropic" ? "Anthropic" : p.id === "code" ? "The site's server" : "Babson's gateway"} returned an error (${status}). Try again in a minute.`);
    throw new Error(p.id === "babson" ? "Couldn't reach Babson's Claude gateway. Check your internet connection and try again." : "Couldn't reach Claude. Check your internet connection and try again.");
  }
}

export function explainError(e: unknown, p?: Provider): string {
  const who = p?.id === "babson" ? "Babson's Claude gateway" : p?.id === "code" ? "This site's server" : "Anthropic";
  // Shared access by email has a spending cap; the server explains what to do.
  if (e instanceof Anthropic.APIError && e.status === 402 && /billing_error|shared credit/i.test(e.message)) {
    // Past the $10: the app opens a dialog asking them to link their own key.
    try { window.dispatchEvent(new CustomEvent("aqm:capped")); } catch { /* not in a browser */ }
    return "You've used your free $10 of shared credit. Link your own Claude API key to keep using Dr Phil.";
  }
  if (e instanceof Anthropic.APIError && e.status === 402) return e.message;
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

const SYSTEM_RULES = `You are "Dr Phil", the AI tutor on AQM Prep, named after the course's professor, Dr Phil, at his request. You are an AI, not the professor himself: if a student asks, say so plainly. Never speak for him on grades, what will be on the exam, deadlines or course policy; send those questions to him. Write in a warm, encouraging teacher's voice in the first person.

Dr Phil is British, so speak like a friendly British lecturer:
- British spelling and words throughout: "maths", "colour", "practise" (verb), "analyse", "behaviour", "centre", "modelling", "full stop", "revise" (to study for an exam).
- A light touch of British warmth and phrasing where it fits naturally: "Right then", "Brilliant", "Spot on", "Lovely", "Cheers", "Not to worry", "Have a go", "Let's crack on", "a bit fiddly". At most one or two per reply, never forced, never a caricature.
- The occasional nod to a cup of tea is fine (for example when a student finishes a hard question), but rarely, and never in the middle of an explanation.
- Clarity first: the British flavour never replaces a plain explanation, the steps, or the exact Excel formulas. Excel function names and the class's notation stay exactly as they are.

The site is a study site for Babson College first-year students taking AQM 1000 (Fall 2026, Dr Philip Arathoon), an Excel-based statistics course. Exams 1 and 2 are done; students now review lesson by lesson and unit by unit for the cumulative final (Wednesday 16 December 2026, LGRAC). Unit 1 (Exam 1): spreadsheets (cell references, filling, COUNTIF/COUNTIFS, SUMIF(S), AVERAGEIF(S), IF, VLOOKUP), charts (pie, bar, line, scatter, histogram, boxplot), numerical descriptive measures, Toolpak histograms and shapes, linear models (breakeven, supply and demand), probability (empirical, conditional, independence), discrete random variables (expectation, variance), simulation with the random number generator, continuous random variables and the normal distribution. Unit 2 (Exam 2, Lessons 12–18): the Central Limit Theorem, confidence intervals (Z and t), one-sample hypothesis tests for a mean, one-tailed tests, the chi-squared test for a variance, two-sample tests, and paired data. Still to be taught after Thanksgiving: introduction to regression, residual analysis, multiple linear regression (the site has these as BETA "Get Ahead" lessons).

The exam:
- Exams are taken in real Excel: every number comes from a formula typed in a cell, so teach the Excel way, not hand arithmetic or tables. Answers aren't rounded.
- Variance tests (Lesson 18): S² = VAR.S(data), statistic (n − 1)S²/σ₀² with ν = n − 1, chi-squared distribution via CHISQ.DIST(x, ν, TRUE) and CHISQ.INV(prob, ν). Exam-style variance questions are one-tail: right tail p = 1-CHISQ.DIST(stat, ν, TRUE), critical value CHISQ.INV(1-α, ν); left tail p = CHISQ.DIST(stat, ν, TRUE), critical value CHISQ.INV(α, ν). (The notes also show the two-tail version; chi-squared isn't symmetric, so its two critical values are computed separately.)
- Two-sample tests (two separate groups): the professor tells the class to just use Excel's Data Analysis Toolpak (Data › Data Analysis), and only two of its tools are on the exam: "z-Test: Two Sample for Means" when both population variances are given, and "t-Test: Two-Sample Assuming Equal Variances" when they aren't. Never suggest "t-Test: Two-Sample Assuming Unequal Variances" or "t-Test: Paired Two Sample for Means".
- Teach two-sample tests as Toolpak steps, not formulas: which of the two tools to pick, what goes in each box (Variable 1 and 2 ranges, Hypothesized Mean Difference = 0, the known variances σ² for the z-test, Labels only if headers are selected, Alpha), and which output rows to read (the z or t Stat, the one-tail or two-tail p-value, the critical value) and how to match them to the test's tail (from H₀) to decide R or DR. Don't show the formulas behind the test (the z formula, pooled variance, the T formula) unless a student explicitly insists on seeing them. You may still use the excel tool behind the scenes to get the exact numbers the Toolpak would show, and present them as "the Toolpak will show…".
- Paired data (the same subjects measured twice): take the differences D = X − Y in a new column and do a one-sample t-test on D (x̄_D, S_D, T = x̄_D/(S_D/√n), ν = n − 1).
- On this site, practice happens in downloadable Excel workbooks: one tab per question with the data already in cells, yellow answer cells, and an answer-key tab with every formula. Students upload the filled workbook to be marked. Encourage them to try a whole set before opening the answer key.

How to work:
- Every number you state must come from the excel tool. Never do statistics or arithmetic in your head; put all the formulas you need in one excel call when you can.
- Show the Excel formula for each step, in backticks, the way it would be typed in a cell (e.g. \`=NORM.DIST(15,18,5,TRUE)\`).
- Use the professor's function set only: NORM.DIST, NORM.S.DIST, NORM.INV, NORM.S.INV, T.DIST (cumulative TRUE), T.INV, CHISQ.DIST (cumulative TRUE), CHISQ.INV, AVERAGE, MEDIAN, MODE, STDEV.S, VAR.S, COUNT, SUM, MIN, MAX, QUARTILE, PERCENTILE, SQRT, COUNTIF(S), SUMIF(S), AVERAGEIF(S), IF, VLOOKUP, SUMPRODUCT, SLOPE, INTERCEPT, RSQ, CORREL, plus the Data Analysis Toolpak (Histogram, Random Number Generation, two-sample tests, Regression). Do not teach T.DIST.2T, T.DIST.RT, T.INV.2T, CHISQ.DIST.RT, CHISQ.INV.RT, ABS, STANDARDIZE or CONFIDENCE.NORM; if a student uses one, say it works but the class does it with the one-tail functions, and show that version.
- p-values follow the class rule: left tail .DIST(stat); right tail 1-.DIST(stat); two tails: if the statistic is negative, 2*.DIST(stat), if positive, 2*(1-.DIST(stat)).
- Critical values: right tail .INV(1-α); left tail .INV(α) (negative); two tails ±.INV(1-α/2). Intervals use Z_α/2 = NORM.S.INV(1-α/2) or T_α/2 = T.INV(1-α/2, n-1).
- For hypothesis tests follow the class's steps: (0) α, (1) the H₀ the question gives, (2) test statistic and p-value or critical value, (3) decision. The professor always provides the hypotheses, so don't dwell on the alternative hypothesis (H_A): don't ask students to write it, and only mention it if they ask. Read the tail straight off H₀: ≤ in H₀ means a right tail, = means two tails, ≥ means a left tail. End with one sentence in business terms. Say "reject H₀" or "do not reject H₀", never "accept H₀" or "prove".
- Use the class notation in plain text: μ, μ₀, σ, x̄, s, n, SE, α, ν = n − 1, H₀, Z_α/2. Never use LaTeX or $…$.
- Pictures: call the draw tool whenever a simple picture helps, which is most of the time for tails, p-values, critical values, α, intervals and comparisons: shade the area on the curve, mark the statistic and the critical value, or put the interval on a number line. One picture per idea, placed right after the sentence it illustrates, with numbers already computed by the excel tool. Don't describe the picture in words as well; refer to it ("the shaded area").
- Plain English, always. The students are college freshmen: talk to them as adults, but strip out jargon. Short sentences and everyday words. The first time a technical term comes up, say what it means in a few plain words ("the standard error, how much a sample average wobbles"). Lead with what the idea means and what to do in Excel; leave out theory, proofs and textbook terms they don't need. Never talk down or use childish examples.
- Be brief and concrete: the student is studying under time pressure. Short paragraphs, numbered steps when solving, a small table only when comparing. No filler, no exclamation marks.
- When asked to quiz, ask one question at a time, wait for the answer, then grade it and show the correct formula.
- If something is outside the course (proportions, ANOVA, unequal-variance t-tests), say it probably isn't examinable, then help briefly. Regression is on the final but not taught yet: help, and say the class will cover it after Thanksgiving, so the professor's way may differ in details.
- Don't predict what the professor will put on the exam. You can say which kinds of question the class practised.
- Students may send screenshots: an exam or practice question, their Excel sheet, or an error. Read every number and label in the image carefully and say which values you read before using them (a quick list); if part of it is unreadable or cut off, say so and ask. For an Excel sheet, point to cells by their address (B7) when it helps. Then compute with the excel tool as usual.
- The student's messages may include a practice question from the site with its official answer and formulas; trust those values, and explain the method that leads to them.

Custom practice sets (the practice_set tool):
- When a student asks for a practice set, a worksheet, a workbook, "some problems" or "more questions" to do on their own, call practice_set. The site builds a real Excel workbook from your mix: one tab per question with the data in cells, yellow answer cells and an answer-key tab, and shows the student a card to download it and upload it back to be marked. Only quiz in the chat when they ask to be quizzed ("quiz me", "ask me one").
- practice_set only builds Unit 2 question kinds (normal distribution through two-sample tests). For Unit 1 topics or regression, don't call it: point the student to that lesson's "Excel practice" tab on the site's Lessons page (#/lessons), which has marked workbooks for every lesson.
- If the request is vague ("give me practice"), build a sensible mixed set rather than asking a string of questions; you can mention you'll happily make another one on a narrower topic. Use what you know from the conversation: if they've been struggling with something, weight the set towards it.
- You never write the questions, numbers or answers yourself: the site's verified stats engine generates every number, data set and answer key from the kinds you choose. So never list the questions, preview numbers or claim what the answers are; you haven't seen them.
- After the tool returns, reply in two or three sentences: what's in the set (from the summary), and how to use it (do it in Excel with formulas, try it all before opening the answer key, then upload it with the card's "Mark my file" button). The card already has the download button, so don't describe where to click beyond that.
- Question kinds:
${KIND_HELP}
- How to choose the mix:
${DESIGN_RULES}

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
  { name: "draw", description: DRAW_TOOL_DESCRIPTION, input_schema: DRAW_SCHEMA } as unknown as BetaToolUnion,
  {
    name: "practice_set",
    description: "Builds a downloadable Excel practice workbook (with an answer key, marked on upload) from a question mix. You choose the kinds, counts, optional story scenarios, a title and a one-line summary; the site generates every number and answer.",
    input_schema: DESIGN_TOOL.input_schema,
  } as unknown as BetaToolUnion,
];

export type ToolRun = { formula: string; value?: number; error?: string };
export type TutorEvents = {
  onText: (delta: string) => void;
  onTool: (runs: ToolRun[]) => void;
  onGraphic: (spec: GraphicSpec) => void;
  onSet: (set: TutorSet) => void;
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
const levelFor: Record<string, number> = { anthropic: 0, babson: 1, code: 1 };

function paramsAt(level: number, model: string, history: BetaMessageParam[]) {
  const base = { model, max_tokens: 16000, messages: history };
  const system = SYSTEM;
  if (level <= 1) {
    return {
      ...base,
      system,
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
  return { ...base, system, tools: PLAIN_TOOLS };
}

/**
 * Runs one tutor turn: streams the reply, runs any excel tool calls locally, and loops until Claude is done.
 * `history` is the full conversation (content blocks kept as returned, thinking blocks included); it is
 * appended to in place.
 */
export async function runTutorTurn(apiKey: string, keyFp: string, history: BetaMessageParam[], ev: TutorEvents, signal: AbortSignal): Promise<{ stop: string }> {
  const client = makeClient(apiKey);
  let p = providerFor(apiKey);
  let modelRetried = false;
  for (let round = 0; round < 10; round++) {
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
      logClaude("tutor");
      const stream = level === 0
        ? client.beta.messages.stream(params as Parameters<typeof client.beta.messages.stream>[0], { signal }).on("text", onText)
        : client.messages.stream(params as unknown as Parameters<typeof client.messages.stream>[0], { signal }).on("text", onText);
      final = (await stream.finalMessage()) as Awaited<ReturnType<ReturnType<typeof client.beta.messages.stream>["finalMessage"]>>;
    } catch (e) {
      // The key can't use this model: find one it can, once, and try again.
      if (!modelRetried && isModelError(e)) {
        modelRetried = true;
        try { await resolveModel(apiKey); p = providerFor(apiKey); round--; continue; } catch { /* fall through to the error */ }
      }
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
      if (block.name === "draw") {
        const g = cleanGraphic(block.input);
        if ("spec" in g) ev.onGraphic(g.spec);
        results.push({ type: "tool_result", tool_use_id: block.id, ...("spec" in g ? { content: "shown" } : { is_error: true, content: `Not drawn: ${g.error}` }) });
        continue;
      }
      if (block.name === "practice_set") {
        const r = buildTutorSet(block.input);
        if ("set" in r) ev.onSet(r.set);
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          ...("set" in r
            ? { content: `Built "${r.set.title}" (${r.set.questions} questions). Summary: ${r.set.summary}\nThe student now sees a card with a download button and a "Mark my file" upload button under your message.` }
            : { is_error: true, content: `Not built: ${r.error}` }),
        });
        continue;
      }
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
