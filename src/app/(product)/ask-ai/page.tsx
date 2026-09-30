import { Suspense } from "react";

import { AskAiPanel } from "@/components/ask-ai/ask-ai-panel";
import { isChatEnabled } from "@/lib/ai/engine";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import { workspaceText } from "@/lib/i18n/workspace-copy";

export default async function AskAiPage() {
  const locale = await getRequestLocale();
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted">{workspaceText(locale, "chatLoadingPanel")}</p>
      }
    >
      <AskAiPanel chatEnabled={isChatEnabled()} />
    </Suspense>
  );
}
