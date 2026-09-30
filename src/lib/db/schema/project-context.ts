import { boolean, index, text } from 'drizzle-orm/pg-core';

import { analyticsSchema, timestamptz } from './analytics-schema';
import { projects } from './projects';
import { users } from './users';

export const projectProfiles = analyticsSchema.table('project_profiles', {
  projectId: text('project_id')
    .primaryKey()
    .references(() => projects.id, { onDelete: 'cascade' }),
  siteUrl: text('site_url'),
  languages: text('languages'),
  audience: text('audience'),
  positioning: text('positioning'),
  goals: text('goals'),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamptz('updated_at').defaultNow().notNull(),
});

export const projectCompetitors = analyticsSchema.table(
  'project_competitors',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    domain: text('domain'),
    notes: text('notes'),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
    updatedAt: timestamptz('updated_at').defaultNow().notNull(),
  },
  (table) => [index('project_competitors_project_id_idx').on(table.projectId)]
);

export const projectDocuments = analyticsSchema.table(
  'project_documents',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    kind: text('kind').$type<'link' | 'text'>().notNull(),
    url: text('url'),
    body: text('body'),
    confidential: boolean('confidential').notNull().default(false),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
    updatedAt: timestamptz('updated_at').defaultNow().notNull(),
  },
  (table) => [index('project_documents_project_id_idx').on(table.projectId)]
);
