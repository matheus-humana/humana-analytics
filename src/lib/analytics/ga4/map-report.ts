import { parseGa4Date } from "../dates";
import type {
  DailyMetric,
  EventMetric,
  PageMetric,
  TrafficSourceMetric,
} from "../types";

export type Ga4ReportRow = {
  dimensionValues?: Array<{ value?: string | null }>;
  metricValues?: Array<{ value?: string | null }>;
};

export type Ga4ReportResponse = {
  dimensionHeaders?: Array<{ name?: string | null }>;
  metricHeaders?: Array<{ name?: string | null }>;
  rows?: Ga4ReportRow[];
};

function headers(values: Array<{ name?: string | null }> | undefined): string[] {
  return (values ?? []).map((header) => header.name ?? "");
}

function dimensionMap(report: Ga4ReportResponse, row: Ga4ReportRow) {
  const names = headers(report.dimensionHeaders);
  const values = row.dimensionValues ?? [];
  const map = new Map<string, string>();
  names.forEach((name, index) => {
    map.set(name, values[index]?.value ?? "");
  });
  return map;
}

function metricMap(report: Ga4ReportResponse, row: Ga4ReportRow) {
  const names = headers(report.metricHeaders);
  const values = row.metricValues ?? [];
  const map = new Map<string, string>();
  names.forEach((name, index) => {
    map.set(name, values[index]?.value ?? "0");
  });
  return map;
}

function toNumber(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toInteger(value: string | undefined): number {
  return Math.round(toNumber(value));
}

export function mapDailyReport(report: Ga4ReportResponse): DailyMetric[] {
  return (report.rows ?? []).map((row) => {
    const dimensions = dimensionMap(report, row);
    const metrics = metricMap(report, row);
    return {
      date: parseGa4Date(dimensions.get("date") || ""),
      activeUsers: toInteger(metrics.get("activeUsers")),
      sessions: toInteger(metrics.get("sessions")),
      screenPageViews: toInteger(metrics.get("screenPageViews")),
      engagementRate: toNumber(metrics.get("engagementRate")),
      newUsers: toInteger(metrics.get("newUsers")),
      eventCount: toInteger(metrics.get("eventCount")),
      keyEvents: toInteger(metrics.get("keyEvents")),
    };
  });
}

export function mapPagesReport(report: Ga4ReportResponse): PageMetric[] {
  return (report.rows ?? []).map((row) => {
    const dimensions = dimensionMap(report, row);
    const metrics = metricMap(report, row);
    return {
      date: parseGa4Date(dimensions.get("date") || ""),
      pagePath: dimensions.get("pagePath") || "(not set)",
      pageTitle: dimensions.get("pageTitle") || "",
      screenPageViews: toInteger(metrics.get("screenPageViews")),
      activeUsers: toInteger(metrics.get("activeUsers")),
      engagementRate: toNumber(metrics.get("engagementRate")),
    };
  });
}

export function mapEventsReport(report: Ga4ReportResponse): EventMetric[] {
  return (report.rows ?? []).map((row) => {
    const dimensions = dimensionMap(report, row);
    const metrics = metricMap(report, row);
    return {
      date: parseGa4Date(dimensions.get("date") || ""),
      eventName: dimensions.get("eventName") || "(not set)",
      eventCount: toInteger(metrics.get("eventCount")),
      activeUsers: toInteger(metrics.get("activeUsers")),
      keyEvents: toInteger(metrics.get("keyEvents")),
    };
  });
}

export function mapTrafficReport(
  report: Ga4ReportResponse,
): TrafficSourceMetric[] {
  return (report.rows ?? []).map((row) => {
    const dimensions = dimensionMap(report, row);
    const metrics = metricMap(report, row);
    return {
      date: parseGa4Date(dimensions.get("date") || ""),
      source: dimensions.get("sessionSource") || "(direct)",
      medium: dimensions.get("sessionMedium") || "(none)",
      activeUsers: toInteger(metrics.get("activeUsers")),
      sessions: toInteger(metrics.get("sessions")),
    };
  });
}
