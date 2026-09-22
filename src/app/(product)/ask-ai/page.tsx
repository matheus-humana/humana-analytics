import { Suspense } from "react";

import { AskAiPanel } from "@/components/ask-ai/ask-ai-panel";

export default function AskAiPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted">Carregando Ask AI…</p>}
    >
      <AskAiPanel />
    </Suspense>
  );
}
