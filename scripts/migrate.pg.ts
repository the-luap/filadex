/**
 * Brings a PostgreSQL database up to date.
 *
 *   DATABASE_URL=postgres://... npx tsx scripts/migrate.pg.ts
 *
 * There are three cases, and the difference matters:
 *
 *   Already on drizzle   The journal table exists and has a row. Run the
 *                        migrator; it applies whatever is newer than the last
 *                        recorded migration.
 *
 *   Fresh database       Nothing exists. Run the migrator from 0000, which
 *                        creates the whole schema.
 *
 *   Existing install     Tables exist but there is no journal - a deployment
 *                        built by docker-entrypoint.sh's CREATE TABLE block and
 *                        the migrations/legacy scripts. Running 0000 here would
 *                        fail on the first CREATE TABLE, so instead the legacy
 *                        chain is run once to bring the database to a known
 *                        state, and 0000 is then recorded as applied without
 *                        being run. From the next release onward such a
 *                        deployment is on the first path above.
 *
 * The legacy catch-up matters because an installation may be several versions
 * behind and have run only some of those scripts. They are all guarded on
 * information_schema, so re-running them on an up-to-date database does
 * nothing. Baselining without it would declare a schema present that is not.
 *
 * Baselining is a claim - "the database already looks like 0000" - and it is
 * irreversible in practice, because from then on the legacy chain never runs
 * again. So the claim is checked before it is made, against 0000's own SQL:
 * see assertMatchesBaseline. Several legacy scripts report success while
 * having skipped their work (a database user that does not own `filaments`
 * cannot ALTER it), the base tables were created by the entrypoint rather than
 * by any script here, and a database built by `drizzle-kit push` has plain
 * `timestamp` where 0000 has `timestamptz`. Each of those produces a database
 * that would be baselined as correct and is not.
 *
 * See migrations/legacy/README.md for why that chain stays in the repository
 * and what keeps it working.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pkg from "pg";
const { Client } = pkg;
import { db, pool } from "../server/db";
import { runLegacyMigrations } from "../migrations/legacy";

function resolveMigrationsFolder(folder: string): string {
  if (fs.existsSync(folder)) return folder;
  const fromScript = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", folder);
  if (fs.existsSync(fromScript)) return fromScript;
  return folder;
}

const MIGRATIONS_FOLDER = resolveMigrationsFolder("migrations/pg");

// Arbitrary but stable: two containers starting at once must pick the same
// number, and nothing else in the system takes an advisory lock.
const MIGRATION_LOCK_KEY = 8749121;

type JournalEntry = { idx: number; when: number; tag: string };

function firstMigration(): { tag: string; when: number } {
  const journal = JSON.parse(
    fs.readFileSync(`${MIGRATIONS_FOLDER}/meta/_journal.json`, "utf8"),
  ) as { entries: JournalEntry[] };
  const first = journal.entries.find((entry) => entry.idx === 0);
  if (!first) throw new Error(`No 0000 migration in ${MIGRATIONS_FOLDER}/meta/_journal.json`);
  return { tag: first.tag, when: first.when };
}

/** The hash drizzle stores for a migration is the sha256 of its SQL file. */
function migrationHash(tag: string): string {
  const sqlText = fs.readFileSync(`${MIGRATIONS_FOLDER}/${tag}.sql`, "utf8");
  return createHash("sha256").update(sqlText).digest("hex");
}

/**
 * A journal table with no rows is not a database on generated migrations: it is
 * a baseline that was interrupted between creating the table and recording the
 * row. Treating it as the first case would run 0000 against a populated
 * database, which fails on the first CREATE TABLE and fails identically on
 * every restart afterwards.
 */
async function hasDrizzleJournal(): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
    ) AS present`);
  if (!result.rows[0].present) return false;

  const applied = await db.execute(sql`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`);
  return Number(applied.rows[0].count) > 0;
}

async function hasApplicationTables(): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    ) AS present`);
  return Boolean(result.rows[0].present);
}

