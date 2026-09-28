/**
 * Shared analytics period presets.
 * Shared by GA4 and Humana Analytics via URL `?period=`.
 */

export const ANALYTICS_PERIOD_IDS = [
  "24h",
  "3d",
  "7d",
  "28d",
  "90d",
] as const;

export type AnalyticsPeriodId = (typeof ANALYTICS_PERIOD_IDS)[number];

export type AnalyticsPeriod = {
  id: AnalyticsPeriodId;
  label: string;
  shortLabel: string;
  /** Inclusive calendar window expressed for GA4 Data API. */
  ga4: { startDate: string; endDate: string };
  /** Hint for providers that support rolling hours. */
  rollingHours: number | null;
};

export const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriodId = "7d";

export const ANALYTICS_PERIODS: Record<AnalyticsPeriodId, AnalyticsPeriod> = {
  "24h": {
    id: "24h",
    label: "Hoje / últimas 24h",
    shortLabel: "24h",
    // GA4 is day-granular; "today" is the closest match for last ~24h.
    ga4: { startDate: "today", endDate: "today" },
    rollingHours: 24,
  },
  "3d": {
    id: "3d",
    label: "Últimos 3 dias",
    shortLabel: "3 dias",
    ga4: { startDate: "3daysAgo", endDate: "yesterday" },
    rollingHours: 72,
  },
  "7d": {
    id: "7d",
    label: "Últimos 7 dias",
    shortLabel: "7 dias",
    ga4: { startDate: "7daysAgo", endDate: "yesterday" },
    rollingHours: 168,
  },
  "28d": {
    id: "28d",
    label: "Últimos 28 dias",
    shortLabel: "28 dias",
    ga4: { startDate: "28daysAgo", endDate: "yesterday" },
    rollingHours: 672,
  },
  "90d": {
    id: "90d",
    label: "Últimos 90 dias",
    shortLabel: "90 dias",
    ga4: { startDate: "90daysAgo", endDate: "yesterday" },
    rollingHours: 2160,
  },
};

export function isAnalyticsPeriodId(value: string): value is AnalyticsPeriodId {
  return (ANALYTICS_PERIOD_IDS as readonly string[]).includes(value);
}

export function resolveAnalyticsPeriod(
  value: string | null | undefined
): AnalyticsPeriod {
  if (value && isAnalyticsPeriodId(value)) {
    return ANALYTICS_PERIODS[value];
  }
  return ANALYTICS_PERIODS[DEFAULT_ANALYTICS_PERIOD];
}

export const ANALYTICS_PERIOD_OPTIONS = ANALYTICS_PERIOD_IDS.map(
  (id) => ANALYTICS_PERIODS[id]
);
