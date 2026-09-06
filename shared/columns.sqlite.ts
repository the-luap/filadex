import type { SQL } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  foreignKey,
  index,
  uniqueIndex,
  type SQLiteColumn,
} from "drizzle-orm/sqlite-core";

/**
 * The column vocabulary shared/schema.ts is written in, SQLite dialect.
 *
 * Each helper names what a column is *for* rather than which SQLite type
 * spells it. See shared/columns.pg.ts and docs/adr/0004 for design context.
 */

/** Defines a table. Named separately from the column helpers because it takes the dialect's table builder. */
export const table = sqliteTable;

/**
 * Table-level constructs, re-exported so shared/schema.ts imports only from
 * this file and stays free of any direct dependency on one dialect.
 */
export { foreignKey, index, uniqueIndex };

export const t = {
  /**
   * Auto-incrementing primary key.
   *
   * Uses AUTOINCREMENT to prevent id reuse when rows are deleted. Plain SQLite
   * INTEGER PRIMARY KEY reuses rowids, which would silently corrupt external
   * integrations, bookmarks, and cached queries that store old IDs.
   */
  pk: (name: string) => integer(name).primaryKey({ autoIncrement: true }),

  /** Arbitrary-length string. */
  text: (name: string) => text(name),

  /** Whole number. */
  int: (name: string) => integer(name),

  /** True/false, stored as 0/1 integer with boolean mode. */
  bool: (name: string) => integer(name, { mode: "boolean" }),

  /**
   * Exact decimal, stored as SQLite TEXT, NOT numeric.
   *
   * SQLite columns with NUMERIC affinity convert strings on write and return
   * JavaScript numbers on read, so "0.10" becomes 0.1 while TypeScript still
   * types it as a string. Money and weights are strings throughout this
   * codebase to preserve precision, so TEXT is used to round-trip exact values.
   */
  numeric: (name: string) => text(name),

  /**
   * A moment in time, stored as epoch milliseconds.
   *
   * Uses mode: 'timestamp_ms'. Plain mode: 'timestamp' truncates to seconds,
   * causing flaky tests and precision loss whenever writes and reads happen
   * in the same second.
   */
  timestamp: (name: string) => integer(name, { mode: "timestamp_ms" }),

  /**
   * A moment in time, stored with its zone.
   *
   * On SQLite, timestamp and timestamptz collapse to the same representation:
   * epoch milliseconds carry no timezone, so SQLite installs are born with
   * the unified representation that ADR 0002 defers reaching on Postgres.
   */
  timestamptz: (name: string) => integer(name, { mode: "timestamp_ms" }),

  /** A calendar day with no time of day, carried as a YYYY-MM-DD string. */
  date: (name: string) => text(name),

  /** A structured value stored whole as text with a JSON codec. */
  json: <T>(name: string) => text(name, { mode: "json" }).$type<T>(),

  /**
   * A column holding another table's primary key. The constraint itself is
   * declared in the table's extras with `foreignKey`, so it can be named.
   */
  fk: (name: string) => integer(name),
};

/**
 * Key expression for an index covering a nullable column alongside expressions.
 *
 * SQLite cannot have `coalesce(column, 0)`: drizzle-kit splits index key lists
 * on commas without respecting parentheses, generating invalid SQL (e.g.
 * `coalesce("user_id"`, `0)`). The index is partial on
 * `WHERE user_id IS NOT NULL`, so the bare column is semantically identical.
 *
 * See docs/adr/0004.
 */
export const nullableIndexKey = <T extends SQLiteColumn | SQL>(column: T): T =>
  column;
