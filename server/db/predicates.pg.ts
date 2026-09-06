import { sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Case-insensitive comparisons, in one place.
 *
 * Every case-insensitive match in the application goes through these two
 * functions rather than writing the SQL inline. That matters for two reasons.
 *
 * The first is consistency: "does this username already exist" and "can this
 * username log in" have to agree, and they only reliably agree if they are the
 * same predicate. They were not, once, and the result was that an account
 * registered as "Alice" could never be logged into as "alice".
 *
 * The second is that this is the one comparison SQL engines genuinely disagree
 * about. ILIKE is Postgres-only, and LOWER() is not the only way to spell a
 * caseless comparison. Keeping both behind a named function means a different
 * engine changes this file and nothing else.
 */

/** Matches when the column equals the value, ignoring case. */
export function eqIgnoreCase(column: AnyPgColumn, value: string): SQL {
  return sql`LOWER(${column}) = LOWER(${value})`;
}

/**
 * Matches when the column contains the value anywhere in it, ignoring case.
 *
 * `%`, `_` and `\` in the value are escaped rather than stripped, so a search
 * term matches those characters literally and cannot widen its own pattern. A
 * term made only of wildcards matches only rows that literally contain them.
 *
 * The escape character is spelled `E'\\'` rather than `'\'` so it stays a single
 * backslash whether or not the target database has `standard_conforming_strings`
 * on - Filadex can be pointed at an operator's own database (docs/adr/0002).
 */
export function containsIgnoreCase(column: AnyPgColumn, value: string): SQL {
  const escaped = value.replace(/[\\%_]/g, (char) => `\\${char}`);
  return sql`${column} ILIKE ${`%${escaped}%`} ESCAPE E'\\\\'`;
}

/**
 * Matches when a `numeric` column equals the value as a *number* rather than as
 * a string, so "1.750" and "1.75" are the same diameter.
 *
 * This is the one comparison in the application that reads a `numeric` column
 * with a SQL operator, and it is the one place the two engines disagree about
 * it: `t.numeric` is a real `numeric` here and TEXT on SQLite (see
 * shared/columns.sqlite.ts for why), so a plain `=` dedupes "1.750" against an
 * existing "1.75" on Postgres and creates a second filament type on SQLite.
 *
 * Postgres is the side with deployed installations and with a `numeric UNIQUE`
 * on `diameters.value`, so its behaviour is the one both engines are held to:
 * here that means the existing operator, unchanged.
 */
export function eqNumeric(column: AnyPgColumn, value: string): SQL {
  return sql`${column} = ${value}`;
}
