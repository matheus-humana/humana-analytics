import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { APIUserAbortError } from "openai";

import { getGa4ConnectionStatus } from "@/lib/analytics/ga4-source";
import { resolveAnalyticsPeriod } from "@/lib/analytics/period";
import { getGithubConnectionStatus } from "@/lib/github/status";
import { workspaceText } from "@/lib/i18n/workspace-copy";
import { getSeoConnectionStatus } from "@/lib/seo/status";
import { readWebSearchConfig } from "@/lib/web/search";

import type { ChatLocale, EngineSelection, ProviderId } from "./analytics-bot-contract";
import { currentEngine } from "./engine";
import { finalizeAnswer, selectWebCitations } from "./grounding";
import { buildHumanaAnalyticsPrompt, type ConnectedSources } from "./prompts";
import {
  completeChat,
  modelForProvider,
  shouldFallback,
  type ChatCompletionResult,
  type ToolCallDelta,
} from "./providers";
import {
  chatToolDefinitions,
  executeAnalyticsTool,
  type ChatToolDefinition,
  type ToolRunContext,
} from "./tools";
import { WEB_SOURCE } from "./tools/web-tools";
import {
  disconnectedSource,
  prepareToolResult,
  readCitations,
  resultOk,
  safeToolArgs,
  type Citation,
  type ToolCallRecord,
} from "./tool-trace";
import {
  addUsage,
  emptyUsage,
  logUsage,
  summarizeUsage,
  type UsageSummary,
} from "./usage";
import type { StoredTurn } from "./conversations";

const MAX_TOOL_ROUNDS = 3;

export class ChatAbortedError extends Error {
  partial: string;

  constructor(partial: string) {
    super("aborted");
    this.name = "ChatAbortedError";
    this.partial = partial;
  }
}

export type AskAiResult = {
  answer: string;
  toolsUsed: ToolCallRecord[];
  usage: UsageSummary;
  citations: Citation[];
  provider: ProviderId;
  usedFallback: boolean;
  locale: ChatLocale;
};

type Completer = (input: {
  provider: ProviderId;
  model: string;
  apiKey: string;
  messages: ChatCompletionMessageParam[];
  tools: ChatToolDefinition[];
  signal?: AbortSignal;
  onDelta?: (text: string) => void;
}) => Promise<ChatCompletionResult>;

type ExecuteTool = (
  name: string,
  rawArgs: string,
  defaultPeriod: string,
  toolContext?: ToolRunContext
) => Promise<unknown>;

function providerKey(id: ProviderId, override?: Partial<Record<ProviderId, string>>): string {
  const fromOverride = override?.[id]?.trim();
  if (fromOverride) return fromOverride;
  if (id === "gemini") return process.env.GEMINI_API_KEY?.trim() ?? "";
  if (id === "groq") return process.env.GROQ_API_KEY?.trim() ?? "";
  return process.env.OPENAI_API_KEY?.trim() ?? "";
}

async function connectedSources() {
  const [ga4, github, seo] = await Promise.all([
    getGa4ConnectionStatus().catch(() => ({ connected: false })),
    getGithubConnectionStatus().catch(() => ({ connected: false })),
    getSeoConnectionStatus().catch(() => null),
  ]);

  return {
    ga4: ga4.connected,
    github: github.connected,
    seo: Boolean(seo?.pagespeed.connected),
    geo: Boolean(seo?.crawl.connected),
    web: readWebSearchConfig().ok,
  };
}

function abortIfNeeded(signal: AbortSignal | undefined, partial: string) {
  if (signal?.aborted) throw new ChatAbortedError(partial);
}

