// Import postgres directly
import pg from 'pg';
const { Pool } = pg;

// Create a fallback logger in case the real logger is not available
const fallbackLogger = {
  info: console.log,
  error: console.error,
  warn: console.warn,
  debug: console.log
};
let logger = fallbackLogger;

// Create a database connection directly
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://filadex:filadex@db:5432/filadex'
});

async function importDependencies() {
  try {
    // Try to import the logger
    try {
      const loggerModule = await import('../server/logger.js');
      if (loggerModule.logger) {
        logger = loggerModule.logger;
      }
    } catch (loggerError) {
      console.log('Using fallback logger');
    }
  } catch (error) {
    console.error('Error importing dependencies:', error);
  }
}

async function runMigration() {
  try {
    // Import dependencies first
    await importDependencies();

    logger.info('Starting migration: Adding timestamp columns to filaments table');

    // Check if the columns already exist
    const checkColumnsQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'filaments'
      AND column_name IN ('created_at', 'updated_at');
    `;

    const { rows } = await pool.query(checkColumnsQuery);
    const existingColumnNames = rows.map(row => row.column_name);

    // Add created_at column if it doesn't exist
    if (!existingColumnNames.includes('created_at')) {
      logger.info('Adding created_at column to filaments table');
      await pool.query(`
        ALTER TABLE filaments
        ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
      `);
    } else {
      logger.info('created_at column already exists in filaments table');
    }

    // Add updated_at column if it doesn't exist
    if (!existingColumnNames.includes('updated_at')) {
      logger.info('Adding updated_at column to filaments table');
      await pool.query(`
        ALTER TABLE filaments
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
      `);
    } else {
      logger.info('updated_at column already exists in filaments table');
    }

    logger.info('Migration completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    // Close the pool when done
    try {
      await pool.end();
    } catch (err) {
      console.error('Error closing pool:', err);
    }
  }
}

export { runMigration };
