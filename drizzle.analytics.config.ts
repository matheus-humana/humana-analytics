import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit config exclusive to Humana Analytics.
 *
 * Targets only the PostgreSQL schema `analytics`.
 * Must never point to public, knowledge_center, or cms_admin.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema/index.ts',
  out: './src/lib/db/migrations',
  schemaFilter: ['analytics'],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  migrations: {
    table: '__drizzle_migrations_analytics',
    schema: 'drizzle',
  },
  strict: true,
  verbose: true,
});
