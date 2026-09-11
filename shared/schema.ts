import { sql } from "drizzle-orm";
import { table, t, foreignKey, index, uniqueIndex, nullableIndexKey } from "@shared/columns";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = table("users", {
  id: t.pk("id"),
  username: t.text("username").notNull().unique("users_username_key"),
  password: t.text("password").notNull(),
  isAdmin: t.bool("is_admin").default(false),
  // Source of truth for authorization; isAdmin above is kept as a mirror
  // (role === 'admin') so existing code reading isAdmin keeps working.
  role: t.text("role").notNull().default("user"), // 'admin' | 'user'
  email: t.text("email").unique("users_email_key"),
  emailVerified: t.bool("email_verified").default(false),
  emailVerificationToken: t.text("email_verification_token"),
  emailVerificationExpires: t.timestamp("email_verification_expires"),
  passwordResetToken: t.text("password_reset_token"),
  passwordResetExpires: t.timestamp("password_reset_expires"),
  forceChangePassword: t.bool("force_change_password").default(true),
  // When the password was last set, by the user, a reset link or an admin.
  // Sessions issued before this moment are refused (server/auth.ts), which is
  // what makes changing the password a way to lock a stolen cookie out.
  passwordChangedAt: t.timestamptz("password_changed_at"),
  language: t.text("language").default("en"),
  currency: t.text("currency").default("EUR"),
  temperatureUnit: t.text("temperature_unit").default("C"),
  lastLogin: t.timestamptz("last_login"),
  createdAt: t.timestamptz("created_at").defaultNow().notNull(),
  // Low-stock / drying-reminder email alert preferences (per-user, not global)
  lowStockThresholdPercent: t.int("low_stock_threshold_percent").default(15),
  notifyLowStock: t.bool("notify_low_stock").default(true),
  notifyDryingReminder: t.bool("notify_drying_reminder").default(true),
  dryingReminderDays: t.int("drying_reminder_days").default(30),
  // Per-user UI theme (previously a single global theme.json file shared by
  // every user - see migrations/add_user_theme_preferences.ts)
  themeVariant: t.text("theme_variant").default("professional"),
  themePrimary: t.text("theme_primary").default("#EA580C"),
  themeAppearance: t.text("theme_appearance").default("dark"), // 'light' | 'dark'
  themeRadius: t.numeric("theme_radius").default("0.8"),
  // The username as the account namespace sees it: NFC-normalised and
  // case-folded by foldUsername, written by storage.ts on every create and
  // rename. Never displayed - `username` keeps the capitalisation the user
  // chose - and never set by a caller.
  usernameFolded: t.text("username_folded").notNull(),
}, (table) => [
  // Enforces that usernames are unique regardless of case, and - now that they
  // may hold diacritics - regardless of which Unicode spelling was typed.
  //
  // This replaced a `lower(username)` expression index. The database cannot be
  // the thing that folds: `LOWER()` folds only ASCII when lc_ctype is C, so on
  // such an install `Müller` and `müller` both lower to themselves and the
  // index would let both accounts exist. Folding in the application and storing
  // the result makes uniqueness mean the same thing on every deployment.
  uniqueIndex("users_username_folded_idx").on(table.usernameFolded),
]);

// A filament product (vendor, material, color, diameter, print temp) defined
// once; filaments (below) become spool instances referencing one of these,
// so buying 5 identical spools no longer means re-entering the same
// manufacturer/material/color/diameter 5 times. See IMPLEMENTATION_PLAN.md #9.
export const filamentTypes = table("filament_types", {
  id: t.pk("id"),
  userId: t.fk("user_id"),
  manufacturer: t.text("manufacturer"),
  material: t.text("material").notNull(),
  colorName: t.text("color_name").notNull(),
  colorCode: t.text("color_code"),
  diameter: t.numeric("diameter"),
  printTemp: t.text("print_temp"),
  createdAt: t.timestamp("created_at").defaultNow(),
}, (table) => [
  foreignKey({
    name: "filament_types_user_id_fkey",
    columns: [table.userId],
    foreignColumns: [users.id],
  }).onDelete("cascade"),
]);

