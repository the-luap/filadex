import { pgTable, text, serial, integer, boolean, numeric, date, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false),
  // Source of truth for authorization; isAdmin above is kept as a mirror
  // (role === 'admin') so existing code reading isAdmin keeps working.
  role: text("role").notNull().default("user"), // 'admin' | 'user'
  email: text("email").unique(),
  emailVerified: boolean("email_verified").default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpires: timestamp("email_verification_expires"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  forceChangePassword: boolean("force_change_password").default(true),
  language: text("language").default("en"),
  currency: text("currency").default("EUR"),
  temperatureUnit: text("temperature_unit").default("C"),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  // Low-stock / drying-reminder email alert preferences (per-user, not global)
  lowStockThresholdPercent: integer("low_stock_threshold_percent").default(15),
  notifyLowStock: boolean("notify_low_stock").default(true),
  notifyDryingReminder: boolean("notify_drying_reminder").default(true),
  dryingReminderDays: integer("drying_reminder_days").default(30),
  // Per-user UI theme (previously a single global theme.json file shared by
  // every user - see migrations/add_user_theme_preferences.ts)
  themeVariant: text("theme_variant").default("professional"),
  themePrimary: text("theme_primary").default("#EA580C"),
  themeAppearance: text("theme_appearance").default("dark"), // 'light' | 'dark'
  themeRadius: numeric("theme_radius").default("0.8"),
});

// A filament product (vendor, material, color, diameter, print temp) defined
// once; filaments (below) become spool instances referencing one of these,
// so buying 5 identical spools no longer means re-entering the same
// manufacturer/material/color/diameter 5 times. See IMPLEMENTATION_PLAN.md #9.
export const filamentTypes = pgTable("filament_types", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  manufacturer: text("manufacturer"),
  material: text("material").notNull(),
  colorName: text("color_name").notNull(),
  colorCode: text("color_code"),
  diameter: numeric("diameter"),
  printTemp: text("print_temp"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type FilamentType = typeof filamentTypes.$inferSelect;

// The spool instance table. Product-identity fields (manufacturer, material,
// colorName, colorCode, diameter, printTemp) live on filamentTypes instead -
// server/storage.ts joins them back in so every route/component keeps
// working against the same flattened shape (see the `Filament` type below).
export const filaments = pgTable("filaments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  filamentTypeId: integer("filament_type_id").notNull().references(() => filamentTypes.id),
  name: text("name").notNull(),
  totalWeight: numeric("total_weight").notNull(),
  remainingPercentage: numeric("remaining_percentage").notNull(),
  purchaseDate: date("purchase_date"),
  purchasePrice: numeric("purchase_price"), // Kaufpreis in EUR
  status: text("status"),  // 'sealed', 'opened'
  spoolType: text("spool_type"), // 'spooled', 'spoolless'
  dryerCount: integer("dryer_count").default(0), // Anzahl der Trocknungen
  lastDryingDate: date("last_drying_date"), // Datum der letzten Trocknung
  storageLocation: text("storage_location"), // Lagerort
  // Set when a low-stock email is sent, cleared once remaining % rises back
  // above the threshold - prevents re-notifying every scheduled check.
  lowStockNotifiedAt: timestamp("low_stock_notified_at"),
  // Set when a drying-reminder email is sent; throttles reminders to at most
  // once/day rather than every scheduled check, until lastDryingDate changes.
  dryingReminderNotifiedAt: timestamp("drying_reminder_notified_at"),
  // Values for this user's customFieldDefinitions, keyed by definition id (as a string)
  customFieldValues: jsonb("custom_field_values").$type<Record<string, any>>().default({}),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  isAdmin: true,
  forceChangePassword: true,
  language: true,
  currency: true,
  temperatureUnit: true,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export const updateThemeSchema = z.object({
  variant: z.string().min(1).optional(),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #EA580C").optional(),
  appearance: z.enum(["light", "dark"]).optional(),
  radius: z.number().min(0).max(2).optional(),
});

export type UpdateTheme = z.infer<typeof updateThemeSchema>;

// 3-30 chars, letters/numbers/underscore/hyphen only - shared between the
// registration schema and the /api/auth/check-username validation.
export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(/^[a-zA-Z0-9_-]+$/, "Username may only contain letters, numbers, underscores, and hyphens");

export const registerSchema = z.object({
  username: usernameSchema,
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const resendVerificationSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// The flattened API-facing shape: a spool instance (filaments row) joined
// with its filament type. This is what every route/component reads and
// writes; storage.ts's find-or-create logic handles translating to/from the
// normalized filamentTypeId model underneath.
type FilamentTypeSelectFields = {
  manufacturer: string | null;
  material: string;
  colorName: string;
  colorCode: string | null;
  diameter: string | null;
  printTemp: string | null;
};

type FilamentTypeInsertFields = {
  manufacturer?: string | null;
  material: string;
  colorName: string;
  colorCode?: string | null;
  diameter?: string | null;
  printTemp?: string | null;
};

export type Filament = Omit<typeof filaments.$inferSelect, "filamentTypeId"> & FilamentTypeSelectFields & {
  filamentTypeId: number;
};

export type InsertFilament = Omit<typeof filaments.$inferInsert, "id" | "filamentTypeId"> & FilamentTypeInsertFields;

// Bearbeiten Sie das Schema, um sicherzustellen, dass numerische Felder korrekt konvertiert werden
// Schema für das Einfügen von Filaments ohne Transformation
const baseInsertFilamentSchema = createInsertSchema(filaments).omit({
  id: true,
  filamentTypeId: true,
}).extend({
  manufacturer: z.string().nullable().optional(),
  material: z.string(),
  colorName: z.string(),
  colorCode: z.string().nullable().optional(),
  diameter: z.union([z.string(), z.number()]).nullable().optional(),
  printTemp: z.string().nullable().optional(),
});

// Schema mit Transformation für die Formvalidierung
export const insertFilamentSchema = baseInsertFilamentSchema.transform((data) => {
  // Konvertiert numerische Werte zu Strings für die Datenbank
  return {
    ...data,
    diameter: data.diameter !== undefined && data.diameter !== null ? data.diameter.toString() : data.diameter,
    totalWeight: data.totalWeight.toString(),
    remainingPercentage: data.remainingPercentage.toString(),
    purchasePrice: data.purchasePrice?.toString(),
    dryerCount: data.dryerCount !== undefined ? data.dryerCount : 0
  };
});

// Neue Listen für die Einstellungen
export const manufacturers = pgTable("manufacturers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").default(999),
  createdAt: timestamp("created_at").defaultNow()
});

export const materials = pgTable("materials", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").default(999),
  density: numeric("density"), // g/cm^3; lets weight<->length conversions work without an external lookup
  isHygroscopic: boolean("is_hygroscopic").default(false), // drives the drying-reminder email check
  createdAt: timestamp("created_at").defaultNow()
});

export const colors = pgTable("colors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const diameters = pgTable("diameters", {
  id: serial("id").primaryKey(),
  value: numeric("value").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow()
});

export const storageLocations = pgTable("storage_locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").default(999),
  createdAt: timestamp("created_at").defaultNow()
});

