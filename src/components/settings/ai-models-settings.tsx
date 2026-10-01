"use client";

import { useEffect, useState } from "react";

import type { ChatModel } from "@/components/ai/model-picker";
import { ProviderIcon } from "@/components/ai/provider-icon";
import { useLocale } from "@/components/i18n/locale-provider";
import { IconSearch } from "@/components/workspace/icons";
import { modelDisplayName, PROVIDER_HOSTS, PROVIDER_NAMES } from "@/lib/ai/model-label";
import { workspaceText, type WorkspaceMessageKey } from "@/lib/i18n/workspace-copy";

type WebSearchMode = "key" | "keyless" | "off";

const WEB_STATUS: Record<WebSearchMode, { label: WorkspaceMessageKey; dot: string }> = {
  key: { label: "aiStatusReady", dot: "bg-[#0cce6b]" },
  keyless: { label: "aiWebKeyless", dot: "bg-[#ffa400]" },
  off: { label: "aiWebOff", dot: "bg-[#cccccc]" },
};

export function AiModelsSettings() {
  const { locale } = useLocale();
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  const [models, setModels] = useState<ChatModel[] | null>(null);
  const [webSearch, setWebSearch] = useState<WebSearchMode | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/ai/models", { cache: "no-store" });
        const data = (await response.json()) as {
          ok?: boolean;
          models?: ChatModel[];
          webSearch?: WebSearchMode;
        };
        if (cancelled) return;
        if (!response.ok || !data.ok) {
          setFailed(true);
          return;
        }
        setModels(data.models ?? []);
        setWebSearch(data.webSearch ?? "off");
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mt-5 border-t border-border pt-4">
      <h2 className="font-display text-sm font-semibold text-foreground">
        {text("aiModelsTitle")}
      </h2>
      <p className="mt-1 text-sm text-muted">{text("aiModelsBody")}</p>

      {failed ? (
        <p className="mt-3 text-sm text-muted">{text("aiModelsUnavailable")}</p>
      ) : (
        <ul className="mt-3 space-y-2" aria-busy={models === null}>
          {(models ?? []).map((item) => (
            <li
              key={item.provider}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
            >
              <ProviderIcon provider={item.provider} className="size-7 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  {PROVIDER_NAMES[item.provider]}
                  {item.role ? (
                    <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">
                      {text(item.role === "primary" ? "aiRolePrimary" : "aiRoleFallback")}
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted">
                  {modelDisplayName(item.model)} · {PROVIDER_HOSTS[item.provider]}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${item.configured ? "bg-[#0cce6b]" : "bg-[#cccccc]"}`}
                />
                {text(item.configured ? "aiStatusReady" : "aiStatusMissing")}
              </span>
            </li>
          ))}
          {webSearch ? (
            <li className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                <IconSearch className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{text("aiWebTitle")}</p>
                <p className="truncate text-xs text-muted">{text("aiWebDetail")}</p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                <span aria-hidden className={`size-1.5 rounded-full ${WEB_STATUS[webSearch].dot}`} />
                {text(WEB_STATUS[webSearch].label)}
              </span>
            </li>
          ) : null}
          {models === null
            ? [0, 1].map((index) => (
                <li key={index} className="h-[3.25rem] animate-pulse rounded-lg bg-secondary" />
              ))
            : null}
        </ul>
      )}

      <p className="mt-3 text-xs text-muted">{text("aiModelsChoice")}</p>
    </section>
  );
}
