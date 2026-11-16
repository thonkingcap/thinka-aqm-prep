// One-shot Claude calls on the student's key: marking written answers, and designing a custom practice set.
// Both force a single tool call so the output is structured; the parsing lives in aiParse.ts (tested offline).
import type Anthropic from "@anthropic-ai/sdk";
import { makeClient, explainError, isModelError } from "./claude.ts";
import { providerFor, resolveModel } from "./provider.ts";
import { addUsage } from "./spend.ts";
import { logClaude, type ClaudeFeature } from "./usage.ts";
import type { CustomSpec } from "./sets.ts";
import {
  MARK_TOOL, MARK_SYSTEM, markPrompt, parseMarks, BLANK_MARK, isBlank,
  DESIGN_TOOL, DESIGN_SYSTEM, designPrompt, specFromDesign,
  COACH_TOOL, COACH_SYSTEM, coachPrompt, parseAdvice,
  type WrittenItem, type WrittenMark, type CoachAdvice,
} from "./aiParse.ts";

export type { WrittenItem, WrittenMark, CoachAdvice };

type Tool = { name: string; description: string; input_schema: Anthropic.Messages.Tool.InputSchema };

/** One request that must answer with `tool`; returns the tool's input object. */
async function forcedToolCall(feature: ClaudeFeature, apiKey: string, keyFp: string, system: string, user: string, tool: Tool, maxTokens: number, signal?: AbortSignal): Promise<unknown> {
  let p = providerFor(apiKey);
  logClaude(feature);
  const client = makeClient(apiKey);
  let msg: Anthropic.Messages.Message;
  const send = () => client.messages.create(
    {
      model: p.model,
      max_tokens: maxTokens,
      system,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [{ role: "user", content: user }],
    },
    { signal },
  );
  try {
    try {
      msg = await send();
    } catch (e) {
      // The key can't use this model: pick one it can and try once more.
      if (signal?.aborted || !isModelError(e)) throw e;
      await resolveModel(apiKey);
      p = providerFor(apiKey);
      msg = await send();
    }
  } catch (e) {
    if (signal?.aborted) throw new Error("Stopped.");
    throw new Error(explainError(e, p));
  }
  addUsage(keyFp, msg.usage);
  const block = msg.content.find((b) => b.type === "tool_use" && b.name === tool.name);
  if (!block || block.type !== "tool_use") {
    if (msg.stop_reason === "refusal") throw new Error("Claude declined this request.");
    throw new Error("Claude didn't return a usable answer. Try again.");
  }
  return block.input;
}

/**
 * Marks written answers against the model answer and key points, in one call. Returns one mark per item,
 * in input order. Blank answers are marked 0 locally and never sent.
 */
export async function markWritten(apiKey: string, keyFp: string, items: WrittenItem[], signal?: AbortSignal): Promise<WrittenMark[]> {
  const toSend = items.filter((it) => !isBlank(it.answer));
  let marked: WrittenMark[] = [];
  if (toSend.length) {
    const maxTokens = Math.min(4000, 400 + 120 * toSend.length);
    const input = await forcedToolCall("mark", apiKey, keyFp, MARK_SYSTEM, markPrompt(toSend), MARK_TOOL, Math.max(1500, maxTokens), signal);
    marked = parseMarks(input, toSend.map((it) => it.id));
  }
  const byId = new Map(marked.map((m) => [m.id, m]));
  return items.map((it) => byId.get(it.id) ?? BLANK_MARK(it.id));
}

/**
 * Asks Claude for a question mix (and optional story settings) matching the student's request, then builds
 * a custom-set spec from it. Claude chooses kinds and wording only; the site's engine makes every number.
 */
export async function designCustomSet(apiKey: string, keyFp: string, request: string, signal?: AbortSignal): Promise<{ spec: CustomSpec; summary: string }> {
  const input = await forcedToolCall("design", apiKey, keyFp, DESIGN_SYSTEM, designPrompt(request), DESIGN_TOOL, 1500, signal);
  return specFromDesign(input);
}

/** Study advice from a marked Exam 3: what to fix first, by area, and a request for one targeted set. */
export async function coachExam3(apiKey: string, keyFp: string, lines: string[], score: string, signal?: AbortSignal): Promise<CoachAdvice> {
  const input = await forcedToolCall("plan", apiKey, keyFp, COACH_SYSTEM, coachPrompt(lines, score), COACH_TOOL, 1200, signal);
  return parseAdvice(input);
}
