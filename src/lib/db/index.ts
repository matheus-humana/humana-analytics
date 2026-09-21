import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import { requireDatabaseUrl } from "@/lib/env";

import * as schema from "./schema";

/**
 * Server-side PostgreSQL + Drizzle client for the `analytics` schema.
 * Uses DATABASE_URL from the environment — never hardcode credentials.
 */

export type Database = PostgresJsDatabase<typeof schema>;

let client: Sql | null = null;
let dbInstance: Database | null = null;

function getPostgresClient(): Sql {
  if (!client) {
    client = postgres(requireDatabaseUrl(), {
      max: 4,
      idle_timeout: 0,
      connect_timeout: 10,
    });
  }

  return client;
}

export function getDb(): Database {
  if (!dbInstance) {
    dbInstance = drizzle(getPostgresClient(), { schema });
  }

  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
    dbInstance = null;
  }
}

/** Lazy proxy so importing this module does not open a DB connection. */
export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const database = getDb();
    return database[prop as keyof Database];
  },
});

export { schema };
export type { NewProject, Project } from "./schema";
