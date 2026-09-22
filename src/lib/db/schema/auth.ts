import { primaryKey, text, uniqueIndex } from 'drizzle-orm/pg-core';

import { analyticsSchema, timestamptz } from './analytics-schema';
import { users } from './users';

/**
 * Google account link. Stores the provider subject only.
 * Access tokens, refresh tokens, and ID tokens are intentionally not persisted.
 */
export const accounts = analyticsSchema.table(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('accounts_provider_account_uidx').on(
      table.provider,
      table.providerAccountId
    ),
  ]
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

/**
 * Server-side session. The cookie holds only this opaque token.
 */
export const sessions = analyticsSchema.table('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamptz('expires').notNull(),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

/**
 * Reserved for Auth.js email flows. Google login does not write these rows.
 */
export const verificationTokens = analyticsSchema.table(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamptz('expires').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.identifier, table.token],
    }),
  ]
);
