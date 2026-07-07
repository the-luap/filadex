import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { createIndexIfMissing } from "./helpers";

/**
 * Migration: adds the filament_usage_log table, recording every change to a
 * filament's remainingPercentage (delta weight, resulting percentage, note, source).
 * Run with: npx tsx migrations/add_filament_usage_log.ts
 */
export async function runMigration() {
  console.log("Starting migration: filament usage log...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS filament_usage_log (
      id SERIAL PRIMARY KEY,
      filament_id INTEGER NOT NULL REFERENCES filaments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      delta_weight NUMERIC NOT NULL,
      remaining_percentage_after NUMERIC NOT NULL,
      note TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TIMESTAMP DEFAULT now()
    );
  `);
  console.log("✓ Created filament_usage_log table");

  await createIndexIfMissing(
    "filament_usage_log_filament_id_idx",
    sql`CREATE INDEX filament_usage_log_filament_id_idx ON filament_usage_log (filament_id);`,
  );
  console.log("✓ Added index on filament_id");

  console.log("Migration completed successfully!");
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
