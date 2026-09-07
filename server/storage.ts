import {
  filaments, type InsertFilament,
  filamentTypes, type Filament,
  manufacturers, type Manufacturer, type InsertManufacturer,
  materials, type Material, type InsertMaterial, type UpdateMaterial,
  colors, type Color, type InsertColor,
  diameters, type Diameter, type InsertDiameter,
  storageLocations, type StorageLocation, type InsertStorageLocation,
  filamentUsageLog, type FilamentUsageLog,
  customFieldDefinitions, type CustomFieldDefinition, type InsertCustomFieldDefinition,
  apiTokens, type ApiToken
} from "@shared/schema";
import {
  users, type User,
  userSharing, type UserSharing,
  catalogRequests, type CatalogRequest,
  communityFilamentCache, type CommunityFilamentCacheEntry,
  emailSettings, type EmailSettings,
  backupSettings, type BackupSettings,
  foldUsername,
  diameterValueSchema,
} from "@shared/schema";
import { db, dialect, vacuumBackup } from "@db";
import { eq, sql, and, or, inArray, desc, isNull, count } from "drizzle-orm";
import { logger } from "./utils/logger";
import { containsIgnoreCase, eqIgnoreCase, eqNumeric } from "@db/predicates";
import { catalogName, foldMaterialName } from "./utils/materials";

/** What the authentication middleware needs to authorize a request. */
export type AuthContext = {
  id: number;
  username: string;
  isAdmin: boolean | null;
  role: string;
};

/**
 * A new account. Wider than InsertUser: self-registration and the default-admin
 * bootstrap both need to set the fields that decide whether the account can log
 * in at all (role, emailVerified, the verification token).
 */
export type NewUser = {
  username: string;
  password: string;
  email?: string | null;
  role: string;
  isAdmin: boolean;
  emailVerified: boolean;
  forceChangePassword: boolean;
  emailVerificationToken?: string | null;
  emailVerificationExpires?: Date | null;
  language?: string | null;
};

/** The columns the admin user list exposes - notably not the password hash. */
export type AdminUserListEntry = {
  id: number;
  username: string;
  isAdmin: boolean | null;
  role: string;
  email: string | null;
  emailVerified: boolean | null;
  forceChangePassword: boolean | null;
  language: string | null;
  currency: string | null;
  temperatureUnit: string | null;
  createdAt: Date | null;
  lastLogin: Date | null;
};

/** What an administrator is allowed to change about another account. */
export type UserChanges = {
  username?: string;
  password?: string;
  isAdmin?: boolean;
  role?: string;
  forceChangePassword?: boolean;
};

export type EmailSettingsChanges = Partial<Omit<typeof emailSettings.$inferInsert, "id" | "updatedAt">>;
export type BackupSettingsChanges = Partial<Omit<typeof backupSettings.$inferInsert, "id" | "updatedAt">>;

export type NewCommunityFilament = typeof communityFilamentCache.$inferInsert;

export type CommunityFilamentCacheStatus = {
  count: number;
  lastUpdated: string | null;
};

/** A queued catalog request as an admin sees it: named requester, no user id. */
export type CatalogRequestForReview = {
  id: number;
  entityType: string;
  payload: unknown;
  status: string;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date | null;
  requestedBy: string | null;
};

export type CatalogRequestReview = {
  status: "approved" | "rejected";
  reviewedBy: number;
  reviewNote?: string | null;
};

/**
 * A user's theme. `radius` is a numeric column, so it is carried as a string
 * both ways - the same contract the rest of the app's numerics use.
 */
export type UserTheme = {
  variant: string | null;
  primary: string | null;
  appearance: string | null;
  radius: string | null;
};

export type ThemeChanges = {
  variant?: string;
  primary?: string;
  appearance?: string;
  radius?: string;
};

/** Per-user settings a user changes about themselves. */
export type UserPreferences = {
  language?: string;
  currency?: string;
  temperatureUnit?: string;
  lowStockThresholdPercent?: number;
  notifyLowStock?: boolean;
  notifyDryingReminder?: boolean;
  dryingReminderDays?: number;
};

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
  await ensureDeclaredMaterialResolves(userId, fields.material);

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
    diameter !== null ? eqNumeric(filamentTypes.diameter, diameter) : isNull(filamentTypes.diameter),
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

