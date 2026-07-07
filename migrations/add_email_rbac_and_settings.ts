import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { addColumnIfMissing, createIndexIfMissing } from "./helpers";

/**
 * Migration: adds RBAC (role column), email/verification/password-reset
 * columns to users, a case-insensitive unique username index, the
 * email_settings singleton table, and the catalog_requests table.
 * Run with: npx tsx migrations/add_email_rbac_and_settings.ts
 */
export async function runMigration() {
  console.log("Starting migration: email, RBAC, and catalog requests...");

  await addColumnIfMissing(
    "users",
    "role",
    sql`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';`,
  );
  await db.execute(sql`
    UPDATE users SET role = 'admin' WHERE is_admin = true AND role <> 'admin';
  `);
  console.log("✓ Added role column and backfilled from is_admin");

  await addColumnIfMissing("users", "email", sql`ALTER TABLE users ADD COLUMN email TEXT UNIQUE;`);
  await addColumnIfMissing("users", "email_verified", sql`ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;`);
  await addColumnIfMissing("users", "email_verification_token", sql`ALTER TABLE users ADD COLUMN email_verification_token TEXT;`);
  await addColumnIfMissing("users", "email_verification_expires", sql`ALTER TABLE users ADD COLUMN email_verification_expires TIMESTAMP;`);
  await addColumnIfMissing("users", "password_reset_token", sql`ALTER TABLE users ADD COLUMN password_reset_token TEXT;`);
  await addColumnIfMissing("users", "password_reset_expires", sql`ALTER TABLE users ADD COLUMN password_reset_expires TIMESTAMP;`);
  console.log("✓ Added email, verification, and password-reset columns");

  // Existing self-hosted admin accounts predate email verification; don't lock them out.
  await db.execute(sql`
    UPDATE users SET email_verified = true WHERE email_verified = false;
  `);

  await createIndexIfMissing(
    "users_username_lower_idx",
    sql`CREATE UNIQUE INDEX users_username_lower_idx ON users (LOWER(username));`,
  );
  console.log("✓ Added case-insensitive unique username index");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS email_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      enabled BOOLEAN DEFAULT false,
      smtp_host TEXT,
      smtp_port INTEGER,
      smtp_user TEXT,
      smtp_password TEXT,
      smtp_secure BOOLEAN DEFAULT true,
      from_email TEXT,
      from_name TEXT,
      updated_at TIMESTAMP DEFAULT now()
    );
  `);
  await db.execute(sql`
    INSERT INTO email_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
  `);
  console.log("✓ Created email_settings table");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS catalog_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      payload JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      review_note TEXT,
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT now()
    );
  `);
  console.log("✓ Created catalog_requests table");

  console.log("Migration completed successfully!");
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
