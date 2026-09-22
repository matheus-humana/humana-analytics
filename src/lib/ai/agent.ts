import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

import {
  askAiToolDefinitions,
  executeAskAiTool,
} from "@/lib/ai/tools/ga4-tools";
import {
  addUsage,
  emptyUsage,
  getOpenAiModel,
  summarizeUsage,
  type TokenUsage,
  type UsageSummary,
} from "@/lib/ai/usage";
import { resolveAnalyticsPeriod } from "@/lib/analytics/period";

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

function systemPrompt(periodLabel: string): string {
  return `Você é o analista de website da Humana Analytics.
Responda em português do Brasil, de forma clara e objetiva.
Use APENAS dados retornados pelas tools (GA4). Não invente métricas.
Se faltar dado, diga o que falta.
Período padrão da interface: ${periodLabel}.
Quando a pergunta não especificar outro intervalo, use esse período nas tools.
Inclua números concretos na resposta.`;
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

export type AskAiResult = {
  answer: string;
  toolsUsed: string[];
  usage: UsageSummary;
};

export async function runAskAiAgent(input: {
  question: string;
  period?: string | null;
}): Promise<AskAiResult> {
  const period = resolveAnalyticsPeriod(input.period);
  const client = getClient();
  const model = getOpenAiModel();
  const tools = askAiToolDefinitions as unknown as ChatCompletionTool[];

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt(period.label) },
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
      return {
        answer,
        toolsUsed,
        usage: summarizeUsage(model, usage),
      };
    }

    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      toolsUsed.push(call.function.name);
      const result = await executeAskAiTool(
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

  return {
    answer:
      "Atingi o limite de consultas internas. Reformule a pergunta de forma mais específica.",
    toolsUsed,
    usage: summarizeUsage(model, usage),
  };
}
