import {
  DashboardHeader,
  LiveGa4Dashboard,
} from "@/components/dashboard/live-ga4-dashboard";
import { LiveClarityDashboard } from "@/components/dashboard/live-clarity-dashboard";
import { LiveVercelDashboard } from "@/components/dashboard/live-vercel-dashboard";
import { Acquisition } from "@/components/dashboard/acquisition";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { TopPages } from "@/components/dashboard/top-pages";
import { TrafficChart } from "@/components/dashboard/traffic-chart";
import { resolveDashboardSource } from "@/lib/analytics/dashboard-source";
import {
  acquisitionSources,
  metricCards,
  topPages,
  trafficSeries,
} from "@/data/mock/dashboard";
import { resolveAnalyticsPeriod } from "@/lib/analytics/period";
import { hasClarityCredentials } from "@/lib/analytics/clarity-source";
import { hasVercelCredentials } from "@/lib/analytics/vercel-source";
import { fetchClarityLiveInsights } from "@/lib/clarity/fetch-report";
import { fetchGa4Dashboard } from "@/lib/ga4/fetch-report";
import { fetchVercelDashboard } from "@/lib/vercel/fetch-report";

type PageProps = {
  searchParams: Promise<{ period?: string; source?: string }>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const period = resolveAnalyticsPeriod(params.period);
  const source = resolveDashboardSource(params.source);

  if (source === "clarity") {
    if (!hasClarityCredentials()) {
      return (
        <div className="space-y-6">
          <DashboardHeader
            live={false}
            source="clarity"
            periodId={period.id}
            periodLabel={period.label}
            error="Conecte o Microsoft Clarity em Data Sources."
          />
        </div>
      );
    }

    let clarityError: string | null = null;
    let clarity: Awaited<ReturnType<typeof fetchClarityLiveInsights>> | null =
      null;

    try {
      clarity = await fetchClarityLiveInsights({ period: period.id });
    } catch (error) {
      clarityError =
        error instanceof Error ? error.message : "Falha ao carregar Clarity";
    }

    if (clarity) {
      return (
        <div className="space-y-6">
          <DashboardHeader
            live
            source="clarity"
            periodId={period.id}
            periodLabel={clarity.periodLabel}
          />
          <LiveClarityDashboard data={clarity} />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <DashboardHeader
          live={false}
          source="clarity"
          periodId={period.id}
          periodLabel={period.label}
          error={clarityError}
        />
      </div>
    );
  }

  if (source === "vercel") {
    if (!hasVercelCredentials()) {
      return (
        <div className="space-y-6">
          <DashboardHeader
            live={false}
            source="vercel"
            periodId={period.id}
            periodLabel={period.label}
            error="Conecte o Vercel Analytics em Data Sources."
          />
        </div>
      );
    }

    let vercelError: string | null = null;
    let vercel: Awaited<ReturnType<typeof fetchVercelDashboard>> | null = null;

    try {
      vercel = await fetchVercelDashboard({ period: period.id });
    } catch (error) {
      vercelError =
        error instanceof Error ? error.message : "Falha ao carregar Vercel";
    }

    if (vercel) {
      return (
        <div className="space-y-6">
          <DashboardHeader
            live
            source="vercel"
            periodId={period.id}
            periodLabel={vercel.periodLabel}
          />
          <LiveVercelDashboard data={vercel} />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <DashboardHeader
          live={false}
          source="vercel"
          periodId={period.id}
          periodLabel={period.label}
          error={vercelError}
        />
      </div>
    );
  }

  let liveError: string | null = null;
  let dashboard: Awaited<ReturnType<typeof fetchGa4Dashboard>> | null = null;

  try {
    dashboard = await fetchGa4Dashboard(period.id);
  } catch (error) {
    liveError =
      error instanceof Error ? error.message : "Falha ao carregar GA4";
  }

  if (dashboard) {
    return (
      <div className="space-y-6">
        <DashboardHeader
          live
          source="ga4"
          periodId={period.id}
          periodLabel={dashboard.periodLabel}
        />
        <LiveGa4Dashboard data={dashboard} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        live={false}
        source="ga4"
        periodId={period.id}
        periodLabel={period.label}
        error={liveError}
      />
      <MetricCards cards={metricCards} showComparison />
      <TrafficChart series={trafficSeries} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TopPages pages={topPages} />
        <Acquisition sources={acquisitionSources} />
      </div>
    </div>
  );
}
