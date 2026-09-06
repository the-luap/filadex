import { sql, type SQL } from "drizzle-orm";
import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  numeric,
  date,
  timestamp,
  jsonb,
  foreignKey,
  index,
  uniqueIndex,
  type PgColumn,
} from "drizzle-orm/pg-core";

/**
 * The column vocabulary shared/schema.ts is written in.
 *
 * Each helper names what a column is *for* rather than which Postgres type
 * spells it. That indirection buys nothing on its own - on Postgres these are
 * one-line pass-throughs - and it exists for one reason: the schema is the
 * single place the whole application agrees on its data, and it should stay a
 * single place even if it ever has to be expressed in another dialect. The
 * alternatives are code generation or a hand-maintained second copy of fifteen
 * tables, and both rot.
 *
 * Only some of these actually vary between engines. The ones that do:
 *
 *   pk         an auto-incrementing key is `serial` here and
 *              `integer().primaryKey({ autoIncrement: true })` elsewhere
 *   bool       Postgres has a boolean type; SQLite stores 0/1
 *   timestamp  a `timestamp` column here; an integer of epoch millis elsewhere
 *   date       a `date` type here; a plain string elsewhere
 *   json       `jsonb` here; text-with-a-JSON-codec elsewhere
 *
 * The ones that do not - `text`, `int`, `numeric` - are here anyway so the
 * schema reads consistently and so that adding a dialect means filling in one
 * file rather than auditing fifteen tables for which columns need attention.
 *
 * `numeric` deliberately keeps its string representation in both directions.
 * Money and weights are carried as strings throughout this codebase, and that
 * contract holds because `numeric` maps to a string rather than a float. Do
 * not "fix" it to a number type.
 */

/** Defines a table. Named separately from the column helpers because it takes the dialect's table builder. */
export const table = pgTable;

/**
 * Table-level constructs, re-exported so shared/schema.ts imports only from
 * this file and stays free of any direct dependency on one dialect.
 *
 * Foreign keys are declared here rather than with `.references()` on the column
 * because only this form can name the constraint, and the names matter: the
 * deployed databases got Postgres's default `<table>_<column>_fkey`, and a
 * migration that assumes a different name would not find the constraint.
 */
export { foreignKey, index, uniqueIndex };

export const t = {
  /** Auto-incrementing primary key. */
  pk: (name: string) => serial(name).primaryKey(),

  /** Arbitrary-length string. */
  text: (name: string) => text(name),

  /** Whole number. */
  int: (name: string) => integer(name),

  /** True/false. */
  bool: (name: string) => boolean(name),

  /** Exact decimal, carried as a string so it never loses precision to a float. */
  numeric: (name: string) => numeric(name),

  /** A moment in time, stored without a zone. */
  timestamp: (name: string) => timestamp(name),

  /**
   * A moment in time, stored with its zone.
   *
   * Both spellings exist because the deployed databases contain both: the
   * tables docker-entrypoint.sh creates use `timestamp with time zone`, while
   * everything added later by the migration scripts does not. Narrowing the
   * former to a plain timestamp would discard each value's offset and
   * reinterpret it in the server's local zone, so the distinction is kept.
   */
  timestamptz: (name: string) => timestamp(name, { withTimezone: true }),

  /** A calendar day with no time of day, carried as a YYYY-MM-DD string. */
  date: (name: string) => date(name),

  /** A structured value stored whole. */
  json: <T>(name: string) => jsonb(name).$type<T>(),

  /**
   * A column holding another table's primary key. The constraint itself is
   * declared in the table's extras with `foreignKey`, so it can be named.
   */
  fk: (name: string) => integer(name),
};

/**
 * Key expression for an index covering a nullable column alongside expressions.
 *
 * Postgres needs `coalesce(column, 0)`: drizzle-kit 0.30's introspection cannot
 * round-trip an index whose key list mixes a bare column with an expression, and
 * `npm run db:verify-upgrade` depends on that round-trip. The `coalesce` form is
 * also already applied on every deployed installation, so changing it would
 * generate an unnecessary index drop and recreate.
 *
 * See docs/adr/0004.
 */
export const nullableIndexKey = (column: PgColumn | SQL): SQL =>
  sql`coalesce(${column}, 0)`;

