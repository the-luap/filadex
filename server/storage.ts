import {
  filaments, type Filament, type InsertFilament,
  manufacturers, type Manufacturer, type InsertManufacturer,
  materials, type Material, type InsertMaterial,
  colors, type Color, type InsertColor,
  diameters, type Diameter, type InsertDiameter,
  storageLocations, type StorageLocation, type InsertStorageLocation
} from "@shared/schema";
import { users, type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq, sql, and, inArray } from "drizzle-orm";

// Modify the interface with any CRUD methods
// you might need
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Filament operations
  getFilaments(userId: number): Promise<Filament[]>;
  getPublicFilamentsWithUser(userId: number, filterFn?: (filament: Filament) => boolean): Promise<{filaments: Filament[], user: {id: number, username: string}}>;
  getFilament(id: number, userId: number): Promise<Filament | undefined>;
  createFilament(filament: InsertFilament): Promise<Filament>;
  updateFilament(id: number, filament: Partial<InsertFilament>, userId: number): Promise<Filament | undefined>;
  deleteFilament(id: number, userId: number): Promise<boolean>;

  // Batch filament operations
  batchDeleteFilaments(ids: number[], userId: number): Promise<number>;
  batchUpdateFilaments(ids: number[], updates: Partial<InsertFilament>, userId: number): Promise<number>;

  // Manufacturer operations
  getManufacturers(): Promise<Manufacturer[]>;
  createManufacturer(manufacturer: InsertManufacturer): Promise<Manufacturer>;
  deleteManufacturer(id: number): Promise<boolean>;
  updateManufacturerOrder(id: number, newOrder: number): Promise<Manufacturer | undefined>;

  // Material operations
  getMaterials(): Promise<Material[]>;
  createMaterial(material: InsertMaterial): Promise<Material>;
  deleteMaterial(id: number): Promise<boolean>;
  updateMaterialOrder(id: number, newOrder: number): Promise<Material | undefined>;

  // Color operations
  getColors(): Promise<Color[]>;
  createColor(color: InsertColor): Promise<Color>;
  deleteColor(id: number): Promise<boolean>;

  // Diameter operations
  getDiameters(): Promise<Diameter[]>;
  createDiameter(diameter: InsertDiameter): Promise<Diameter>;
  deleteDiameter(id: number): Promise<boolean>;

  // Storage Location operations
  getStorageLocations(): Promise<StorageLocation[]>;
  createStorageLocation(location: InsertStorageLocation): Promise<StorageLocation>;
  deleteStorageLocation(id: number): Promise<boolean>;
  updateStorageLocationOrder(id: number, newOrder: number): Promise<StorageLocation | undefined>;
}

