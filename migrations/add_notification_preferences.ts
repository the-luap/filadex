import { sql } from "drizzle-orm";
import { db } from "../server/db";

/**
 * Migration: adds per-user low-stock/drying-reminder email alert preferences,
 * a per-filament low-stock notification cooldown marker, and an
 * admin-editable "is this material hygroscopic" flag (seeded for the common
 * moisture-sensitive families) that the drying-reminder check reads instead
 * of a hardcoded material list.
 * Run with: npx tsx migrations/add_notification_preferences.ts
 */
export async function runMigration() {
  console.log("Starting migration: notification preferences...");

  await db.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS low_stock_threshold_percent INTEGER DEFAULT 15;
  `);
  await db.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_low_stock BOOLEAN DEFAULT true;
  `);
  await db.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_drying_reminder BOOLEAN DEFAULT true;
  `);
  await db.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS drying_reminder_days INTEGER DEFAULT 30;
  `);
  console.log("✓ Added notification preference columns to users");

  await db.execute(sql`
    ALTER TABLE filaments ADD COLUMN IF NOT EXISTS low_stock_notified_at TIMESTAMP;
  `);
  await db.execute(sql`
    ALTER TABLE filaments ADD COLUMN IF NOT EXISTS drying_reminder_notified_at TIMESTAMP;
  `);
  console.log("✓ Added low_stock_notified_at and drying_reminder_notified_at columns to filaments");

  await db.execute(sql`
    ALTER TABLE materials ADD COLUMN IF NOT EXISTS is_hygroscopic BOOLEAN DEFAULT false;
  `);
  console.log("✓ Added is_hygroscopic column to materials");

  // Deliberately no bare 'PA%'/'%PA%' pattern here - it would also match
  // e.g. "Panchroma" (a PLA line), which starts with "Pa".
  const hygroscopicPatterns = [
    "%PETG%", "%PVA%", "%ASA%", "%Nylon%",
    "%PA-%", "%PA6%", "%PA11%", "%PA12%", "%PAHT%", "%PA/%",
  ];
  for (const pattern of hygroscopicPatterns) {
    await db.execute(sql`
      UPDATE materials SET is_hygroscopic = true WHERE name ILIKE ${pattern};
    `);
  }
  console.log("✓ Flagged known hygroscopic material families");

  console.log("Migration completed successfully!");
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