async function runWithProvider(input: {
  provider: ProviderId;
  apiKey: string;
  locale: ChatLocale;
  question: string;
  periodId: string;
  periodLabel: string;
  history?: StoredTurn[];
  sources: ConnectedSources;
  projectId: string | null;
  signal?: AbortSignal;
  onDelta?: (text: string) => void;
  onToolRound?: (tools: string[]) => void;
  complete: Completer;
  executeTool: ExecuteTool;
  usedFallback: boolean;
}): Promise<AskAiResult> {
  const model = modelForProvider(input.provider);
  const tools = chatToolDefinitions({ web: input.sources.web });
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: buildHumanaAnalyticsPrompt({
        periodLabel: input.periodLabel,
        sources: input.sources,
        locale: input.locale,
      }),
    },
    ...(input.history ?? []).map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: "user", content: input.question.trim() },
  ];

  let usage = emptyUsage();
  const toolsUsed: ToolCallRecord[] = [];
  const citations: Citation[] = [];
  const disconnected: string[] = [];
  let streamed = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    abortIfNeeded(input.signal, streamed);
    let response: ChatCompletionResult;
    try {
      response = await input.complete({
        provider: input.provider,
        model,
        apiKey: input.apiKey,
        messages,
        tools,
        signal: input.signal,
        onDelta: (text) => {
          streamed += text;
          input.onDelta?.(text);
        },
      });
    } catch (error) {
      if (error instanceof APIUserAbortError || input.signal?.aborted) {
        throw new ChatAbortedError(streamed);
      }
      throw error;
    }

    usage = addUsage(usage, response.usage);
    if (response.toolCalls.length > 0) {
      streamed = "";
      input.onToolRound?.(response.toolCalls.map((call) => call.name));
    }

    if (response.toolCalls.length === 0) {
      const draft = response.content || streamed;
      if (!draft.trim()) {
        throw new Error("providerBlank");
      }
      if (!streamed && response.content) input.onDelta?.(response.content);
      const used = selectWebCitations(citations, draft);
      const answer = finalizeAnswer({
        draft,
        locale: input.locale,
        calls: toolsUsed,
        citations: used,
        disconnectedSources: disconnected,
      });
      const summary = summarizeUsage(model, usage, input.provider);
      logUsage(summary, toolsUsed.length);
      return {
        answer,
        toolsUsed,
        usage: summary,
        citations: used,
        provider: input.provider,
        usedFallback: input.usedFallback,
        locale: input.locale,
      };
    }

    messages.push({
      role: "assistant",
      content: response.content || null,
      tool_calls: response.toolCalls.map((call) => ({
        id: call.id || `call_${call.name}`,
        type: "function" as const,
        function: { name: call.name, arguments: call.arguments },
        ...(call.extraContent ? { extra_content: call.extraContent } : {}),
      })),
    });

    for (const call of response.toolCalls) {
      abortIfNeeded(input.signal, streamed);
      const started = Date.now();
      const retrievedAt = new Date().toISOString();
      const raw = await input.executeTool(call.name, call.arguments, input.periodId, {
        projectId: input.projectId,
      });
      const prepared = prepareToolResult(raw, retrievedAt);
      const found = readCitations(prepared);
      citations.push(...found);
      const source = disconnectedSource(raw);
      if (source) disconnected.push(source);
      toolsUsed.push({
        name: call.name,
        args: safeToolArgs(call.arguments),
        source: found[0]?.url ? WEB_SOURCE : (found[0]?.source ?? null),
        period: found[0]?.period ?? null,
        ok: resultOk(raw),
        durationMs: Date.now() - started,
      });
      messages.push({
        role: "tool",
        tool_call_id: call.id || `call_${call.name}`,
        content: JSON.stringify(prepared),
      });
    }
  }

  const summary = summarizeUsage(model, usage, input.provider);
  logUsage(summary, toolsUsed.length);
  const answer = finalizeAnswer({
    draft: workspaceText(input.locale, "agentLimit"),
    locale: input.locale,
    calls: toolsUsed,
    citations,
    disconnectedSources: disconnected,
  });
  return {
    answer,
    toolsUsed,
    usage: summary,
    citations,
    provider: input.provider,
    usedFallback: input.usedFallback,
    locale: input.locale,
  };
}

export async function runAskAiAgent(input: {
  question: string;
  period?: string | null;
  history?: StoredTurn[];
  locale: ChatLocale;
  projectId: string | null;
  onDelta?: (text: string) => void;
  onToolRound?: (tools: string[]) => void;
  signal?: AbortSignal;
  sources?: ConnectedSources;
  selection?: EngineSelection;
  complete?: Completer;
  executeTool?: ExecuteTool;
  keys?: Partial<Record<ProviderId, string>>;
}): Promise<AskAiResult> {
  const period = resolveAnalyticsPeriod(input.period);
  const selection = input.selection ?? currentEngine();
  const providers = [selection.primary, selection.fallback].filter(
    (provider): provider is ProviderId => Boolean(provider)
  );
  if (providers.length === 0) {
    throw new Error("providerKeyMissing");
  }

  const sources = input.sources ?? (await connectedSources());
  const complete = input.complete ?? completeChat;
  const executeTool = input.executeTool ?? executeAnalyticsTool;
  let emitted = false;
  let lastError: unknown;

  for (let index = 0; index < providers.length; index += 1) {
    const provider = providers[index];
    const apiKey = providerKey(provider, input.keys);
    if (!apiKey) {
      lastError = new Error("providerKeyMissing");
      continue;
    }
    try {
      return await runWithProvider({
        provider,
        apiKey,
        locale: input.locale,
        question: input.question,
        periodId: period.id,
        periodLabel: period.label,
        history: input.history,
        sources,
        projectId: input.projectId,
        signal: input.signal,
        onDelta: (text) => {
          emitted = true;
          input.onDelta?.(text);
        },
        onToolRound: input.onToolRound,
        complete,
        executeTool,
        usedFallback: index > 0,
      });
    } catch (error) {
      if (error instanceof ChatAbortedError) throw error;
      lastError = error;
      if (!emitted && index < providers.length - 1 && shouldFallback(error)) continue;
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("providerKeyMissing");
}

export type { ToolCallDelta };
