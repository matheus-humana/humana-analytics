import assert from "node:assert/strict";
import test from "node:test";

import { readSeoConfig } from "./config.ts";
import { crawlSite } from "./crawl.ts";
import { explainFinding, explainGeoRule, findingCodes, formatScorePoints } from "./explain.ts";
import { buildSeoFindings } from "./findings.ts";
import { GEO_WEIGHTS, buildGeoChecklist, geoWeightTotal } from "./geo-checklist.ts";
import { parseHtmlPage } from "./html-parse.ts";
import { parsePagespeedResponse } from "./pagespeed-parse.ts";
import { aiBotReports } from "./robots.ts";
import { reconcileFindings } from "./snapshots.ts";
import { createMemorySeoStore } from "./store.ts";
import type { FetchedDocument, FindingRow, SiteFetch } from "./types.ts";

const ORIGIN = "https://example.com";
const HOME = "https://example.com/";
const ENGLISH = "https://example.com/en";

const HOME_TITLE = "Humana AI para equipes que decidem melhor";
const HOME_DESCRIPTION =
  "A Humana estrutura conhecimento, processos e decisões para empresas que operam com IA.";
const EN_TITLE = "Humana AI for teams that decide with clarity";
const EN_DESCRIPTION =
  "Humana structures knowledge, processes, and decisions for companies that work with AI daily.";

test("PageSpeed parser prefers CrUX field data and falls back to lab per vital", () => {
  const parsed = parsePagespeedResponse({
    lighthouseResult: {
      categories: {
        performance: { score: 0.91 },
        accessibility: { score: 1 },
        "best-practices": { score: 0.96 },
        seo: { score: null },
      },
      audits: {
        "largest-contentful-paint": { numericValue: 1800 },
        "cumulative-layout-shift": { numericValue: 0.123 },
        "interaction-to-next-paint": { numericValue: 180 },
      },
    },
    loadingExperience: {
      origin_fallback: false,
      metrics: {
        LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2400, category: "AVERAGE" },
        CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 8, category: "FAST" },
      },
    },
  });

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.data.performance, 91);
  assert.equal(parsed.data.accessibility, 100);
  assert.equal(parsed.data.bestPractices, 96);
  assert.equal(parsed.data.seo, null);
  assert.equal(parsed.data.lcpMs, 2400);
  assert.equal(parsed.data.lcpOrigin, "field-url");
  assert.equal(parsed.data.clsThousandths, 80);
  assert.equal(parsed.data.clsOrigin, "field-url");
  assert.equal(parsed.data.inpMs, 180);
  assert.equal(parsed.data.inpOrigin, "lab");
});

test("PageSpeed parser labels origin fallback and keeps the API error", () => {
  const fallback = parsePagespeedResponse({
    lighthouseResult: {
      categories: { performance: { score: 0.5 } },
      audits: { "cumulative-layout-shift": { numericValue: 0.2 } },
    },
    loadingExperience: {
      origin_fallback: true,
      metrics: {
        LARGEST_CONTENTFUL_PAINT_MS: { percentile: 3000, category: "AVERAGE" },
      },
    },
  });
  assert.equal(fallback.ok, true);
  if (!fallback.ok) return;
  assert.equal(fallback.data.lcpOrigin, "field-origin");
  assert.equal(fallback.data.lcpMs, 3000);
  assert.equal(fallback.data.clsOrigin, "lab");
  assert.equal(fallback.data.clsThousandths, 200);

  const failed = parsePagespeedResponse({
    error: { code: 429, message: "Quota exceeded for quota metric 'Queries' and limit 'Queries per day'." },
  });
  assert.equal(failed.ok, false);
  if (failed.ok) return;
  assert.match(failed.error, /Quota exceeded/);
});