// Insert-Schemas für die neuen Listen
export const insertManufacturerSchema = createInsertSchema(manufacturers).omit({
  id: true,
  createdAt: true,
  sortOrder: true,
});

export const insertMaterialSchema = createInsertSchema(materials).omit({
  id: true,
  createdAt: true,
  sortOrder: true,
});

export const insertColorSchema = createInsertSchema(colors).omit({
  id: true,
  createdAt: true,
});

export const insertDiameterSchema = createInsertSchema(diameters).omit({
  id: true,
  createdAt: true,
}).transform((data) => {
  return {
    ...data,
    value: data.value.toString()
  };
});

export const insertStorageLocationSchema = createInsertSchema(storageLocations).omit({
  id: true,
  createdAt: true,
  sortOrder: true,
});

// Typen für die neuen Listen
export type InsertManufacturer = z.infer<typeof insertManufacturerSchema>;
export type Manufacturer = typeof manufacturers.$inferSelect;

export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type Material = typeof materials.$inferSelect;

export type InsertColor = z.infer<typeof insertColorSchema>;
export type Color = typeof colors.$inferSelect;

export type InsertDiameter = z.infer<typeof insertDiameterSchema>;
export type Diameter = typeof diameters.$inferSelect;

export type InsertStorageLocation = z.infer<typeof insertStorageLocationSchema>;
export type StorageLocation = typeof storageLocations.$inferSelect;

// User sharing settings
export const userSharing = pgTable("user_sharing", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  materialId: integer("material_id").references(() => materials.id, { onDelete: "cascade" }),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow()
});

export const insertUserSharingSchema = createInsertSchema(userSharing).omit({
  id: true,
  createdAt: true,
});

export type InsertUserSharing = z.infer<typeof insertUserSharingSchema>;
export type UserSharing = typeof userSharing.$inferSelect;

