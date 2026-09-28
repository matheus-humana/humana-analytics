import { Ga4TrafficSection } from "@/components/dashboard/ga4-traffic-section";
import type { AnalyticsPeriod, AnalyticsPeriodId } from "@/lib/analytics/period";
import {
  loadGa4DashboardSnapshot,
  type Ga4DashboardSnapshot,
} from "@/lib/ga4/dashboard-cache";

export type TrafficSummary = {
  activeUsers: number;
  periodLabel: string;
};

type TrafficPayload = {
  periodId: AnalyticsPeriodId;
  periodLabel: string;
  error: string | null;
  summary: TrafficSummary | null;
  ga4: Ga4DashboardSnapshot | null;
};

export async function loadTrafficPayload(period: AnalyticsPeriod): Promise<TrafficPayload> {
  try {
    const ga4 = await loadGa4DashboardSnapshot(period.id);
    return {
      periodId: period.id,
      periodLabel: ga4.periodLabel,
      error: null,
      summary: {
        activeUsers: ga4.overview.activeUsers,
        periodLabel: ga4.periodLabel,
      },
      ga4,
    };
  } catch (error) {
    return {
      periodId: period.id,
      periodLabel: period.label,
      error: error instanceof Error ? error.message : "Falha ao carregar GA4",
      summary: null,
      ga4: null,
    };
  }
}

export function WorkspaceTraffic({ payload }: { payload: TrafficPayload }) {
  return (
    <Ga4TrafficSection
      periodId={payload.periodId}
      periodLabel={payload.periodLabel}
      initial={payload.ga4}
      initialError={payload.error}
    />
  );
}
