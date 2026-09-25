import {
  isAnalyticsPeriodId,
  type AnalyticsPeriodId,
} from "@/lib/analytics/period";

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(day: string, delta: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(Date.UTC(year, (month ?? 1) - 1, date ?? 1));
  value.setUTCDate(value.getUTCDate() + delta);
  return value.toISOString().slice(0, 10);
}

export function githubPeriodLength(periodId: AnalyticsPeriodId): number {
  if (periodId === "24h") return 1;
  if (periodId === "3d") return 3;
  if (periodId === "7d") return 7;
  if (periodId === "28d") return 28;
  return 90;
}

export function githubPeriodWindow(
  periodId: AnalyticsPeriodId,
  today: string
): { from: string; to: string; days: number } {
  const days = githubPeriodLength(periodId);
  return { from: addUtcDays(today, -(days - 1)), to: today, days };
}

export function previousWindow(from: string, days: number): { from: string; to: string } {
  return { from: addUtcDays(from, -days), to: addUtcDays(from, -1) };
}

export function coercePeriodId(value: string | null | undefined): AnalyticsPeriodId {
  if (value && isAnalyticsPeriodId(value)) return value;
  return "7d";
}

export function dayFromTimestamp(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString().slice(0, 10);
}