// Database Storage implementation using PostgreSQL
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Filament implementations
  async getFilaments(userId: number): Promise<Filament[]> {
    return await db.select().from(filaments).where(eq(filaments.userId, userId));
  }

  async getPublicFilamentsWithUser(userId: number, filterFn?: (filament: Filament) => boolean): Promise<{filaments: Filament[], user: {id: number, username: string}}> {
    // Get user information
    const [user] = await db.select({
      id: users.id,
      username: users.username
    }).from(users).where(eq(users.id, userId));

    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    console.log(`Getting public filaments for user: ${user.username} (ID: ${userId})`);

    // Get filaments
    const allFilaments = await this.getFilaments(userId);

    // Apply filter if provided
    const filteredFilaments = filterFn ? allFilaments.filter(filterFn) : allFilaments;

    console.log(`Found ${filteredFilaments.length} public filaments for user ${user.username}`);

    // Return filaments with user information
    return {
      filaments: filteredFilaments,
      user: {
        id: user.id,
        username: user.username
      }
    };
  }

  async getFilament(id: number, userId: number): Promise<Filament | undefined> {
    console.log(`DEBUG: getFilament called with id=${id}, userId=${userId}`);
    console.log(`DEBUG: id type: ${typeof id}, userId type: ${typeof userId}`);

    try {
      const query = db.select().from(filaments)
        .where(eq(filaments.id, id))
        .where(eq(filaments.userId, userId));

      console.log(`DEBUG: SQL query: ${query.toSQL().sql}`);

      const [filament] = await query;

      console.log(`DEBUG: getFilament result:`, filament ? "Found" : "Not found");
      if (filament) {
        console.log(`DEBUG: Filament details: id=${filament.id}, name=${filament.name}`);
      }

      return filament || undefined;
    } catch (err) {
      console.error(`DEBUG: Error in getFilament:`, err);
      throw err;
    }
  }

  async createFilament(insertFilament: InsertFilament): Promise<Filament> {
    const [filament] = await db
      .insert(filaments)
      .values(insertFilament)
      .returning();
    return filament;
  }

  async updateFilament(id: number, updateFilament: Partial<InsertFilament>, userId: number): Promise<Filament | undefined> {
    console.log(`DEBUG: updateFilament called with id=${id}, userId=${userId}`);
    console.log(`DEBUG: updateFilament data:`, updateFilament);

    try {
      const query = db
        .update(filaments)
        .set(updateFilament)
        .where(eq(filaments.id, id))
        .where(eq(filaments.userId, userId))
        .returning();

      console.log(`DEBUG: SQL update query: ${query.toSQL().sql}`);

      const [updated] = await query;

      console.log(`DEBUG: updateFilament result:`, updated ? "Updated" : "Not updated");
      if (updated) {
        console.log(`DEBUG: Updated filament details: id=${updated.id}, name=${updated.name}`);
      }

      return updated || undefined;
    } catch (err) {
      console.error(`DEBUG: Error in updateFilament:`, err);
      throw err;
    }
  }

  async deleteFilament(id: number, userId: number): Promise<boolean> {
    const [deleted] = await db
      .delete(filaments)
      .where(eq(filaments.id, id))
      .where(eq(filaments.userId, userId))
      .returning();
    return !!deleted;
  }

  // Batch operations
  async batchDeleteFilaments(ids: number[], userId: number): Promise<number> {
    // Convert all IDs to numbers to ensure they're valid
    const validIds = ids.map(id => Number(id));

    // Use the in operator from drizzle instead of raw SQL
    const { count } = await db
      .delete(filaments)
      .where(
        and(
          inArray(filaments.id, validIds),
          eq(filaments.userId, userId)
        )
      )
      .returning();

    console.log(`Batch deleted ${count} filaments with IDs:`, validIds);
    return count;
  }

  async batchUpdateFilaments(ids: number[], updates: Partial<InsertFilament>, userId: number): Promise<number> {
    // Convert all IDs to numbers to ensure they're valid
    const validIds = ids.map(id => Number(id));

    // Use the in operator from drizzle instead of raw SQL
    const { count } = await db
      .update(filaments)
      .set(updates)
      .where(
        and(
          inArray(filaments.id, validIds),
          eq(filaments.userId, userId)
        )
      )
      .returning();

    console.log(`Batch updated ${count} filaments with IDs:`, validIds);
    return count;
  }

  // Manufacturer implementations
  async getManufacturers(): Promise<Manufacturer[]> {
    return await db.select().from(manufacturers).orderBy(manufacturers.sortOrder, manufacturers.name);
  }

  async createManufacturer(insertManufacturer: InsertManufacturer): Promise<Manufacturer> {
    const [manufacturer] = await db
      .insert(manufacturers)
      .values(insertManufacturer)
      .returning();
    return manufacturer;
  }

  async deleteManufacturer(id: number): Promise<boolean> {
    const [deleted] = await db
      .delete(manufacturers)
      .where(eq(manufacturers.id, id))
      .returning();
    return !!deleted;
  }

  async updateManufacturerOrder(id: number, newOrder: number): Promise<Manufacturer | undefined> {
    const [updated] = await db
      .update(manufacturers)
      .set({ sortOrder: newOrder })
      .where(eq(manufacturers.id, id))
      .returning();
    return updated || undefined;
  }

  // Material implementations
  async getMaterials(): Promise<Material[]> {
    return await db.select().from(materials).orderBy(materials.sortOrder, materials.name);
  }

  async createMaterial(insertMaterial: InsertMaterial): Promise<Material> {
    const [material] = await db
      .insert(materials)
      .values(insertMaterial)
      .returning();
    return material;
  }

  async deleteMaterial(id: number): Promise<boolean> {
    const [deleted] = await db
      .delete(materials)
      .where(eq(materials.id, id))
      .returning();
    return !!deleted;
  }

  async updateMaterialOrder(id: number, newOrder: number): Promise<Material | undefined> {
    const [updated] = await db
      .update(materials)
      .set({ sortOrder: newOrder })
      .where(eq(materials.id, id))
      .returning();
    return updated || undefined;
  }

  // Color implementations
  async getColors(): Promise<Color[]> {
    return await db.select().from(colors);
  }

  async createColor(insertColor: InsertColor): Promise<Color> {
    const [color] = await db
      .insert(colors)
      .values(insertColor)
      .returning();
    return color;
  }

  async deleteColor(id: number): Promise<boolean> {
    const [deleted] = await db
      .delete(colors)
      .where(eq(colors.id, id))
      .returning();
    return !!deleted;
  }

  // Diameter implementations
  async getDiameters(): Promise<Diameter[]> {
    return await db.select().from(diameters);
  }

  async createDiameter(insertDiameter: InsertDiameter): Promise<Diameter> {
    const [diameter] = await db
      .insert(diameters)
      .values(insertDiameter)
      .returning();
    return diameter;
  }

  async deleteDiameter(id: number): Promise<boolean> {
    const [deleted] = await db
      .delete(diameters)
      .where(eq(diameters.id, id))
      .returning();
    return !!deleted;
  }

  // Storage Location implementations
  async getStorageLocations(): Promise<StorageLocation[]> {
    return await db.select().from(storageLocations).orderBy(storageLocations.sortOrder, storageLocations.name);
  }

  async createStorageLocation(insertLocation: InsertStorageLocation): Promise<StorageLocation> {
    const [location] = await db
      .insert(storageLocations)
      .values(insertLocation)
      .returning();
    return location;
  }

  async deleteStorageLocation(id: number): Promise<boolean> {
    const [deleted] = await db
      .delete(storageLocations)
      .where(eq(storageLocations.id, id))
      .returning();
    return !!deleted;
  }

  async updateStorageLocationOrder(id: number, newOrder: number): Promise<StorageLocation | undefined> {
    const [updated] = await db
      .update(storageLocations)
      .set({ sortOrder: newOrder })
      .where(eq(storageLocations.id, id))
      .returning();
    return updated || undefined;
  }
}

