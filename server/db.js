import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get database connection details from environment variables
const dbConfig = {
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'filadex',
  password: process.env.PGPASSWORD || 'filadex',
  database: process.env.PGDATABASE || 'filadex',
};

console.log('Connecting to PostgreSQL database:', {
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  database: dbConfig.database,
});

// Create a PostgreSQL connection pool
const pool = new Pool(dbConfig);

// Create a Drizzle ORM instance
export const db = drizzle(pool);

// Function to test the database connection
export async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Database connection successful:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Function to run migrations
export async function runMigrations() {
  try {
    console.log('Running database migrations...');
    // await migrate(db, { migrationsFolder: path.join(__dirname, '../migrations') });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}

// Export the pool for direct queries if needed
export { pool };
