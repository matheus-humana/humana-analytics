import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "@/lib/db";
import {
  analyticsDaily,
  analyticsEvents,
  analyticsPages,
  analyticsSyncRuns,
  analyticsTrafficSources,
} from "@/lib/db/schema";
import { previousRange } from "./dates";
import type {
  AnalyticsReports,
  DateRange,
  OverviewMetrics,
  SyncCounts,
} from "./types";

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dailyRange(dataSourceId: string, range: DateRange) {
  return and(
    eq(analyticsDaily.dataSourceId, dataSourceId),
    gte(analyticsDaily.date, range.startDate),
    lte(analyticsDaily.date, range.endDate),
  );
}

export async function startSyncRun(
  db: Database,
  dataSourceId: string,
  range: DateRange,
) {
  const [run] = await db
    .insert(analyticsSyncRuns)
    .values({
      id: randomUUID(),
      dataSourceId,
      status: "running",
      startDate: range.startDate,
      endDate: range.endDate,
    })
    .returning();
  return run;
}

export async function finishSyncRun(
  db: Database,
  runId: string,
  result:
    | { status: "success"; counts: SyncCounts }
    | { status: "error"; errorMessage: string },
) {
  await db
    .update(analyticsSyncRuns)
    .set({
      status: result.status,
      rowsUpserted: result.status === "success" ? result.counts : null,
      errorMessage: result.status === "error" ? result.errorMessage : null,
      finishedAt: new Date(),
    })
    .where(eq(analyticsSyncRuns.id, runId));
}

export async function persistReports(
  db: Database,
  dataSourceId: string,
  reports: AnalyticsReports,
): Promise<SyncCounts> {
  await db.transaction(async (tx) => {
    if (reports.daily.length > 0) {
      await tx
        .insert(analyticsDaily)
        .values(
          reports.daily.map((row) => ({
            id: randomUUID(),
            dataSourceId,
            date: row.date,
            activeUsers: row.activeUsers,
            sessions: row.sessions,
            screenPageViews: row.screenPageViews,
            engagementRate: row.engagementRate,
            newUsers: row.newUsers,
            eventCount: row.eventCount,
            keyEvents: row.keyEvents,
            updatedAt: new Date(),
          })),
        )
        .onConflictDoUpdate({
          target: [analyticsDaily.dataSourceId, analyticsDaily.date],
          set: {
            activeUsers: sql`excluded.active_users`,
            sessions: sql`excluded.sessions`,
            screenPageViews: sql`excluded.screen_page_views`,
            engagementRate: sql`excluded.engagement_rate`,
            newUsers: sql`excluded.new_users`,
            eventCount: sql`excluded.event_count`,
            keyEvents: sql`excluded.key_events`,
            updatedAt: sql`now()`,
          },
        });
    }

    if (reports.pages.length > 0) {
      await tx
        .insert(analyticsPages)
        .values(
          reports.pages.map((row) => ({
            id: randomUUID(),
            dataSourceId,
            date: row.date,
            pagePath: row.pagePath,
            pageTitle: row.pageTitle,
            screenPageViews: row.screenPageViews,
            activeUsers: row.activeUsers,
            engagementRate: row.engagementRate,
            updatedAt: new Date(),
          })),
        )
        .onConflictDoUpdate({
          target: [
            analyticsPages.dataSourceId,
            analyticsPages.date,
            analyticsPages.pagePath,
          ],
          set: {
            pageTitle: sql`excluded.page_title`,
            screenPageViews: sql`excluded.screen_page_views`,
            activeUsers: sql`excluded.active_users`,
            engagementRate: sql`excluded.engagement_rate`,
            updatedAt: sql`now()`,
          },
        });
    }

    if (reports.events.length > 0) {
      await tx
        .insert(analyticsEvents)
        .values(
          reports.events.map((row) => ({
            id: randomUUID(),
            dataSourceId,
            date: row.date,
            eventName: row.eventName,
            eventCount: row.eventCount,
            activeUsers: row.activeUsers,
            keyEvents: row.keyEvents,
            updatedAt: new Date(),
          })),
        )
        .onConflictDoUpdate({
          target: [
            analyticsEvents.dataSourceId,
            analyticsEvents.date,
            analyticsEvents.eventName,
          ],
          set: {
            eventCount: sql`excluded.event_count`,
            activeUsers: sql`excluded.active_users`,
            keyEvents: sql`excluded.key_events`,
            updatedAt: sql`now()`,
          },
        });
    }

    if (reports.trafficSources.length > 0) {
      await tx
        .insert(analyticsTrafficSources)
        .values(
          reports.trafficSources.map((row) => ({
            id: randomUUID(),
            dataSourceId,
            date: row.date,
            source: row.source,
            medium: row.medium,
            activeUsers: row.activeUsers,
            sessions: row.sessions,
            updatedAt: new Date(),
          })),
        )
        .onConflictDoUpdate({
          target: [
            analyticsTrafficSources.dataSourceId,
            analyticsTrafficSources.date,
            analyticsTrafficSources.source,
            analyticsTrafficSources.medium,
          ],
          set: {
            activeUsers: sql`excluded.active_users`,
            sessions: sql`excluded.sessions`,
            updatedAt: sql`now()`,
          },
        });
    }
  });

  return {
    daily: reports.daily.length,
    pages: reports.pages.length,
    events: reports.events.length,
    trafficSources: reports.trafficSources.length,
  };
}

