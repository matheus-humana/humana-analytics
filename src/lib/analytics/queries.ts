import { and, eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { dataSources, projects } from "@/lib/db/schema";
import { getGa4PropertyId } from "@/lib/env";
import { resolveDateRange } from "./dates";
import {
  comparePeriods,
  getDaily,
  getEvents,
  getLatestSyncRun,
  getOverview,
  getTopPages,
  getTrafficSources,
} from "./repository";
import type { DateRange } from "./types";

export async function findGa4DataSource(db: Database, propertyId?: string) {
  const filters = [eq(dataSources.provider, "google_analytics")];
  if (propertyId) {
    filters.push(eq(dataSources.externalId, propertyId));
  }

  const [row] = await db
    .select({
      dataSourceId: dataSources.id,
      propertyId: dataSources.externalId,
      status: dataSources.status,
      projectName: projects.name,
    })
    .from(dataSources)
    .innerJoin(projects, eq(projects.id, dataSources.projectId))
    .where(and(...filters))
    .limit(1);

  return row ?? null;
}

export async function getPersistedMetrics(
  db: Database,
  rangeInput: {
    days?: number;
    startDate?: string;
    endDate?: string;
  } = {},
) {
  const range: DateRange = resolveDateRange(rangeInput);
  const source = await findGa4DataSource(db, getGa4PropertyId());
  if (!source) {
    return {
      source: "postgresql" as const,
      configured: false,
      range,
      dataSource: null,
      lastSync: null,
      overview: null,
      comparison: null,
      daily: [],
      pages: [],
      events: [],
      trafficSources: [],
    };
  }

  const [overview, comparison, daily, pages, events, trafficSources, lastSync] =
    await Promise.all([
      getOverview(db, source.dataSourceId, range),
      comparePeriods(db, source.dataSourceId, range),
      getDaily(db, source.dataSourceId, range),
      getTopPages(db, source.dataSourceId, range),
      getEvents(db, source.dataSourceId, range),
      getTrafficSources(db, source.dataSourceId, range),
      getLatestSyncRun(db, source.dataSourceId),
    ]);

  return {
    source: "postgresql" as const,
    configured: true,
    range,
    dataSource: source,
    lastSync,
    overview,
    comparison,
    daily,
    pages,
    events,
    trafficSources,
  };
}