export type FilamentType = typeof filamentTypes.$inferSelect;

// The spool instance table. Product-identity fields (manufacturer, material,
// colorName, colorCode, diameter, printTemp) live on filamentTypes instead -
// server/storage.ts joins them back in so every route/component keeps
// working against the same flattened shape (see the `Filament` type below).
export const filaments = table("filaments", {
  id: t.pk("id"),
  userId: t.fk("user_id"),
  filamentTypeId: t.fk("filament_type_id").notNull(),
  name: t.text("name").notNull(),
  totalWeight: t.numeric("total_weight").notNull(),
  remainingPercentage: t.numeric("remaining_percentage").notNull(),
  purchaseDate: t.date("purchase_date"),
  purchasePrice: t.numeric("purchase_price"), // Kaufpreis in EUR
  status: t.text("status"),  // 'sealed', 'opened'
  spoolType: t.text("spool_type"), // 'spooled', 'spoolless'
  dryerCount: t.int("dryer_count").default(0).notNull(), // Anzahl der Trocknungen
  lastDryingDate: t.date("last_drying_date"), // Datum der letzten Trocknung
  storageLocation: t.text("storage_location"), // Lagerort
  barcode: t.text("barcode"), // Barcode or GTIN from packaging/spool
  // Set when a low-stock email is sent, cleared once remaining % rises back
  // above the threshold - prevents re-notifying every scheduled check.
  lowStockNotifiedAt: t.timestamp("low_stock_notified_at"),
  // Set when a drying-reminder email is sent; throttles reminders to at most
  // once/day rather than every scheduled check, until lastDryingDate changes.
  dryingReminderNotifiedAt: t.timestamp("drying_reminder_notified_at"),
  // Values for this user's customFieldDefinitions, keyed by definition id (as a string)
  customFieldValues: t.json<Record<string, any>>("custom_field_values").default({}),
}, (table) => [
  foreignKey({
    name: "filaments_user_id_fkey",
    columns: [table.userId],
    foreignColumns: [users.id],
  }).onDelete("cascade"),
  foreignKey({
    name: "filaments_filament_type_id_fkey",
    columns: [table.filamentTypeId],
    foreignColumns: [filamentTypes.id],
  }),
]);

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  isAdmin: true,
  forceChangePassword: true,
  language: true,
  currency: true,
  temperatureUnit: true,
});

export const updateThemeSchema = z.object({
  variant: z.string().min(1).optional(),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #EA580C").optional(),
  appearance: z.enum(["light", "dark"]).optional(),
  radius: z.number().min(0).max(2).optional(),
});

export type UpdateTheme = z.infer<typeof updateThemeSchema>;

/**
 * The one normalisation a username passes through on its way in.
 *
 * A letter with a diacritic has two encodings that render identically: `ü` is
 * either U+00FC, or `u` followed by U+0308. Which one arrives depends on the
 * keyboard, the operating system, and whether the text was pasted. Left alone
 * they are different strings, so two accounts could display the same name, and
 * someone who registered with one spelling and later typed the other would be
 * told their password was wrong.
 */
export const normalizeUsername = (username: string): string => username.normalize("NFC");

/**
 * The account namespace's idea of "the same name", stored as `username_folded`
 * and used for every uniqueness check and every lookup.
 *
 * Folding happens here rather than in SQL because `LOWER()` folds only ASCII
 * when the database's lc_ctype is C, and Filadex can be pointed at an
 * operator's own server (docs/adr/0002). Doing it in JS makes `Müller` and
 * `müller` the same account on every install rather than only on some.
 *
 * `ß` does not fold to `ss` here, so `Straße` and `Strasse` remain two
 * accounts. That is a deliberate limit: full case folding would also have to
 * decide about the many other one-to-many mappings, and no rule the database
 * can enforce would agree with it.
 */
