export const DASHBOARD_SOURCES = ["ga4", "clarity", "vercel"] as const;
export type DashboardSource = (typeof DASHBOARD_SOURCES)[number];

export function resolveDashboardSource(
  value: string | null | undefined
): DashboardSource {
  if (value === "clarity") return "clarity";
  if (value === "vercel") return "vercel";
  return "ga4";
}
