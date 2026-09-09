import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Browser tests, against the built application.
 *
 * These exist because two fixes shipped with no automated coverage (#12), and
 * one of them - a `type="number"` input reporting "" for text the browser
 * cannot parse - is only reproducible in a real browser. jsdom does not
 * implement `validity.badInput`, so a component test would have passed on the
 * broken code. That is the whole argument for driving a browser here.
 *
 * ## Why SQLite rather than the Postgres testcontainer
 *
 * #12 suggested reusing the throwaway Postgres the server suite starts, so
 * there would be one database story rather than two. That issue was written
 * before SQLite landed. Now that it is a supported engine running the same
 * migrations and the same `scripts/seed.ts` fixture, a temp-file SQLite
 * database *is* the one story - and it takes Docker out of the requirements,
 * which matters for a suite people are meant to run before pushing.
 *
 * Nothing under test is dialect-specific: the behaviour lives in the browser.
 *
 * ## Running
 *
 *   npm run build && npm run test:e2e
 *
 * The build is deliberately not implicit. These specs drive the real bundle,
 * and rebuilding silently on every run would hide which artifact failed.
 */

// A fixed path, not mkdtemp: Playwright evaluates this config once in the main
// process and again in each worker, so anything random here would produce a
// different database per evaluation - and anything with side effects would run
// them repeatedly. The config stays inert and the webServer command below does
// the preparation exactly once, when the server starts.
//
// Absolute because server/db.sqlite.ts refuses a relative file: path under
// NODE_ENV=production, which is the mode these specs run the real bundle in.
const DB_DIR = path.resolve("test-results/e2e");
const DATABASE_URL = `file:${path.join(DB_DIR, "e2e.db")}`;
const PORT = process.env.E2E_PORT ?? "5183";

if (!fs.existsSync("dist/index.sqlite.js")) {
  throw new Error("dist/index.sqlite.js is missing - run `npm run build` before `npm run test:e2e`.");
}

// Rebuilt per run: scripts/seed.ts --demo refuses a populated database, which is
// what makes a stale file from a previous run a hard failure rather than a
// confusing pass.
const startServer = [
  `rm -rf ${JSON.stringify(DB_DIR)}`,
  `mkdir -p ${JSON.stringify(DB_DIR)}`,
  "node dist/migrate.sqlite.js",
  "node dist/seed.sqlite.js --demo",
  "node dist/index.sqlite.js",
].join(" && ");

export default defineConfig({
  testDir: "./tests/e2e",
  // Each spec mutates the catalog of the account it signs in as, so they are
  // not safe to interleave against one database.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : "line",

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: startServer,
    url: `http://127.0.0.1:${PORT}/api/auth/me`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_URL,
      PORT,
      NODE_ENV: "production",
      JWT_SECRET: "filadex-e2e-fixed-secret",
      CATALOG_CACHE_DIR: path.join(DB_DIR, "catalogs"),
      DISABLE_RATE_LIMITS: "true",
    },
  },
});
