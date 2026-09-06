import { sql, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

/**
 * Case-insensitive comparisons, in one place (SQLite dialect).
 *
 * `eqIgnoreCase` uses LOWER() on both sides.
 * `containsIgnoreCase` uses LIKE with ESCAPE '\'.
 *
 * SQLite's LIKE folds case for ASCII characters only; Unicode characters
 * (like umlauts) are not folded. This is an accepted constraint matching
 * the product's username rules.
 *
 * See docs/adr/0004.
 */

/** Matches when the column equals the value, ignoring case. */
export function eqIgnoreCase(column: AnySQLiteColumn, value: string): SQL {
  return sql`LOWER(${column}) = LOWER(${value})`;
}

/**
 * Matches when the column contains the value anywhere in it, ignoring case.
 *
 * `%`, `_` and `\` in the value are escaped rather than stripped, so a search
 * term matches those characters literally and cannot widen its own pattern. A
 * term made only of wildcards matches only rows that literally contain them.
 *
 * Uses SQLite's LIKE operator with ESCAPE '\'.
 */
export function containsIgnoreCase(column: AnySQLiteColumn, value: string): SQL {
  const escaped = value.replace(/[\\%_]/g, (char) => `\\${char}`);
  return sql`${column} LIKE ${`%${escaped}%`} ESCAPE '\\'`;
}

/**
 * Matches when a `numeric` column equals the value as a *number* rather than as
 * a string, so "1.750" and "1.75" are the same diameter.
 *
 * `t.numeric` is TEXT on SQLite (see shared/columns.sqlite.ts), so a plain `=`
 * is a string comparison and would create a second filament type where
 * Postgres reuses the existing one. Both sides go through the same CAST, so two
 * spellings of one value produce the same double and compare equal; a NULL
 * column stays NULL and matches nothing, which is what the callers' explicit
 * IS NULL branches expect.
 */
export function eqNumeric(column: AnySQLiteColumn, value: string): SQL {
  return sql`CAST(${column} AS REAL) = CAST(${value} AS REAL)`;
}
