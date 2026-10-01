import {
  hasProviderKey,
  resolveChatEngine,
  selectReplyEngine,
  type ChatEngineEnv,
  type EngineSelection,
  type ProviderId,
} from "./analytics-bot-contract";
import { modelForProvider } from "./providers";

export function readChatEnv(
  env: NodeJS.ProcessEnv = process.env
): ChatEngineEnv {
  return {
    chatEngine: env.CHAT_ENGINE,
    webhookUrl: env.ANALYTICS_BOT_WEBHOOK_URL,
    openAiKey: env.OPENAI_API_KEY,
    geminiKey: env.GEMINI_API_KEY,
    groqKey: env.GROQ_API_KEY,
    primary: env.AI_PROVIDER_PRIMARY,
    fallback: env.AI_PROVIDER_FALLBACK,
  };
}

export function currentEngine(): EngineSelection {
  return resolveChatEngine(readChatEnv());
}

export function isChatEnabled(env: ChatEngineEnv = readChatEnv()): boolean {
  return selectReplyEngine(env) !== "none";
}

/** Providers offered in the chat model picker and in Settings. */
export const CHAT_MODEL_PROVIDERS = ["gemini", "groq"] as const satisfies readonly ProviderId[];

export type ChatModelOption = {
  provider: ProviderId;
  model: string;
  configured: boolean;
  role: "primary" | "fallback" | null;
};

export function chatModelOptions(env: ChatEngineEnv = readChatEnv()): {
  selectable: boolean;
  models: ChatModelOption[];
} {
  const selection = resolveChatEngine(env);
  return {
    selectable: selection.engine === "native" || selection.engine === "openai",
    models: CHAT_MODEL_PROVIDERS.map((provider) => ({
      provider,
      model: modelForProvider(provider),
      configured: hasProviderKey(provider, env),
      role:
        selection.primary === provider
          ? "primary"
          : selection.fallback === provider
            ? "fallback"
            : null,
    })),
  };
}