export async function getOverview(
  db: Database,
  dataSourceId: string,
  range: DateRange,
): Promise<OverviewMetrics> {
  const [row] = await db
    .select({
      activeUsers: sql<number>`coalesce(sum(${analyticsDaily.activeUsers}), 0)`,
      sessions: sql<number>`coalesce(sum(${analyticsDaily.sessions}), 0)`,
      screenPageViews: sql<number>`coalesce(sum(${analyticsDaily.screenPageViews}), 0)`,
      engagementRate: sql<number>`case
        when coalesce(sum(${analyticsDaily.sessions}), 0) = 0 then 0
        else sum(${analyticsDaily.engagementRate} * ${analyticsDaily.sessions})
          / sum(${analyticsDaily.sessions})
      end`,
      newUsers: sql<number>`coalesce(sum(${analyticsDaily.newUsers}), 0)`,
      eventCount: sql<number>`coalesce(sum(${analyticsDaily.eventCount}), 0)`,
      keyEvents: sql<number>`coalesce(sum(${analyticsDaily.keyEvents}), 0)`,
    })
    .from(analyticsDaily)
    .where(dailyRange(dataSourceId, range));

  return {
    activeUsers: toNumber(row?.activeUsers),
    sessions: toNumber(row?.sessions),
    screenPageViews: toNumber(row?.screenPageViews),
    engagementRate: toNumber(row?.engagementRate),
    newUsers: toNumber(row?.newUsers),
    eventCount: toNumber(row?.eventCount),
    keyEvents: toNumber(row?.keyEvents),
  };
}

export async function getDaily(
  db: Database,
  dataSourceId: string,
  range: DateRange,
) {
  return db
    .select({
      date: analyticsDaily.date,
      activeUsers: analyticsDaily.activeUsers,
      sessions: analyticsDaily.sessions,
      screenPageViews: analyticsDaily.screenPageViews,
      engagementRate: analyticsDaily.engagementRate,
      newUsers: analyticsDaily.newUsers,
      eventCount: analyticsDaily.eventCount,
      keyEvents: analyticsDaily.keyEvents,
    })
    .from(analyticsDaily)
    .where(dailyRange(dataSourceId, range))
    .orderBy(analyticsDaily.date);
}

export async function getTopPages(
  db: Database,
  dataSourceId: string,
  range: DateRange,
  limit = 20,
) {
  const rows = await db
    .select({
      pagePath: analyticsPages.pagePath,
      pageTitle: sql<string>`max(${analyticsPages.pageTitle})`,
      screenPageViews: sql<number>`coalesce(sum(${analyticsPages.screenPageViews}), 0)`,
      activeUsers: sql<number>`coalesce(sum(${analyticsPages.activeUsers}), 0)`,
      engagementRate: sql<number>`case
        when coalesce(sum(${analyticsPages.screenPageViews}), 0) = 0 then 0
        else sum(${analyticsPages.engagementRate} * ${analyticsPages.screenPageViews})
          / sum(${analyticsPages.screenPageViews})
      end`,
    })
    .from(analyticsPages)
    .where(
      and(
        eq(analyticsPages.dataSourceId, dataSourceId),
        gte(analyticsPages.date, range.startDate),
        lte(analyticsPages.date, range.endDate),
      ),
    )
    .groupBy(analyticsPages.pagePath)
    .orderBy(sql`sum(${analyticsPages.screenPageViews}) desc`)
    .limit(limit);

  return rows.map((row) => ({
    pagePath: row.pagePath,
    pageTitle: row.pageTitle,
    screenPageViews: toNumber(row.screenPageViews),
    activeUsers: toNumber(row.activeUsers),
    engagementRate: toNumber(row.engagementRate),
  }));
}

