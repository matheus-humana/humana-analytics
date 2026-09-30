import OpenAI, { APIConnectionTimeoutError, APIError, APIUserAbortError } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import type { ProviderId } from "./analytics-bot-contract";
import { emptyUsage, type TokenUsage } from "./usage";

/** Verified against Google's Gemini API model page (stable id, July 2026). */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

export const GEMINI_OPENAI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/";
export const GROQ_OPENAI_BASE_URL = "https://api.groq.com/openai/v1";

const PROVIDER_TIMEOUT_MS = 25_000;

export type ToolCallDelta = {
  id: string;
  name: string;
  arguments: string;
};

export type ChatCompletionResult = {
  content: string;
  toolCalls: ToolCallDelta[];
  usage: TokenUsage;
};

export function modelForProvider(provider: ProviderId): string {
  if (provider === "gemini") {
    return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  }
  if (provider === "groq") {
    return process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
  }
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

export function baseUrlForProvider(provider: ProviderId): string | undefined {
  if (provider === "gemini") return GEMINI_OPENAI_BASE_URL;
  if (provider === "groq") return GROQ_OPENAI_BASE_URL;
  return undefined;
}

export function createProviderClient(provider: ProviderId, apiKey: string) {
  return new OpenAI({
    apiKey,
    baseURL: baseUrlForProvider(provider),
    timeout: PROVIDER_TIMEOUT_MS,
    maxRetries: 0,
  });
}

export function shouldFallback(error: unknown): boolean {
  if (error instanceof APIUserAbortError) return false;
  if (error instanceof APIConnectionTimeoutError) return true;
  if (error instanceof APIError) {
    const status = error.status;
    return status === 429 || (typeof status === "number" && status >= 500);
  }
  if (error instanceof Error && error.name === "TimeoutError") return true;
  if (error instanceof Error && /timeout|timed out/i.test(error.message)) return true;
  return false;
}

function usageFromChunk(usage: {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
} | null | undefined): TokenUsage {
  return {
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
  };
}

/**
 * One Chat Completions call. Gemini and Groq are used through their
 * OpenAI-compatible endpoints, so tool calls and streaming stay on the
 * client the app already depends on.
 */
export async function completeChat(input: {
  provider: ProviderId;
  model: string;
  apiKey: string;
  messages: ChatCompletionMessageParam[];
  tools: OpenAI.Chat.Completions.ChatCompletionTool[];
  signal?: AbortSignal;
  onDelta?: (text: string) => void;
}): Promise<ChatCompletionResult> {
  const client = createProviderClient(input.provider, input.apiKey);
  const stream = await client.chat.completions.create(
    {
      model: input.model,
      messages: input.messages,
      tools: input.tools,
      tool_choice: "auto",
      temperature: input.provider === "openai" ? 0.2 : undefined,
      max_tokens: 700,
      stream: true,
      stream_options: { include_usage: true },
    },
    { signal: input.signal }
  );

  const toolAcc = new Map<number, ToolCallDelta>();
  let content = "";
  let sawTool = false;
  let usage = emptyUsage();

  for await (const chunk of stream) {
    if (input.signal?.aborted) {
      throw new APIUserAbortError();
    }
    const delta = chunk.choices[0]?.delta;
    if (delta?.tool_calls) {
      sawTool = true;
      for (const call of delta.tool_calls) {
        const index = call.index ?? 0;
        const current = toolAcc.get(index) ?? { id: "", name: "", arguments: "" };
        if (call.id) current.id = call.id;
        if (call.function?.name) current.name += call.function.name;
        if (call.function?.arguments) current.arguments += call.function.arguments;
        toolAcc.set(index, current);
      }
    }
    if (delta?.content) {
      content += delta.content;
      if (!sawTool) input.onDelta?.(delta.content);
    }
    if (chunk.usage) usage = usageFromChunk(chunk.usage);
  }

  const toolCalls = [...toolAcc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, call]) => call)
    .filter((call) => call.name);

  return { content: content.trim(), toolCalls, usage };
}
