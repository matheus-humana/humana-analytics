import {
  DashboardHeader,
  LiveGa4Dashboard,
} from "@/components/dashboard/live-ga4-dashboard";
import { LiveClarityDashboard } from "@/components/dashboard/live-clarity-dashboard";
import { LiveVercelDashboard } from "@/components/dashboard/live-vercel-dashboard";
import { hasClarityCredentials } from "@/lib/analytics/clarity-source";
import type { DashboardSource } from "@/lib/analytics/dashboard-source";
import { hasVercelCredentials } from "@/lib/analytics/vercel-source";
import type { AnalyticsPeriod, AnalyticsPeriodId } from "@/lib/analytics/period";
import {
  fetchClarityLiveInsights,
  type ClarityDashboardData,
} from "@/lib/clarity/fetch-report";
import { fetchGa4Dashboard, type Ga4DashboardData } from "@/lib/ga4/fetch-report";
import {
  fetchVercelDashboard,
  type VercelDashboardData,
} from "@/lib/vercel/fetch-report";

export type TrafficSummary = {
  activeUsers: number;
  periodLabel: string;
};

type TrafficPayload = {
  source: DashboardSource;
  periodId: AnalyticsPeriodId;
  periodLabel: string;
  error: string | null;
  summary: TrafficSummary | null;
  ga4: Ga4DashboardData | null;
  clarity: ClarityDashboardData | null;
  vercel: VercelDashboardData | null;
};

export async function loadTrafficPayload(
  period: AnalyticsPeriod,
  source: DashboardSource
): Promise<TrafficPayload> {
  if (source === "clarity") {
    return loadClarity(period);
  }
  if (source === "vercel") {
    return loadVercel(period);
  }
  return loadGa4(period);
}

async function loadGa4(period: AnalyticsPeriod): Promise<TrafficPayload> {
  try {
    const ga4 = await fetchGa4Dashboard(period.id);
    return {
      source: "ga4",
      periodId: period.id,
      periodLabel: ga4.periodLabel,
      error: null,
      summary: {
        activeUsers: ga4.overview.activeUsers,
        periodLabel: ga4.periodLabel,
      },
      ga4,
      clarity: null,
      vercel: null,
    };
  } catch (error) {
    return {
      source: "ga4",
      periodId: period.id,
      periodLabel: period.label,
      error: error instanceof Error ? error.message : "Falha ao carregar GA4",
      summary: null,
      ga4: null,
      clarity: null,
      vercel: null,
    };
  }
}

async function loadClarity(period: AnalyticsPeriod): Promise<TrafficPayload> {
  if (!hasClarityCredentials()) {
    return emptyPayload("clarity", period, "Conecte o Microsoft Clarity em Data Sources.");
  }
  try {
    const clarity = await fetchClarityLiveInsights({ period: period.id });
    return {
      source: "clarity",
      periodId: period.id,
      periodLabel: clarity.periodLabel,
      error: null,
      summary: null,
      ga4: null,
      clarity,
      vercel: null,
    };
  } catch (error) {
    return emptyPayload(
      "clarity",
      period,
      error instanceof Error ? error.message : "Falha ao carregar Clarity"
    );
  }
}

async function loadVercel(period: AnalyticsPeriod): Promise<TrafficPayload> {
  if (!hasVercelCredentials()) {
    return emptyPayload("vercel", period, "Conecte o Vercel Analytics em Data Sources.");
  }
  try {
    const vercel = await fetchVercelDashboard({ period: period.id });
    return {
      source: "vercel",
      periodId: period.id,
      periodLabel: vercel.periodLabel,
      error: null,
      summary: null,
      ga4: null,
      clarity: null,
      vercel,
    };
  } catch (error) {
    return emptyPayload(
      "vercel",
      period,
      error instanceof Error ? error.message : "Falha ao carregar Vercel"
    );
  }
}

function emptyPayload(
  source: DashboardSource,
  period: AnalyticsPeriod,
  error: string
): TrafficPayload {
  return {
    source,
    periodId: period.id,
    periodLabel: period.label,
    error,
    summary: null,
    ga4: null,
    clarity: null,
    vercel: null,
  };
}

export function WorkspaceTraffic({ payload }: { payload: TrafficPayload }) {
  return (
    <div className="space-y-4">
      <DashboardHeader
        live={payload.error == null && (payload.ga4 != null || payload.clarity != null || payload.vercel != null)}
        source={payload.source}
        periodId={payload.periodId}
        periodLabel={payload.periodLabel}
        error={payload.error}
      />
      {payload.ga4 ? <LiveGa4Dashboard data={payload.ga4} /> : null}
      {payload.clarity ? <LiveClarityDashboard data={payload.clarity} /> : null}
      {payload.vercel ? <LiveVercelDashboard data={payload.vercel} /> : null}
    </div>
  );
}
