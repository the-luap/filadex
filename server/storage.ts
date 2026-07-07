import {
  filaments, type InsertFilament,
  filamentTypes, type Filament,
  manufacturers, type Manufacturer, type InsertManufacturer,
  materials, type Material, type InsertMaterial,
  colors, type Color, type InsertColor,
  diameters, type Diameter, type InsertDiameter,
  storageLocations, type StorageLocation, type InsertStorageLocation,
  filamentUsageLog, type FilamentUsageLog,
  customFieldDefinitions, type CustomFieldDefinition, type InsertCustomFieldDefinition,
  apiTokens, type ApiToken
} from "@shared/schema";
import { users, type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq, sql, and, inArray, desc, isNull } from "drizzle-orm";
import { logger } from "./utils/logger";

export interface InsertFilamentUsageLog {
  filamentId: number;
  userId: number;
  deltaWeight: string;
  remainingPercentageAfter: string;
  note?: string;
  source?: string;
}

type FilamentTypeFieldsInput = {
  manufacturer?: string | null;
  material: string;
  colorName: string;
  colorCode?: string | null;
  diameter?: string | null;
  printTemp?: string | null;
};

// Finds an existing filamentTypes row matching all product-identity fields
// exactly (nulls included), or creates one. This is the whole "dedup" payoff
// of the filament-type/spool-instance split: identical spools bought again
// reuse the same type row instead of duplicating manufacturer/material/etc.
async function findOrCreateFilamentType(userId: number, fields: FilamentTypeFieldsInput): Promise<number> {
  const manufacturer = fields.manufacturer ?? null;
  const colorCode = fields.colorCode ?? null;
  const diameter = fields.diameter ?? null;
  const printTemp = fields.printTemp ?? null;

  const conditions = [
    eq(filamentTypes.userId, userId),
    eq(filamentTypes.material, fields.material),
    eq(filamentTypes.colorName, fields.colorName),
    manufacturer !== null ? eq(filamentTypes.manufacturer, manufacturer) : isNull(filamentTypes.manufacturer),
    colorCode !== null ? eq(filamentTypes.colorCode, colorCode) : isNull(filamentTypes.colorCode),
    diameter !== null ? eq(filamentTypes.diameter, diameter) : isNull(filamentTypes.diameter),
    printTemp !== null ? eq(filamentTypes.printTemp, printTemp) : isNull(filamentTypes.printTemp),
  ];

  const [existing] = await db.select().from(filamentTypes).where(and(...conditions));
  if (existing) return existing.id;

  const [created] = await db.insert(filamentTypes).values({
    userId,
    manufacturer,
    material: fields.material,
    colorName: fields.colorName,
    colorCode,
    diameter,
    printTemp,
  }).returning();
  return created.id;
}

