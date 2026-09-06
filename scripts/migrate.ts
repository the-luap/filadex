/**
 * Migration runner entrypoint.
 * Dispatches to scripts/migrate.sqlite.ts or scripts/migrate.pg.ts based on DATABASE_URL.
 */
const url = process.env.DATABASE_URL || "";
if (url.startsWith("file:") || url.startsWith("sqlite:")) {
  await import("./migrate.sqlite");
} else {
  await import("./migrate.pg");
}

export {};

