import { text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import {
  analyticsDataSourceProvider,
  dataSources,
} from './data-sources';
import { analyticsSchema } from './projects';
const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' });

/**
 * Server-side credentials for a connected analytics data source.
 *
 * Stores only the encrypted OAuth refresh token for that connection.
 * Client ID / client secret belong in environment/secrets — never here.
 * Access tokens and authorization codes are not persisted.
 */
export const dataSourceCredentials = analyticsSchema.table(
  'data_source_credentials',
  {
    id: text('id').primaryKey(),
    dataSourceId: text('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'cascade' }),
    provider: analyticsDataSourceProvider('provider').notNull(),
    /** Ciphertext of the OAuth refresh token — never store plaintext. */
    refreshTokenEncrypted: text('refresh_token_encrypted').notNull(),
    /** OAuth scope actually granted for this connection. */
    scope: text('scope').notNull(),
    expiresAt: timestamptz('expires_at'),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
    updatedAt: timestamptz('updated_at').defaultNow().notNull(),
  },
  (table) => [
    /**
     * One credential row per data source.
     * Also serves as the lookup index on data_source_id.
     */
    uniqueIndex('data_source_credentials_data_source_id_uidx').on(
      table.dataSourceId
    ),
  ]
);

export type DataSourceCredential = typeof dataSourceCredentials.$inferSelect;
export type NewDataSourceCredential = typeof dataSourceCredentials.$inferInsert;