export const foldUsername = (username: string): string =>
  normalizeUsername(username).toLowerCase();

// 3-30 characters, letters, numbers, underscore and hyphen - shared between the
// registration schema, /api/auth/check-username and the admin endpoints.
//
// "Letters" means Latin-script letters, not A-Za-z. The UI ships in German and
// this could not hold `müller`, which is not a rule anyone chose - the class was
// written as A-Za-z and never revisited. Latin script covers every umlaut,
// eszett and accent the German and English UIs can produce.
//
// It is deliberately not \p{L}. That would also admit Cyrillic `а` (U+0430),
// which renders identically to Latin `a`, so `аdmin` and `admin` would be two
// accounts indistinguishable wherever a username is shown - including the
// public sharing page, which needs no login to view. Nothing here detects
// confusables, and folding does not help: the two differ in every comparison
// available. Restricting to one script is what keeps that closed. Widening to
// all of them is a one-token change, but it should be a deliberate one, made
// together with confusable detection. Digits stay 0-9 for the same reason -
// \p{N} would admit Arabic-Indic digits.
//
// Normalisation runs first, so the length and character checks see one
// canonical form: a decomposed `ü` is a letter followed by a combining mark,
// which this class would otherwise reject while the composed spelling passed.
// It also makes `max(30)` mean 30 characters rather than 30 code points.
export const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .pipe(
    z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be at most 30 characters")
      .regex(/^[\p{Script=Latin}0-9_-]+$/u, "Username may only contain letters, numbers, underscores, and hyphens"),
  );

// Shared between self-registration and admin-created accounts so the two ways
// of creating a user cannot drift apart on what counts as an acceptable password.
export const passwordSchema = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters");

// newPassword uses passwordSchema so changing your password is held to the same
// length as registering: a user could otherwise register with 8 and immediately
// downgrade. The rule binds the password being set, not one already stored -
// short existing passwords keep working at login.
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

export const registerSchema = z.object({
  username: usernameSchema,
  email: z.string().email("Please enter a valid email address"),
  password: passwordSchema,
});

// Both admin endpoints were unvalidated before, so anything that sent a
// JSON-ish boolean worked. Rejecting "true" or 1 now would break a caller that
// has been doing it for releases, which is not a change either endpoint set out
// to make, so those forms are still accepted and normalised here.
const flexibleBoolean = z.preprocess((value) => {
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return value;
}, z.boolean());

// An admin creating an account skips email verification, so there is no email
// here - but the username and password rules are the same ones self-registration
// applies.
export const adminCreateUserSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  isAdmin: flexibleBoolean.optional(),
  forceChangePassword: flexibleBoolean.optional(),
});

// Editing a user applies the same rules to the fields it is given. Every field
// is optional - the endpoint is a partial update - but a username or password
// that arrives has to satisfy what creating one would, or a name the system
// refuses to create could still be set by renaming into it.
// An empty string means "leave this alone" rather than "set it to nothing":
// the edit form clears the password field it did not touch, and the endpoint
// skipped falsy values before this was validated at all.
const omitIfBlank = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

