import {
  resolveChatEngine,
  selectReplyEngine,
  type ChatEngineEnv,
  type EngineSelection,
} from "./analytics-bot-contract";

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
