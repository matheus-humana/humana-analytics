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
] as const satisfies readonly WorkspaceMessageKey[];

/** Maps a stored Portuguese UI sentence, or a dictionary key, to the active locale. */
export function localizeKnownCopy(message: string, locale: ChatLocale): string {
  if (isWorkspaceMessageKey(message)) return workspaceText(locale, message);
  const portuguese = workspaceCopy["pt-BR"];
  for (const key of STORED_ERRORS) {
    if (message === portuguese[key]) return workspaceText(locale, key);
  }
  return message;
}