// The username is checked against usernameSchema by the endpoint rather than
// here, because whether the rules apply depends on the name the user already
// has: before either endpoint was validated an admin could create any name at
// all, and the edit form prefills the username, so re-applying the rules to
// every request would lock an upgraded install out of administering such an
// account over a field nobody touched. Setting a name is still checked.
export const adminUpdateUserSchema = z.object({
  username: omitIfBlank(z.string()),
  password: omitIfBlank(passwordSchema),
  isAdmin: flexibleBoolean.optional(),
  forceChangePassword: flexibleBoolean.optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: passwordSchema,
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
  density?: string | number | null;
};

export type Filament = Omit<typeof filaments.$inferSelect, "filamentTypeId"> & FilamentTypeSelectFields & {
  filamentTypeId: number;
};

export type InsertFilament = Omit<typeof filaments.$inferInsert, "id" | "filamentTypeId"> & FilamentTypeInsertFields;

/**
 * A diameter has to be a number, not merely something that starts with one.
 *
 * It is stored as `numeric` - a real numeric on Postgres, TEXT on SQLite (see
 * shared/columns.sqlite.ts) - and matched as a number when a spool looks for its
 * filament type. A value like "1.75mm" or "" therefore diverges: Postgres errors
 * on the parameter, while SQLite's CAST(x AS REAL) stops at the first
 * non-numeric character and makes "1.75mm" equal to "1.75", silently attaching
 * the spool to a catalog entry with a different diameter. Rejecting it at the
 * boundary is what keeps both engines answering the same way.
 *
 * Enforced on the client by insertFilamentSchema below, and on the server by
 * storage.createFilament/updateFilament - the routes that write a spool (direct
 * POST, CSV and JSON import, batch, the Spoolman-compatible API) do not all
 * parse a schema, but they all go through storage.
 */
export const diameterValueSchema = z.union([
  z.string().refine(
    (value) => value.trim() !== "" && Number.isFinite(Number(value)),
    { message: "diameter must be a number" },
  ),
  z.number(),
]);

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
  diameter: diameterValueSchema.nullable().optional(),
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

// What a spool write may carry, checked at the HTTP boundary. The routes used
// to copy fields off req.body one by one - which kept ownership and the
// notification latches out of a caller's reach, but let a status of "bogus", a
// purchase date of "yesterday" or a string where custom-field values belong
// straight into the row. Numbers may arrive as strings or numbers, since the
// form, the imports and the print-server clients disagree; the database
// stores them as text either way.
const numberish = (min: number, max?: number) => z.union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => value !== "" && Number.isFinite(Number(value)), { message: "must be a number" })
  .refine((value) => Number(value) >= min, { message: `must be at least ${min}` })
  .refine((value) => max === undefined || Number(value) <= max, { message: `must be at most ${max}` });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date in YYYY-MM-DD form");

export const filamentStatuses = ["sealed", "opened"] as const;
export const spoolTypes = ["spooled", "spoolless"] as const;

// Values for the caller's custom fields, keyed by definition id. Scalars only,
// bounded in count and length, so the JSON column cannot become a dumping
// ground for arbitrary documents.
export const customFieldValuesSchema = z.record(
  z.string().max(20),
  z.union([z.string().max(1000), z.number(), z.boolean(), z.null()]),
).refine((values) => Object.keys(values).length <= 50, { message: "too many custom field values" });

export const filamentWriteSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(200),
  manufacturer: z.string().max(200).nullable().optional(),
  material: z.string().trim().min(1, "material is required").max(100),
  colorName: z.string().max(100),
  colorCode: z.string().max(20).nullable().optional(),
  density: z.union([
    z.number().positive().finite().transform((n) => String(n)),
    z.string().regex(/^\d+(\.\d+)?$/, "Density must be a positive number"),
  ]).nullable().optional(),
  printTemp: z.union([z.string().max(50), z.number()]).transform((v) => String(v)).optional(),
  diameter: diameterValueSchema.nullable().optional(),
  totalWeight: numberish(0),
  remainingPercentage: numberish(0, 100),
  purchaseDate: isoDate.nullable().optional(),
  purchasePrice: numberish(0).nullable().optional(),
  status: z.enum(filamentStatuses).nullable().optional(),
  spoolType: z.enum(spoolTypes).nullable().optional(),
  dryerCount: z.number().int().min(0).max(10_000).optional(),
  lastDryingDate: isoDate.nullable().optional(),
  storageLocation: z.string().max(200).nullable().optional(),
  barcode: z.string().trim().max(100).nullable().optional(),
  customFieldValues: customFieldValuesSchema.optional(),
});

export const filamentPatchSchema = filamentWriteSchema.partial();

// One sharing setting: the whole collection (materialId null) or one material.
export const userSharingSchema = z.object({
  materialId: z.number().int().positive().nullable().optional(),
  isPublic: z.boolean().optional(),
});

