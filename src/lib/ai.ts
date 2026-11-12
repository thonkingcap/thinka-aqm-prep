// One-shot Claude calls on the student's key: marking written answers, and designing a custom practice set.
// Both force a single tool call so the output is structured; the parsing lives in aiParse.ts (tested offline).
import type Anthropic from "@anthropic-ai/sdk";
import { makeClient, explainError } from "./claude.ts";
import { providerFor } from "./provider.ts";
import { addUsage } from "./spend.ts";
import type { CustomSpec } from "./sets.ts";
import {
  MARK_TOOL, MARK_SYSTEM, markPrompt, parseMarks, BLANK_MARK, isBlank,
  DESIGN_TOOL, DESIGN_SYSTEM, designPrompt, specFromDesign,
  type WrittenItem, type WrittenMark,
} from "./aiParse.ts";

export type { WrittenItem, WrittenMark };

type Tool = { name: string; description: string; input_schema: Anthropic.Messages.Tool.InputSchema };

/** One request that must answer with `tool`; returns the tool's input object. */
async function forcedToolCall(apiKey: string, keyFp: string, system: string, user: string, tool: Tool, maxTokens: number, signal?: AbortSignal): Promise<unknown> {
  const p = providerFor(apiKey);
  const client = makeClient(apiKey);
  let msg: Anthropic.Messages.Message;
  try {
    msg = await client.messages.create(
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
    const input = await forcedToolCall(apiKey, keyFp, MARK_SYSTEM, markPrompt(toSend), MARK_TOOL, Math.max(1500, maxTokens), signal);
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
  const input = await forcedToolCall(apiKey, keyFp, DESIGN_SYSTEM, designPrompt(request), DESIGN_TOOL, 1500, signal);
  return specFromDesign(input);
}
