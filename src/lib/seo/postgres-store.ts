import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  crawlPages,
  crawlSnapshots,
  pagespeedSnapshots,
  seoRuns,
  siteFindings,
} from "@/lib/db/schema";

import type { SeoSnapshotStore } from "./store";
import type {
  AiBotReport,
  CrawlPageRow,
  CrawlSnapshotRow,
  FindingRow,
  GeoRuleResult,
  HreflangLink,
  PagespeedRow,
  SeoRunRow,
  VitalOrigin,
} from "./types";

export function createPostgresSeoStore(): SeoSnapshotStore {
  return {
    async upsertPagespeed(row) {
      await db
        .insert(pagespeedSnapshots)
        .values(row)
        .onConflictDoUpdate({
          target: [
            pagespeedSnapshots.projectId,
            pagespeedSnapshots.pageUrl,
            pagespeedSnapshots.strategy,
            pagespeedSnapshots.day,
          ],
          set: {
            performance: row.performance,
            accessibility: row.accessibility,
            bestPractices: row.bestPractices,
            seo: row.seo,
            lcpMs: row.lcpMs,
            clsThousandths: row.clsThousandths,
            inpMs: row.inpMs,
            lcpOrigin: row.lcpOrigin,
            clsOrigin: row.clsOrigin,
            inpOrigin: row.inpOrigin,
            collectedAt: new Date(),
          },
        });
    },
    async listPagespeed(projectId) {
      const rows = await db
        .select()
        .from(pagespeedSnapshots)
        .where(eq(pagespeedSnapshots.projectId, projectId))
        .orderBy(asc(pagespeedSnapshots.day));
      return rows.map(toPagespeed);
    },
    async replaceCrawl(row, pageRows) {
      await db
        .insert(crawlSnapshots)
        .values({
          ...row,
          checklist: row.checklist,
          aiBots: row.aiBots,
        })
        .onConflictDoUpdate({
          target: [crawlSnapshots.projectId, crawlSnapshots.day],
          set: {
            siteUrl: row.siteUrl,
            pagesFetched: row.pagesFetched,
            pagesPlanned: row.pagesPlanned,
            complete: row.complete,
            sitemapFound: row.sitemapFound,
            sitemapUrls: row.sitemapUrls,
            robotsFound: row.robotsFound,
            robotsBytes: row.robotsBytes,
            llmsFound: row.llmsFound,
            llmsBytes: row.llmsBytes,
            llmsValid: row.llmsValid,
            geoScorePoints: row.geoScorePoints,
            checklist: row.checklist,
            aiBots: row.aiBots,
            collectedAt: new Date(),
          },
        });
      await db
        .delete(crawlPages)
        .where(and(eq(crawlPages.projectId, row.projectId), eq(crawlPages.day, row.day)));
      if (pageRows.length > 0) {
        await db.insert(crawlPages).values(pageRows);
      }
    },
    async listCrawls(projectId) {
      const rows = await db
        .select()
        .from(crawlSnapshots)
        .where(eq(crawlSnapshots.projectId, projectId))
        .orderBy(asc(crawlSnapshots.day));
      return rows.map(toCrawl);
    },
    async listCrawlPages(projectId, day) {
      const rows = await db
        .select()
        .from(crawlPages)
        .where(and(eq(crawlPages.projectId, projectId), eq(crawlPages.day, day)))
        .orderBy(asc(crawlPages.pageUrl));
      return rows.map(toPage);
    },
    async listFindings(projectId) {
      const rows = await db
        .select()
        .from(siteFindings)
        .where(eq(siteFindings.projectId, projectId));
      return rows.map(toFinding);
    },
    async saveFindings(rows) {
      if (rows.length === 0) return;
      await db
        .insert(siteFindings)
        .values(rows)
        .onConflictDoUpdate({
          target: [siteFindings.projectId, siteFindings.fingerprint],
          set: {
            source: sql`excluded.source`,
            severity: sql`excluded.severity`,
            code: sql`excluded.code`,
            pageUrl: sql`excluded.page_url`,
            detail: sql`excluded.detail`,
            status: sql`excluded.status`,
            firstSeenOn: sql`excluded.first_seen_on`,
            lastSeenOn: sql`excluded.last_seen_on`,
            resolvedOn: sql`excluded.resolved_on`,
            updatedAt: new Date(),
          },
        });
    },
    async addRun(row) {
      await db.insert(seoRuns).values({
        id: row.id,
        projectId: row.projectId,
        kind: row.kind,
        ok: row.ok,
        detail: row.detail,
        pageUrl: row.pageUrl,
        strategy: row.strategy,
        finishedAt: new Date(row.finishedAt),
      });
    },
    async latestRun(projectId, kind) {
      const rows = await db
        .select()
        .from(seoRuns)
        .where(and(eq(seoRuns.projectId, projectId), eq(seoRuns.kind, kind)))
        .orderBy(asc(seoRuns.finishedAt));
      const row = rows.at(-1);
      if (!row) return null;
      return {
        id: row.id,
        projectId: row.projectId,
        kind: row.kind === "pagespeed" ? "pagespeed" : "crawl",
        ok: row.ok,
        detail: row.detail,
        pageUrl: row.pageUrl,
        strategy: row.strategy,
        finishedAt: row.finishedAt.toISOString(),
      } satisfies SeoRunRow;
    },
  };
}

