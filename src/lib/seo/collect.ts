import { randomBytes } from "node:crypto";

import { crawlSite } from "./crawl";
import {
  CRAWL_BUDGET_MS,
  PAGE_TIMEOUT_MS,
  pagespeedTargets,
  readSeoConfig,
  type SeoConfig,
} from "./config";
import { utcDay } from "./dates";
import { fetchPagespeed, type PagespeedFetch } from "./pagespeed-client";
import { ensureWebsiteProject, markSeoSource } from "./projects";
import { reconcileFindings } from "./snapshots";
import { createPostgresSeoStore } from "./postgres-store";
import type { SeoSnapshotStore } from "./store";
import type { PagespeedRow, PagespeedStrategy, SiteFetch } from "./types";

export type CrawlCollectResult = {
  ok: boolean;
  error?: string;
  day?: string;
  pagesFetched?: number;
  pagesPlanned?: number;
  complete?: boolean;
  geoScorePoints?: number;
  openFindings?: number;
};

export type PagespeedCollectResult = {
  ok: boolean;
  error?: string;
  quota?: boolean;
  idle?: boolean;
  day?: string;
  page?: string;
  strategy?: PagespeedStrategy;
  next?: { page: string; strategy: PagespeedStrategy } | null;
};

function newId(): string {
  return randomBytes(9).toString("base64url");
}

