import { text } from 'drizzle-orm/pg-core';

import { analyticsSchema, timestamptz } from './analytics-schema';
import { organizations } from './organizations';

export { analyticsSchema } from './analytics-schema';

/**
 * Analytics project (MVP).
 * Represents a website/property tracked by Humana Analytics.
 * Belongs to an organization so additional projects can be added later.
 */
export const projects = analyticsSchema.table('projects', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
  updatedAt: timestamptz('updated_at').defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
