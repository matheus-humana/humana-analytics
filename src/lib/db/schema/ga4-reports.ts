import {
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

import { dataSources } from './data-sources';
import { analyticsSchema } from './projects';

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' });

export const analyticsDaily = analyticsSchema.table(
  'analytics_daily',
  {
    id: text('id').primaryKey(),
    dataSourceId: text('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    activeUsers: integer('active_users').notNull().default(0),
    sessions: integer('sessions').notNull().default(0),
    screenPageViews: integer('screen_page_views').notNull().default(0),
    engagementRate: doublePrecision('engagement_rate').notNull().default(0),
    newUsers: integer('new_users').notNull().default(0),
    eventCount: integer('event_count').notNull().default(0),
    keyEvents: integer('key_events').notNull().default(0),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
    updatedAt: timestamptz('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('analytics_daily_source_date').on(table.dataSourceId, table.date),
    index('analytics_daily_source_date_idx').on(table.dataSourceId, table.date),
  ]
);

export const analyticsPages = analyticsSchema.table(
  'analytics_pages',
  {
    id: text('id').primaryKey(),
    dataSourceId: text('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    pagePath: text('page_path').notNull(),
    pageTitle: text('page_title').notNull().default(''),
    screenPageViews: integer('screen_page_views').notNull().default(0),
    activeUsers: integer('active_users').notNull().default(0),
    engagementRate: doublePrecision('engagement_rate').notNull().default(0),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
    updatedAt: timestamptz('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('analytics_pages_source_date_path').on(
      table.dataSourceId,
      table.date,
      table.pagePath
    ),
    index('analytics_pages_source_date_idx').on(table.dataSourceId, table.date),
  ]
);

export const analyticsEvents = analyticsSchema.table(
  'analytics_events',
  {
    id: text('id').primaryKey(),
    dataSourceId: text('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    eventName: text('event_name').notNull(),
    eventCount: integer('event_count').notNull().default(0),
    activeUsers: integer('active_users').notNull().default(0),
    keyEvents: integer('key_events').notNull().default(0),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
    updatedAt: timestamptz('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('analytics_events_source_date_name').on(
      table.dataSourceId,
      table.date,
      table.eventName
    ),
    index('analytics_events_source_date_idx').on(
      table.dataSourceId,
      table.date
    ),
  ]
);

export const analyticsTrafficSources = analyticsSchema.table(
  'analytics_traffic_sources',
  {
    id: text('id').primaryKey(),
    dataSourceId: text('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    source: text('source').notNull(),
    medium: text('medium').notNull(),
    activeUsers: integer('active_users').notNull().default(0),
    sessions: integer('sessions').notNull().default(0),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
    updatedAt: timestamptz('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('analytics_traffic_sources_source_date_source_medium').on(
      table.dataSourceId,
      table.date,
      table.source,
      table.medium
    ),
    index('analytics_traffic_sources_source_date_idx').on(
      table.dataSourceId,
      table.date
    ),
  ]
);

export const analyticsSyncRuns = analyticsSchema.table(
  'analytics_sync_runs',
  {
    id: text('id').primaryKey(),
    dataSourceId: text('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    rowsUpserted: jsonb('rows_upserted').$type<Record<string, number>>(),
    errorMessage: text('error_message'),
    startedAt: timestamptz('started_at').defaultNow().notNull(),
    finishedAt: timestamptz('finished_at'),
  },
  (table) => [
    index('analytics_sync_runs_source_started_idx').on(
      table.dataSourceId,
      table.startedAt
    ),
  ]
);