// Neue Listen für die Einstellungen
export const manufacturers = table("manufacturers", {
  id: t.pk("id"),
  name: t.text("name").notNull(),
  userId: t.fk("user_id"), // NULL = Global Catalog; set = that user's Personal Catalog
  sortOrder: t.int("sort_order").default(999),
  createdAt: t.timestamptz("created_at").defaultNow().notNull()
}, (table) => [
  foreignKey({
    name: "manufacturers_user_id_fkey",
    columns: [table.userId],
    foreignColumns: [users.id],
  }).onDelete("cascade"),
  uniqueIndex("manufacturers_global_name_lower_idx")
    .on(sql`lower(${table.name})`).where(sql`${table.userId} IS NULL`),
  uniqueIndex("manufacturers_user_name_lower_idx")
    .on(nullableIndexKey(table.userId), sql`lower(${table.name})`).where(sql`${table.userId} IS NOT NULL`),
]);

export const materials = table("materials", {
  id: t.pk("id"),
  name: t.text("name").notNull(),
  userId: t.fk("user_id"), // NULL = Global Catalog; set = that user's Personal Catalog
  sortOrder: t.int("sort_order").default(999),
  density: t.numeric("density"), // g/cm^3; lets weight<->length conversions work without an external lookup
  isHygroscopic: t.bool("is_hygroscopic").default(false), // drives the drying-reminder email check
  // Set by the owner to silence the "needs attention" prompt the client shows
  // on a Personal Catalog row with no density and no hygroscopic flag. Without
  // it, a material that genuinely has neither is indistinguishable from one
  // auto-registration created and nobody ever looked at, so the prompt would
  // stay on that row forever with nothing the owner could do about it.
  attentionDismissed: t.bool("attention_dismissed").default(false).notNull(),
  createdAt: t.timestamptz("created_at").defaultNow().notNull()
}, (table) => [
  foreignKey({
    name: "materials_user_id_fkey",
    columns: [table.userId],
    foreignColumns: [users.id],
  }).onDelete("cascade"),
  // Unique within the Global Catalog, and unique within each Personal Catalog,
  // case-insensitively. Two partial indexes rather than one on
  // (user_id, lower(name)) because SQL NULLs never conflict with each other, so
  // a single index would let the Global Catalog hold duplicates.
  uniqueIndex("materials_global_name_lower_idx")
    .on(sql`lower(${table.name})`).where(sql`${table.userId} IS NULL`),
  // nullableIndexKey wraps user_id in `coalesce(user_id, 0)` on Postgres (because
  // drizzle-kit 0.30's introspection cannot round-trip an index whose key list
  // mixes a bare column with an expression) and leaves it as a bare column on
  // SQLite (where drizzle-kit splits index keys on commas ignoring parentheses).
  // The index is partial on WHERE user_id IS NOT NULL, so the bare column is
  // semantically identical. See docs/adr/0004.
  uniqueIndex("materials_user_name_lower_idx")
    .on(nullableIndexKey(table.userId), sql`lower(${table.name})`).where(sql`${table.userId} IS NOT NULL`),
]);

export const colors = table("colors", {
  id: t.pk("id"),
  name: t.text("name").notNull(),
  code: t.text("code").notNull(),
  createdAt: t.timestamptz("created_at").defaultNow().notNull()
});

export const diameters = table("diameters", {
  id: t.pk("id"),
  value: t.numeric("value").notNull().unique("diameters_value_key"),
  createdAt: t.timestamptz("created_at").defaultNow().notNull()
});

export const storageLocations = table("storage_locations", {
  id: t.pk("id"),
  name: t.text("name").notNull().unique("storage_locations_name_key"),
  sortOrder: t.int("sort_order").default(999),
  createdAt: t.timestamptz("created_at").defaultNow().notNull()
});

export const genericTerms = table("generic_terms", {
  id: t.pk("id"),
  word: t.text("word").notNull().unique("generic_terms_word_key"),
  createdAt: t.timestamptz("created_at").defaultNow().notNull()
});

