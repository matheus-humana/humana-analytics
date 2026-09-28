import { buildSeoFindings } from "./findings";
import { buildGeoChecklist, looksLikeHtml } from "./geo-checklist";
import { headingSkipCount, parseHtmlPage } from "./html-parse";
import { aiBotReports, sitemapUrlsFromRobots } from "./robots";
import { parseSitemapXml } from "./sitemap";
import type {
  AiBotReport,
  CrawlPageRow,
  CrawlSnapshotRow,
  FetchedDocument,
  GeoRuleResult,
  IncomingFinding,
  PageSignals,
  SiteFetch,
} from "./types";
import { normalizePageUrl, sameOrigin, uniqueUrls } from "./urls";

export type CrawlExecution = {
  snapshot: Omit<CrawlSnapshotRow, "projectId" | "day">;
  pages: Array<Omit<CrawlPageRow, "projectId" | "day">>;
  findings: IncomingFinding[];
  checkedPages: string[];
  preserveCodes: string[];
  resolveSiteLevel: boolean;
};

export async function crawlSite(input: {
  projectId: string;
  siteUrl: string;
  origin: string;
  extraPages: string[];
  maxPages: number;
  concurrency: number;
  linkChecks: number;
  deadlineMs: number;
  fetchImpl: SiteFetch;
  pageTimeoutMs: number;
}): Promise<CrawlExecution> {
  const home = normalizePageUrl(input.siteUrl) ?? input.siteUrl;
  const robotsUrl = new URL("/robots.txt", input.origin).toString();
  const llmsUrl = new URL("/llms.txt", input.origin).toString();
  const defaultSitemap = new URL("/sitemap.xml", input.origin).toString();

  const robotsDoc = await input.fetchImpl(robotsUrl, input.pageTimeoutMs).catch((error: unknown) =>
    failedDocument(robotsUrl, error)
  );
  const robotsFound = robotsDoc.status === 200 && !robotsDoc.error;
  const robotsText = robotsFound ? robotsDoc.text : null;
  const bots = aiBotReports(robotsText);

  const llmsDoc = await input.fetchImpl(llmsUrl, input.pageTimeoutMs).catch((error: unknown) =>
    failedDocument(llmsUrl, error)
  );

  const sitemapSeeds = uniqueUrls([
    ...sitemapUrlsFromRobots(robotsText ?? "").map((url) => normalizePageUrl(url) ?? url),
    defaultSitemap,
  ]);
  const discovered: string[] = [];
  let sitemapFound = false;
  const seenSitemaps = new Set<string>();
  for (const seed of sitemapSeeds) {
    if (!sameOrigin(seed, input.origin) && !seed.startsWith(input.origin)) continue;
    const found = await readSitemap({
      url: seed,
      origin: input.origin,
      depth: 0,
      into: discovered,
      seen: seenSitemaps,
      limit: input.maxPages,
      deadlineMs: input.deadlineMs,
      fetchImpl: input.fetchImpl,
      pageTimeoutMs: input.pageTimeoutMs,
    });
    sitemapFound = sitemapFound || found;
  }

  const planned = uniqueUrls([
    home,
    ...input.extraPages,
    ...discovered
      .map((url) => normalizePageUrl(url))
      .filter((url): url is string => Boolean(url && sameOrigin(url, input.origin))),
  ]).slice(0, input.maxPages);

  const signals: PageSignals[] = [];
  const seenFinal = new Set<string>();
  let fetched = 0;
  let homePage: PageSignals | null = null;
  await mapPool(planned, input.concurrency, async (url) => {
    if (Date.now() > input.deadlineMs) return;
    const doc = await input.fetchImpl(url, input.pageTimeoutMs).catch((error: unknown) =>
      failedDocument(url, error)
    );
    fetched += 1;
    const finalUrl = normalizePageUrl(doc.url) ?? url;
    const page = parseHtmlPage({
      html: doc.status >= 200 && doc.status < 400 ? doc.text : "",
      url: finalUrl,
      httpStatus: doc.status,
      origin: input.origin,
      xRobots: doc.xRobots,
      error: doc.error,
    });
    if (url === home) homePage = page;
    if (seenFinal.has(finalUrl)) return;
    seenFinal.add(finalUrl);
    signals.push(page);
  });

  const byUrl = new Map<string, number>();
  for (const page of signals) byUrl.set(page.url, page.httpStatus);

  const uncheckedLinks: Array<{ from: string; to: string }> = [];
  for (const page of signals) {
    if (page.httpStatus < 200 || page.httpStatus >= 400) continue;
    for (const target of page.internalLinks) {
      if (!byUrl.has(target)) uncheckedLinks.push({ from: page.url, to: target });
    }
  }
  const probeTargets = uniqueUrls(uncheckedLinks.map((link) => link.to)).slice(0, input.linkChecks);
  await mapPool(probeTargets, input.concurrency, async (url) => {
    if (Date.now() > input.deadlineMs) return;
    const doc = await input.fetchImpl(url, input.pageTimeoutMs).catch((error: unknown) =>
      failedDocument(url, error)
    );
    const finalUrl = normalizePageUrl(doc.url) ?? url;
    byUrl.set(url, doc.status);
    if (finalUrl !== url && !byUrl.has(finalUrl)) byUrl.set(finalUrl, doc.status);
  });

  const seoFindings = buildSeoFindings({
    projectId: input.projectId,
    pages: signals,
    linkStatus: byUrl,
  });
  const geo = buildGeoChecklist({
    projectId: input.projectId,
    siteUrl: home,
    llmsStatus: llmsDoc.error ? llmsDoc.status || null : llmsDoc.status,
    llmsBody: llmsDoc.error ? "" : llmsDoc.text,
    llmsContentType: llmsDoc.contentType,
    bots,
    pages: signals,
    homePage,
  });

  const complete = fetched === planned.length;
  const pages = signals.map((page) => toPageRow(page));
  const llmsBody = llmsDoc.error ? "" : llmsDoc.text;
  const llmsValid = geo.rules.find((rule) => rule.id === "llms_valid")?.passed ?? false;

  return {
    snapshot: {
      siteUrl: home,
      pagesFetched: fetched,
      pagesPlanned: planned.length,
      complete,
      sitemapFound,
      sitemapUrls: discovered.length,
      robotsFound,
      robotsBytes: robotsFound ? byteLength(robotsDoc.text) : 0,
      llmsFound: llmsDoc.status === 200 && byteLength(llmsBody) > 0 && !looksLikeHtml(llmsBody, llmsDoc.contentType),
      llmsBytes: llmsDoc.status === 200 ? byteLength(llmsBody) : 0,
      llmsValid,
      geoScorePoints: geo.scorePoints,
      checklist: geo.rules,
      aiBots: bots,
    },
    pages,
    findings: [...seoFindings, ...geo.findings],
    checkedPages: signals.map((page) => page.url),
    preserveCodes: complete ? [] : ["duplicate_title", "duplicate_description"],
    resolveSiteLevel: true,
  };
}

