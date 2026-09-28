"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { useLocale } from "@/components/i18n/locale-provider";
import {
  ANALYTICS_PERIOD_IDS,
  type AnalyticsPeriodId,
  resolveAnalyticsPeriod,
} from "@/lib/analytics/period";
import { periodLabel, periodShortLabel } from "@/lib/i18n/period-label";
import { workspaceText } from "@/lib/i18n/workspace-copy";

type Props = {
  /** Current period from the server (kept in sync with ?period=). */
  value?: AnalyticsPeriodId;
};

export function PeriodFilter({ value }: Props) {
  const { locale } = useLocale();
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
      className={`inline-flex items-center rounded-full bg-secondary p-0.5 ${
        pending ? "opacity-70" : ""
      }`}
      role="group"
      aria-label={workspaceText(locale, "periodFilter")}
    >
      {ANALYTICS_PERIOD_IDS.map((id) => {
        const active = id === current;
        return (
          <button
            key={id}
            type="button"
            onClick={() => select(id)}
            disabled={pending}
            title={periodLabel(locale, id)}
            className={`rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
              active ? "ha-primary" : "text-muted hover:text-foreground"
            }`}
          >
            {periodShortLabel(locale, id)}
          </button>
        );
      })}
    </div>
  );
}
