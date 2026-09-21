import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import "./load-env";
import { requireDatabaseUrl } from "../src/lib/env";

async function migrate() {
  const databaseUrl = requireDatabaseUrl();
  const sql = postgres(databaseUrl, { max: 1 });
  const migrationsDir = join(process.cwd(), "drizzle");
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    throw new Error("No SQL migrations found in drizzle/.");
  }

  try {
    for (const file of files) {
      const path = join(migrationsDir, file);
      const contents = readFileSync(path, "utf8");
      console.log(`Applying ${file}`);
      await sql.unsafe(contents);
    }
    console.log(`Applied ${files.length} migration(s).`);
  } finally {
    await sql.end();
  }
}

migrate().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
