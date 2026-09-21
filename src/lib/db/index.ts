import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

/**
 * Server-side PostgreSQL + Drizzle client for the `analytics` schema.
 * Uses DATABASE_URL from the environment — never hardcode credentials.
 */

type AnalyticsDatabase = ReturnType<typeof drizzle<typeof schema>>;

let client: ReturnType<typeof postgres> | null = null;
let dbInstance: AnalyticsDatabase | null = null;

function getPostgresClient(): ReturnType<typeof postgres> {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    client = postgres(connectionString, {
      max: 1,
      idle_timeout: 0,
      connect_timeout: 10,
    });
  }

  return client;
}

function getDatabase(): AnalyticsDatabase {
  if (!dbInstance) {
    dbInstance = drizzle(getPostgresClient(), { schema });
  }

  return dbInstance;
}

/** Lazy proxy so importing this module does not open a DB connection. */
export const db = new Proxy({} as AnalyticsDatabase, {
  get(_target, prop) {
    const database = getDatabase();
    return database[prop as keyof AnalyticsDatabase];
  },
});

export { schema };
export type { NewProject, Project } from './schema';
