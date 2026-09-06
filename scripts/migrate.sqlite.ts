/**
 * Brings a SQLite database up to date.
 *
 *   DATABASE_URL=file:/path/to/filadex.db npx tsx scripts/migrate.sqlite.ts
 *
 * SQLite has no legacy migration chain and no advisory locks.
 * It applies migrations from migrations/sqlite using drizzle-orm/libsql/migrator.
 */
import fs from "node:fs";
import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db, client } from "../server/db.sqlite";

function resolveMigrationsFolder(folder: string): string {
  if (fs.existsSync(folder)) return folder;
  const fromScript = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", folder);
  if (fs.existsSync(fromScript)) return fromScript;
  return folder;
}

const MIGRATIONS_FOLDER = resolveMigrationsFolder("migrations/sqlite");

async function main() {
  console.log("Applying SQLite database migrations...");
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  console.log("SQLite database is up to date.");
}

main()
  .then(() => {
    client.close();
  })
  .catch((error) => {
    console.error("SQLite database migration failed:", error);
    client.close();
    process.exit(1);
  });
