import { text, uniqueIndex } from 'drizzle-orm/pg-core';

import { analyticsSchema, timestamptz } from './analytics-schema';
import { users } from './users';

/**
 * Company / tenant. The internal Humana team uses one organization today.
 */
export const organizations = analyticsSchema.table('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
  updatedAt: timestamptz('updated_at').defaultNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

/**
 * Light membership. `role` stays a label (`member`) until a real permission model exists.
 */
export const organizationMembers = analyticsSchema.table(
  'organization_members',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('organization_members_org_user_uidx').on(
      table.organizationId,
      table.userId
    ),
  ]
);

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;
