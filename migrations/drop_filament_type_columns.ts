import { sql } from "drizzle-orm";
import { db } from "../server/db";

/**
 * Migration: drops the product-identity columns from `filaments` now that
 * they live on `filament_types` (see migrations/add_filament_types.ts). Kept
 * as a separate migration file from the backfill for clarity, and
 * safety-gated rather than run unconditionally: it aborts without dropping
 * anything if any filament still lacks a filament_type_id (i.e. the backfill
 * hasn't completed/succeeded yet), which is what makes it safe for
 * docker-entrypoint.sh to run it right after the backfill on every boot.
 *
 * Run with: npx tsx migrations/drop_filament_type_columns.ts
 */
export async function runMigration() {
  console.log("Starting migration: drop redundant filament type columns...");

  const { rows: legacyMaterialColumn } = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'filaments' AND column_name = 'material';
  `);

  if (legacyMaterialColumn.length === 0) {
    console.log("✓ Legacy columns already dropped (or never existed) - nothing to do");
    console.log("Migration completed successfully!");
    return;
  }

  const { rows: unlinkedRows } = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count FROM filaments WHERE filament_type_id IS NULL;
  `);
  const unlinkedCount = unlinkedRows[0]?.count ?? 0;

  if (unlinkedCount > 0) {
    console.warn(
      `⚠ ${unlinkedCount} filament row(s) still have no filament_type_id - skipping column drop. ` +
      `Re-run migrations/add_filament_types.ts (or investigate manually) before this can proceed safely.`
    );
    return;
  }

  await db.execute(sql`ALTER TABLE filaments ALTER COLUMN filament_type_id SET NOT NULL;`);
  await db.execute(sql`
    ALTER TABLE filaments
      DROP COLUMN IF EXISTS manufacturer,
      DROP COLUMN IF EXISTS material,
      DROP COLUMN IF EXISTS color_name,
      DROP COLUMN IF EXISTS color_code,
      DROP COLUMN IF EXISTS diameter,
      DROP COLUMN IF EXISTS print_temp;
  `);
  console.log("✓ Dropped redundant product-identity columns from filaments");

  console.log("Migration completed successfully!");
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
