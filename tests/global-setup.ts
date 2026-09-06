import type { TestProject } from "vitest/node";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Provides the database the whole suite runs against.
 *
 * For Postgres:
 *   TEST_DATABASE_URL set   -> that database is used as-is (CI, or a server you
 *                              already have running)
 *   TEST_DATABASE_URL unset -> a throwaway Postgres container is started here
 *                              and torn down when the run finishes
 *
 * For SQLite:
 *   Uses a temporary file in os.tmpdir(), torn down when the run finishes.
 *   No container is needed, making the SQLite leg fast and portable.
 *
 * Note the variable is deliberately NOT the application's own DATABASE_URL:
 * tests/helpers/db.ts drops and recreates the public schema (or drops all tables),
 * which would destroy a development database configured in the shell.
 */

import { isSqlite as checkIsSqlite } from "./helpers/dialect";
import { normalizeSqliteUrl } from "../server/sqlite-url";

// Matches the version docker-compose.template.yml deploys.
const POSTGRES_IMAGE = "postgres:15-alpine";

export default async function setup({ provide }: TestProject) {
  const isSqlite = checkIsSqlite();

  if (isSqlite) {
    if (process.env.TEST_DATABASE_URL) {
      provide("databaseUrl", normalizeSqliteUrl(process.env.TEST_DATABASE_URL));
      return;
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "filadex-test-"));
    const dbPath = path.join(tempDir, "test.db");
    provide("databaseUrl", `file:${dbPath}`);

    return async () => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    };
  }

  if (process.env.TEST_DATABASE_URL) {
    provide("databaseUrl", process.env.TEST_DATABASE_URL);
    return;
  }

  const { PostgreSqlContainer } = await import("@testcontainers/postgresql");
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();

  provide("databaseUrl", container.getConnectionUri());

  return async () => {
    await container.stop();
  };
}

declare module "vitest" {
  interface ProvidedContext {
    databaseUrl: string;
  }
}
