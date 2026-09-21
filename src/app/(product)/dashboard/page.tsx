import { Acquisition } from "@/components/dashboard/acquisition";
import {
  DashboardHeader,
  MetricCards,
} from "@/components/dashboard/metric-cards";
import { TopPages } from "@/components/dashboard/top-pages";
import { TrafficChart } from "@/components/dashboard/traffic-chart";
import type {
  AcquisitionSource,
  MetricCard,
  TopPage,
  TrafficPoint,
} from "@/data/mock/dashboard";
import { getPersistedMetrics } from "@/lib/analytics/queries";
import { getDb } from "@/lib/db";
import { getDatabaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatChange(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function weekdayLabel(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

export default async function DashboardPage() {
  let live:
    | Awaited<ReturnType<typeof getPersistedMetrics>>
    | null = null;

  if (getDatabaseUrl()) {
    try {
      const metrics = await getPersistedMetrics(getDb());
      if (metrics.overview && metrics.overview.sessions > 0) {
        live = metrics;
      }
    } catch {
      live = null;
    }
  }

  const cards: MetricCard[] | undefined = live?.overview
    ? [
        {
          id: "users",
          label: "Users",
          value: formatNumber(live.overview.activeUsers),
          change: live.comparison
            ? formatChange(live.comparison.change.activeUsers)
            : "—",
          trend:
            (live.comparison?.change.activeUsers ?? 0) >= 0 ? "up" : "down",
        },
        {
          id: "sessions",
          label: "Sessions",
          value: formatNumber(live.overview.sessions),
          change: live.comparison
            ? formatChange(live.comparison.change.sessions)
            : "—",
          trend: (live.comparison?.change.sessions ?? 0) >= 0 ? "up" : "down",
        },
        {
          id: "page-views",
          label: "Page Views",
          value: formatNumber(live.overview.screenPageViews),
          change: live.comparison
            ? formatChange(live.comparison.change.screenPageViews)
            : "—",
          trend:
            (live.comparison?.change.screenPageViews ?? 0) >= 0 ? "up" : "down",
        },
        {
          id: "engagement",
          label: "Engagement Rate",
          value: `${(live.overview.engagementRate * 100).toFixed(1)}%`,
          change: "—",
          trend: "up",
        },
      ]
    : undefined;

  const series: TrafficPoint[] | undefined = live
    ? live.daily.map((row) => ({
        day: weekdayLabel(row.date),
        users: row.activeUsers,
      }))
    : undefined;

  const pages: TopPage[] | undefined = live
    ? live.pages.map((row) => ({
        path: row.pagePath,
        views: formatNumber(row.screenPageViews),
      }))
    : undefined;

  const sources: AcquisitionSource[] | undefined = live
    ? (() => {
        const total = live.trafficSources.reduce(
          (sum, row) => sum + row.sessions,
          0,
        );
        return live.trafficSources.map((row) => ({
          source: `${row.source} / ${row.medium}`,
          share: total
            ? `${Math.round((row.sessions / total) * 100)}%`
            : "0%",
        }));
      })()
    : undefined;

  return (
    <div className="space-y-6">
      <DashboardHeader
        live={Boolean(live)}
        periodLabel={
          live ? `${live.range.startDate} → ${live.range.endDate}` : undefined
        }
      />
      <MetricCards cards={cards} />
      <TrafficChart series={series} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TopPages pages={pages} />
        <Acquisition sources={sources} />
      </div>
    </div>
  );
}
