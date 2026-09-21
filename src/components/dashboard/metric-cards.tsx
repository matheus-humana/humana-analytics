import {
  dashboardPeriodLabel,
  metricCards as mockMetricCards,
} from "@/data/mock/dashboard";
import type { MetricCard } from "@/data/mock/dashboard";

type DashboardHeaderProps = {
  live?: boolean;
  periodLabel?: string;
};

export function DashboardHeader({
  live = false,
  periodLabel = dashboardPeriodLabel,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="mb-2 inline-flex items-center rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted">
          {live ? "PostgreSQL" : "Demo data"}
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Website Overview
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted sm:text-base">
          Understand what&apos;s happening across your website.
        </p>
      </div>

      <div className="inline-flex items-center gap-2 self-start rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
        <span className="text-muted">Period</span>
        <span className="font-medium">{periodLabel}</span>
      </div>
    </div>
  );
}

export function MetricCards({ cards = mockMetricCards }: { cards?: MetricCard[] }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <MetricCardItem key={card.id} card={card} />
      ))}
    </section>
  );
}

function MetricCardItem({ card }: { card: MetricCard }) {
  const positive = card.trend === "up";

  return (
    <article className="rounded-xl border border-border bg-surface p-4 shadow-sm shadow-black/5">
      <p className="text-sm text-muted">{card.label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        {card.value}
      </p>
      <p
        className={`mt-2 text-sm ${
          positive ? "text-[#6074c8]" : "text-[#5f5f5f]"
        }`}
      >
        {card.change}{" "}
        <span className="text-muted">vs previous period</span>
      </p>
    </article>
  );
}