test("crawl rules flag the sample HTML and a healthy page stays clean", () => {
  assert.ok(HOME_TITLE.length >= 30 && HOME_TITLE.length <= 60);
  assert.ok(HOME_DESCRIPTION.length >= 50 && HOME_DESCRIPTION.length <= 160);

  const healthy = parseHtmlPage({
    html: healthyHtml(HOME, HOME_TITLE, HOME_DESCRIPTION, ENGLISH),
    url: HOME,
    httpStatus: 200,
    origin: ORIGIN,
  });
  const english = parseHtmlPage({
    html: healthyHtml(ENGLISH, EN_TITLE, EN_DESCRIPTION, HOME),
    url: ENGLISH,
    httpStatus: 200,
    origin: ORIGIN,
  });
  const clean = buildSeoFindings({
    projectId: "proj",
    pages: [healthy, english],
    linkStatus: new Map([
      [HOME, 200],
      [ENGLISH, 200],
    ]),
  });
  assert.deepEqual(clean.map((item) => item.code), []);

  const broken = parseHtmlPage({
    html: brokenHtml(),
    url: HOME,
    httpStatus: 200,
    origin: ORIGIN,
  });
  const findings = buildSeoFindings({
    projectId: "proj",
    pages: [broken],
    linkStatus: new Map([
      [HOME, 200],
      ["https://example.com/missing", 404],
    ]),
  });
  const codes = findings.map((item) => item.code).sort();
  assert.deepEqual(codes, [
    "broken_internal_link",
    "h1_multiple",
    "image_missing_alt",
    "missing_canonical",
    "missing_description",
    "missing_hreflang",
    "missing_title",
    "noindex",
  ]);
  const link = findings.find((item) => item.code === "broken_internal_link");
  assert.equal(link?.severity, "critical");
  assert.equal(link?.pageUrl, HOME);
  assert.match(link?.detail ?? "", /404/);
  assert.equal(findings.find((item) => item.code === "missing_title")?.severity, "critical");
  assert.equal(findings.find((item) => item.code === "image_missing_alt")?.severity, "warning");
});

test("duplicate titles are warnings and a repeated crawl does not double them", () => {
  const shared = "Humana AI para equipes que decidem melhor";
  const first = parseHtmlPage({
    html: healthyHtml(HOME, shared, HOME_DESCRIPTION, ENGLISH),
    url: HOME,
    httpStatus: 200,
    origin: ORIGIN,
  });
  const second = parseHtmlPage({
    html: healthyHtml(ENGLISH, shared, EN_DESCRIPTION, HOME),
    url: ENGLISH,
    httpStatus: 200,
    origin: ORIGIN,
  });
  const incoming = buildSeoFindings({
    projectId: "proj",
    pages: [first, second],
    linkStatus: new Map([
      [HOME, 200],
      [ENGLISH, 200],
    ]),
  });
  assert.equal(incoming.filter((item) => item.code === "duplicate_title").length, 2);

  const day = "2026-09-27";
  const once = reconcileFindings({
    existing: [],
    incoming,
    day,
    checkedPages: new Set([HOME, ENGLISH]),
    resolveSiteLevel: true,
  });
  const twice = reconcileFindings({
    existing: once,
    incoming,
    day,
    checkedPages: new Set([HOME, ENGLISH]),
    resolveSiteLevel: true,
  });
  assert.equal(twice.length, once.length);
  assert.equal(new Set(twice.map((item) => item.fingerprint)).size, twice.length);
  assert.equal(twice.every((item) => item.firstSeenOn === day && item.status === "open"), true);
});

test("GEO checklist scores the sample site from explicit weights", () => {
  assert.equal(geoWeightTotal(), 1000);
  assert.equal(
    Object.values(GEO_WEIGHTS).reduce((sum, value) => sum + value, 0),
    1000
  );

  const home = parseHtmlPage({
    html: healthyHtml(HOME, HOME_TITLE, HOME_DESCRIPTION, ENGLISH),
    url: HOME,
    httpStatus: 200,
    origin: ORIGIN,
  });
  const llms = "# Humana\nThis file describes the public site.\nhttps://example.com/\n";
  const healthy = buildGeoChecklist({
    projectId: "proj",
    siteUrl: HOME,
    llmsStatus: 200,
    llmsBody: llms,
    llmsContentType: "text/plain",
    bots: aiBotReports("User-agent: *\nDisallow:\n"),
    pages: [home],
  });
  assert.equal(healthy.scorePoints, 1000);
  assert.equal(healthy.rules.every((rule) => rule.passed), true);
  assert.equal(healthy.findings.length, 0);
  for (const rule of healthy.rules) {
    assert.equal(rule.weightPoints, GEO_WEIGHTS[rule.id]);
    assert.ok(explainGeoRule("pt-BR", rule).length > 0);
    assert.ok(explainGeoRule("en", rule).length > 0);
  }

  const blocked = aiBotReports(
    ["User-agent: *", "Disallow:", "", "User-agent: GPTBot", "Disallow: /", "", "User-agent: ClaudeBot", "Disallow: /"].join(
      "\n"
    )
  );
  assert.equal(blocked.find((bot) => bot.bot === "GPTBot")?.access, "blocked");
  assert.equal(blocked.find((bot) => bot.bot === "PerplexityBot")?.access, "allowed");
  assert.equal(
    aiBotReports("User-agent: GPTBot\nDisallow: /\nAllow: /\n").find((bot) => bot.bot === "GPTBot")
      ?.access,
    "allowed"
  );

  const broken = parseHtmlPage({
    html: brokenHtml(),
    url: HOME,
    httpStatus: 200,
    origin: ORIGIN,
  });
  const weak = buildGeoChecklist({
    projectId: "proj",
    siteUrl: HOME,
    llmsStatus: 404,
    llmsBody: "<html>missing</html>",
    llmsContentType: "text/html",
    bots: blocked,
    pages: [broken],
  });
  assert.equal(weak.scorePoints, Math.round((200 * 5) / 7));
  assert.equal(weak.rules.find((rule) => rule.id === "llms_present")?.passed, false);
  assert.equal(weak.rules.find((rule) => rule.id === "jsonld_organization")?.passed, false);
  assert.equal(weak.rules.find((rule) => rule.id === "headings")?.evidence.h1, 2);
  const why = explainGeoRule("pt-BR", weak.rules.find((rule) => rule.id === "robots_ai")!);
  assert.match(why, /GPTBot/);
  assert.match(why, /ClaudeBot/);
});

