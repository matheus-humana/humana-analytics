import { index, text, timestamp } from 'drizzle-orm/pg-core';

import { analyticsSchema, projects } from './projects';

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' });

/**
 * Supported analytics providers for the MVP.
 */
export const analyticsDataSourceProvider = analyticsSchema.enum(
  'analytics_data_source_provider',
  ['ga4', 'clarity', 'vercel']
);

/**
 * Connection status of a data source.
 */
export const analyticsDataSourceStatus = analyticsSchema.enum(
  'analytics_data_source_status',
  ['active', 'inactive', 'error']
);

/**
 * Analytics data source connected to a project.
 * Credentials are intentionally stored elsewhere — never in this table.
 */
export const dataSources = analyticsSchema.table(
  'data_sources',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    provider: analyticsDataSourceProvider('provider').notNull(),
    name: text('name').notNull(),
    status: analyticsDataSourceStatus('status').notNull(),
    /** External resource id (e.g. GA4 property id). Optional until configured. */
    externalId: text('external_id'),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
    updatedAt: timestamptz('updated_at').defaultNow().notNull(),
  },
  (table) => [index('data_sources_project_id_idx').on(table.projectId)]
);

export type DataSource = typeof dataSources.$inferSelect;
export type NewDataSource = typeof dataSources.$inferInsert;