// The SQL types drizzle generates in 0000, mapped to what
// information_schema.columns reports for them.
const DATA_TYPES: Record<string, string> = {
  "serial": "integer",
  "integer": "integer",
  "bigint": "bigint",
  "text": "text",
  "jsonb": "jsonb",
  "numeric": "numeric",
  "boolean": "boolean",
  "date": "date",
  "timestamp": "timestamp without time zone",
  "timestamp with time zone": "timestamp with time zone",
};

/**
 * The tables and columns 0000 creates, read from the migration itself rather
 * than from a list kept alongside it - a hand-maintained list is exactly the
 * thing that goes stale without anyone noticing.
 */
function baselineShape(tag: string): Map<string, Map<string, string>> {
  const sqlText = fs.readFileSync(`${MIGRATIONS_FOLDER}/${tag}.sql`, "utf8");
  const shape = new Map<string, Map<string, string>>();

  for (const match of sqlText.matchAll(/CREATE TABLE "([^"]+)" \(([\s\S]*?)\n\);/g)) {
    const [, table, body] = match;
    const columns = new Map<string, string>();

    for (const line of body.split("\n")) {
      const column = line.trim().match(/^"([^"]+)"\s+(.+?)(?:\s+(?:DEFAULT|NOT NULL|PRIMARY KEY|GENERATED)\b.*)?,?$/);
      if (!column) continue; // CONSTRAINT lines and anything else that is not a column

      const [, name, rawType] = column;
      const dataType = DATA_TYPES[rawType.trim().toLowerCase()];
      if (dataType) columns.set(name, dataType);
    }

    shape.set(table, columns);
  }

  if (shape.size === 0) throw new Error(`Parsed no tables out of ${MIGRATIONS_FOLDER}/${tag}.sql`);
  return shape;
}

/** The same shape, as the database actually has it. */
async function actualShape(): Promise<Map<string, Map<string, string>>> {
  const result = await db.execute(sql`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'`);

  const shape = new Map<string, Map<string, string>>();
  for (const row of result.rows as Array<{ table_name: string; column_name: string; data_type: string }>) {
    if (!shape.has(row.table_name)) shape.set(row.table_name, new Map());
    shape.get(row.table_name)!.set(row.column_name, row.data_type);
  }
  return shape;
}

/**
 * Refuses to baseline a database that does not match 0000.
 *
 * Baselining is what makes the legacy chain stop running, so a database
 * recorded as being at 0000 when it is not stays broken across every restart -
 * where before this change the entrypoint re-ran the chain each boot and healed
 * itself once whatever blocked it was fixed. Failing here instead leaves the
 * database untouched and the chain able to run again.
 */
async function assertMatchesBaseline(tag: string): Promise<void> {
  const expected = baselineShape(tag);
  const actual = await actualShape();
  const problems: string[] = [];

  for (const [table, columns] of Array.from(expected)) {
    const actualColumns = actual.get(table);
    if (!actualColumns) {
      problems.push(`missing table "${table}"`);
      continue;
    }
    for (const [column, dataType] of Array.from(columns)) {
      const actualType = actualColumns.get(column);
      if (actualType === undefined) {
        problems.push(`missing column "${table}"."${column}"`);
      } else if (actualType !== dataType) {
        problems.push(`"${table}"."${column}" is ${actualType}, expected ${dataType}`);
      }
    }
  }

  if (problems.length === 0) return;

  throw new Error(
    `The database does not match the ${tag} baseline, so it has not been recorded as applied:\n` +
    problems.map((problem) => `  - ${problem}`).join("\n") +
    "\n\nThe legacy migrations ran but did not leave the schema they are supposed to.\n" +
    "The usual causes:\n" +
    "  - The database user does not own the tables it has to ALTER; several legacy\n" +
    "    scripts log a warning and continue when that happens. Grant ownership and\n" +
    "    start again.\n" +
    "  - The schema was created with `drizzle-kit push` rather than by a release,\n" +
    "    which produces plain `timestamp` columns where the baseline has\n" +
    "    `timestamp with time zone`.\n" +
    "Nothing has been changed; fixing the cause and starting again will retry.",
  );
}

