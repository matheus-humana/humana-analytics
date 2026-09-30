import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";

import {
  isWorkspaceMessageKey,
  workspaceCopy,
  workspaceText,
  type WorkspaceMessageKey,
} from "./workspace-copy";

const STORED_ERRORS = [
  "engineMissing",
  "webhookRejected",
  "webhookUnreachable",
  "webhookTimeout",
  "openaiMissing",
  "openaiEmpty",
  "openaiBlank",
  "agentLimit",
  "askFailed",
  "ga4LoadFailed",
  "ga4LoadError",
  "chatOpenFailed",
  "chatQueryFailed",
  "chatSpeakFailed",
  "couldNotFetchData",
  "questionRequired",
  "questionTooLong",
  "conversationNotFound",
  "providerBlank",
  "providerEmpty",
  "providerKeyMissing",
  "chatStopped",
] as const satisfies readonly WorkspaceMessageKey[];

/** Maps a stored Portuguese UI sentence, or a dictionary key, to the active locale. */
export function localizeKnownCopy(message: string, locale: ChatLocale): string {
  if (isWorkspaceMessageKey(message)) return workspaceText(locale, message);
  for (const key of STORED_ERRORS) {
    if (
      message === workspaceCopy["pt-BR"][key] ||
      message === workspaceCopy.en[key]
    ) {
      return workspaceText(locale, key);
    }
  }
  return message;
}
