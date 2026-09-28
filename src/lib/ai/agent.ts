import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

import { getGa4ConnectionStatus } from "@/lib/analytics/ga4-source";
import { resolveAnalyticsPeriod } from "@/lib/analytics/period";
import { getGithubConnectionStatus } from "@/lib/github/status";
import { getSeoConnectionStatus } from "@/lib/seo/status";

import type { StoredTurn } from "./conversations";
import { buildHumanaAnalyticsPrompt } from "./prompts";
import {
  analyticsToolDefinitions,
  executeAnalyticsTool,
} from "./tools";
import {
  addUsage,
  emptyUsage,
  getOpenAiModel,
  logUsage,
  summarizeUsage,
  type TokenUsage,
  type UsageSummary,
} from "./usage";

const MAX_TOOL_ROUNDS = 4;
const MAX_OUTPUT_TOKENS = 700;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY não configurada. Adicione a chave em .env.local."
    );
  }
  return new OpenAI({ apiKey });
}

function usageFromResponse(response: {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
}): TokenUsage {
  return {
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    totalTokens: response.usage?.total_tokens ?? 0,
  };
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
  };
}

export type AskAiResult = {
  answer: string;
  toolsUsed: string[];
  usage: UsageSummary;
};

export async function runAskAiAgent(input: {
  question: string;
  period?: string | null;
  history?: StoredTurn[];
}): Promise<AskAiResult> {
  const period = resolveAnalyticsPeriod(input.period);
  const client = getClient();
  const model = getOpenAiModel();
  const tools = analyticsToolDefinitions as unknown as ChatCompletionTool[];
  const sources = await connectedSources();

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: buildHumanaAnalyticsPrompt({
        periodLabel: period.label,
        sources,
      }),
    },
    ...(input.history ?? []).map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: "user", content: input.question.trim() },
  ];

  let usage = emptyUsage();
  const toolsUsed: string[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.2,
      max_tokens: MAX_OUTPUT_TOKENS,
    });

    usage = addUsage(usage, usageFromResponse(response));
    const message = response.choices[0]?.message;
    if (!message) {
      throw new Error("OpenAI não retornou mensagem.");
    }

    messages.push(message);

    const toolCalls = message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      const answer = message.content?.trim();
      if (!answer) {
        throw new Error("OpenAI retornou resposta vazia.");
      }
      const summary = summarizeUsage(model, usage);
      logUsage(summary, toolsUsed.length);
      return {
        answer,
        toolsUsed,
        usage: summary,
      };
    }

    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      toolsUsed.push(call.function.name);
      const result = await executeAnalyticsTool(
        call.function.name,
        call.function.arguments,
        period.id
      );
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  const summary = summarizeUsage(model, usage);
  logUsage(summary, toolsUsed.length);
  return {
    answer:
      "Atingi o limite de consultas internas. Reformule a pergunta de forma mais específica.",
    toolsUsed,
    usage: summary,
  };
}
