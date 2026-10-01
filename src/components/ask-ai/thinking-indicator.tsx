import { ProviderIcon as ModelIcon } from "@/components/ai/provider-icon";
import { IconSearch } from "@/components/workspace/icons";
import { ProviderIcon as SourceIcon } from "@/components/workspace/provider-icons";
import type { ProviderId } from "@/lib/ai/analytics-bot-contract";
import type { ThinkingSource } from "@/lib/ai/thinking-stage";
import type { WorkspaceMessageKey } from "@/lib/i18n/workspace-copy";
import type { ConnectionProvider } from "@/lib/workspace/status-log";

const SOURCE_ICONS: Record<Exclude<ThinkingSource, "web">, ConnectionProvider> = {
  ga4: "ga4",
  github: "github",
  seo: "pagespeed",
  geo: "crawl",
};

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

export function ThinkingIndicator({
  sources,
  model,
  label,
}: {
  sources: readonly ThinkingSource[];
  model: ProviderId | null;
  label: string;
}) {
  return (
    <div role="status" className="flex items-center gap-2 py-1 text-sm">
      <span className="relative flex h-6 min-w-6 items-center justify-center" aria-hidden>
        {sources.length === 0 ? (
          <>
            <span className="ha-think-halo absolute inset-0 rounded-full" />
            {model ? (
              <ModelIcon provider={model} className="ha-think-spark relative size-4" />
            ) : (
              <SparkIcon className="ha-think-spark relative size-4 text-accent" />
            )}
          </>
        ) : (
          <span className="flex items-center gap-1">
            {sources.slice(0, 3).map((source, index) => (
              <span
                key={source}
                className="ha-think-hop flex"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                {source === "web" ? (
                  <IconSearch className="size-4 text-accent" />
                ) : (
                  <SourceIcon provider={SOURCE_ICONS[source]} className="size-4" />
                )}
              </span>
            ))}
          </span>
        )}
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

function SparkIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12 24a14.3 14.3 0 0 0-12-12A14.3 14.3 0 0 0 12 0a14.3 14.3 0 0 0 12 12 14.3 14.3 0 0 0-12 12Z"
      />
    </svg>
  );
}
