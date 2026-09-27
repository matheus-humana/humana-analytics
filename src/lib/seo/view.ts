import type { AnalyticsPeriodId } from "@/lib/analytics/period";

import type {
  AiBotReport,
  CrawlPageRow,
  GeoRuleResult,
  PagespeedStrategy,
  VitalOrigin,
} from "./types";

export type ScoreCard = {
  pageUrl: string;
  strategy: PagespeedStrategy;
  day: string;
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  lcpMs: number | null;
  clsThousandths: number | null;
  inpMs: number | null;
  lcpOrigin: VitalOrigin | null;
  clsOrigin: VitalOrigin | null;
  inpOrigin: VitalOrigin | null;
};

export type SeriesPoint = {
  pageUrl: string;
  strategy: PagespeedStrategy;
  day: string;
  performance: number | null;
  seo: number | null;
};

export type FindingView = {
  fingerprint: string;
  source: "seo" | "geo";
  severity: "critical" | "warning";
  code: string;
  pageUrl: string;
  detail: string;
  status: "open" | "resolved";
  firstSeenOn: string;
  lastSeenOn: string;
  resolvedOn: string | null;
};

export type AiTrafficView = {
  connected: boolean;
  error: string | null;
  from: string | null;
  to: string | null;
  sessions: number | null;
  activeUsers: number | null;
  rows: Array<{ source: string; sessions: number; activeUsers: number }>;
  queriedSources: string[];
};

export type CrawlView = {
  day: string;
  siteUrl: string;
  pagesFetched: number;
  pagesPlanned: number;
  complete: boolean;
  sitemapFound: boolean;
  sitemapUrls: number;
  robotsFound: boolean;
  robotsBytes: number;
  llmsFound: boolean;
  llmsBytes: number;
  llmsValid: boolean;
  geoScorePoints: number;
  checklist: GeoRuleResult[];
  aiBots: AiBotReport[];
};

export type SeoWorkspace = {
  configured: boolean;
  siteUrl: string | null;
  detail: string | null;
  websiteProjectId: string | null;
  periodId: AnalyticsPeriodId;
  periodFrom: string;
  periodTo: string;
  pagespeedStatus: "active" | "error" | "not_connected";
  pagespeedDetail: string | null;
  pagespeedUpdatedAt: string | null;
  crawlStatus: "active" | "error" | "not_connected";
  crawlDetail: string | null;
  crawlUpdatedAt: string | null;
  scores: ScoreCard[];
  series: SeriesPoint[];
  crawl: CrawlView | null;
  pageHealth: Array<Omit<CrawlPageRow, "projectId">>;
  openFindings: FindingView[];
  resolvedFindings: FindingView[];
  aiTraffic: AiTrafficView;
  rail: {
    seoScore: number | null;
    geoScorePoints: number | null;
    openActions: number | null;
  };
};

export function emptySeoWorkspace(input: {
  detail: string | null;
  periodId: AnalyticsPeriodId;
  periodFrom: string;
  periodTo: string;
  siteUrl?: string | null;
}): SeoWorkspace {
  return {
    configured: false,
    siteUrl: input.siteUrl ?? null,
    detail: input.detail,
    websiteProjectId: null,
    periodId: input.periodId,
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
    pagespeedStatus: "not_connected",
    pagespeedDetail: input.detail,
    pagespeedUpdatedAt: null,
    crawlStatus: "not_connected",
    crawlDetail: input.detail,
    crawlUpdatedAt: null,
    scores: [],
    series: [],
    crawl: null,
    pageHealth: [],
    openFindings: [],
    resolvedFindings: [],
    aiTraffic: {
      connected: false,
      error: null,
      from: null,
      to: null,
      sessions: null,
      activeUsers: null,
      rows: [],
      queriedSources: [],
    },
    rail: { seoScore: null, geoScorePoints: null, openActions: null },
  };
}