// Singleton row (id fixed to 1) holding the admin-configured SMTP settings
export const emailSettings = pgTable("email_settings", {
  id: integer("id").primaryKey().default(1),
  enabled: boolean("enabled").default(false),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUser: text("smtp_user"),
  smtpPassword: text("smtp_password"),
  smtpSecure: boolean("smtp_secure").default(true),
  fromEmail: text("from_email"),
  fromName: text("from_name"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const updateEmailSettingsSchema = createInsertSchema(emailSettings).omit({
  id: true,
  updatedAt: true,
});

export type UpdateEmailSettings = z.infer<typeof updateEmailSettingsSchema>;
export type EmailSettings = typeof emailSettings.$inferSelect;

// User-submitted requests to add a new catalog entry (manufacturer/material/
// color/diameter/storage location); reviewed by an admin before the entry
// becomes real. Keeps the shared catalog tables admin-only while still
// letting any user propose additions.
export const catalogRequestEntityTypes = [
  "manufacturer",
  "material",
  "color",
  "diameter",
  "storageLocation",
] as const;

export const catalogRequests = pgTable("catalog_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(), // one of catalogRequestEntityTypes
  payload: jsonb("payload").notNull(), // e.g. {name} | {name, code} | {value}
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  reviewNote: text("review_note"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCatalogRequestSchema = z.object({
  entityType: z.enum(catalogRequestEntityTypes),
  payload: z.record(z.string(), z.any()),
});

export type InsertCatalogRequest = z.infer<typeof insertCatalogRequestSchema>;
export type CatalogRequest = typeof catalogRequests.$inferSelect;

// Records every change to a filament's remainingPercentage, so "how much did
// I use and when" is answerable without the user having tracked it manually.
export const filamentUsageLog = pgTable("filament_usage_log", {
  id: serial("id").primaryKey(),
  filamentId: integer("filament_id").notNull().references(() => filaments.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deltaWeight: numeric("delta_weight").notNull(), // grams; negative = consumed, positive = corrected/refilled
  remainingPercentageAfter: numeric("remaining_percentage_after").notNull(),
  note: text("note"),
  source: text("source").notNull().default("manual"), // 'manual' | 'printer'
  createdAt: timestamp("created_at").defaultNow(),
});

export type FilamentUsageLog = typeof filamentUsageLog.$inferSelect;

// Lets a user define their own tracked attributes on filaments (e.g. "shelf",
// "batch number") without a schema change; values live in
// filaments.customFieldValues, keyed by this definition's id.
export const customFieldFieldTypes = ["text", "number", "boolean", "date"] as const;

export const customFieldDefinitions = pgTable("custom_field_definitions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull().default("filament"), // only 'filament' for now
  name: text("name").notNull(),
  fieldType: text("field_type").notNull(), // one of customFieldFieldTypes
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomFieldDefinitionSchema = createInsertSchema(customFieldDefinitions).omit({
  id: true,
  userId: true,
  createdAt: true,
}).extend({
  fieldType: z.enum(customFieldFieldTypes),
});

export type InsertCustomFieldDefinition = z.infer<typeof insertCustomFieldDefinitionSchema>;
export type CustomFieldDefinition = typeof customFieldDefinitions.$inferSelect;

// A locally-cached copy of community filament profiles from SpoolmanDB
// (https://github.com/Donkie/SpoolmanDB, MIT licensed), refreshed by an
// admin action rather than a live external API call per search. One row per
// manufacturer/product/color combination.
export const communityFilamentCache = pgTable("community_filament_cache", {
  id: serial("id").primaryKey(),
  manufacturer: text("manufacturer").notNull(),
  material: text("material").notNull(),
  name: text("name").notNull(),
  colorName: text("color_name").notNull(),
  colorCode: text("color_code"),
  density: numeric("density"),
  diameter: numeric("diameter"),
  extruderTemp: integer("extruder_temp"),
  bedTemp: integer("bed_temp"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type CommunityFilamentCacheEntry = typeof communityFilamentCache.$inferSelect;

// Per-user API tokens for printer/print-server integrations (a print server
// can't hold a user's login cookie). tokenHash is a SHA-256 digest of the
// plaintext token - looked up directly, not bcrypt-compared, since the
// token itself is high-entropy random data rather than a user-chosen password.
export const apiTokens = pgTable("api_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  label: text("label"),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
});

export type ApiToken = typeof apiTokens.$inferSelect;

export const insertApiTokenSchema = z.object({
  label: z.string().optional(),
});

export type InsertApiToken = z.infer<typeof insertApiTokenSchema>;

// Body for POST /api/integrations/usage (Phase A generic printer ingestion)
export const printerUsageEventSchema = z.object({
  filamentId: z.number().int().positive(),
  deltaWeight: z.number(), // grams; negative = consumed
  externalJobId: z.string().optional(),
});

export type PrinterUsageEvent = z.infer<typeof printerUsageEventSchema>;