// Insert-Schemas für die neuen Listen
export const insertManufacturerSchema = createInsertSchema(manufacturers).omit({
  id: true,
  createdAt: true,
  sortOrder: true,
  userId: true,
});

export const insertMaterialSchema = createInsertSchema(materials).omit({
  id: true,
  createdAt: true,
  sortOrder: true,
  // Direct creation always targets the Global Catalog; a Personal Catalog entry
  // is only ever auto-registered from a declared material (see storage.ts).
  userId: true,
  // Only ever set after the fact, by the owner of the row it is prompting - and
  // a Global Catalog row is never prompted about in the first place.
  attentionDismissed: true,
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

export const insertGenericTermSchema = createInsertSchema(genericTerms)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    word: z.string().trim().min(1, "Word is required"),
  });

// Typen für die neuen Listen
export type InsertManufacturer = z.infer<typeof insertManufacturerSchema>;
export type Manufacturer = typeof manufacturers.$inferSelect;

export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type Material = typeof materials.$inferSelect;

// The only fields an owner (or an admin, on any row) can fill in after the
// fact - name and scoping are fixed at creation. This is what turns an
// auto-registered Personal Catalog row into one that actually does something:
// see docs/adr/0003-per-user-material-catalog.md.
//
// Written out directly rather than derived from createInsertSchema: unlike
// POST /api/materials (admin-only), PUT /api/materials/:id is reachable by any
// owner of a Personal Catalog row, so density needs an actual format check -
// createInsertSchema otherwise maps the numeric column to a bare, unrefined
// string, and an unparseable value would reach Postgres as a raw
// `UPDATE ... SET density = '...'` and fail as an unhandled 500.
export const updateMaterialSchema = z.object({
  density: z.string().regex(/^\d+(\.\d+)?$/, "Density must be a positive number").nullable().optional(),
  isHygroscopic: z.boolean().nullable().optional(),
  attentionDismissed: z.boolean().optional(),
});

export type UpdateMaterial = z.infer<typeof updateMaterialSchema>;

export type InsertColor = z.infer<typeof insertColorSchema>;
export type Color = typeof colors.$inferSelect;

export type InsertDiameter = z.infer<typeof insertDiameterSchema>;
export type Diameter = typeof diameters.$inferSelect;

export type InsertStorageLocation = z.infer<typeof insertStorageLocationSchema>;
export type StorageLocation = typeof storageLocations.$inferSelect;

export type InsertGenericTerm = z.infer<typeof insertGenericTermSchema>;
export type GenericTerm = typeof genericTerms.$inferSelect;

// User sharing settings
export const userSharing = table("user_sharing", {
  id: t.pk("id"),
  userId: t.fk("user_id").notNull(),
  materialId: t.fk("material_id"),
  isPublic: t.bool("is_public").default(false),
  createdAt: t.timestamptz("created_at").defaultNow().notNull()
}, (table) => [
  foreignKey({
    name: "user_sharing_user_id_fkey",
    columns: [table.userId],
    foreignColumns: [users.id],
  }).onDelete("cascade"),
  foreignKey({
    name: "user_sharing_material_id_fkey",
    columns: [table.materialId],
    foreignColumns: [materials.id],
  }).onDelete("cascade"),
]);

export const insertUserSharingSchema = createInsertSchema(userSharing).omit({
  id: true,
  createdAt: true,
});

export type InsertUserSharing = z.infer<typeof insertUserSharingSchema>;
export type UserSharing = typeof userSharing.$inferSelect;

// Singleton row (id fixed to 1) holding the admin-configured SMTP settings
export const emailSettings = table("email_settings", {
  id: t.int("id").primaryKey().default(1),
  enabled: t.bool("enabled").default(false),
  smtpHost: t.text("smtp_host"),
  smtpPort: t.int("smtp_port"),
  smtpUser: t.text("smtp_user"),
  smtpPassword: t.text("smtp_password"),
  smtpSecure: t.bool("smtp_secure").default(true),
  fromEmail: t.text("from_email"),
  fromName: t.text("from_name"),
  updatedAt: t.timestamp("updated_at").defaultNow(),
});

