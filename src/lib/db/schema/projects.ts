import { pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Isolated PostgreSQL schema for Humana Analytics.
 * Must not use the public schema or other product schemas.
 */
export const analyticsSchema = pgSchema('analytics');

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' });

/**
 * Analytics project (MVP).
 * Represents a website/property tracked by Humana Analytics.
 */
export const projects = analyticsSchema.table('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
  updatedAt: timestamptz('updated_at').defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
