import { defineConfig } from "vitest/config";
import path from "path";

import { isSqlite as checkIsSqlite } from "./tests/helpers/dialect";

const isSqlite = checkIsSqlite();

export default defineConfig({
  resolve: {
    alias: {
      "@shared/columns": isSqlite
        ? path.resolve(import.meta.dirname, "shared/columns.sqlite.ts")
        : path.resolve(import.meta.dirname, "shared/columns.pg.ts"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@db/predicates": isSqlite
        ? path.resolve(import.meta.dirname, "server/db/predicates.sqlite.ts")
        : path.resolve(import.meta.dirname, "server/db/predicates.pg.ts"),
      "@db": isSqlite
        ? path.resolve(import.meta.dirname, "server/db.sqlite.ts")
        : path.resolve(import.meta.dirname, "server/db.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // A fixed secret keeps issued JWTs valid for the whole run and silences the
    // random-secret warning server/auth.ts logs on import.
    env: { JWT_SECRET: "filadex-test-secret", NODE_ENV: "test" },
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    // Every test file talks to the same database server, and each rebuilds the
    // schema, so files must not run concurrently.
    fileParallelism: false,
    // Starting a Postgres container, creating the schema and bcrypt hashing at
    // cost 10 all make the defaults too tight.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
