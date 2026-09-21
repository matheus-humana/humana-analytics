import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { requireGa4PropertyId } from "@/lib/env";
import type { AnalyticsAdapter, AnalyticsReports, DateRange } from "../types";
import { createGa4RestClient, type Ga4DataClient } from "./client";
import { loadServiceAccount } from "./credentials";
import {
  mapDailyReport,
  mapEventsReport,
  mapPagesReport,
  mapTrafficReport,
  type Ga4ReportResponse,
} from "./map-report";

const PAGE_LIMIT = 250;
const EVENT_LIMIT = 250;
const TRAFFIC_LIMIT = 250;

export type Ga4FixtureFile = {
  daily?: Ga4ReportResponse;
  pages?: Ga4ReportResponse;
  events?: Ga4ReportResponse;
  trafficSources?: Ga4ReportResponse;
};

function reportsFromFixture(fixture: Ga4FixtureFile): AnalyticsReports {
  return {
    daily: mapDailyReport(fixture.daily ?? {}),
    pages: mapPagesReport(fixture.pages ?? {}),
    events: mapEventsReport(fixture.events ?? {}),
    trafficSources: mapTrafficReport(fixture.trafficSources ?? {}),
  };
}

export function createGa4Adapter(options?: {
  client?: Ga4DataClient;
  propertyId?: string;
}): AnalyticsAdapter {
  const propertyId = options?.propertyId ?? requireGa4PropertyId();
  const client =
    options?.client ?? createGa4RestClient(loadServiceAccount());

  return {
    provider: "google_analytics",
    async validate() {
      await client.runReport(propertyId, {
        dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
        metrics: [{ name: "activeUsers" }],
        limit: 1,
      });
      return { ok: true, propertyId };
    },
    async fetchReports(range: DateRange) {
      const dateRanges = [
        { startDate: range.startDate, endDate: range.endDate },
      ];

      const [daily, pages, events, trafficSources] = await Promise.all([
        client.runReport(propertyId, {
          dateRanges,
          dimensions: [{ name: "date" }],
          metrics: [
            { name: "activeUsers" },
            { name: "sessions" },
            { name: "screenPageViews" },
            { name: "engagementRate" },
            { name: "newUsers" },
            { name: "eventCount" },
            { name: "keyEvents" },
          ],
          orderBys: [{ dimension: { dimensionName: "date" } }],
        }),
        client.runReport(propertyId, {
          dateRanges,
          dimensions: [{ name: "date" }, { name: "pagePath" }, { name: "pageTitle" }],
          metrics: [
            { name: "screenPageViews" },
            { name: "activeUsers" },
            { name: "engagementRate" },
          ],
          limit: PAGE_LIMIT,
          orderBys: [{ desc: true, metric: { metricName: "screenPageViews" } }],
        }),
        client.runReport(propertyId, {
          dateRanges,
          dimensions: [{ name: "date" }, { name: "eventName" }],
          metrics: [
            { name: "eventCount" },
            { name: "activeUsers" },
            { name: "keyEvents" },
          ],
          limit: EVENT_LIMIT,
          orderBys: [{ desc: true, metric: { metricName: "eventCount" } }],
        }),
        client.runReport(propertyId, {
          dateRanges,
          dimensions: [
            { name: "date" },
            { name: "sessionSource" },
            { name: "sessionMedium" },
          ],
          metrics: [{ name: "activeUsers" }, { name: "sessions" }],
          limit: TRAFFIC_LIMIT,
          orderBys: [{ desc: true, metric: { metricName: "sessions" } }],
        }),
      ]);

      return {
        daily: mapDailyReport(daily),
        pages: mapPagesReport(pages),
        events: mapEventsReport(events),
        trafficSources: mapTrafficReport(trafficSources),
      };
    },
  };
}

export function loadGa4Fixture(
  filePath = resolve(process.cwd(), "fixtures/ga4-sample.json"),
): Ga4FixtureFile {
  return JSON.parse(readFileSync(filePath, "utf8")) as Ga4FixtureFile;
}

export function createFixtureAdapter(options?: {
  fixture?: Ga4FixtureFile;
  propertyId?: string;
}): AnalyticsAdapter {
  const propertyId = options?.propertyId ?? requireGa4PropertyId();
  const fixture = options?.fixture ?? loadGa4Fixture();
  const reports = reportsFromFixture(fixture);

  return {
    provider: "google_analytics",
    async validate() {
      return { ok: true, propertyId };
    },
    async fetchReports() {
      return reports;
    },
  };
}
