import { unstable_cache } from "next/cache";

import { GA4_CACHE_SECONDS } from "@/lib/freshness/status";
import { fetchGa4Dashboard, type Ga4DashboardData } from "@/lib/ga4/fetch-report";

export type Ga4DashboardSnapshot = Ga4DashboardData & {
  /** When this payload was read from the GA4 Data API. */
  fetchedAt: string;
};

async function readGa4Dashboard(periodId: string): Promise<Ga4DashboardSnapshot> {
  const data = await fetchGa4Dashboard(periodId);
  return { ...data, fetchedAt: new Date().toISOString() };
}

/**
 * Shares one GA4 read across open tabs for {@link GA4_CACHE_SECONDS}.
 * `fetchedAt` is the time of that read, not the time the page rendered.
 */
export function loadGa4DashboardSnapshot(periodId: string): Promise<Ga4DashboardSnapshot> {
  return unstable_cache(readGa4Dashboard, ["ga4-dashboard"], {
    revalidate: GA4_CACHE_SECONDS,
  })(periodId);
}