test("a homepage redirect is stored once and still scores GEO", async () => {
  const pages = healthySite();
  pages.set(
    docKey(HOME),
    textDoc(ENGLISH, 200, healthyHtml(ENGLISH, EN_TITLE, EN_DESCRIPTION, HOME), "text/html")
  );
  const execution = await crawlSite({
    projectId: "proj",
    siteUrl: HOME,
    origin: ORIGIN,
    extraPages: [],
    maxPages: 10,
    concurrency: 2,
    linkChecks: 0,
    deadlineMs: Date.now() + 5_000,
    pageTimeoutMs: 1_000,
    fetchImpl: siteFetch(pages),
  });
  assert.equal(execution.snapshot.complete, true);
  assert.equal(execution.snapshot.pagesFetched, 2);
  assert.equal(execution.pages.length, 1);
  assert.equal(execution.pages[0]?.pageUrl, ENGLISH);
  assert.equal(execution.snapshot.geoScorePoints, 1000);
  assert.equal(
    execution.snapshot.checklist.find((rule) => rule.id === "headings")?.evidence.page,
    ENGLISH
  );
  assert.equal(execution.findings.length, 0);
});

test("snapshots stay idempotent and a missing finding is resolved on the next crawl", async () => {
  const store = createMemorySeoStore();
  const base = {
    projectId: "proj",
    pageUrl: HOME,
    strategy: "mobile" as const,
    day: "2026-09-27",
    performance: 80,
    accessibility: 90,
    bestPractices: 90,
    seo: 90,
    lcpMs: 2000,
    clsThousandths: 50,
    inpMs: 150,
    lcpOrigin: "lab" as const,
    clsOrigin: "lab" as const,
    inpOrigin: "lab" as const,
  };
  await store.upsertPagespeed(base);
  await store.upsertPagespeed({ ...base, performance: 88 });
  assert.equal(store.pagespeedCount(), 1);
  assert.equal((await store.listPagespeed("proj"))[0]?.performance, 88);

  const execution = await crawlSite({
    projectId: "proj",
    siteUrl: HOME,
    origin: ORIGIN,
    extraPages: [],
    maxPages: 10,
    concurrency: 2,
    linkChecks: 5,
    deadlineMs: Date.now() + 5_000,
    pageTimeoutMs: 1_000,
    fetchImpl: siteFetch(healthySite()),
  });
  assert.equal(execution.snapshot.complete, true);
  assert.equal(execution.snapshot.llmsFound, true);
  assert.equal(execution.snapshot.sitemapFound, true);
  assert.equal(execution.snapshot.geoScorePoints, 1000);
  assert.equal(execution.findings.length, 0);
  assert.equal(execution.pages.length, 2);

  await store.replaceCrawl(
    { ...execution.snapshot, projectId: "proj", day: "2026-09-27" },
    execution.pages.map((page) => ({ ...page, projectId: "proj", day: "2026-09-27" }))
  );
  const again = await crawlSite({
    projectId: "proj",
    siteUrl: HOME,
    origin: ORIGIN,
    extraPages: [],
    maxPages: 10,
    concurrency: 2,
    linkChecks: 5,
    deadlineMs: Date.now() + 5_000,
    pageTimeoutMs: 1_000,
    fetchImpl: siteFetch(healthySite()),
  });
  await store.replaceCrawl(
    { ...again.snapshot, projectId: "proj", day: "2026-09-27", geoScorePoints: 1000 },
    again.pages.slice(0, 1).map((page) => ({ ...page, projectId: "proj", day: "2026-09-27" }))
  );
  assert.equal(store.crawlCount(), 1);
  assert.equal(store.pageCount("proj", "2026-09-27"), 1);

  const broken = await crawlSite({
    projectId: "proj",
    siteUrl: HOME,
    origin: ORIGIN,
    extraPages: [],
    maxPages: 10,
    concurrency: 2,
    linkChecks: 5,
    deadlineMs: Date.now() + 5_000,
    pageTimeoutMs: 1_000,
    fetchImpl: siteFetch(brokenSite()),
  });
  const open = reconcileFindings({
    existing: [],
    incoming: broken.findings,
    day: "2026-09-27",
    checkedPages: new Set(broken.checkedPages),
    resolveSiteLevel: true,
  });
  const kept = reconcileFindings({
    existing: open,
    incoming: broken.findings,
    day: "2026-09-27",
    checkedPages: new Set(broken.checkedPages),
    resolveSiteLevel: true,
  });
  assert.equal(kept.filter((item) => item.status === "open").length, open.length);
  assert.equal(kept[0]?.firstSeenOn, "2026-09-27");

  const fixed = reconcileFindings({
    existing: kept,
    incoming: [],
    day: "2026-09-28",
    checkedPages: new Set(broken.checkedPages),
    resolveSiteLevel: true,
  });
  assert.equal(fixed.every((item) => item.status === "resolved"), true);
  assert.equal(fixed.every((item) => item.resolvedOn === "2026-09-28"), true);
  assert.equal(fixed.length, kept.length);

  const resolvedAgain = reconcileFindings({
    existing: fixed,
    incoming: [],
    day: "2026-09-29",
    checkedPages: new Set(broken.checkedPages),
    resolveSiteLevel: true,
  });
  assert.equal(resolvedAgain.length, fixed.length);
  assert.equal(resolvedAgain.every((item) => item.resolvedOn === "2026-09-28"), true);

  await store.saveFindings(fixed);
  await store.saveFindings(resolvedAgain);
  const stored = await store.listFindings("proj");
  assert.equal(stored.length, fixed.length);
  assert.equal(new Set(stored.map((item) => item.fingerprint)).size, stored.length);
});

