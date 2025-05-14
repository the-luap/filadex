import { db } from './db.js';
import { eq, and, or, isNull, desc } from 'drizzle-orm';
import * as schema from '../shared/schema.js';

// Database storage implementation
class DatabaseStorage {
  async getFilaments(userId) {
    try {
      // Get filaments for the current user
      // Order by id instead of createdAt/updatedAt to avoid issues with older records
      const filaments = await db.select().from(schema.filaments)
        .where(eq(schema.filaments.userId, userId))
        .orderBy(desc(schema.filaments.id));

      return filaments;
    } catch (error) {
      console.error('Error fetching filaments:', error);
      throw error;
    }
  }

  async getFilament(id, userId) {
    try {
      // Get a single filament by ID, ensuring it belongs to the current user
      const filaments = await db.select().from(schema.filaments)
        .where(and(
          eq(schema.filaments.id, id),
          eq(schema.filaments.userId, userId)
        ));

      return filaments.length > 0 ? filaments[0] : null;
    } catch (error) {
      console.error(`Error fetching filament ${id}:`, error);
      throw error;
    }
  }

  async createFilament(data) {
    try {
      // Create a new filament
      const newFilament = await db.insert(schema.filaments).values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      return newFilament[0];
    } catch (error) {
      console.error('Error creating filament:', error);
      throw error;
    }
  }

  async updateFilament(id, data, userId) {
    try {
      // Check if filament exists and belongs to the user
      const filament = await this.getFilament(id, userId);
      if (!filament) {
        return null;
      }

      // Update the filament
      const updatedFilament = await db.update(schema.filaments)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(and(
          eq(schema.filaments.id, id),
          eq(schema.filaments.userId, userId)
        ))
        .returning();

      return updatedFilament[0];
    } catch (error) {
      console.error(`Error updating filament ${id}:`, error);
      throw error;
    }
  }

  async deleteFilament(id, userId) {
    try {
      // Check if filament exists and belongs to the user
      const filament = await this.getFilament(id, userId);
      if (!filament) {
        return false;
      }

      // Delete the filament
      await db.delete(schema.filaments)
        .where(and(
          eq(schema.filaments.id, id),
          eq(schema.filaments.userId, userId)
        ));

      return true;
    } catch (error) {
      console.error(`Error deleting filament ${id}:`, error);
      throw error;
    }
  }

  async getSharedFilaments(userId) {
    try {
      // Get filaments shared with the user
      const sharedFilaments = await db.select({
        filament: schema.filaments
      })
      .from(schema.filaments)
      .innerJoin(
        schema.userSharing,
        and(
          eq(schema.userSharing.filamentId, schema.filaments.id),
          eq(schema.userSharing.userId, userId)
        )
      );

      return sharedFilaments.map(row => row.filament);
    } catch (error) {
      console.error('Error fetching shared filaments:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const storage = new DatabaseStorage();
