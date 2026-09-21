"use client";

import { useState } from "react";

import {
  dataSourcesDemo,
  ga4ComingSoonMessage,
} from "@/data/mock/data-sources";

export function DataSourcesPanel() {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Data Sources
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
          Connect analytics platforms to power dashboards and Ask AI.
        </p>
      </div>

      {message ? (
        <div className="rounded-lg border border-[#cccccc] bg-[#f1f1f1] px-4 py-3 text-sm text-[#151515]">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4">
        {dataSourcesDemo.map((source) => (
          <article
            key={source.id}
            className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">
                {source.name}
              </h2>
              <p
                className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs ${
                  source.status === "not_connected"
                    ? "bg-[#f1f1f1] text-[#5f5f5f]"
                    : "bg-accent-soft text-accent"
                }`}
              >
                {source.statusLabel}
              </p>
            </div>

            {source.status === "not_connected" && source.actionLabel ? (
              <button
                type="button"
                onClick={() => setMessage(ga4ComingSoonMessage)}
                className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[#f1f1f1]"
              >
                {source.actionLabel}
              </button>
            ) : (
              <span className="text-sm text-muted">Unavailable in demo</span>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