test("an unchecked page is not marked resolved", () => {
  const existing: FindingRow[] = [
    {
      projectId: "proj",
      fingerprint: "seo:missing_title:https://example.com/old:",
      source: "seo",
      severity: "critical",
      code: "missing_title",
      pageUrl: "https://example.com/old",
      detail: "",
      status: "open",
      firstSeenOn: "2026-09-01",
      lastSeenOn: "2026-09-01",
      resolvedOn: null,
    },
  ];
  const next = reconcileFindings({
    existing,
    incoming: [],
    day: "2026-09-27",
    checkedPages: new Set([HOME]),
    resolveSiteLevel: true,
  });
  assert.equal(next[0]?.status, "open");
  assert.equal(next[0]?.firstSeenOn, "2026-09-01");
});

test("finding copy exists in Portuguese and English", () => {
  for (const code of findingCodes()) {
    const portuguese = explainFinding("pt-BR", code);
    const english = explainFinding("en", code);
    assert.ok(portuguese);
    assert.ok(english);
    assert.ok(portuguese.title.length > 0);
    assert.ok(english.title.length > 0);
    assert.ok(portuguese.fix.length > 0);
    assert.ok(english.fix.length > 0);
  }
  assert.equal(formatScorePoints(1000), "10.0");
  assert.equal(formatScorePoints(75), "0.75");
  assert.equal(formatScorePoints(150), "1.5");
});

test("readability uses the body and ignores the document title", () => {
  const page = parseHtmlPage({
    html: `<html><head><title>${HOME_TITLE}</title></head><body><div id="root"></div></body></html>`,
    url: HOME,
    httpStatus: 200,
    origin: ORIGIN,
  });
  assert.equal(page.h1.length, 0);
  assert.equal(page.wordCount, 0);
  assert.equal(page.title, HOME_TITLE);
});

