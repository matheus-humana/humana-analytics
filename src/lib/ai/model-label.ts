import type { ProviderId } from "./analytics-bot-contract";

export const PROVIDER_NAMES: Record<ProviderId, string> = {
  gemini: "Gemini",
  groq: "Groq",
  openai: "OpenAI",
};

export const PROVIDER_HOSTS: Record<ProviderId, string> = {
  gemini: "Google AI Studio",
  groq: "GroqCloud",
  openai: "OpenAI",
};

const UPPERCASE_PARTS = new Set(["gpt", "oss", "ai"]);

/** "gemini-3.5-flash-lite" → "Gemini 3.5 Flash Lite", "openai/gpt-oss-120b" → "GPT OSS 120B". */
export function modelDisplayName(model: string): string {
  const base = model.split("/").pop() ?? model;
  return base
    .split("-")
    .filter(Boolean)
    .map((part) => {
      if (UPPERCASE_PARTS.has(part.toLowerCase())) return part.toUpperCase();
      if (/^\d+(\.\d+)?[bkm]$/i.test(part)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}
