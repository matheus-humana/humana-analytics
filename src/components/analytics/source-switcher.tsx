"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import {
  DASHBOARD_SOURCES,
  type DashboardSource,
  resolveDashboardSource,
} from "@/lib/analytics/dashboard-source";

export type { DashboardSource };

type Props = {
  value?: DashboardSource;
};

const LABELS: Record<DashboardSource, string> = {
  ga4: "GA4",
  clarity: "Clarity",
  vercel: "Vercel",
};

export function SourceSwitcher({ value }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const current = resolveDashboardSource(
    value ?? searchParams.get("source")
  );

  function select(source: DashboardSource) {
    const params = new URLSearchParams(searchParams.toString());
    if (source === "ga4") {
      params.delete("source");
    } else {
      params.set("source", source);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div
      className={`inline-flex items-center rounded-full bg-secondary p-0.5 ${
        pending ? "opacity-70" : ""
      }`}
      role="group"
      aria-label="Fonte de dados"
    >
      {DASHBOARD_SOURCES.map((source) => {
        const active = source === current;
        return (
          <button
            key={source}
            type="button"
            onClick={() => select(source)}
            disabled={pending}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              active ? "ha-primary" : "text-muted hover:text-foreground"
            }`}
          >
            {LABELS[source]}
          </button>
        );
      })}
    </div>
  );
}
