export const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
  "CCBot",
] as const;

export type AiBotName = (typeof AI_BOTS)[number];

export type VitalOrigin = "field-url" | "field-origin" | "lab";

export type PagespeedStrategy = "mobile" | "desktop";

export type FindingSource = "seo" | "geo";

export type FindingSeverity = "critical" | "warning";

export type FindingStatus = "open" | "resolved";

export type JsonPrimitive = string | number | boolean | null;

export type GeoEvidence = Record<string, JsonPrimitive>;

export type ParsedPagespeed = {
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

export type PagespeedRow = ParsedPagespeed & {
  projectId: string;
  pageUrl: string;
  strategy: PagespeedStrategy;
  day: string;
};

export type HreflangLink = {
  lang: string;
  href: string;
};

export type PageSignals = {
  url: string;
  httpStatus: number;
  title: string | null;
  description: string | null;
  canonical: string | null;
  lang: string | null;
  hreflang: HreflangLink[];
  h1: string[];
  headingLevels: number[];
  imagesMissingAlt: number;
  noindex: boolean;
  jsonLdTypes: string[];
  internalLinks: string[];
  wordCount: number;
  sentenceCount: number;
  averageSentenceWords: number | null;
  payloadH1: number;
  payloadWords: number;
  textInPayload: boolean;
  error: string | null;
};

export type CrawlPageRow = {
  projectId: string;
  day: string;
  pageUrl: string;
  httpStatus: number;
  title: string | null;
  titleLength: number;
  description: string | null;
  descriptionLength: number;
  h1Count: number;
  canonical: string | null;
  lang: string | null;
  hreflang: HreflangLink[];
  imagesMissingAlt: number;
  noindex: boolean;
  jsonLdTypes: string[];
  wordCount: number;
  sentenceCount: number;
  headingSkips: number;
};

export type AiBotReport = {
  bot: AiBotName;
  access: "allowed" | "blocked";
  via: "missing_robots" | "explicit" | "wildcard" | "default";
};

export type GeoRuleId =
  | "llms_present"
  | "llms_valid"
  | "robots_ai"
  | "jsonld_organization"
  | "jsonld_website"
  | "jsonld_product"
  | "jsonld_faq"
  | "headings"
  | "readability";

export type GeoRuleResult = {
  id: GeoRuleId;
  weightPoints: number;
  earnedPoints: number;
  passed: boolean;
  evidence: GeoEvidence;
};

export type CrawlSnapshotRow = {
  projectId: string;
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

export type IncomingFinding = {
  projectId: string;
  fingerprint: string;
  source: FindingSource;
  severity: FindingSeverity;
  code: string;
  pageUrl: string;
  detail: string;
};

export type FindingRow = IncomingFinding & {
  status: FindingStatus;
  firstSeenOn: string;
  lastSeenOn: string;
  resolvedOn: string | null;
};

export type SeoRunRow = {
  id: string;
  projectId: string;
  kind: "pagespeed" | "crawl";
  ok: boolean;
  detail: string | null;
  pageUrl: string | null;
  strategy: string | null;
  finishedAt: string;
};

export type FetchedDocument = {
  url: string;
  status: number;
  contentType: string | null;
  xRobots: string | null;
  text: string;
  error: string | null;
};

export type SiteFetch = (
  url: string,
  timeoutMs: number
) => Promise<FetchedDocument>;
