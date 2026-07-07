import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { addColumnIfMissing } from "./helpers";

/**
 * Migration: adds custom_field_definitions (per-user, user-defined tracked
 * attributes) and a customFieldValues JSONB column on filaments to hold their
 * values, keyed by definition id.
 * Run with: npx tsx migrations/add_custom_fields.ts
 */
export async function runMigration() {
  console.log("Starting migration: custom fields...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS custom_field_definitions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL DEFAULT 'filament',
      name TEXT NOT NULL,
      field_type TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT now()
    );
  `);
  console.log("✓ Created custom_field_definitions table");

  await addColumnIfMissing(
    "filaments",
    "custom_field_values",
    sql`ALTER TABLE filaments ADD COLUMN custom_field_values JSONB DEFAULT '{}';`,
  );
  console.log("✓ Added custom_field_values column to filaments");

  console.log("Migration completed successfully!");
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
