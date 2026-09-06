import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const dialect = "postgres" as const;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
export async function closeDb(): Promise<void> {
  await pool.end();
}
export async function vacuumBackup(_destinationPath: string): Promise<void> {
  throw new Error("Database backups are only supported on SQLite installations");
}

