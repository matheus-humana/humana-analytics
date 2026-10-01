import Image from "next/image";

import type { ThinkingSource } from "@/lib/ai/thinking-stage";
import type { WorkspaceMessageKey } from "@/lib/i18n/workspace-copy";

const SOURCE_LABELS: Record<ThinkingSource, WorkspaceMessageKey> = {
  ga4: "chatThinkingGa4",
  github: "chatThinkingGithub",
  seo: "chatThinkingSeo",
  geo: "chatThinkingGeo",
  web: "chatThinkingWeb",
};

export function thinkingText(
  sources: readonly ThinkingSource[],
  text: (key: WorkspaceMessageKey) => string
): string {
  if (sources.length === 0) return text("chatThinkingNow");
  if (sources.length === 1) return text(SOURCE_LABELS[sources[0]]);
  return text("chatThinkingSources").replace("{count}", String(sources.length));
}

export function ThinkingIndicator({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-1 text-sm">
      <span className="relative flex h-6 w-6 items-center justify-center" aria-hidden>
        <span className="ha-think-halo absolute inset-0 rounded-full" />
        <Image
          src="/brand/simbolo-preto-humana.png"
          alt=""
          width={10}
          height={20}
          className="ha-think-mark relative h-4 w-auto"
        />
      </span>
      <span className="ha-think-text font-medium">{label.replace(/[.…]+$/, "")}</span>
      <span className="flex items-end gap-0.5 pb-0.5" aria-hidden>
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="ha-think-dot block size-1 rounded-full bg-muted"
            style={{ animationDelay: `${index * 0.16}s` }}
          />
        ))}
      </span>
    </div>
  );
}