/** Records 0000 as applied without running it, for a schema that already exists. */
async function baseline() {
  const { tag, when } = firstMigration();
  await assertMatchesBaseline(tag);
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )`);
  await db.execute(sql`
    INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at")
    VALUES (${migrationHash(tag)}, ${when})`);
  console.log(`  baselined at ${tag}`);
}

async function main() {
  if (await hasDrizzleJournal()) {
    console.log("Database is on generated migrations; applying any new ones.");
  } else if (await hasApplicationTables()) {
    console.log("Existing installation found. Catching up on the legacy migrations first:");
    await runLegacyMigrations(db);
    console.log("Recording the current schema as the migration baseline:");
    await baseline();
  } else {
    console.log("Fresh database; creating the schema from the generated migrations.");
  }

  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  console.log("Database is up to date.");
}

async function waitForDatabase(databaseUrl: string, maxRetries = 30, delayMs = 1000): Promise<void> {
  console.log("Waiting for the database...");
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const client = new Client({ connectionString: databaseUrl });
    try {
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      console.log("Database is accessible!");
      return;
    } catch (err: any) {
      await client.end().catch(() => {});
      // Code 3D000 means 'database does not exist'. The server is running and ready.
      if (err.code === "3D000") {
        console.log("Database server is accessible (target database does not exist yet).");
        return;
      }
      if (attempt === maxRetries) {
        throw new Error(`Timeout waiting for the database! Last error: ${err.message}`);
      }
      console.log(`Waiting for the database... Attempt ${attempt} of ${maxRetries}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function ensureDatabaseExists(databaseUrl: string): Promise<void> {
  const url = new URL(databaseUrl);
  const targetDb = decodeURIComponent(url.pathname.slice(1));
  if (!targetDb || targetDb === "postgres") {
    return;
  }

  console.log(`Checking if database ${targetDb} exists...`);
  const maintenanceUrl = new URL(databaseUrl);
  maintenanceUrl.pathname = "/postgres";

  const client = new Client({ connectionString: maintenanceUrl.toString() });
  try {
    await client.connect();
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [targetDb]);
    if (res.rowCount === 0) {
      console.log(`Database ${targetDb} does not exist, trying to create...`);
      const quoted = `"${targetDb.replace(/"/g, '""')}"`;
      try {
        await client.query(`CREATE DATABASE ${quoted}`);
        console.log(`Database ${targetDb} created.`);
      } catch (e: any) {
        console.warn(`Could not create database, trying to continue anyway: ${e.message}`);
      }
    } else {
      console.log(`Database ${targetDb} already exists.`);
    }
  } catch (err: any) {
    console.warn(`Could not check/create database via maintenance DB: ${err.message}, trying to continue anyway...`);
  } finally {
    await client.end().catch(() => {});
  }
}

async function reportConnectionAndPermissions(client: pkg.PoolClient, targetDb: string): Promise<void> {
  const res = await client.query<{ current_db: string; has_permission: boolean }>(
    "SELECT current_database() AS current_db, has_schema_privilege(current_user, 'public', 'CREATE') AS has_permission"
  );
  const row = res.rows[0];
  console.log(
    `Connected to database: ${row.current_db} (target: ${targetDb}), CREATE on public: ${row.has_permission}`
  );
}

/**
 * Two containers starting against the same database would otherwise both decide
 * the same thing and both act on it - both running 0000, or both inserting a
 * baseline row. The lock is held on one connection for the whole run, because a
 * session-level advisory lock belongs to the connection that took it and the
 * pool hands out a different one per statement.
 */
async function withMigrationLock(work: () => Promise<void>): Promise<void> {
  const client = await pool.connect();
  const url = new URL(process.env.DATABASE_URL!);
  const targetDb = decodeURIComponent(url.pathname.slice(1));
  try {
    await reportConnectionAndPermissions(client, targetDb);
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    await work();
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]).catch(() => {});
    client.release();
  }
}

async function start() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }
  await waitForDatabase(process.env.DATABASE_URL);
  await ensureDatabaseExists(process.env.DATABASE_URL);
  await withMigrationLock(main);
}

start()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
