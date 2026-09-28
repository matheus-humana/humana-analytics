import type { AnalyticsPeriodId } from "@/lib/analytics/period";

export function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(day: string, delta: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1));
  value.setUTCDate(value.getUTCDate() + delta);
  return value.toISOString().slice(0, 10);
}

/** Inclusive dates matching the GA4 presets. 7d ends yesterday. */
export function ga4Window(
  periodId: AnalyticsPeriodId,
  today: string
): { from: string; to: string } {
  if (periodId === "24h") return { from: today, to: today };
  const days = periodId === "3d" ? 3 : periodId === "7d" ? 7 : periodId === "28d" ? 28 : 90;
  const to = addUtcDays(today, -1);
  return { from: addUtcDays(to, -(days - 1)), to };
}

export function periodWindow(
  periodId: AnalyticsPeriodId,
  today: string
): { from: string; to: string } {
  const days = periodId === "24h" ? 1 : periodId === "3d" ? 3 : periodId === "7d" ? 7 : periodId === "28d" ? 28 : 90;
  return { from: addUtcDays(today, -(days - 1)), to: today };
}
