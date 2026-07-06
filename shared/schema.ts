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
});

export const filaments = pgTable("filaments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  manufacturer: text("manufacturer"),
  material: text("material").notNull(),
  colorName: text("color_name").notNull(),
  colorCode: text("color_code"),
  diameter: numeric("diameter"),
  printTemp: text("print_temp"),
  totalWeight: numeric("total_weight").notNull(),
  remainingPercentage: numeric("remaining_percentage").notNull(),
  purchaseDate: date("purchase_date"),
  purchasePrice: numeric("purchase_price"), // Kaufpreis in EUR
  status: text("status"),  // 'sealed', 'opened'
  spoolType: text("spool_type"), // 'spooled', 'spoolless'
  dryerCount: integer("dryer_count").default(0), // Anzahl der Trocknungen
  lastDryingDate: date("last_drying_date"), // Datum der letzten Trocknung
  storageLocation: text("storage_location"), // Lagerort
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

// Bearbeiten Sie das Schema, um sicherzustellen, dass numerische Felder korrekt konvertiert werden
// Schema für das Einfügen von Filaments ohne Transformation
const baseInsertFilamentSchema = createInsertSchema(filaments).omit({
  id: true,
});

// Schema mit Transformation für die Formvalidierung
export const insertFilamentSchema = baseInsertFilamentSchema.transform((data) => {
  // Konvertiert numerische Werte zu Strings für die Datenbank
  return {
    ...data,
    diameter: data.diameter?.toString(),
    totalWeight: data.totalWeight.toString(),
    remainingPercentage: data.remainingPercentage.toString(),
    purchasePrice: data.purchasePrice?.toString(),
    dryerCount: data.dryerCount !== undefined ? data.dryerCount : 0
  };
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Wichtiger Typ ohne Transformation für die Datenbankoperationen
export type InsertFilament = z.infer<typeof baseInsertFilamentSchema>;
export type Filament = typeof filaments.$inferSelect;

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
