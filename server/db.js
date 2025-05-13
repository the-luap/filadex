import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "../shared/schema.js";

// Get database connection string from environment variables
// Default to PostgreSQL connection using docker-compose variables if not set
const DATABASE_URL = process.env.DATABASE_URL ||
  `postgres://${process.env.POSTGRES_USER || 'filadex'}:${process.env.POSTGRES_PASSWORD || 'filadex'}@postgres:5432/${process.env.POSTGRES_DB || 'filadex'}`;

console.log("Connecting to database with URL:", DATABASE_URL.replace(/:[^:]*@/, ':****@')); // Log URL with password masked

export const pool = new Pool({
  connectionString: DATABASE_URL,
  // Add connection retry logic
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Test database connection
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('Successfully connected to the database');
    client.release();
    return true;
  } catch (err) {
    console.error('Error connecting to the database:', err.stack);
    return false;
  }
};

// Also connect immediately
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
  } else {
    console.log('Successfully connected to the database');
    release();
  }
});

export const db = drizzle(pool, { schema });