// A material row is in scope for a user when it is global (user_id NULL) or
// their own Personal Catalog entry. Written once here because getMaterials,
// getHygroscopicMaterialNames and resolveMaterial all need exactly this.
const materialInScopeFor = (userId: number) =>
  or(isNull(materials.userId), eq(materials.userId, userId));

// A declared material that resolves to no Catalog Material is registered into
// the declaring user's Personal Catalog, so from here on every declared material
// resolves to a row - the point of docs/adr/0003. This fires on every path
// through find-or-create: manual create, edit, CSV import, Spoolman import. The
// name is stored exactly as the user typed it; density and is_hygroscopic stay
// at their neutral defaults, and phase 2 makes the row visible to fill in or
// delete.
async function ensureDeclaredMaterialResolves(userId: number, declared: string): Promise<void> {
  // Stored the way the catalog matches it, so ` PETG` and `PETG ` register one
  // row rather than two that look identical in the settings list.
  const name = catalogName(declared);

  // Blank is not a material to register. The Spool form requires one, but an
  // import or a direct API call can leave it empty, and a nameless Catalog
  // Material sitting in the owner's settings list helps nobody.
  if (name === "") return;
  if (await storage.resolveMaterial(userId, name)) return;

  // Two concurrent requests declaring the same new material both resolve to
  // nothing and both insert; the partial unique index rejects the second. Let
  // it be a no-op rather than a 500 - the row exists either way afterwards.
  await db.insert(materials)
    .values({ userId, name, density: null, isHygroscopic: false })
    .onConflictDoNothing();
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
  /** Looks a user up by name the way the account namespace is defined: ignoring case. */
  getUserByUsername(username: string): Promise<User | undefined>;
  /** Just the fields the authentication middleware puts on the request. */
  getUserAuthContext(id: number): Promise<AuthContext | undefined>;
  createUser(user: NewUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByEmailVerificationToken(token: string): Promise<User | undefined>;
  getUserByPasswordResetToken(token: string): Promise<User | undefined>;
  /** Marks the address confirmed and spends the token that confirmed it. */
  markEmailVerified(userId: number): Promise<void>;
  setEmailVerificationToken(userId: number, token: string, expiresAt: Date): Promise<void>;
  setPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<void>;
  /** Completes a reset: sets the password and spends the reset token. */
  resetPassword(userId: number, hashedPassword: string): Promise<void>;
  /** Changes the password of a user who is already signed in. */
  changePassword(userId: number, hashedPassword: string): Promise<void>;
  recordLogin(userId: number): Promise<void>;

  // User administration
  listUsers(): Promise<AdminUserListEntry[]>;
  updateUser(id: number, changes: UserChanges): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;
  /** How many accounts can still administer the installation. */
  countAdmins(): Promise<number>;
  /** Writes whichever preferences were supplied; no-ops when none were. */
  updateUserPreferences(userId: number, preferences: UserPreferences): Promise<void>;
  getUserTheme(userId: number): Promise<UserTheme | undefined>;
  /** Writes whichever parts of the theme were supplied; no-ops when none were. */
  updateUserTheme(userId: number, theme: ThemeChanges): Promise<void>;

  // Scheduled notification checks
  /** Everyone who could receive a notification email. */
  getVerifiedUsers(): Promise<User[]>;
  /** Names of the catalog materials that absorb moisture, for drying reminders - global plus this user's. */
  getHygroscopicMaterialNames(userId: number): Promise<string[]>;
  markLowStockNotified(filamentIds: number[]): Promise<void>;
  markDryingReminderNotified(filamentIds: number[]): Promise<void>;

  // Catalog requests
  createCatalogRequest(userId: number, entityType: string, payload: unknown): Promise<CatalogRequest>;
  /** The review queue, newest first, with the requester's name resolved. */
  listCatalogRequests(status?: string): Promise<CatalogRequestForReview[]>;
  getCatalogRequestsByUser(userId: number): Promise<CatalogRequest[]>;
  /** Only returns a request still awaiting review, so a second review cannot land. */
  getPendingCatalogRequest(id: number): Promise<CatalogRequest | undefined>;
  reviewCatalogRequest(id: number, review: CatalogRequestReview): Promise<CatalogRequest | undefined>;

  // Community filament cache (mirrored from SpoolmanDB)
  /** Case-insensitive substring match over manufacturer, product name and colour. */
  searchCommunityFilaments(query: string, limit: number): Promise<CommunityFilamentCacheEntry[]>;
  /** Swaps the whole cache for a fresh set, atomically. */
  replaceCommunityFilaments(entries: NewCommunityFilament[]): Promise<void>;
  getCommunityFilamentCacheStatus(): Promise<CommunityFilamentCacheStatus>;

  // Email settings (a single row)
  getEmailSettings(): Promise<EmailSettings | undefined>;
  /** Writes the settings row a migration seeds; undefined if it is not there. */
  updateEmailSettings(changes: EmailSettingsChanges): Promise<EmailSettings | undefined>;

  // System & Backups
  getDialect(): "postgres" | "sqlite";
  getBackupSettings(): Promise<BackupSettings | undefined>;
  updateBackupSettings(changes: BackupSettingsChanges): Promise<BackupSettings>;
  createBackup(destinationPath: string): Promise<void>;

  // Sharing settings
  getUserSharing(userId: number): Promise<UserSharing[]>;
  /** Replaces this user's setting for a material - or their global one, when materialId is null. */
  setUserSharing(userId: number, materialId: number | null, isPublic: boolean): Promise<UserSharing>;
  /** Only the settings that actually share something. */
  getPublicUserSharing(userId: number): Promise<UserSharing[]>;

  // Filament operations
  getFilaments(userId: number): Promise<Filament[]>;
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
  /** The Global Catalog plus that user's Personal Catalog. */
  getMaterials(userId: number): Promise<Material[]>;
  /**
   * The Catalog Material a declared material names for this user, ignoring case
   * and checking the Personal Catalog before the Global one. `undefined` when it
   * resolves to nothing.
   */
  resolveMaterial(userId: number, declared: string): Promise<Material | undefined>;
  getMaterialsByIds(ids: number[]): Promise<Material[]>;
  createMaterial(material: InsertMaterial): Promise<Material>;
  deleteMaterial(id: number): Promise<boolean>;
  updateMaterialOrder(id: number, newOrder: number): Promise<Material | undefined>;
  /** Fills in the after-the-fact fields on an existing row - see UpdateMaterial. */
  updateMaterial(id: number, fields: UpdateMaterial): Promise<Material | undefined>;

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
    // Matched on the folded column rather than with eqIgnoreCase: LOWER() folds
    // only ASCII on a C-locale database, so once a username can hold diacritics
    // the database can no longer be the thing deciding what "the same name"
    // means. foldUsername is that decision, and username_folded is its result.
    const [user] = await db.select().from(users)
      .where(eq(users.usernameFolded, foldUsername(username)));
    return user || undefined;
  }

  async getUserAuthContext(id: number): Promise<AuthContext | undefined> {
    const [user] = await db.select({
      id: users.id,
      username: users.username,
      isAdmin: users.isAdmin,
      role: users.role,
    }).from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async createUser(newUser: NewUser): Promise<User> {
    // username_folded is derived here, never passed in, so no caller can create
    // a row whose folded form disagrees with its username.
    const [user] = await db
      .insert(users)
      .values({ ...newUser, usernameFolded: foldUsername(newUser.username) })
      .returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users)
      .where(eqIgnoreCase(users.email, email));
    return user || undefined;
  }

  async getUserByEmailVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users)
      .where(eq(users.emailVerificationToken, token));
    return user || undefined;
  }

  async getUserByPasswordResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users)
      .where(eq(users.passwordResetToken, token));
    return user || undefined;
  }

  async markEmailVerified(userId: number): Promise<void> {
    await db.update(users)
      .set({ emailVerified: true, emailVerificationToken: null, emailVerificationExpires: null })
      .where(eq(users.id, userId));
  }

  async setEmailVerificationToken(userId: number, token: string, expiresAt: Date): Promise<void> {
    await db.update(users)
      .set({ emailVerificationToken: token, emailVerificationExpires: expiresAt })
      .where(eq(users.id, userId));
  }

  async setPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<void> {
    await db.update(users)
      .set({ passwordResetToken: token, passwordResetExpires: expiresAt })
      .where(eq(users.id, userId));
  }

  async resetPassword(userId: number, hashedPassword: string): Promise<void> {
    await db.update(users)
      .set({
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        forceChangePassword: false,
      })
      .where(eq(users.id, userId));
  }

  // Unlike resetPassword this leaves any pending reset token alone, which is
  // the behaviour the change-password endpoint has always had.
  async changePassword(userId: number, hashedPassword: string): Promise<void> {
    await db.update(users)
      .set({ password: hashedPassword, forceChangePassword: false })
      .where(eq(users.id, userId));
  }

  async recordLogin(userId: number): Promise<void> {
    await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, userId));
  }

  async listUsers(): Promise<AdminUserListEntry[]> {
    return await db.select({
      id: users.id,
      username: users.username,
      isAdmin: users.isAdmin,
      role: users.role,
      email: users.email,
      emailVerified: users.emailVerified,
      forceChangePassword: users.forceChangePassword,
      language: users.language,
      currency: users.currency,
      temperatureUnit: users.temperatureUnit,
      createdAt: users.createdAt,
      lastLogin: users.lastLogin,
    }).from(users);
  }

  async updateUser(id: number, changes: UserChanges): Promise<User | undefined> {
    if (Object.keys(changes).length === 0) {
      return await this.getUser(id);
    }

    // A rename has to carry the folded form with it, or the account keeps
    // answering to its old name and the unique index guards the wrong value.
    const columns = changes.username === undefined
      ? changes
      : { ...changes, usernameFolded: foldUsername(changes.username) };

    const [updated] = await db.update(users).set(columns).where(eq(users.id, id)).returning();
    return updated || undefined;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async countAdmins(): Promise<number> {
    const [{ count: admins }] = await db.select({ count: count() }).from(users)
      .where(eq(users.role, "admin"));
    return admins;
  }

  async updateUserPreferences(userId: number, preferences: UserPreferences): Promise<void> {
    if (Object.keys(preferences).length === 0) {
      return;
    }

    await db.update(users).set(preferences).where(eq(users.id, userId));
  }

  async getVerifiedUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.emailVerified, true));
  }

  async getHygroscopicMaterialNames(userId: number): Promise<string[]> {
    // Not filtered on is_hygroscopic in SQL: a Personal Catalog row and a Global
    // one may hold the same name (the two partial unique indexes are disjoint),
    // and this has to apply the same Personal-before-Global precedence
    // resolveMaterial does. Filtering first would let the Global row's flag
    // decide for a name the user's own row owns - so the user unchecks
    // "hygroscopic" on their own row, keeps getting reminders, and nothing in
    // the UI explains why.
    const rows = await db.select({
      name: materials.name,
      userId: materials.userId,
      isHygroscopic: materials.isHygroscopic,
    }).from(materials).where(materialInScopeFor(userId));

    const winners = new Map<string, { name: string; isHygroscopic: boolean | null }>();
    for (const row of rows) {
      const key = foldMaterialName(row.name);
      if (row.userId !== null || !winners.has(key)) winners.set(key, row);
    }

    return [...winners.values()].filter((row) => row.isHygroscopic).map((row) => row.name);
  }

  async markLowStockNotified(filamentIds: number[]): Promise<void> {
    if (filamentIds.length === 0) return;
    await db.update(filaments)
      .set({ lowStockNotifiedAt: new Date() })
      .where(inArray(filaments.id, filamentIds));
  }

  async markDryingReminderNotified(filamentIds: number[]): Promise<void> {
    if (filamentIds.length === 0) return;
    await db.update(filaments)
      .set({ dryingReminderNotifiedAt: new Date() })
      .where(inArray(filaments.id, filamentIds));
  }

  async createCatalogRequest(userId: number, entityType: string, payload: unknown): Promise<CatalogRequest> {
    const [created] = await db.insert(catalogRequests)
      .values({ userId, entityType, payload })
      .returning();
    return created;
  }

  async listCatalogRequests(status?: string): Promise<CatalogRequestForReview[]> {
    return await db
      .select({
        id: catalogRequests.id,
        entityType: catalogRequests.entityType,
        payload: catalogRequests.payload,
        status: catalogRequests.status,
        reviewNote: catalogRequests.reviewNote,
        reviewedAt: catalogRequests.reviewedAt,
        createdAt: catalogRequests.createdAt,
        requestedBy: users.username,
      })
      .from(catalogRequests)
      .leftJoin(users, eq(catalogRequests.userId, users.id))
      .where(status ? eq(catalogRequests.status, status) : undefined)
      // Two requests submitted in the same millisecond - the SQLite default
      // is millisecond epoch - tie on createdAt, and a tie leaves the order to
      // the engine. The id was handed out in insertion order, so it settles it.
      .orderBy(desc(catalogRequests.createdAt), desc(catalogRequests.id));
  }

  async getCatalogRequestsByUser(userId: number): Promise<CatalogRequest[]> {
    return await db.select().from(catalogRequests)
      .where(eq(catalogRequests.userId, userId))
      .orderBy(desc(catalogRequests.createdAt), desc(catalogRequests.id));
  }

  async getPendingCatalogRequest(id: number): Promise<CatalogRequest | undefined> {
    const [request] = await db.select().from(catalogRequests)
      .where(and(eq(catalogRequests.id, id), eq(catalogRequests.status, "pending")));
    return request || undefined;
  }

  async reviewCatalogRequest(id: number, review: CatalogRequestReview): Promise<CatalogRequest | undefined> {
    const [updated] = await db.update(catalogRequests)
      .set({ ...review, reviewedAt: new Date() })
      .where(eq(catalogRequests.id, id))
      .returning();
    return updated || undefined;
  }

  async searchCommunityFilaments(query: string, limit: number): Promise<CommunityFilamentCacheEntry[]> {
    return await db.select().from(communityFilamentCache)
      .where(or(
        containsIgnoreCase(communityFilamentCache.manufacturer, query),
        containsIgnoreCase(communityFilamentCache.name, query),
        containsIgnoreCase(communityFilamentCache.colorName, query),
      ))
      .limit(limit);
  }

  async replaceCommunityFilaments(entries: NewCommunityFilament[]): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(communityFilamentCache);
      if (entries.length > 0) {
        // Insert in chunks to stay well under typical parameter-count limits
        const CHUNK_SIZE = 500;
        for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
          await tx.insert(communityFilamentCache).values(entries.slice(i, i + CHUNK_SIZE));
        }
      }
    });
  }

  async getCommunityFilamentCacheStatus(): Promise<CommunityFilamentCacheStatus> {
    const [row] = await db.select({
      count: sql<number>`count(*)`,
      lastUpdated: sql<string | number | null>`max(${communityFilamentCache.updatedAt})`,
    }).from(communityFilamentCache);
    let lastUpdated: string | null = null;
    if (typeof row?.lastUpdated === "number") {
      lastUpdated = new Date(row.lastUpdated).toISOString().replace("T", " ").slice(0, 19);
    } else if (typeof row?.lastUpdated === "string") {
      lastUpdated = row.lastUpdated;
    }
    return { count: Number(row?.count ?? 0), lastUpdated };
  }

  async getEmailSettings(): Promise<EmailSettings | undefined> {
    const [settings] = await db.select().from(emailSettings).where(eq(emailSettings.id, 1));
    return settings || undefined;
  }

  async updateEmailSettings(changes: EmailSettingsChanges): Promise<EmailSettings | undefined> {
    const [updated] = await db.update(emailSettings)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(emailSettings.id, 1))
      .returning();
    return updated || undefined;
  }

  getDialect(): "postgres" | "sqlite" {
    return dialect;
  }

  async getBackupSettings(): Promise<BackupSettings | undefined> {
    const [settings] = await db.select().from(backupSettings).where(eq(backupSettings.id, 1));
    return settings || undefined;
  }

  async updateBackupSettings(changes: BackupSettingsChanges): Promise<BackupSettings> {
    const existing = await this.getBackupSettings();
    if (!existing) {
      const [inserted] = await db.insert(backupSettings)
        .values({ id: 1, ...changes, updatedAt: new Date() })
        .returning();
      return inserted;
    }
    const [updated] = await db.update(backupSettings)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(backupSettings.id, 1))
      .returning();
    return updated;
  }

  async createBackup(destinationPath: string): Promise<void> {
    await vacuumBackup(destinationPath);
  }

  async getUserTheme(userId: number): Promise<UserTheme | undefined> {
    const [theme] = await db.select({
      variant: users.themeVariant,
      primary: users.themePrimary,
      appearance: users.themeAppearance,
      radius: users.themeRadius,
    }).from(users).where(eq(users.id, userId));
    return theme || undefined;
  }

  async updateUserTheme(userId: number, theme: ThemeChanges): Promise<void> {
    const columns: Partial<typeof users.$inferInsert> = {};
    if (theme.variant !== undefined) columns.themeVariant = theme.variant;
    if (theme.primary !== undefined) columns.themePrimary = theme.primary;
    if (theme.appearance !== undefined) columns.themeAppearance = theme.appearance;
    if (theme.radius !== undefined) columns.themeRadius = theme.radius;

    if (Object.keys(columns).length === 0) {
      return;
    }

    await db.update(users).set(columns).where(eq(users.id, userId));
  }

  async getUserSharing(userId: number): Promise<UserSharing[]> {
    return await db.select().from(userSharing).where(eq(userSharing.userId, userId));
  }

  async setUserSharing(userId: number, materialId: number | null, isPublic: boolean): Promise<UserSharing> {
    // A global setting has a NULL material_id, and `material_id = NULL` is never
    // true, so clearing it needs IS NULL.
    //
    // There may be more than one row to clear. Nothing stops duplicates at the
    // schema level, and every release before the one that fixed it left one
    // behind on each toggle - so an upgraded database arrives with several.
    // getPublicUserSharing takes any row with is_public, so a stale `true` would
    // keep a collection public after it was set to private. Deleting every
    // matching row before inserting the replacement collapses them.
    await db.delete(userSharing).where(and(
      eq(userSharing.userId, userId),
      materialId === null ? isNull(userSharing.materialId) : eq(userSharing.materialId, materialId),
    ));

    const [created] = await db.insert(userSharing)
      .values({ userId, materialId, isPublic })
      .returning();
    return created;
  }

  async getPublicUserSharing(userId: number): Promise<UserSharing[]> {
    return await db.select().from(userSharing)
      .where(and(eq(userSharing.userId, userId), eq(userSharing.isPublic, true)));
  }

  // Filament implementations
  async getFilaments(userId: number): Promise<Filament[]> {
    return await db.select(FILAMENT_SELECT_COLUMNS).from(filaments)
      .innerJoin(filamentTypes, eq(filaments.filamentTypeId, filamentTypes.id))
      .where(eq(filaments.userId, userId));
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
    // Only values a caller actually supplied are checked - a legacy row holding
    // "1.75mm" from before this rule existed stays editable.
    if (diameter != null) diameterValueSchema.parse(diameter);

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
      if (diameter != null) diameterValueSchema.parse(diameter);
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
  async getMaterialsByIds(ids: number[]): Promise<Material[]> {
    if (ids.length === 0) {
      return [];
    }
    return await db.select().from(materials).where(inArray(materials.id, ids));
  }

  async getMaterials(userId: number): Promise<Material[]> {
    return await db.select().from(materials)
      .where(materialInScopeFor(userId))
      // The Global Catalog first, in the order an admin arranged it, then the
      // user's own entries by name. Both default to sort_order 999, so without
      // the first key an auto-registered personal row would land among the
      // curated ones.
      .orderBy(sql`${materials.userId} IS NOT NULL`, materials.sortOrder, materials.name);
  }

  async resolveMaterial(userId: number, declared: string): Promise<Material | undefined> {
    // Matched on the folded name in JS rather than with eqIgnoreCase, for the
    // reason getUserByUsername matches on username_folded: SQLite's LOWER()
    // folds ASCII only, so leaving this to the database makes `Äbs` resolve to
    // `äbs` on Postgres and to nothing on SQLite. See foldMaterialName.
    //
    // The set is small by construction - the Global Catalog plus this user's own
    // entries - and getHygroscopicMaterialNames already reads it whole for the
    // same reason.
    const target = foldMaterialName(declared);
    const rows = await db.select().from(materials)
      .where(materialInScopeFor(userId))
      // The user's own Personal Catalog row wins when a Global one also matches.
      .orderBy(sql`${materials.userId} IS NULL`);
    return rows.find((row) => foldMaterialName(row.name) === target);
  }

  async createMaterial(insertMaterial: InsertMaterial): Promise<Material> {
    const [material] = await db
      .insert(materials)
      // Stored the way the catalog matches it, the same as an auto-registered
      // row. A Global Catalog row named " PETG" would be one nothing resolves
      // to: resolveMaterial compares against the trimmed declared material.
      // This is the seam every create goes through - the Add form, CSV import
      // and Catalog Request approval alike.
      .values({ ...insertMaterial, name: catalogName(insertMaterial.name) })
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

  async updateMaterial(id: number, fields: UpdateMaterial): Promise<Material | undefined> {
    const [updated] = await db
      .update(materials)
      .set(fields)
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

// Export database storage for production use
export const storage = new DatabaseStorage();
