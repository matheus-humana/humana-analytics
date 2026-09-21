import { getDb } from "@/lib/db";
import { publicErrorMessage } from "@/lib/errors";
import { requireGa4PropertyId } from "@/lib/env";
import { ensureGa4Context, markDataSourceStatus } from "./bootstrap";
import { resolveDateRange } from "./dates";
import { createFixtureAdapter, createGa4Adapter } from "./ga4/adapter";
import {
  finishSyncRun,
  persistReports,
  startSyncRun,
} from "./repository";
import type { AnalyticsAdapter, DateRange, SyncCounts } from "./types";

export type SyncOptions = {
  days?: number;
  startDate?: string;
  endDate?: string;
  fixture?: boolean;
  dryRun?: boolean;
  adapter?: AnalyticsAdapter;
  propertyId?: string;
};

export type SyncResult = {
  propertyId: string;
  dataSourceId: string;
  range: DateRange;
  mode: "live" | "fixture" | "dry-run";
  counts: SyncCounts;
};

export async function syncGa4Reports(
  options: SyncOptions = {},
): Promise<SyncResult> {
  const propertyId = options.propertyId ?? requireGa4PropertyId();
  const range = resolveDateRange(options);
  const adapter =
    options.adapter ??
    (options.fixture
      ? createFixtureAdapter({ propertyId })
      : createGa4Adapter({ propertyId }));

  if (options.dryRun) {
    const reports = await adapter.fetchReports(range);
    return {
      propertyId,
      dataSourceId: "dry-run",
      range,
      mode: "dry-run",
      counts: {
        daily: reports.daily.length,
        pages: reports.pages.length,
        events: reports.events.length,
        trafficSources: reports.trafficSources.length,
      },
    };
  }

  const db = getDb();
  const context = await ensureGa4Context(db, propertyId);
  const run = await startSyncRun(db, context.dataSourceId, range);

  try {
    const reports = await adapter.fetchReports(range);
    const counts = await persistReports(db, context.dataSourceId, reports);
    await finishSyncRun(db, run.id, { status: "success", counts });
    await markDataSourceStatus(db, context.dataSourceId, "active");

    return {
      propertyId,
      dataSourceId: context.dataSourceId,
      range,
      mode: options.fixture ? "fixture" : "live",
      counts,
    };
  } catch (error) {
    await finishSyncRun(db, run.id, {
      status: "error",
      errorMessage: publicErrorMessage(error),
    });
    await markDataSourceStatus(db, context.dataSourceId, "error");
    throw error;
  }
}

export async function validateGa4Connection(options?: {
  fixture?: boolean;
  propertyId?: string;
}) {
  const propertyId = options?.propertyId ?? requireGa4PropertyId();
  const adapter = options?.fixture
    ? createFixtureAdapter({ propertyId })
    : createGa4Adapter({ propertyId });
  return adapter.validate();
}
