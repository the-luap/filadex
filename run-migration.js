// Import the migration
import { runMigration } from './migrations/add_user_id_column.js';

// Run the migration
async function main() {
  try {
    console.log('Starting migration...');
    await runMigration();
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