// Memory Storage implementation for development and testing
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private filamentStore: Map<number, Filament>;
  private manufacturerStore: Map<number, Manufacturer>;
  private materialStore: Map<number, Material>;
  private colorStore: Map<number, Color>;
  private diameterStore: Map<number, Diameter>;
  private storageLocationStore: Map<number, StorageLocation>;

  userCurrentId: number;
  filamentCurrentId: number;
  manufacturerCurrentId: number;
  materialCurrentId: number;
  colorCurrentId: number;
  diameterCurrentId: number;
  storageLocationCurrentId: number;

  constructor() {
    this.users = new Map();
    this.filamentStore = new Map();
    this.manufacturerStore = new Map();
    this.materialStore = new Map();
    this.colorStore = new Map();
    this.diameterStore = new Map();
    this.storageLocationStore = new Map();

    this.userCurrentId = 1;
    this.filamentCurrentId = 1;
    this.manufacturerCurrentId = 1;
    this.materialCurrentId = 1;
    this.colorCurrentId = 1;
    this.diameterCurrentId = 1;
    this.storageLocationCurrentId = 1;

    // Add some initial data
    this.createFilament({
      name: "PLA Schwarz Bambu Lab",
      manufacturer: "Bambu Lab",
      material: "PLA",
      colorName: "Schwarz",
      colorCode: "#000000",
      diameter: "1.75",
      printTemp: "200-220°C",
      totalWeight: "1",
      remainingPercentage: "65"
    });

    this.createFilament({
      name: "PETG Transparent",
      manufacturer: "Prusament",
      material: "PETG",
      colorName: "Transparent",
      colorCode: "#FFFFFF",
      diameter: "1.75",
      printTemp: "230-250°C",
      totalWeight: "1",
      remainingPercentage: "15"
    });

    this.createFilament({
      name: "ABS Rot",
      manufacturer: "Filamentworld",
      material: "ABS",
      colorName: "Rot",
      colorCode: "#F44336",
      diameter: "1.75",
      printTemp: "240-260°C",
      totalWeight: "1",
      remainingPercentage: "0"
    });

    this.createFilament({
      name: "TPU Flexibel Grau",
      manufacturer: "Ninjatek",
      material: "TPU",
      colorName: "Grau",
      colorCode: "#9E9E9E",
      diameter: "1.75",
      printTemp: "210-230°C",
      totalWeight: "0.5",
      remainingPercentage: "75"
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Filament implementations
  async getFilaments(userId: number): Promise<Filament[]> {
    return Array.from(this.filamentStore.values())
      .filter(filament => filament.userId === userId);
  }

  async getPublicFilamentsWithUser(userId: number, filterFn?: (filament: Filament) => boolean): Promise<{filaments: Filament[], user: {id: number, username: string}}> {
    // Get user
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // Get filaments
    const allFilaments = await this.getFilaments(userId);

    // Apply filter if provided
    const filteredFilaments = filterFn ? allFilaments.filter(filterFn) : allFilaments;

    // Return filaments with user information
    return {
      filaments: filteredFilaments,
      user: {
        id: user.id,
        username: user.username
      }
    };
  }

  async getFilament(id: number, userId: number): Promise<Filament | undefined> {
    const filament = this.filamentStore.get(id);
    if (filament && filament.userId === userId) {
      return filament;
    }
    return undefined;
  }

  async createFilament(insertFilament: InsertFilament): Promise<Filament> {
    const id = this.filamentCurrentId++;
    const filament: Filament = { ...insertFilament, id };
    this.filamentStore.set(id, filament);
    return filament;
  }

  async updateFilament(id: number, updateFilament: Partial<InsertFilament>, userId: number): Promise<Filament | undefined> {
    const existing = this.filamentStore.get(id);
    if (!existing || existing.userId !== userId) return undefined;

    const updated: Filament = { ...existing, ...updateFilament };
    this.filamentStore.set(id, updated);
    return updated;
  }

  async deleteFilament(id: number, userId: number): Promise<boolean> {
    const filament = this.filamentStore.get(id);
    if (filament && filament.userId === userId) {
      return this.filamentStore.delete(id);
    }
    return false;
  }

  // Batch operations
  async batchDeleteFilaments(ids: number[], userId: number): Promise<number> {
    let deletedCount = 0;
    for (const id of ids) {
      const filament = this.filamentStore.get(id);
      if (filament && filament.userId === userId) {
        this.filamentStore.delete(id);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  async batchUpdateFilaments(ids: number[], updates: Partial<InsertFilament>, userId: number): Promise<number> {
    let updatedCount = 0;
    for (const id of ids) {
      const filament = this.filamentStore.get(id);
      if (filament && filament.userId === userId) {
        const updated = { ...filament, ...updates };
        this.filamentStore.set(id, updated);
        updatedCount++;
      }
    }
    return updatedCount;
  }

  // Manufacturer implementations
  async getManufacturers(): Promise<Manufacturer[]> {
    return Array.from(this.manufacturerStore.values())
      .sort((a, b) => {
        if (a.sortOrder !== null && b.sortOrder !== null) {
          return a.sortOrder - b.sortOrder;
        }
        return a.name.localeCompare(b.name);
      });
  }

  async createManufacturer(insertManufacturer: InsertManufacturer): Promise<Manufacturer> {
    const id = this.manufacturerCurrentId++;
    const manufacturer: Manufacturer = {
      ...insertManufacturer,
      id,
      createdAt: new Date(),
      sortOrder: 999 // Default to end of list
    };
    this.manufacturerStore.set(id, manufacturer);
    return manufacturer;
  }

  async deleteManufacturer(id: number): Promise<boolean> {
    return this.manufacturerStore.delete(id);
  }

  async updateManufacturerOrder(id: number, newOrder: number): Promise<Manufacturer | undefined> {
    const manufacturer = this.manufacturerStore.get(id);
    if (!manufacturer) return undefined;

    const updated = { ...manufacturer, sortOrder: newOrder };
    this.manufacturerStore.set(id, updated);
    return updated;
  }

  // Material implementations
  async getMaterials(): Promise<Material[]> {
    return Array.from(this.materialStore.values())
      .sort((a, b) => {
        if (a.sortOrder !== null && b.sortOrder !== null) {
          return a.sortOrder - b.sortOrder;
        }
        return a.name.localeCompare(b.name);
      });
  }

  async createMaterial(insertMaterial: InsertMaterial): Promise<Material> {
    const id = this.materialCurrentId++;
    const material: Material = {
      ...insertMaterial,
      id,
      createdAt: new Date(),
      sortOrder: 999 // Default to end of list
    };
    this.materialStore.set(id, material);
    return material;
  }

  async deleteMaterial(id: number): Promise<boolean> {
    return this.materialStore.delete(id);
  }

  async updateMaterialOrder(id: number, newOrder: number): Promise<Material | undefined> {
    const material = this.materialStore.get(id);
    if (!material) return undefined;

    const updated = { ...material, sortOrder: newOrder };
    this.materialStore.set(id, updated);
    return updated;
  }

  // Color implementations
  async getColors(): Promise<Color[]> {
    return Array.from(this.colorStore.values());
  }

  async createColor(insertColor: InsertColor): Promise<Color> {
    const id = this.colorCurrentId++;
    const color: Color = { ...insertColor, id, createdAt: new Date() };
    this.colorStore.set(id, color);
    return color;
  }

  async deleteColor(id: number): Promise<boolean> {
    return this.colorStore.delete(id);
  }

  // Diameter implementations
  async getDiameters(): Promise<Diameter[]> {
    return Array.from(this.diameterStore.values());
  }

  async createDiameter(insertDiameter: InsertDiameter): Promise<Diameter> {
    const id = this.diameterCurrentId++;
    const diameter: Diameter = { ...insertDiameter, id, createdAt: new Date() };
    this.diameterStore.set(id, diameter);
    return diameter;
  }

  async deleteDiameter(id: number): Promise<boolean> {
    return this.diameterStore.delete(id);
  }

  // Storage Location implementations
  async getStorageLocations(): Promise<StorageLocation[]> {
    return Array.from(this.storageLocationStore.values())
      .sort((a, b) => {
        if (a.sortOrder !== null && b.sortOrder !== null) {
          return a.sortOrder - b.sortOrder;
        }
        return a.name.localeCompare(b.name);
      });
  }

  async createStorageLocation(insertLocation: InsertStorageLocation): Promise<StorageLocation> {
    const id = this.storageLocationCurrentId++;
    const location: StorageLocation = {
      ...insertLocation,
      id,
      createdAt: new Date(),
      sortOrder: 999 // Default to end of list
    };
    this.storageLocationStore.set(id, location);
    return location;
  }

  async deleteStorageLocation(id: number): Promise<boolean> {
    return this.storageLocationStore.delete(id);
  }

  async updateStorageLocationOrder(id: number, newOrder: number): Promise<StorageLocation | undefined> {
    const location = this.storageLocationStore.get(id);
    if (!location) return undefined;

    const updated = { ...location, sortOrder: newOrder };
    this.storageLocationStore.set(id, updated);
    return updated;
  }
}

// Export database storage for production use
export const storage = new DatabaseStorage();
