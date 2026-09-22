/** Approximate USD per 1M tokens — update when OpenAI changes pricing. */
const MODEL_PRICING_USD_PER_1M: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 },
};

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type UsageSummary = TokenUsage & {
  model: string;
  estimatedCostUsd: number;
};

export function getOpenAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

export function estimateCostUsd(
  model: string,
  usage: TokenUsage
): number {
  const pricing =
    MODEL_PRICING_USD_PER_1M[model] ?? MODEL_PRICING_USD_PER_1M["gpt-4o-mini"];
  const input = (usage.promptTokens / 1_000_000) * pricing.input;
  const output = (usage.completionTokens / 1_000_000) * pricing.output;
  return Number((input + output).toFixed(6));
}

export function emptyUsage(): TokenUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

export function summarizeUsage(
  model: string,
  usage: TokenUsage
): UsageSummary {
  return {
    ...usage,
    model,
    estimatedCostUsd: estimateCostUsd(model, usage),
  };
}
