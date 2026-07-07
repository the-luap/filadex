import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { addColumnIfMissing } from "./helpers";

/**
 * Migration: splits "filament type" (manufacturer, material, color,
 * diameter, print temp) out of the flat `filaments` row into its own
 * `filament_types` table, and links each existing filament (spool instance)
 * to its type via a new `filament_type_id` column - see
 * IMPLEMENTATION_PLAN.md #9.
 *
 * This is the additive half of a two-step migration: it backfills
 * filament_type_id but does NOT drop the now-redundant columns from
 * `filaments` (see migrations/drop_filament_type_columns.ts for that, run
 * separately once the backfill is verified).
 *
 * Run with: npx tsx migrations/add_filament_types.ts
 */
export async function runMigration() {
  console.log("Starting migration: filament types...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS filament_types (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      manufacturer TEXT,
      material TEXT NOT NULL,
      color_name TEXT NOT NULL,
      color_code TEXT,
      diameter NUMERIC,
      print_temp TEXT,
      created_at TIMESTAMP DEFAULT now()
    );
  `);
  console.log("✓ Created filament_types table");

  const { rows: filamentTypeIdColumn } = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'filaments' AND column_name = 'filament_type_id';
  `);

  if (filamentTypeIdColumn.length > 0) {
    console.log("✓ filaments.filament_type_id already exists - skipping backfill");
    console.log("Migration completed successfully!");
    return;
  }

  const { rows: legacyMaterialColumn } = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'filaments' AND column_name = 'material';
  `);

  if (legacyMaterialColumn.length === 0) {
    // A fresh install created via `drizzle-kit push` already has the new
    // shape and no rows to backfill.
    await addColumnIfMissing(
      "filaments",
      "filament_type_id",
      sql`ALTER TABLE filaments ADD COLUMN filament_type_id INTEGER REFERENCES filament_types(id);`,
    );
    console.log("✓ Fresh install - added empty filament_type_id column");
    console.log("Migration completed successfully!");
    return;
  }

  console.log("Backfilling filament_types from existing filaments rows...");

  await db.execute(sql`
    INSERT INTO filament_types (user_id, manufacturer, material, color_name, color_code, diameter, print_temp)
    SELECT DISTINCT user_id, manufacturer, material, color_name, color_code, diameter, print_temp
    FROM filaments;
  `);
  console.log("✓ Backfilled filament_types from distinct filament combinations");

  await addColumnIfMissing(
    "filaments",
    "filament_type_id",
    sql`ALTER TABLE filaments ADD COLUMN filament_type_id INTEGER REFERENCES filament_types(id);`,
  );

  await db.execute(sql`
    UPDATE filaments f
    SET filament_type_id = ft.id
    FROM filament_types ft
    WHERE f.filament_type_id IS NULL
      AND f.user_id IS NOT DISTINCT FROM ft.user_id
      AND f.material IS NOT DISTINCT FROM ft.material
      AND f.color_name IS NOT DISTINCT FROM ft.color_name
      AND f.manufacturer IS NOT DISTINCT FROM ft.manufacturer
      AND f.color_code IS NOT DISTINCT FROM ft.color_code
      AND f.diameter IS NOT DISTINCT FROM ft.diameter
      AND f.print_temp IS NOT DISTINCT FROM ft.print_temp;
  `);
  console.log("✓ Linked existing filaments to their filament_type_id");

  console.log("Migration completed successfully!");
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
