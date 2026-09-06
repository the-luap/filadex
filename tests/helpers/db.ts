/**
 * The test database connection, plus the schema and reset handling around it.
 *
 * Dialect-aware:
 *   Postgres: starts or connects to a Postgres server, builds schema using
 *             drizzle-kit's generateMigration, drops/recreates public schema,
 *             and resets tables using TRUNCATE ... RESTART IDENTITY CASCADE.
 *   SQLite:   uses a file URL (from global-setup.ts), builds schema using
 *             generateSQLiteMigration, enables WAL/busy_timeout/foreign_keys,
 *             and resets tables using PRAGMA foreign_keys=OFF, DELETE FROM,
 *             DELETE FROM sqlite_sequence, and PRAGMA foreign_keys=ON.
 *
 * In both dialects, the schema is derived from shared/schema.ts at startup
 * via drizzle-kit's API so it cannot drift from application schema.
 */
import { createRequire } from "node:module";
import { inject } from "vitest";
import pg from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { createClient } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import * as schema from "../../shared/schema";

const require = createRequire(import.meta.url);
// drizzle-kit's ESM bundle (api.mjs) is broken in 0.30.4 - it `require()`s node
// builtins, which throws under ESM. The CJS build works.
const {
  generateDrizzleJson,
  generateMigration,
  generateSQLiteDrizzleJson,
  generateSQLiteMigration,
} = require("drizzle-kit/api");
import { isSqlite as checkIsSqlite } from "./dialect";
import { normalizeSqliteUrl } from "../../server/sqlite-url";

const databaseUrl = inject("databaseUrl");
const isSqlite = checkIsSqlite(databaseUrl);

const pool = isSqlite ? null : new pg.Pool({ connectionString: databaseUrl });
export const client = isSqlite ? createClient({ url: normalizeSqliteUrl(databaseUrl) }) : null;

if (isSqlite && client) {
  await client.executeMultiple(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
  `);
}

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

type TestDb = typeof schema.users extends PgTable
  ? NodePgDatabase<typeof schema>
  : LibSQLDatabase<typeof schema>;

/** The drizzle instance the application code is pointed at (see tests/setup.ts). */
export const db: TestDb = (isSqlite
  ? drizzleLibsql(client!, { schema })
  : drizzlePg(pool!, { schema })) as any;

export const closeDb = async () => {
  if (isSqlite && client) {
    client.close();
  } else if (pool) {
    await pool.end();
  }
};

const tables = Object.values(schema).filter((value) =>
  isSqlite ? is(value, SQLiteTable) : is(value, PgTable),
) as (PgTable | SQLiteTable)[];

/**
 * Rebuilds the schema from scratch. Test files run one at a time
 * (fileParallelism: false) so that each gets a clean database even when they
 * all share one server.
 */
export async function createSchema() {
  if (isSqlite && client) {
    const statements: string[] = await generateSQLiteMigration(
      await generateSQLiteDrizzleJson({}),
      await generateSQLiteDrizzleJson(schema),
    );

    await client.execute("PRAGMA foreign_keys = OFF;");
    const existing = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    );
    for (const row of existing.rows) {
      await client.execute(`DROP TABLE IF EXISTS "${row.name}"`);
    }
    await client.execute("PRAGMA foreign_keys = ON;");

    for (const statement of statements) {
      await client.execute(statement);
    }
  } else {
    const statements: string[] = await generateMigration(
      generateDrizzleJson({}),
      generateDrizzleJson(schema),
    );

    await (db as any).execute(sql`drop schema if exists public cascade`);
    await (db as any).execute(sql`create schema public`);
    for (const statement of statements) {
      await (db as any).execute(sql.raw(statement));
    }
  }
}

const truncateAll = sql.raw(
  `truncate table ${tables.map((t) => `"${getTableName(t as any)}"`).join(", ")} restart identity cascade`,
);

/** Empties every table and resets sequences, so each test starts from nothing. */
export async function resetDb() {
  if (isSqlite && client) {
    await client.execute("PRAGMA foreign_keys = OFF;");
    for (const table of tables) {
      await client.execute(`DELETE FROM "${getTableName(table as any)}"`);
    }
    try {
      await client.execute("DELETE FROM sqlite_sequence;");
    } catch {
      // sqlite_sequence only exists if an autoincrement table has had rows inserted
    }
    await client.execute("PRAGMA foreign_keys = ON;");
  } else {
    await (db as any).execute(truncateAll);
  }
}

export const dialect = isSqlite ? ("sqlite" as const) : ("postgres" as const);

export async function vacuumBackup(destinationPath: string): Promise<void> {
  if (isSqlite && client) {
    const escaped = destinationPath.replace(/'/g, "''");
    await client.execute(`VACUUM INTO '${escaped}'`);
  } else {
    throw new Error("Database backups are only supported on SQLite installations");
  }
}
