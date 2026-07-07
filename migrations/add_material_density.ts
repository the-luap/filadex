import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { addColumnIfMissing } from "./helpers";

/**
 * Migration: adds a `density` column (g/cm^3) to materials, seeded with
 * sensible defaults for common material families matched by name keyword
 * (existing rows use varied vendor-specific names like "PLA Basic" or
 * "PA6-CF", not exact material-type strings). Nullable and always editable
 * per material — seeding is a starting point, not a requirement.
 * Run with: npx tsx migrations/add_material_density.ts
 */
export async function runMigration() {
  console.log("Starting migration: material density...");

  await addColumnIfMissing("materials", "density", sql`ALTER TABLE materials ADD COLUMN density NUMERIC;`);
  console.log("✓ Added density column to materials");

  const seeds: Array<{ density: number; pattern: string }> = [
    // Most specific first, so a later broader pattern's `density IS NULL`
    // guard doesn't get a chance to run before the specific one lands.
    // Note: deliberately no bare 'PA%'/'%PA%' pattern - it would also match
    // e.g. "Panchroma" (a PLA line), which starts with "Pa".
    { density: 1.52, pattern: "%PA-%" },
    { density: 1.52, pattern: "%PA6%" },
    { density: 1.52, pattern: "%PA11%" },
    { density: 1.52, pattern: "%PA12%" },
    { density: 1.52, pattern: "%PAHT%" },
    { density: 1.52, pattern: "%PA/%" },
    { density: 1.52, pattern: "%Nylon%" },
    { density: 1.24, pattern: "%PLA%" },
    { density: 1.27, pattern: "%PETG%" },
    { density: 1.05, pattern: "%ASA%" },
    { density: 1.04, pattern: "%ABS%" },
    { density: 1.21, pattern: "%TPU%" },
    { density: 1.23, pattern: "%PVA%" },
    { density: 1.23, pattern: "%PCTG%" },
    { density: 1.20, pattern: "%PC%" },
    { density: 1.31, pattern: "%PEEK%" },
    { density: 1.29, pattern: "%PPSU%" },
    { density: 1.78, pattern: "%PVDF%" },
  ];

  for (const { density, pattern } of seeds) {
    await db.execute(sql`
      UPDATE materials SET density = ${density} WHERE name ILIKE ${pattern} AND density IS NULL;
    `);
  }
  console.log("✓ Seeded default densities for known material families");

  console.log("Migration completed successfully!");
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
