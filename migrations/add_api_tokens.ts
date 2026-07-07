import { sql } from "drizzle-orm";
import { db } from "../server/db";

/**
 * Migration: adds the api_tokens table backing per-user API tokens for
 * printer/print-server integrations (Phase A of the printer integration -
 * see IMPLEMENTATION_PLAN.md #5).
 * Run with: npx tsx migrations/add_api_tokens.ts
 */
export async function runMigration() {
  console.log("Starting migration: API tokens...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS api_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      label TEXT,
      created_at TIMESTAMP DEFAULT now(),
      last_used_at TIMESTAMP
    );
  `);
  console.log("✓ Created api_tokens table");

  console.log("Migration completed successfully!");
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