export async function getEvents(
  db: Database,
  dataSourceId: string,
  range: DateRange,
  limit = 20,
) {
  const rows = await db
    .select({
      eventName: analyticsEvents.eventName,
      eventCount: sql<number>`coalesce(sum(${analyticsEvents.eventCount}), 0)`,
      activeUsers: sql<number>`coalesce(sum(${analyticsEvents.activeUsers}), 0)`,
      keyEvents: sql<number>`coalesce(sum(${analyticsEvents.keyEvents}), 0)`,
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.dataSourceId, dataSourceId),
        gte(analyticsEvents.date, range.startDate),
        lte(analyticsEvents.date, range.endDate),
      ),
    )
    .groupBy(analyticsEvents.eventName)
    .orderBy(sql`sum(${analyticsEvents.eventCount}) desc`)
    .limit(limit);

  return rows.map((row) => ({
    eventName: row.eventName,
    eventCount: toNumber(row.eventCount),
    activeUsers: toNumber(row.activeUsers),
    keyEvents: toNumber(row.keyEvents),
  }));
}

export async function getTrafficSources(
  db: Database,
  dataSourceId: string,
  range: DateRange,
  limit = 20,
) {
  const rows = await db
    .select({
      source: analyticsTrafficSources.source,
      medium: analyticsTrafficSources.medium,
      activeUsers: sql<number>`coalesce(sum(${analyticsTrafficSources.activeUsers}), 0)`,
      sessions: sql<number>`coalesce(sum(${analyticsTrafficSources.sessions}), 0)`,
    })
    .from(analyticsTrafficSources)
    .where(
      and(
        eq(analyticsTrafficSources.dataSourceId, dataSourceId),
        gte(analyticsTrafficSources.date, range.startDate),
        lte(analyticsTrafficSources.date, range.endDate),
      ),
    )
    .groupBy(analyticsTrafficSources.source, analyticsTrafficSources.medium)
    .orderBy(sql`sum(${analyticsTrafficSources.sessions}) desc`)
    .limit(limit);

  return rows.map((row) => ({
    source: row.source,
    medium: row.medium,
    activeUsers: toNumber(row.activeUsers),
    sessions: toNumber(row.sessions),
  }));
}

export async function comparePeriods(
  db: Database,
  dataSourceId: string,
  current: DateRange,
  previous = previousRange(current),
) {
  const [currentOverview, previousOverview] = await Promise.all([
    getOverview(db, dataSourceId, current),
    getOverview(db, dataSourceId, previous),
  ]);

  const change = (currentValue: number, previousValue: number) => {
    if (previousValue === 0) {
      return currentValue === 0 ? 0 : 1;
    }
    return (currentValue - previousValue) / previousValue;
  };

  return {
    current: { range: current, metrics: currentOverview },
    previous: { range: previous, metrics: previousOverview },
    change: {
      activeUsers: change(currentOverview.activeUsers, previousOverview.activeUsers),
      sessions: change(currentOverview.sessions, previousOverview.sessions),
      screenPageViews: change(
        currentOverview.screenPageViews,
        previousOverview.screenPageViews,
      ),
      eventCount: change(currentOverview.eventCount, previousOverview.eventCount),
      keyEvents: change(currentOverview.keyEvents, previousOverview.keyEvents),
    },
  };
}

export async function getLatestSyncRun(db: Database, dataSourceId: string) {
  const [run] = await db
    .select({
      id: analyticsSyncRuns.id,
      status: analyticsSyncRuns.status,
      startDate: analyticsSyncRuns.startDate,
      endDate: analyticsSyncRuns.endDate,
      rowsUpserted: analyticsSyncRuns.rowsUpserted,
      errorMessage: analyticsSyncRuns.errorMessage,
      startedAt: analyticsSyncRuns.startedAt,
      finishedAt: analyticsSyncRuns.finishedAt,
    })
    .from(analyticsSyncRuns)
    .where(eq(analyticsSyncRuns.dataSourceId, dataSourceId))
    .orderBy(desc(analyticsSyncRuns.startedAt))
    .limit(1);

  return run ?? null;
}