// Selection shape shared by every filament read - the spool instance's own
// columns plus its filament type's product-identity columns, flattened into
// the API-facing `Filament` shape.
const FILAMENT_SELECT_COLUMNS = {
  id: filaments.id,
  userId: filaments.userId,
  filamentTypeId: filaments.filamentTypeId,
  name: filaments.name,
  totalWeight: filaments.totalWeight,
  remainingPercentage: filaments.remainingPercentage,
  purchaseDate: filaments.purchaseDate,
  purchasePrice: filaments.purchasePrice,
  status: filaments.status,
  spoolType: filaments.spoolType,
  dryerCount: filaments.dryerCount,
  lastDryingDate: filaments.lastDryingDate,
  storageLocation: filaments.storageLocation,
  lowStockNotifiedAt: filaments.lowStockNotifiedAt,
  dryingReminderNotifiedAt: filaments.dryingReminderNotifiedAt,
  customFieldValues: filaments.customFieldValues,
  manufacturer: filamentTypes.manufacturer,
  material: filamentTypes.material,
  colorName: filamentTypes.colorName,
  colorCode: filamentTypes.colorCode,
  diameter: filamentTypes.diameter,
  printTemp: filamentTypes.printTemp,
};

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

  // Filament usage log
  getFilamentUsageLog(filamentId: number, userId: number): Promise<FilamentUsageLog[]>;
  createFilamentUsageLog(entry: InsertFilamentUsageLog): Promise<FilamentUsageLog>;

  // Custom field definitions
  getCustomFieldDefinitions(userId: number): Promise<CustomFieldDefinition[]>;
  createCustomFieldDefinition(userId: number, definition: InsertCustomFieldDefinition): Promise<CustomFieldDefinition>;
  deleteCustomFieldDefinition(id: number, userId: number): Promise<boolean>;

  // API tokens
  getApiTokens(userId: number): Promise<ApiToken[]>;
  createApiToken(userId: number, tokenHash: string, label: string | undefined): Promise<ApiToken>;
  deleteApiToken(id: number, userId: number): Promise<boolean>;
  getUserIdByTokenHash(tokenHash: string): Promise<number | undefined>;
  touchApiTokenLastUsed(id: number): Promise<void>;

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
    return await db.select(FILAMENT_SELECT_COLUMNS).from(filaments)
      .innerJoin(filamentTypes, eq(filaments.filamentTypeId, filamentTypes.id))
      .where(eq(filaments.userId, userId));
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

    logger.debug(`Getting public filaments for user: ${user.username} (ID: ${userId})`);

    // Get filaments
    const allFilaments = await this.getFilaments(userId);

    // Apply filter if provided
    const filteredFilaments = filterFn ? allFilaments.filter(filterFn) : allFilaments;

    logger.debug(`Found ${filteredFilaments.length} public filaments for user ${user.username}`);

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
    try {
      const [filament] = await db.select(FILAMENT_SELECT_COLUMNS).from(filaments)
        .innerJoin(filamentTypes, eq(filaments.filamentTypeId, filamentTypes.id))
        .where(and(eq(filaments.id, id), eq(filaments.userId, userId)));

      return filament || undefined;
    } catch (err) {
      logger.error(`Error in getFilament:`, err);
      throw err;
    }
  }

  async createFilament(insertFilament: InsertFilament): Promise<Filament> {
    const { manufacturer, material, colorName, colorCode, diameter, printTemp, ...spoolFields } = insertFilament;
    if (spoolFields.userId == null) {
      throw new Error("createFilament requires a userId");
    }

    const filamentTypeId = await findOrCreateFilamentType(spoolFields.userId, {
      manufacturer, material, colorName, colorCode, diameter, printTemp,
    });
    const [created] = await db.insert(filaments).values({ ...spoolFields, filamentTypeId }).returning();

    const result = await this.getFilament(created.id, spoolFields.userId);
    if (!result) throw new Error("Failed to load newly created filament");
    return result;
  }

  async updateFilament(id: number, updateFilament: Partial<InsertFilament>, userId: number): Promise<Filament | undefined> {
    try {
      const existing = await this.getFilament(id, userId);
      if (!existing) return undefined;

      const { manufacturer, material, colorName, colorCode, diameter, printTemp, ...spoolFields } = updateFilament;
      const typeFieldsChanged = [manufacturer, material, colorName, colorCode, diameter, printTemp]
        .some((value) => value !== undefined);

      const dbUpdate: Partial<typeof filaments.$inferInsert> = { ...spoolFields };
      if (typeFieldsChanged) {
        dbUpdate.filamentTypeId = await findOrCreateFilamentType(userId, {
          manufacturer: manufacturer !== undefined ? manufacturer : existing.manufacturer,
          material: material !== undefined ? material : existing.material,
          colorName: colorName !== undefined ? colorName : existing.colorName,
          colorCode: colorCode !== undefined ? colorCode : existing.colorCode,
          diameter: diameter !== undefined ? diameter : existing.diameter,
          printTemp: printTemp !== undefined ? printTemp : existing.printTemp,
        });
      }

      const [updated] = await db
        .update(filaments)
        .set(dbUpdate)
        .where(and(eq(filaments.id, id), eq(filaments.userId, userId)))
        .returning();

      if (!updated) return undefined;
      return await this.getFilament(id, userId);
    } catch (err) {
      logger.error(`Error in updateFilament:`, err);
      throw err;
    }
  }

  async deleteFilament(id: number, userId: number): Promise<boolean> {
    const [deleted] = await db
      .delete(filaments)
      .where(and(eq(filaments.id, id), eq(filaments.userId, userId)))
      .returning();
    return !!deleted;
  }

  // Batch operations
  async batchDeleteFilaments(ids: number[], userId: number): Promise<number> {
    // Convert all IDs to numbers to ensure they're valid
    const validIds = ids.map(id => Number(id));

    // Use the in operator from drizzle instead of raw SQL
    const deleted = await db
      .delete(filaments)
      .where(
        and(
          inArray(filaments.id, validIds),
          eq(filaments.userId, userId)
        )
      )
      .returning();

    logger.info(`Batch deleted ${deleted.length} filaments with IDs:`, validIds);
    return deleted.length;
  }

  async batchUpdateFilaments(ids: number[], updates: Partial<InsertFilament>, userId: number): Promise<number> {
    // Convert all IDs to numbers to ensure they're valid
    const validIds = ids.map(id => Number(id));

    // Applied one at a time (not a single bulk UPDATE): each filament may
    // need its own filamentType resolved/created if the update touches a
    // product-identity field (manufacturer/material/colorName/etc.) - see
    // updateFilament's find-or-create logic.
    let updatedCount = 0;
    for (const id of validIds) {
      const updated = await this.updateFilament(id, updates, userId);
      if (updated) updatedCount++;
    }

    logger.info(`Batch updated ${updatedCount} filaments with IDs:`, validIds);
    return updatedCount;
  }

  // Filament usage log implementations
  async getFilamentUsageLog(filamentId: number, userId: number): Promise<FilamentUsageLog[]> {
    return await db.select().from(filamentUsageLog)
      .where(and(eq(filamentUsageLog.filamentId, filamentId), eq(filamentUsageLog.userId, userId)))
      .orderBy(desc(filamentUsageLog.createdAt));
  }

  async createFilamentUsageLog(entry: InsertFilamentUsageLog): Promise<FilamentUsageLog> {
    const [log] = await db
      .insert(filamentUsageLog)
      .values(entry)
      .returning();
    return log;
  }

  // Custom field definition implementations
  async getCustomFieldDefinitions(userId: number): Promise<CustomFieldDefinition[]> {
    return await db.select().from(customFieldDefinitions).where(eq(customFieldDefinitions.userId, userId));
  }

  async createCustomFieldDefinition(userId: number, definition: InsertCustomFieldDefinition): Promise<CustomFieldDefinition> {
    const [created] = await db
      .insert(customFieldDefinitions)
      .values({ ...definition, userId })
      .returning();
    return created;
  }

  async deleteCustomFieldDefinition(id: number, userId: number): Promise<boolean> {
    const [deleted] = await db
      .delete(customFieldDefinitions)
      .where(and(eq(customFieldDefinitions.id, id), eq(customFieldDefinitions.userId, userId)))
      .returning();
    return !!deleted;
  }

  // API token implementations
  async getApiTokens(userId: number): Promise<ApiToken[]> {
    return await db.select().from(apiTokens).where(eq(apiTokens.userId, userId));
  }

  async createApiToken(userId: number, tokenHash: string, label: string | undefined): Promise<ApiToken> {
    const [created] = await db.insert(apiTokens).values({ userId, tokenHash, label }).returning();
    return created;
  }

  async deleteApiToken(id: number, userId: number): Promise<boolean> {
    const [deleted] = await db
      .delete(apiTokens)
      .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)))
      .returning();
    return !!deleted;
  }

  async getUserIdByTokenHash(tokenHash: string): Promise<number | undefined> {
    const [row] = await db.select({ userId: apiTokens.userId, id: apiTokens.id }).from(apiTokens)
      .where(eq(apiTokens.tokenHash, tokenHash));
    if (row) {
      await this.touchApiTokenLastUsed(row.id);
    }
    return row?.userId;
  }

  async touchApiTokenLastUsed(id: number): Promise<void> {
    await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, id));
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
  private usageLogStore: Map<number, FilamentUsageLog>;
  private customFieldDefinitionStore: Map<number, CustomFieldDefinition>;
  private apiTokenStore: Map<number, ApiToken>;

  userCurrentId: number;
  filamentCurrentId: number;
  manufacturerCurrentId: number;
  materialCurrentId: number;
  colorCurrentId: number;
  diameterCurrentId: number;
  storageLocationCurrentId: number;
  usageLogCurrentId: number;
  customFieldDefinitionCurrentId: number;
  apiTokenCurrentId: number;

  constructor() {
    this.users = new Map();
    this.filamentStore = new Map();
    this.manufacturerStore = new Map();
    this.materialStore = new Map();
    this.colorStore = new Map();
    this.diameterStore = new Map();
    this.storageLocationStore = new Map();
    this.usageLogStore = new Map();
    this.customFieldDefinitionStore = new Map();
    this.apiTokenStore = new Map();

    this.userCurrentId = 1;
    this.filamentCurrentId = 1;
    this.manufacturerCurrentId = 1;
    this.materialCurrentId = 1;
    this.colorCurrentId = 1;
    this.diameterCurrentId = 1;
    this.storageLocationCurrentId = 1;
    this.usageLogCurrentId = 1;
    this.customFieldDefinitionCurrentId = 1;
    this.apiTokenCurrentId = 1;

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
    const user: User = {
      id,
      username: insertUser.username,
      password: insertUser.password,
      isAdmin: insertUser.isAdmin ?? false,
      role: "user",
      email: null,
      emailVerified: false,
      emailVerificationToken: null,
      emailVerificationExpires: null,
      passwordResetToken: null,
      passwordResetExpires: null,
      forceChangePassword: insertUser.forceChangePassword ?? true,
      language: insertUser.language ?? "en",
      currency: insertUser.currency ?? "EUR",
      temperatureUnit: insertUser.temperatureUnit ?? "C",
      lastLogin: null,
      createdAt: new Date(),
      lowStockThresholdPercent: 15,
      notifyLowStock: true,
      notifyDryingReminder: true,
      dryingReminderDays: 30,
    };
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
    // MemStorage keeps the flattened shape directly (no separate type-store
    // normalization needed for this in-memory dev stub); filamentTypeId is a
    // synthetic id just to satisfy the Filament shape.
    const filament: Filament = {
      id,
      filamentTypeId: id,
      userId: insertFilament.userId ?? null,
      name: insertFilament.name,
      totalWeight: insertFilament.totalWeight,
      remainingPercentage: insertFilament.remainingPercentage,
      purchaseDate: insertFilament.purchaseDate ?? null,
      purchasePrice: insertFilament.purchasePrice ?? null,
      status: insertFilament.status ?? null,
      spoolType: insertFilament.spoolType ?? null,
      dryerCount: insertFilament.dryerCount ?? 0,
      lastDryingDate: insertFilament.lastDryingDate ?? null,
      storageLocation: insertFilament.storageLocation ?? null,
      lowStockNotifiedAt: insertFilament.lowStockNotifiedAt ?? null,
      dryingReminderNotifiedAt: insertFilament.dryingReminderNotifiedAt ?? null,
      customFieldValues: insertFilament.customFieldValues ?? {},
      manufacturer: insertFilament.manufacturer ?? null,
      material: insertFilament.material,
      colorName: insertFilament.colorName,
      colorCode: insertFilament.colorCode ?? null,
      diameter: insertFilament.diameter ?? null,
      printTemp: insertFilament.printTemp ?? null,
    };
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

  // Filament usage log implementations
  async getFilamentUsageLog(filamentId: number, userId: number): Promise<FilamentUsageLog[]> {
    return Array.from(this.usageLogStore.values())
      .filter(log => log.filamentId === filamentId && log.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }

  async createFilamentUsageLog(entry: InsertFilamentUsageLog): Promise<FilamentUsageLog> {
    const id = this.usageLogCurrentId++;
    const log: FilamentUsageLog = {
      id,
      filamentId: entry.filamentId,
      userId: entry.userId,
      deltaWeight: entry.deltaWeight,
      remainingPercentageAfter: entry.remainingPercentageAfter,
      note: entry.note ?? null,
      source: entry.source ?? "manual",
      createdAt: new Date(),
    };
    this.usageLogStore.set(id, log);
    return log;
  }

  // Custom field definition implementations
  async getCustomFieldDefinitions(userId: number): Promise<CustomFieldDefinition[]> {
    return Array.from(this.customFieldDefinitionStore.values()).filter((d) => d.userId === userId);
  }

  async createCustomFieldDefinition(userId: number, definition: InsertCustomFieldDefinition): Promise<CustomFieldDefinition> {
    const id = this.customFieldDefinitionCurrentId++;
    const created: CustomFieldDefinition = {
      id,
      userId,
      entityType: definition.entityType ?? "filament",
      name: definition.name,
      fieldType: definition.fieldType,
      createdAt: new Date(),
    };
    this.customFieldDefinitionStore.set(id, created);
    return created;
  }

  async deleteCustomFieldDefinition(id: number, userId: number): Promise<boolean> {
    const definition = this.customFieldDefinitionStore.get(id);
    if (definition && definition.userId === userId) {
      return this.customFieldDefinitionStore.delete(id);
    }
    return false;
  }

  // API token implementations
  async getApiTokens(userId: number): Promise<ApiToken[]> {
    return Array.from(this.apiTokenStore.values()).filter((t) => t.userId === userId);
  }

  async createApiToken(userId: number, tokenHash: string, label: string | undefined): Promise<ApiToken> {
    const id = this.apiTokenCurrentId++;
    const token: ApiToken = {
      id,
      userId,
      tokenHash,
      label: label ?? null,
      createdAt: new Date(),
      lastUsedAt: null,
    };
    this.apiTokenStore.set(id, token);
    return token;
  }

  async deleteApiToken(id: number, userId: number): Promise<boolean> {
    const token = this.apiTokenStore.get(id);
    if (token && token.userId === userId) {
      return this.apiTokenStore.delete(id);
    }
    return false;
  }

  async getUserIdByTokenHash(tokenHash: string): Promise<number | undefined> {
    const token = Array.from(this.apiTokenStore.values()).find((t) => t.tokenHash === tokenHash);
    if (token) {
      await this.touchApiTokenLastUsed(token.id);
    }
    return token?.userId;
  }

  async touchApiTokenLastUsed(id: number): Promise<void> {
    const token = this.apiTokenStore.get(id);
    if (token) {
      this.apiTokenStore.set(id, { ...token, lastUsedAt: new Date() });
    }
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
      density: insertMaterial.density ?? null,
      isHygroscopic: insertMaterial.isHygroscopic ?? false,
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
