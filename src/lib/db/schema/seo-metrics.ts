import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  primaryKey,
  text,
} from 'drizzle-orm/pg-core';

import type {
  AiBotReport,
  GeoRuleResult,
  HreflangLink,
} from '../../seo/types';
import { analyticsSchema, timestamptz } from './analytics-schema';
import { projects } from './projects';

/**
 * One Lighthouse/CrUX measurement per page, strategy, and UTC day.
 * A later collect on the same day updates the row.
 * Null scores mean the API omitted that category, not a score of zero.
 */
export const pagespeedSnapshots = analyticsSchema.table(
  'pagespeed_snapshots',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    pageUrl: text('page_url').notNull(),
    strategy: text('strategy').notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    performance: integer('performance'),
    accessibility: integer('accessibility'),
    bestPractices: integer('best_practices'),
    seo: integer('seo'),
    lcpMs: integer('lcp_ms'),
    clsThousandths: integer('cls_thousandths'),
    inpMs: integer('inp_ms'),
    lcpOrigin: text('lcp_origin'),
    clsOrigin: text('cls_origin'),
    inpOrigin: text('inp_origin'),
    collectedAt: timestamptz('collected_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.projectId, table.pageUrl, table.strategy, table.day],
    }),
    index('pagespeed_snapshots_project_day_idx').on(table.projectId, table.day),
  ]
);

/** Daily on-page crawl plus the GEO checklist computed from that crawl. */
export const crawlSnapshots = analyticsSchema.table(
  'crawl_snapshots',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    siteUrl: text('site_url').notNull(),
    pagesFetched: integer('pages_fetched').notNull(),
    pagesPlanned: integer('pages_planned').notNull(),
    complete: boolean('complete').notNull(),
    sitemapFound: boolean('sitemap_found').notNull(),
    sitemapUrls: integer('sitemap_urls').notNull(),
    robotsFound: boolean('robots_found').notNull(),
    robotsBytes: integer('robots_bytes').notNull(),
    llmsFound: boolean('llms_found').notNull(),
    llmsBytes: integer('llms_bytes').notNull(),
    llmsValid: boolean('llms_valid').notNull(),
    geoScorePoints: integer('geo_score_points').notNull(),
    checklist: jsonb('checklist').$type<GeoRuleResult[]>().notNull(),
    aiBots: jsonb('ai_bots').$type<AiBotReport[]>().notNull(),
    collectedAt: timestamptz('collected_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.day] }),
    index('crawl_snapshots_project_idx').on(table.projectId),
  ]
);

/** Public page signals from the crawl. Replaced for that project and day. */
export const crawlPages = analyticsSchema.table(
  'crawl_pages',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    pageUrl: text('page_url').notNull(),
    httpStatus: integer('http_status').notNull(),
    title: text('title'),
    titleLength: integer('title_length').notNull(),
    description: text('description'),
    descriptionLength: integer('description_length').notNull(),
    h1Count: integer('h1_count').notNull(),
    canonical: text('canonical'),
    lang: text('lang'),
    hreflang: jsonb('hreflang').$type<HreflangLink[]>().notNull(),
    imagesMissingAlt: integer('images_missing_alt').notNull(),
    noindex: boolean('noindex').notNull(),
    jsonLdTypes: jsonb('json_ld_types').$type<string[]>().notNull(),
    wordCount: integer('word_count').notNull(),
    sentenceCount: integer('sentence_count').notNull(),
    headingSkips: integer('heading_skips').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.day, table.pageUrl] }),
  ]
);

/**
 * Open and resolved audit items. The fingerprint is stable across runs.
 * A later crawl updates last_seen, and marks the row resolved when the
 * checked page no longer produces that fingerprint.
 */
export const siteFindings = analyticsSchema.table(
  'site_findings',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    fingerprint: text('fingerprint').notNull(),
    source: text('source').notNull(),
    severity: text('severity').notNull(),
    code: text('code').notNull(),
    pageUrl: text('page_url').notNull(),
    detail: text('detail').notNull(),
    status: text('status').notNull(),
    firstSeenOn: date('first_seen_on', { mode: 'string' }).notNull(),
    lastSeenOn: date('last_seen_on', { mode: 'string' }).notNull(),
    resolvedOn: date('resolved_on', { mode: 'string' }),
    updatedAt: timestamptz('updated_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.fingerprint] }),
    index('site_findings_project_status_idx').on(table.projectId, table.status),
  ]
);

/** Latest PageSpeed or crawl attempt, including the provider error text. */
export const seoRuns = analyticsSchema.table(
  'seo_runs',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    ok: boolean('ok').notNull(),
    detail: text('detail'),
    pageUrl: text('page_url'),
    strategy: text('strategy'),
    finishedAt: timestamptz('finished_at').defaultNow().notNull(),
  },
  (table) => [
    index('seo_runs_project_kind_idx').on(table.projectId, table.kind, table.finishedAt),
  ]
);
