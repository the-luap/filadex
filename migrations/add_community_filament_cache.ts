import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { createIndexIfMissing } from "./helpers";

/**
 * Migration: adds the community_filament_cache table, holding a locally
 * cached copy of SpoolmanDB's (MIT-licensed) filament profile dataset. Empty
 * until an admin runs "Refresh community database" - see
 * server/utils/spoolmandb-sync.ts.
 * Run with: npx tsx migrations/add_community_filament_cache.ts
 */
export async function runMigration() {
  console.log("Starting migration: community filament cache...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS community_filament_cache (
      id SERIAL PRIMARY KEY,
      manufacturer TEXT NOT NULL,
      material TEXT NOT NULL,
      name TEXT NOT NULL,
      color_name TEXT NOT NULL,
      color_code TEXT,
      density NUMERIC,
      diameter NUMERIC,
      extruder_temp INTEGER,
      bed_temp INTEGER,
      updated_at TIMESTAMP DEFAULT now()
    );
  `);
  console.log("✓ Created community_filament_cache table");

  await createIndexIfMissing(
    "community_filament_cache_search_idx",
    sql`
      CREATE INDEX community_filament_cache_search_idx
        ON community_filament_cache (manufacturer, name, color_name);
    `,
  );
  console.log("✓ Added search index");

  console.log("Migration completed successfully!");
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