export const updateEmailSettingsSchema = createInsertSchema(emailSettings).omit({
  id: true,
  updatedAt: true,
});

export type UpdateEmailSettings = z.infer<typeof updateEmailSettingsSchema>;
export type EmailSettings = typeof emailSettings.$inferSelect;

// Singleton row (id fixed to 1) holding SQLite automated backup configuration
export const backupSettings = table("backup_settings", {
  id: t.int("id").primaryKey().default(1),
  enabled: t.bool("enabled").default(false),
  schedule: t.text("schedule").notNull().default("off"), // 'off' | 'daily' | 'weekly'
  time: t.text("time").notNull().default("02:00"), // 'HH:MM' 24h format
  dayOfWeek: t.int("day_of_week").default(1), // 1 = Monday ... 7 = Sunday
  retentionCount: t.int("retention_count").notNull().default(7), // keep last N backups
  lastBackupAt: t.timestamp("last_backup_at"),
  updatedAt: t.timestamp("updated_at").defaultNow(),
});

// createInsertSchema only knows each column's type and nullability, which for
// this table is not enough: the UI clamps retention to at least 1 but the API
// did not, and `retentionCount: 0` makes pruneBackups slice(0) and delete every
// backup including the one the request just wrote - answering 201 with a
// filename that no longer exists. A negative value deletes the oldest N per run.
// The remaining three fields are read as an enum, an HH:MM string and an ISO
// weekday by the scheduler, so they say so here.
export const updateBackupSettingsSchema = createInsertSchema(backupSettings)
  .omit({
    id: true,
    updatedAt: true,
  })
  .extend({
    schedule: z.enum(["off", "daily", "weekly"]).optional(),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM in 24-hour format")
      .optional(),
    dayOfWeek: z.number().int().min(1).max(7).nullable().optional(),
    retentionCount: z.number().int().min(1).optional(),
  });

export type UpdateBackupSettings = z.infer<typeof updateBackupSettingsSchema>;
export type BackupSettings = typeof backupSettings.$inferSelect;

// Singleton row (id fixed to 1) holding instance-wide system configuration
export const systemSettings = table("system_settings", {
  id: t.int("id").primaryKey().default(1),
  registrationEnabled: t.bool("registration_enabled").default(true),
  updatedAt: t.timestamp("updated_at").defaultNow(),
});

export const updateSystemSettingsSchema = createInsertSchema(systemSettings).omit({
  id: true,
  updatedAt: true,
});

export type UpdateSystemSettings = z.infer<typeof updateSystemSettingsSchema>;
export type SystemSettings = typeof systemSettings.$inferSelect;

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

export const catalogRequests = table("catalog_requests", {
  id: t.pk("id"),
  userId: t.fk("user_id").notNull(),
  entityType: t.text("entity_type").notNull(), // one of catalogRequestEntityTypes
  payload: t.json("payload").notNull(), // e.g. {name} | {name, code} | {value}
  status: t.text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  reviewNote: t.text("review_note"),
  reviewedBy: t.fk("reviewed_by"),
  reviewedAt: t.timestamp("reviewed_at"),
  createdAt: t.timestamp("created_at").defaultNow(),
}, (table) => [
  foreignKey({
    name: "catalog_requests_user_id_fkey",
    columns: [table.userId],
    foreignColumns: [users.id],
  }).onDelete("cascade"),
  foreignKey({
    name: "catalog_requests_reviewed_by_fkey",
    columns: [table.reviewedBy],
    foreignColumns: [users.id],
  }),
]);

export const insertCatalogRequestSchema = z.object({
  entityType: z.enum(catalogRequestEntityTypes),
  payload: z.record(z.string(), z.any()),
});