test("SITE_URL is required and pages stay on that origin", () => {
  const missing = readSeoConfig({ SITE_URL: "  " });
  assert.equal(missing.ok, false);
  if (missing.ok) return;
  assert.equal(missing.detail, "missing_site_url");

  const config = readSeoConfig({
    SITE_URL: "https://www.Humana.ai/en/",
    SEO_PAGES: "/pt, https://evil.example/phish, /en",
    AI_TRAFFIC_SOURCES: "Claude.ai, perplexity.ai",
  });
  assert.equal(config.ok, true);
  if (!config.ok) return;
  assert.equal(config.config.siteUrl, "https://www.humana.ai/en");
  assert.deepEqual(config.config.pages, ["https://www.humana.ai/pt"]);
  assert.deepEqual(config.config.aiSources, ["claude.ai", "perplexity.ai"]);
});

function healthyHtml(url: string, title: string, description: string, alternate: string): string {
  const paragraph = Array.from({ length: 15 }, () =>
    "Humana organiza o conhecimento da empresa com clareza e ritmo."
  ).join(" ");
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${url}">
  <link rel="alternate" hreflang="en" href="${alternate}">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@graph":[
    {"@type":"Organization","name":"Humana"},
    {"@type":"WebSite","name":"Humana"},
    {"@type":"SoftwareApplication","name":"Humana"},
    {"@type":"FAQPage","mainEntity":[]}
  ]}
  </script>
</head>
<body>
  <header><nav><a href="${alternate}">Idioma</a></nav></header>
  <main>
    <h1>${title}</h1>
    <h2>Como funciona</h2>
    <p>${paragraph}</p>
    <img src="/logo.png" alt="Logotipo da Humana">
  </main>
</body>
</html>`;
}

function brokenHtml(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta name="robots" content="noindex">
</head>
<body>
  <main>
    <h1>Um</h1>
    <h1>Dois</h1>
    <h3>Pulo</h3>
    <p>Curto demais</p>
    <img src="/foto.png">
    <a href="/missing">Quebrado</a>
  </main>
</body>
</html>`;
}

function healthySite(): Map<string, FetchedDocument> {
  const llms = "# Humana\nThis file describes the public site.\nhttps://example.com/\n";
  return new Map([
    [docKey("https://example.com/robots.txt"), textDoc("https://example.com/robots.txt", 200, "User-agent: *\nDisallow:\nSitemap: https://example.com/sitemap.xml\n", "text/plain")],
    [docKey("https://example.com/llms.txt"), textDoc("https://example.com/llms.txt", 200, llms, "text/plain")],
    [docKey("https://example.com/sitemap.xml"), textDoc("https://example.com/sitemap.xml", 200, `<urlset><loc>${HOME}</loc><loc>${ENGLISH}</loc></urlset>`, "application/xml")],
    [docKey(HOME), textDoc(HOME, 200, healthyHtml(HOME, HOME_TITLE, HOME_DESCRIPTION, ENGLISH), "text/html")],
    [docKey(ENGLISH), textDoc(ENGLISH, 200, healthyHtml(ENGLISH, EN_TITLE, EN_DESCRIPTION, HOME), "text/html")],
  ]);
}

function brokenSite(): Map<string, FetchedDocument> {
  return new Map([
    [docKey("https://example.com/robots.txt"), textDoc("https://example.com/robots.txt", 200, "User-agent: *\nDisallow:\n\nUser-agent: GPTBot\nDisallow: /\n", "text/plain")],
    [docKey("https://example.com/llms.txt"), textDoc("https://example.com/llms.txt", 404, "missing", "text/plain")],
    [docKey("https://example.com/sitemap.xml"), textDoc("https://example.com/sitemap.xml", 200, `<urlset><loc>${HOME}</loc></urlset>`, "application/xml")],
    [docKey(HOME), textDoc(HOME, 200, brokenHtml(), "text/html")],
    [docKey("https://example.com/missing"), textDoc("https://example.com/missing", 404, "missing", "text/html")],
  ]);
}

function siteFetch(pages: Map<string, FetchedDocument>): SiteFetch {
  return async (url: string) => {
    const found = pages.get(docKey(url));
    if (found) return found;
    return textDoc(url, 404, "missing", "text/html");
  };
}

function textDoc(url: string, status: number, body: string, contentType: string): FetchedDocument {
  return { url, status, contentType, xRobots: null, text: body, error: null };
}

function docKey(url: string): string {
  const parsed = new URL(url);
  if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.hash = "";
  return parsed.toString();
}
