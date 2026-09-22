import { text } from 'drizzle-orm/pg-core';

import { analyticsSchema, timestamptz } from './analytics-schema';

/**
 * Application user. Email stays in Postgres for identity lookup and is not
 * sent to the model or included in client session JSON.
 */
export const users = analyticsSchema.table('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamptz('email_verified'),
  image: text('image'),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
  updatedAt: timestamptz('updated_at').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
