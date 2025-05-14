/**
 * Migration script to add userId field to filaments table
 * and assign existing filaments to the admin user
 */

import { db } from '../db.js';
import { filaments, users } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

async function migrate() {
  try {
    console.log('Starting migration: Adding userId field to filaments table');

    // Check if the column already exists
    const checkColumnQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'filaments' AND column_name = 'user_id'
    `;

    const columnExists = await db.execute(checkColumnQuery);

    if (columnExists.length === 0) {
      console.log('Adding user_id column to filaments table');

      // Add the column
      await db.execute(`
        ALTER TABLE filaments
        ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
      `);

      // Find the admin user
      const adminUsers = await db.select().from(users).where(eq(users.isAdmin, true));

      if (adminUsers.length === 0) {
        throw new Error('No admin user found');
      }

      const adminUser = adminUsers[0];
      console.log(`Found admin user: ${adminUser.username} (ID: ${adminUser.id})`);

      // Update all existing filaments to belong to the admin user
      await db.execute(`
        UPDATE filaments
        SET user_id = ${adminUser.id}
        WHERE user_id IS NULL
      `);

      console.log(`Assigned all existing filaments to user ID: ${adminUser.id}`);

      // Make the column not nullable for future inserts
      await db.execute(`
        ALTER TABLE filaments
        ALTER COLUMN user_id SET NOT NULL
      `);

      console.log('Migration completed successfully');
    } else {
      console.log('Column user_id already exists in filaments table. Skipping migration.');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Export the migrate function
export { migrate };
