import { date, index, integer, jsonb, primaryKey, text } from 'drizzle-orm/pg-core';

import { analyticsSchema, timestamptz } from './analytics-schema';
import { projects } from './projects';
import type { GithubAsset, GithubPath, GithubReferrer } from '../../github/types';

/**
 * Daily GitHub traffic. One row per repository per UTC day.
 * Views and clones are upserted independently so a later collect updates
 * the same day instead of inserting a second row.
 * Null means that side was absent from the payload, not a recorded zero.
 */
export const githubTrafficDays = analyticsSchema.table(
  'github_traffic_days',
  {
    repo: text('repo').notNull(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    views: integer('views'),
    uniqueViews: integer('unique_views'),
    clones: integer('clones'),
    uniqueClones: integer('unique_clones'),
    collectedAt: timestamptz('collected_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.repo, table.day] }),
    index('github_traffic_days_project_idx').on(table.projectId),
  ]
);

/**
 * Point-in-time repository counters for the collection day.
 * Stars, forks, watchers and release downloads are current counters.
 * The 14-day view/clone totals are GitHub's own window, stored beside the day
 * so uniques are never reconstructed by summing daily uniques.
 * Referrers and paths are that same 14-day window. No user logins are stored.
 */
export const githubRepoDays = analyticsSchema.table(
  'github_repo_days',
  {
    repo: text('repo').notNull(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    stars: integer('stars').notNull(),
    forks: integer('forks').notNull(),
    watchers: integer('watchers').notNull(),
    releaseDownloads: integer('release_downloads').notNull(),
    views14d: integer('views_14d').notNull(),
    uniqueViews14d: integer('unique_views_14d').notNull(),
    clones14d: integer('clones_14d').notNull(),
    uniqueClones14d: integer('unique_clones_14d').notNull(),
    referrers: jsonb('referrers').$type<GithubReferrer[]>().notNull(),
    paths: jsonb('paths').$type<GithubPath[]>().notNull(),
    assets: jsonb('assets').$type<GithubAsset[]>().notNull(),
    collectedAt: timestamptz('collected_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.repo, table.day] }),
    index('github_repo_days_project_idx').on(table.projectId),
  ]
);