function toPagespeed(row: typeof pagespeedSnapshots.$inferSelect): PagespeedRow {
  return {
    projectId: row.projectId,
    pageUrl: row.pageUrl,
    strategy: row.strategy === "desktop" ? "desktop" : "mobile",
    day: row.day,
    performance: row.performance,
    accessibility: row.accessibility,
    bestPractices: row.bestPractices,
    seo: row.seo,
    lcpMs: row.lcpMs,
    clsThousandths: row.clsThousandths,
    inpMs: row.inpMs,
    lcpOrigin: asOrigin(row.lcpOrigin),
    clsOrigin: asOrigin(row.clsOrigin),
    inpOrigin: asOrigin(row.inpOrigin),
  };
}

function toCrawl(row: typeof crawlSnapshots.$inferSelect): CrawlSnapshotRow {
  return {
    projectId: row.projectId,
    day: row.day,
    siteUrl: row.siteUrl,
    pagesFetched: row.pagesFetched,
    pagesPlanned: row.pagesPlanned,
    complete: row.complete,
    sitemapFound: row.sitemapFound,
    sitemapUrls: row.sitemapUrls,
    robotsFound: row.robotsFound,
    robotsBytes: row.robotsBytes,
    llmsFound: row.llmsFound,
    llmsBytes: row.llmsBytes,
    llmsValid: row.llmsValid,
    geoScorePoints: row.geoScorePoints,
    checklist: Array.isArray(row.checklist) ? (row.checklist as GeoRuleResult[]) : [],
    aiBots: Array.isArray(row.aiBots) ? (row.aiBots as AiBotReport[]) : [],
  };
}

function toPage(row: typeof crawlPages.$inferSelect): CrawlPageRow {
  return {
    projectId: row.projectId,
    day: row.day,
    pageUrl: row.pageUrl,
    httpStatus: row.httpStatus,
    title: row.title,
    titleLength: row.titleLength,
    description: row.description,
    descriptionLength: row.descriptionLength,
    h1Count: row.h1Count,
    canonical: row.canonical,
    lang: row.lang,
    hreflang: Array.isArray(row.hreflang) ? (row.hreflang as HreflangLink[]) : [],
    imagesMissingAlt: row.imagesMissingAlt,
    noindex: row.noindex,
    jsonLdTypes: Array.isArray(row.jsonLdTypes) ? (row.jsonLdTypes as string[]) : [],
    wordCount: row.wordCount,
    sentenceCount: row.sentenceCount,
    headingSkips: row.headingSkips,
  };
}

function toFinding(row: typeof siteFindings.$inferSelect): FindingRow {
  return {
    projectId: row.projectId,
    fingerprint: row.fingerprint,
    source: row.source === "geo" ? "geo" : "seo",
    severity: row.severity === "critical" ? "critical" : "warning",
    code: row.code,
    pageUrl: row.pageUrl,
    detail: row.detail,
    status: row.status === "resolved" ? "resolved" : "open",
    firstSeenOn: row.firstSeenOn,
    lastSeenOn: row.lastSeenOn,
    resolvedOn: row.resolvedOn,
  };
}

function asOrigin(value: string | null): VitalOrigin | null {
  if (value === "field-url" || value === "field-origin" || value === "lab") return value;
  return null;
}
