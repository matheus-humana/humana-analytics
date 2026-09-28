import type { AnalyticsPeriodId } from "@/lib/analytics/period";
import { redactSensitive } from "@/lib/ai/redact";
import { fetchGa4AiReferrals } from "@/lib/ga4/fetch-report";

import { readSeoConfig } from "./config";
import { ga4Window, periodWindow, utcDay } from "./dates";
import { createPostgresSeoStore } from "./postgres-store";
import { ensureWebsiteProject } from "./projects";
import { getSeoConnectionStatus } from "./status";
import type { SeoSnapshotStore } from "./store";
import type { FindingRow, PagespeedRow } from "./types";
import { emptySeoWorkspace, type FindingView, type SeoWorkspace } from "./view";

export async function loadSeoWorkspace(
  periodId: AnalyticsPeriodId,
  now = new Date(),
  store?: SeoSnapshotStore
): Promise<SeoWorkspace> {
  const today = utcDay(now);
  const period = periodWindow(periodId, today);
  const config = readSeoConfig();
  if (!config.ok) {
    return emptySeoWorkspace({
      detail: config.detail,
      periodId,
      periodFrom: period.from,
      periodTo: period.to,
    });
  }

  const dbStore = store ?? createPostgresSeoStore();
  const project = await ensureWebsiteProject();
  const [status, pagespeed, crawls, findings, aiTraffic] = await Promise.all([
    getSeoConnectionStatus({ store: dbStore }),
    dbStore.listPagespeed(project.id),
    dbStore.listCrawls(project.id),
    dbStore.listFindings(project.id),
    loadAiTraffic(config.config.aiSources, periodId, today),
  ]);

  const latestCrawl = crawls.at(-1) ?? null;
  const pageHealth = latestCrawl
    ? await dbStore.listCrawlPages(project.id, latestCrawl.day)
    : [];
  const scores = latestScores(pagespeed);
  const series = pagespeed
    .filter((row) => row.day >= period.from && row.day <= period.to)
    .map((row) => ({
      pageUrl: row.pageUrl,
      strategy: row.strategy,
      day: row.day,
      performance: row.performance,
      seo: row.seo,
    }));
  const openFindings = findings
    .filter((item) => item.status === "open")
    .sort(bySeverity)
    .map(toView);
  const resolvedFindings = findings
    .filter((item) => item.status === "resolved")
    .sort((a, b) => (b.resolvedOn ?? "").localeCompare(a.resolvedOn ?? ""))
    .slice(0, 30)
    .map(toView);
  const homeMobile = scores.find(
    (score) => score.pageUrl === config.config.siteUrl && score.strategy === "mobile"
  );

  return {
    configured: true,
    siteUrl: config.config.siteUrl,
    detail: null,
    websiteProjectId: project.id,
    periodId,
    periodFrom: period.from,
    periodTo: period.to,
    pagespeedStatus: status.pagespeed.status,
    pagespeedDetail: status.pagespeed.detail,
    pagespeedUpdatedAt: status.pagespeed.updatedAt,
    crawlStatus: status.crawl.status,
    crawlDetail: status.crawl.detail,
    crawlUpdatedAt: status.crawl.updatedAt,
    scores,
    series,
    crawl: latestCrawl
      ? {
          day: latestCrawl.day,
          siteUrl: latestCrawl.siteUrl,
          pagesFetched: latestCrawl.pagesFetched,
          pagesPlanned: latestCrawl.pagesPlanned,
          complete: latestCrawl.complete,
          sitemapFound: latestCrawl.sitemapFound,
          sitemapUrls: latestCrawl.sitemapUrls,
          robotsFound: latestCrawl.robotsFound,
          robotsBytes: latestCrawl.robotsBytes,
          llmsFound: latestCrawl.llmsFound,
          llmsBytes: latestCrawl.llmsBytes,
          llmsValid: latestCrawl.llmsValid,
          geoScorePoints: latestCrawl.geoScorePoints,
          checklist: latestCrawl.checklist,
          aiBots: latestCrawl.aiBots,
        }
      : null,
    pageHealth: pageHealth.map((page) => ({
      day: page.day,
      pageUrl: page.pageUrl,
      httpStatus: page.httpStatus,
      title: page.title,
      titleLength: page.titleLength,
      description: page.description,
      descriptionLength: page.descriptionLength,
      h1Count: page.h1Count,
      canonical: page.canonical,
      lang: page.lang,
      hreflang: page.hreflang,
      imagesMissingAlt: page.imagesMissingAlt,
      noindex: page.noindex,
      jsonLdTypes: page.jsonLdTypes,
      wordCount: page.wordCount,
      sentenceCount: page.sentenceCount,
      headingSkips: page.headingSkips,
    })),
    openFindings,
    resolvedFindings,
    aiTraffic,
    rail: {
      seoScore: homeMobile?.seo ?? null,
      geoScorePoints: latestCrawl?.geoScorePoints ?? null,
      openActions: latestCrawl || findings.length > 0 ? openFindings.length : null,
    },
  };
}

function latestScores(rows: PagespeedRow[]) {
  const byKey = new Map<string, PagespeedRow>();
  for (const row of rows) {
    const key = `${row.pageUrl}\n${row.strategy}`;
    const current = byKey.get(key);
    if (!current || row.day > current.day) byKey.set(key, row);
  }
  return [...byKey.values()].sort((a, b) => a.pageUrl.localeCompare(b.pageUrl) || a.strategy.localeCompare(b.strategy));
}

function bySeverity(a: FindingRow, b: FindingRow): number {
  if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
  return b.lastSeenOn.localeCompare(a.lastSeenOn) || a.pageUrl.localeCompare(b.pageUrl);
}

function toView(row: FindingRow): FindingView {
  return {
    fingerprint: row.fingerprint,
    source: row.source,
    severity: row.severity,
    code: row.code,
    pageUrl: row.pageUrl,
    detail: row.detail,
    status: row.status,
    firstSeenOn: row.firstSeenOn,
    lastSeenOn: row.lastSeenOn,
    resolvedOn: row.resolvedOn,
  };
}

async function loadAiTraffic(
  sources: string[],
  periodId: AnalyticsPeriodId,
  today: string
) {
  const window = ga4Window(periodId, today);
  try {
    const report = await fetchGa4AiReferrals(sources, periodId);
    return {
      connected: true,
      error: null,
      from: window.from,
      to: window.to,
      sessions: report.sessions,
      activeUsers: report.activeUsers,
      rows: report.sources,
      queriedSources: report.queriedSources,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "GA4 query failed";
    return {
      connected: false,
      error: redactSensitive(message, 300),
      from: window.from,
      to: window.to,
      sessions: null,
      activeUsers: null,
      rows: [],
      queriedSources: sources,
    };
  }
}