export type InsertCatalogRequest = z.infer<typeof insertCatalogRequestSchema>;
export type CatalogRequest = typeof catalogRequests.$inferSelect;

// Records every change to a filament's remainingPercentage, so "how much did
// I use and when" is answerable without the user having tracked it manually.
export const filamentUsageLog = table("filament_usage_log", {
  id: t.pk("id"),
  filamentId: t.fk("filament_id").notNull(),
  userId: t.fk("user_id").notNull(),
  deltaWeight: t.numeric("delta_weight").notNull(), // grams; negative = consumed, positive = corrected/refilled
  remainingPercentageAfter: t.numeric("remaining_percentage_after").notNull(),
  note: t.text("note"),
  source: t.text("source").notNull().default("manual"), // 'manual' | 'printer'
  createdAt: t.timestamp("created_at").defaultNow(),
}, (table) => [
  foreignKey({
    name: "filament_usage_log_filament_id_fkey",
    columns: [table.filamentId],
    foreignColumns: [filaments.id],
  }).onDelete("cascade"),
  foreignKey({
    name: "filament_usage_log_user_id_fkey",
    columns: [table.userId],
    foreignColumns: [users.id],
  }).onDelete("cascade"),
  index("filament_usage_log_filament_id_idx").on(table.filamentId),
]);

export type FilamentUsageLog = typeof filamentUsageLog.$inferSelect;

// Lets a user define their own tracked attributes on filaments (e.g. "shelf",
// "batch number") without a schema change; values live in
// filaments.customFieldValues, keyed by this definition's id.
export const customFieldFieldTypes = ["text", "number", "boolean", "date"] as const;

export const customFieldDefinitions = table("custom_field_definitions", {
  id: t.pk("id"),
  userId: t.fk("user_id").notNull(),
  entityType: t.text("entity_type").notNull().default("filament"), // only 'filament' for now
  name: t.text("name").notNull(),
  fieldType: t.text("field_type").notNull(), // one of customFieldFieldTypes
  createdAt: t.timestamp("created_at").defaultNow(),
}, (table) => [
  foreignKey({
    name: "custom_field_definitions_user_id_fkey",
    columns: [table.userId],
    foreignColumns: [users.id],
  }).onDelete("cascade"),
]);

export const insertCustomFieldDefinitionSchema = createInsertSchema(customFieldDefinitions).omit({
  id: true,
  userId: true,
  createdAt: true,
}).extend({
  fieldType: z.enum(customFieldFieldTypes),
});

export type InsertCustomFieldDefinition = z.infer<typeof insertCustomFieldDefinitionSchema>;
export type CustomFieldDefinition = typeof customFieldDefinitions.$inferSelect;

// Per-user API tokens for printer/print-server integrations (a print server
// can't hold a user's login cookie). tokenHash is a SHA-256 digest of the
// plaintext token - looked up directly, not bcrypt-compared, since the
// token itself is high-entropy random data rather than a user-chosen password.
export const apiTokens = table("api_tokens", {
  id: t.pk("id"),
  userId: t.fk("user_id").notNull(),
  tokenHash: t.text("token_hash").notNull().unique("api_tokens_token_hash_key"),
  label: t.text("label"),
  createdAt: t.timestamp("created_at").defaultNow(),
  lastUsedAt: t.timestamp("last_used_at"),
}, (table) => [
  foreignKey({
    name: "api_tokens_user_id_fkey",
    columns: [table.userId],
    foreignColumns: [users.id],
  }).onDelete("cascade"),
]);

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

export interface CommunityCatalogItem {
  id: string;
  source: "ofd" | "spoolmandb";
  manufacturer: string;
  material: string;
  name: string;
  colorName: string;
  colorCode: string | null;
  density: number | null;
  diameter: number | null;
  weightGrams: number | null;
  spoolRefill: boolean | null;
  extruderTemp: number | null;
  bedTemp: number | null;
  gtin: string | null;
  candidates?: CommunityCatalogItem[];
}

