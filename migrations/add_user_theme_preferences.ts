import { sql } from "drizzle-orm";
import { db } from "../server/db";
import * as fs from "fs";
import * as path from "path";

/**
 * Migration: moves the UI theme (accent color, dark/light appearance) from a
 * single global theme.json file (read/written by an unauthenticated
 * /api/theme endpoint - every user shared one theme, and anyone could change
 * it) to per-user columns on `users`.
 *
 * Existing installs get their previous global theme.json values backfilled
 * onto every user, so nobody's current look changes; new users get the
 * column defaults (matching theme.json's own factory defaults).
 *
 * Run with: npx tsx migrations/add_user_theme_preferences.ts
 */
export async function runMigration() {
  console.log("Starting migration: per-user theme preferences...");

  // This migration re-runs on every container start (docker-entrypoint.sh),
  // so the theme.json backfill below must only ever happen once - otherwise
  // every restart would silently overwrite each user's saved theme choice
  // back to the old global default. Column existence is the one-time gate.
  const { rows } = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'theme_variant';
  `);
  const alreadyMigrated = rows.length > 0;

  await db.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_variant TEXT DEFAULT 'professional';
  `);
  await db.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_primary TEXT DEFAULT '#EA580C';
  `);
  await db.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_appearance TEXT DEFAULT 'dark';
  `);
  await db.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_radius NUMERIC DEFAULT 0.8;
  `);
  console.log("✓ Per-user theme columns present");

  if (alreadyMigrated) {
    console.log("Already migrated on a previous run - skipping theme.json backfill");
  } else {
    try {
      const themePath = path.resolve("./theme.json");
      if (fs.existsSync(themePath)) {
        const legacy = JSON.parse(fs.readFileSync(themePath, "utf-8"));
        if (legacy.variant || legacy.primary || legacy.appearance || legacy.radius) {
          await db.execute(sql`
            UPDATE users SET
              theme_variant = COALESCE(${legacy.variant ?? null}, theme_variant),
              theme_primary = COALESCE(${legacy.primary ?? null}, theme_primary),
              theme_appearance = COALESCE(${legacy.appearance ?? null}, theme_appearance),
              theme_radius = COALESCE(${legacy.radius ?? null}, theme_radius);
          `);
          console.log("✓ Backfilled every user with the previous global theme.json values");
        }
      }
    } catch (error) {
      console.warn("Could not backfill from legacy theme.json (non-fatal):", error);
    }
  }

  console.log("Migration completed successfully!");
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
