import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";
import { chatSuggestionKeys, workspaceText } from "@/lib/i18n/workspace-copy";

export function humanaAnalyticsSuggestions(locale: ChatLocale): string[] {
  return chatSuggestionKeys.map((key) => workspaceText(locale, key));
}