async function readSitemap(input: {
  url: string;
  origin: string;
  depth: number;
  into: string[];
  seen: Set<string>;
  limit: number;
  deadlineMs: number;
  fetchImpl: SiteFetch;
  pageTimeoutMs: number;
}): Promise<boolean> {
  if (input.depth > 3 || input.seen.has(input.url) || Date.now() > input.deadlineMs) return false;
  if (input.into.length >= input.limit) return false;
  input.seen.add(input.url);
  const doc = await input.fetchImpl(input.url, input.pageTimeoutMs).catch((error: unknown) =>
    failedDocument(input.url, error)
  );
  if (doc.status !== 200 || doc.error) return false;
  const parsed = parseSitemapXml(doc.text);
  let found = parsed.urls.length > 0 || parsed.indexes.length > 0;
  if (parsed.indexes.length > 0) {
    for (const child of parsed.indexes) {
      const normalized = normalizePageUrl(child) ?? child;
      const nested = await readSitemap({ ...input, url: normalized, depth: input.depth + 1 });
      found = found || nested;
      if (input.into.length >= input.limit) break;
    }
    return found;
  }
  for (const loc of parsed.urls) {
    if (input.into.length >= input.limit) break;
    const normalized = normalizePageUrl(loc);
    if (!normalized || !sameOrigin(normalized, input.origin)) continue;
    input.into.push(normalized);
  }
  return found;
}

function toPageRow(page: PageSignals): Omit<CrawlPageRow, "projectId" | "day"> {
  return {
    pageUrl: page.url,
    httpStatus: page.httpStatus,
    title: page.title,
    titleLength: page.title?.length ?? 0,
    description: page.description,
    descriptionLength: page.description?.length ?? 0,
    h1Count: page.h1.length,
    canonical: page.canonical,
    lang: page.lang,
    hreflang: page.hreflang,
    imagesMissingAlt: page.imagesMissingAlt,
    noindex: page.noindex,
    jsonLdTypes: page.jsonLdTypes,
    wordCount: page.wordCount,
    sentenceCount: page.sentenceCount,
    headingSkips: headingSkipCount(page.headingLevels),
  };
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      await worker(items[current] as T);
    }
  });
  await Promise.all(workers);
}

function failedDocument(url: string, error: unknown): FetchedDocument {
  return {
    url,
    status: 0,
    contentType: null,
    xRobots: null,
    text: "",
    error: error instanceof Error ? error.message : "Fetch failed",
  };
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export type { AiBotReport, GeoRuleResult };
