/**
 * @libsql/client rejects a `sqlite:` URL with URL_SCHEME_NOT_SUPPORTED, but the
 * scheme is accepted at every entry point that chooses the dialect
 * (docker-entrypoint.sh, scripts/migrate.ts). Normalising it to `file:` here is
 * what makes the two agree.
 *
 * This module is deliberately free of side effects: server/db.sqlite.ts opens a
 * database connection on import, and the test harness needs the function without
 * that. See docs/adr/0004-sqlite-alongside-postgres.md.
 */
export function normalizeSqliteUrl(url: string): string {
  if (url.startsWith("sqlite:")) {
    return url.replace(/^sqlite:/, "file:");
  }
  return url;
}

/**
 * The filesystem path a `file:` URL names, with any query string removed.
 *
 * Returns null for the in-memory forms (`file::memory:`, with or without
 * parameters), which name no file at all.
 */
export function sqliteFilePath(url: string): string | null {
  if (!url.startsWith("file:")) return null;
  if (url.startsWith("file::memory:")) return null;

  const withoutQuery = url.split("?")[0];
  // `file:///data/x.db` and `file:/data/x.db` are the same path; the first
  // spelling carries an empty authority component that is not part of it.
  const rest = withoutQuery.startsWith("file://")
    ? withoutQuery.slice("file://".length)
    : withoutQuery.slice("file:".length);
  return rest;
}
