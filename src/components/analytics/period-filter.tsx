"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import {
  ANALYTICS_PERIOD_OPTIONS,
  type AnalyticsPeriodId,
  resolveAnalyticsPeriod,
} from "@/lib/analytics/period";

type Props = {
  /** Current period from the server (kept in sync with ?period=). */
  value?: AnalyticsPeriodId;
};

export function PeriodFilter({ value }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const current = resolveAnalyticsPeriod(
    value ?? searchParams.get("period")
  ).id;

  function select(period: AnalyticsPeriodId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", period);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1 ${
        pending ? "opacity-70" : ""
      }`}
      role="group"
      aria-label="Filtro de período"
    >
      {ANALYTICS_PERIOD_OPTIONS.map((option) => {
        const active = option.id === current;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => select(option.id)}
            disabled={pending}
            title={option.label}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
              active
                ? "bg-accent text-white"
                : "text-muted hover:bg-[#f1f1f1] hover:text-foreground"
            }`}
          >
            {option.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
