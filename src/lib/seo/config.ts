import { AI_BOTS, type AiBotName } from "./types";

export const MISSING_SITE_URL = "missing_site_url";
export const INVALID_SITE_URL = "invalid_site_url";
export const NO_SNAPSHOT = "no_snapshot";

export const DEFAULT_MAX_PAGES = 30;
export const DEFAULT_CONCURRENCY = 4;
export const DEFAULT_PAGESPEED_MAX = 16;
export const DEFAULT_LINK_CHECKS = 40;
export const PAGE_TIMEOUT_MS = 12_000;
export const CRAWL_BUDGET_MS = 45_000;
export const PAGESPEED_TIMEOUT_MS = 50_000;

export const TITLE_MIN = 30;
export const TITLE_MAX = 60;
export const DESCRIPTION_MIN = 50;
export const DESCRIPTION_MAX = 160;

/** Public referrers treated as AI assistants. Override with AI_TRAFFIC_SOURCES. */
export const DEFAULT_AI_SOURCES = [
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "gemini.google.com",
  "copilot.microsoft.com",
  "claude.ai",
  "chat.mistral.ai",
  "poe.com",
  "you.com",
  "phind.com",
  "meta.ai",
] as const;

export type SeoConfig = {
  siteUrl: string;
  origin: string;
  pages: string[];
  maxPages: number;
  concurrency: number;
  linkChecks: number;
  pagespeedKey: string | null;
  pagespeedMax: number;
  aiSources: string[];
};

export type SeoEnv = {
  SITE_URL?: string | null;
  SEO_PAGES?: string | null;
  SEO_MAX_PAGES?: string | null;
  SEO_CONCURRENCY?: string | null;
  SEO_LINK_CHECKS?: string | null;
  SEO_PAGESPEED_MAX?: string | null;
  PAGESPEED_API_KEY?: string | null;
  AI_TRAFFIC_SOURCES?: string | null;
};

export function readSeoConfig(
  env: SeoEnv = seoEnvFromProcess()
): { ok: true; config: SeoConfig } | { ok: false; detail: string } {
  const rawSite = env.SITE_URL?.trim() ?? "";
  if (!rawSite) return { ok: false, detail: MISSING_SITE_URL };

  let site: URL;
  try {
    site = new URL(rawSite);
  } catch {
    return { ok: false, detail: INVALID_SITE_URL };
  }
  if (site.protocol !== "http:" && site.protocol !== "https:") {
    return { ok: false, detail: INVALID_SITE_URL };
  }
  if (site.username || site.password) {
    return { ok: false, detail: INVALID_SITE_URL };
  }

  const siteUrl = normalizeConfiguredSite(site);
  const origin = new URL(siteUrl).origin;
  const pages = resolvePages(origin, siteUrl, env.SEO_PAGES);
  const aiSources = readList(env.AI_TRAFFIC_SOURCES).map((item) => item.toLowerCase());
  return {
    ok: true,
    config: {
      siteUrl,
      origin,
      pages,
      maxPages: clampInt(env.SEO_MAX_PAGES, DEFAULT_MAX_PAGES, 1, 80),
      concurrency: clampInt(env.SEO_CONCURRENCY, DEFAULT_CONCURRENCY, 1, 6),
      linkChecks: clampInt(env.SEO_LINK_CHECKS, DEFAULT_LINK_CHECKS, 0, 80),
      pagespeedKey: env.PAGESPEED_API_KEY?.trim() || null,
      pagespeedMax: clampInt(env.SEO_PAGESPEED_MAX, DEFAULT_PAGESPEED_MAX, 1, 40),
      aiSources: aiSources.length > 0 ? aiSources : [...DEFAULT_AI_SOURCES],
    },
  };
}

export function pagespeedTargets(config: SeoConfig): string[] {
  const urls = [config.siteUrl, ...config.pages];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    unique.push(url);
    if (unique.length * 2 >= config.pagespeedMax) break;
  }
  return unique;
}

export function isAiBot(value: string): value is AiBotName {
  return (AI_BOTS as readonly string[]).includes(value);
}

function seoEnvFromProcess(): SeoEnv {
  return {
    SITE_URL: process.env.SITE_URL,
    SEO_PAGES: process.env.SEO_PAGES,
    SEO_MAX_PAGES: process.env.SEO_MAX_PAGES,
    SEO_CONCURRENCY: process.env.SEO_CONCURRENCY,
    SEO_LINK_CHECKS: process.env.SEO_LINK_CHECKS,
    SEO_PAGESPEED_MAX: process.env.SEO_PAGESPEED_MAX,
    PAGESPEED_API_KEY: process.env.PAGESPEED_API_KEY,
    AI_TRAFFIC_SOURCES: process.env.AI_TRAFFIC_SOURCES,
  };
}

function normalizeConfiguredSite(site: URL): string {
  site.hash = "";
  site.hostname = site.hostname.toLowerCase();
  if (
    (site.protocol === "https:" && site.port === "443") ||
    (site.protocol === "http:" && site.port === "80")
  ) {
    site.port = "";
  }
  if (site.pathname.length > 1 && site.pathname.endsWith("/")) {
    site.pathname = site.pathname.replace(/\/+$/, "");
  }
  if (site.pathname === "") site.pathname = "/";
  return site.toString();
}

function resolvePages(origin: string, home: string, raw: string | null | undefined): string[] {
  const pages: string[] = [];
  for (const part of readList(raw)) {
    let url: URL;
    try {
      url = part.startsWith("http://") || part.startsWith("https://")
        ? new URL(part)
        : new URL(part.startsWith("/") ? part : `/${part}`, origin);
    } catch {
      continue;
    }
    if (url.origin !== origin) continue;
    url.hash = "";
    const normalized = normalizeConfiguredSite(url);
    if (normalized === home || pages.includes(normalized)) continue;
    pages.push(normalized);
  }
  return pages;
}

function readList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const part of raw.split(/[\s,]+/)) {
    const value = part.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }
  return items;
}

function clampInt(
  raw: string | null | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
