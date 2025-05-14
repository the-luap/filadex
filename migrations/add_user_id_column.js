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

    logger.info('Starting migration: Adding user_id column to filaments table');

    // Check if the column already exists
    const checkColumnQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'filaments'
      AND column_name = 'user_id';
    `;

    const { rows } = await pool.query(checkColumnQuery);
    
    // Add user_id column if it doesn't exist
    if (rows.length === 0) {
      logger.info('Adding user_id column to filaments table');
      
      // First, check if the users table exists and has records
      const checkUsersQuery = `
        SELECT COUNT(*) as count FROM users;
      `;
      
      try {
        const usersResult = await pool.query(checkUsersQuery);
        const userCount = parseInt(usersResult.rows[0].count);
        
        // Add the user_id column
        await pool.query(`
          ALTER TABLE filaments
          ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
        `);
        
        // If there are users and filaments, assign all existing filaments to the first user (admin)
        if (userCount > 0) {
          const checkFilamentsQuery = `
            SELECT COUNT(*) as count FROM filaments;
          `;
          
          const filamentsResult = await pool.query(checkFilamentsQuery);
          const filamentCount = parseInt(filamentsResult.rows[0].count);
          
          if (filamentCount > 0) {
            logger.info(`Found ${filamentCount} existing filaments, assigning them to the first user`);
            
            // Get the first user (usually admin)
            const firstUserQuery = `
              SELECT id FROM users ORDER BY id LIMIT 1;
            `;
            
            const firstUserResult = await pool.query(firstUserQuery);
            
            if (firstUserResult.rows.length > 0) {
              const firstUserId = firstUserResult.rows[0].id;
              
              // Update all existing filaments to belong to the first user
              await pool.query(`
                UPDATE filaments SET user_id = $1;
              `, [firstUserId]);
              
              logger.info(`Successfully assigned all filaments to user ID ${firstUserId}`);
            }
          }
        }
      } catch (error) {
        logger.error('Error checking users table or updating filaments:', error);
        // Continue with the migration even if this part fails
      }
    } else {
      logger.info('user_id column already exists in filaments table');
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