export async function runCrawlCollection(options?: {
  fetchImpl?: SiteFetch;
  now?: Date;
  store?: SeoSnapshotStore;
}): Promise<CrawlCollectResult> {
  const config = readSeoConfig();
  if (!config.ok) return { ok: false, error: config.detail };

  const now = options?.now ?? new Date();
  const day = utcDay(now);
  const store = options?.store ?? createPostgresSeoStore();
  const project = await ensureWebsiteProject();
  const fetchImpl = options?.fetchImpl ?? defaultSiteFetch;

  try {
    const execution = await crawlSite({
      projectId: project.id,
      siteUrl: config.config.siteUrl,
      origin: config.config.origin,
      extraPages: config.config.pages,
      maxPages: config.config.maxPages,
      concurrency: config.config.concurrency,
      linkChecks: config.config.linkChecks,
      deadlineMs: now.getTime() + CRAWL_BUDGET_MS,
      pageTimeoutMs: PAGE_TIMEOUT_MS,
      fetchImpl,
    });
    await store.replaceCrawl(
      { ...execution.snapshot, projectId: project.id, day },
      execution.pages.map((page) => ({ ...page, projectId: project.id, day }))
    );
    const existing = await store.listFindings(project.id);
    const reconciled = reconcileFindings({
      existing,
      incoming: execution.findings,
      day,
      checkedPages: new Set(execution.checkedPages),
      resolveSiteLevel: execution.resolveSiteLevel,
      preserveCodes: new Set(execution.preserveCodes),
    });
    await store.saveFindings(reconciled);
    await store.addRun({
      id: newId(),
      projectId: project.id,
      kind: "crawl",
      ok: true,
      detail: execution.snapshot.complete
        ? null
        : `partial ${execution.snapshot.pagesFetched}/${execution.snapshot.pagesPlanned}`,
      pageUrl: config.config.siteUrl,
      strategy: null,
      finishedAt: new Date().toISOString(),
    });
    await markSeoSource(project.id, "crawl", "active", config.config.siteUrl);
    return {
      ok: true,
      day,
      pagesFetched: execution.snapshot.pagesFetched,
      pagesPlanned: execution.snapshot.pagesPlanned,
      complete: execution.snapshot.complete,
      geoScorePoints: execution.snapshot.geoScorePoints,
      openFindings: reconciled.filter((item) => item.status === "open").length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Crawl failed";
    try {
      await store.addRun({
        id: newId(),
        projectId: project.id,
        kind: "crawl",
        ok: false,
        detail: message.slice(0, 400),
        pageUrl: config.config.siteUrl,
        strategy: null,
        finishedAt: new Date().toISOString(),
      });
      await markSeoSource(project.id, "crawl", "error", config.config.siteUrl);
    } catch {
      // The caller still receives the crawl error.
    }
    return { ok: false, error: message };
  }
}

export function pagespeedQueue(
  config: SeoConfig
): Array<{ page: string; strategy: PagespeedStrategy }> {
  const jobs: Array<{ page: string; strategy: PagespeedStrategy }> = [];
  for (const page of pagespeedTargets(config)) {
    jobs.push({ page, strategy: "mobile" });
    jobs.push({ page, strategy: "desktop" });
  }
  return jobs;
}

export async function runPagespeedCollection(options?: {
  page?: string;
  strategy?: PagespeedStrategy;
  force?: boolean;
  fetchImpl?: PagespeedFetch;
  now?: Date;
  store?: SeoSnapshotStore;
}): Promise<PagespeedCollectResult> {
  const config = readSeoConfig();
  if (!config.ok) return { ok: false, error: config.detail };

  const now = options?.now ?? new Date();
  const day = utcDay(now);
  const store = options?.store ?? createPostgresSeoStore();
  const project = await ensureWebsiteProject();
  const queue = pagespeedQueue(config.config);
  const requested = normalizeJob(config.config, options?.page, options?.strategy);
  let index = requested
    ? queue.findIndex((job) => job.page === requested.page && job.strategy === requested.strategy)
    : -1;
  if (index < 0 && options?.force && queue.length > 0) {
    index = 0;
  } else if (index < 0) {
    const existing = await store.listPagespeed(project.id);
    const resume = nextPagespeedJob({ config: config.config, existing, day });
    if (resume) {
      index = queue.findIndex((job) => job.page === resume.page && job.strategy === resume.strategy);
    }
  }
  const job = index >= 0 ? queue[index] : null;
  if (!job) return { ok: true, idle: true, day, next: null };

  const result = await fetchPagespeed({
    pageUrl: job.page,
    strategy: job.strategy,
    apiKey: config.config.pagespeedKey,
    fetchImpl: options?.fetchImpl,
  });

  if (!result.ok) {
    await store.addRun({
      id: newId(),
      projectId: project.id,
      kind: "pagespeed",
      ok: false,
      detail: result.error,
      pageUrl: job.page,
      strategy: job.strategy,
      finishedAt: new Date().toISOString(),
    });
    try {
      await markSeoSource(project.id, "pagespeed", "error", config.config.siteUrl);
    } catch {
      // The run row already stores the provider error.
    }
    const next = result.quota ? null : queue[index + 1] ?? null;
    return {
      ok: false,
      error: result.error,
      quota: result.quota,
      day,
      page: job.page,
      strategy: job.strategy,
      next,
    };
  }

  const row: PagespeedRow = {
    projectId: project.id,
    pageUrl: job.page,
    strategy: job.strategy,
    day,
    ...result.data,
  };
  await store.upsertPagespeed(row);
  await store.addRun({
    id: newId(),
    projectId: project.id,
    kind: "pagespeed",
    ok: true,
    detail: null,
    pageUrl: job.page,
    strategy: job.strategy,
    finishedAt: new Date().toISOString(),
  });
  try {
    await markSeoSource(project.id, "pagespeed", "active", config.config.siteUrl);
  } catch {
    // The snapshot is already stored.
  }
  const next = queue[index + 1] ?? null;
  return { ok: true, day, page: job.page, strategy: job.strategy, next };
}

export function nextPagespeedJob(input: {
  config: SeoConfig;
  existing: PagespeedRow[];
  day: string;
  skip?: { page: string; strategy: PagespeedStrategy };
}): { page: string; strategy: PagespeedStrategy } | null {
  const done = new Set(
    input.existing
      .filter((row) => row.day === input.day)
      .map((row) => `${row.pageUrl}\n${row.strategy}`)
  );
  if (input.skip) done.add(`${input.skip.page}\n${input.skip.strategy}`);
  for (const page of pagespeedTargets(input.config)) {
    for (const strategy of ["mobile", "desktop"] as const) {
      if (!done.has(`${page}\n${strategy}`)) return { page, strategy };
    }
  }
  return null;
}

function normalizeJob(
  config: SeoConfig,
  page: string | undefined,
  strategy: PagespeedStrategy | undefined
): { page: string; strategy: PagespeedStrategy } | null {
  if (!page || (strategy !== "mobile" && strategy !== "desktop")) return null;
  const allowed = new Set(pagespeedTargets(config));
  if (!allowed.has(page)) return null;
  return { page, strategy };
}

const defaultSiteFetch: SiteFetch = async (url, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml,text/plain,*/*",
        "User-Agent": "humana-analytics/seo",
      },
    });
    const text = (await response.text()).slice(0, 2_000_000);
    return {
      url: response.url || url,
      status: response.status,
      contentType: response.headers.get("content-type"),
      xRobots: response.headers.get("x-robots-tag"),
      text,
      error: null,
    };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      url,
      status: 0,
      contentType: null,
      xRobots: null,
      text: "",
      error: aborted ? "Timeout" : error instanceof Error ? error.message : "Fetch failed",
    };
  } finally {
    clearTimeout(timer);
  }
};
