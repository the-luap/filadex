import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@shared/schema";

import fs from "node:fs";
import path from "node:path";

import { normalizeSqliteUrl, sqliteFilePath } from "./sqlite-url";
import { logger } from "./utils/logger";

// Importing this module under the Postgres test leg (for the @db mock, or for
// normalizeSqliteUrl) must not fail on the DATABASE_URL that happens to be in the
// environment. The suite never connects through DATABASE_URL - it uses
// TEST_DATABASE_URL - so under NODE_ENV=test any value this driver cannot open is
// ambient shell noise, and an in-memory database stands in for it.
const envUrl = process.env.DATABASE_URL || "";
const isSqliteUrl = envUrl.startsWith("file:") || envUrl.startsWith("sqlite:");
const rawUrl = process.env.NODE_ENV === "test" && !isSqliteUrl ? "file::memory:" : envUrl;
if (!rawUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const dbUrl = normalizeSqliteUrl(rawUrl);

const filePath = sqliteFilePath(dbUrl);
if (filePath !== null) {
  // A relative path resolves against process.cwd(), which in the container is
  // /app - the image's writable layer, not the mounted volume. The install comes
  // up healthy and every byte of it is destroyed by the next `docker compose
  // down && up` or image update. `.env.example` and the README both teach
  // `file:./dev.db` for local development, so the mistake is one copy-paste from
  // a deployment, and in production it is never what anyone means.
  if (!path.isAbsolute(filePath) && process.env.NODE_ENV === "production") {
    throw new Error(
      `DATABASE_URL must name an absolute path in production. "${dbUrl}" resolves to ` +
        `"${path.resolve(filePath)}", which is inside the container rather than a mounted ` +
        `volume, so the database would be lost on the next restart. Use file:/data/filadex.db.`,
    );
  }

  const absolutePath = path.resolve(filePath);
  const dir = path.dirname(absolutePath);
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Which file was opened is the one thing that distinguishes a working install
  // from an empty one that looks identical, so it is said out loud.
  logger.info(`SQLite database: ${absolutePath}`);
} else {
  logger.info(`SQLite database: ${dbUrl}`);
}

export const client = createClient({ url: dbUrl });

/**
 * SQLite connections set three pragmas on connection:
 * - WAL allows readers to proceed during a write.
 * - busy_timeout = 5000 avoids immediate SQLITE_BUSY under concurrent Node requests.
 * - foreign_keys = ON is mandatory; without it SQLite ignores foreign keys and
 *   ON DELETE CASCADE behaviour declared in the schema will silently not happen.
 *
 * See docs/adr/0004.
 */
await client.executeMultiple(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
`);

export const dialect = "sqlite" as const;
export const db = drizzle(client, { schema });
export async function closeDb(): Promise<void> {
  client.close();
}
export async function vacuumBackup(destinationPath: string): Promise<void> {
  const escaped = destinationPath.replace(/'/g, "''");
  await client.execute(`VACUUM INTO '${escaped}'`);
}

