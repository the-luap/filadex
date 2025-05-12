import { pgTable, serial, text, timestamp, boolean, numeric, date, integer } from 'drizzle-orm/pg-core';
import { z } from 'zod';

// Define database tables
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  isAdmin: boolean('is_admin').default(false),
  forceChangePassword: boolean('force_change_password').default(true),
  lastLogin: timestamp('last_login', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const manufacturers = pgTable('manufacturers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  sortOrder: integer('sort_order').default(999),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const materials = pgTable('materials', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  sortOrder: integer('sort_order').default(999),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const colors = pgTable('colors', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const diameters = pgTable('diameters', {
  id: serial('id').primaryKey(),
  value: numeric('value').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const storageLocations = pgTable('storage_locations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  sortOrder: integer('sort_order').default(999),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const filaments = pgTable('filaments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  manufacturer: text('manufacturer'),
  material: text('material').notNull(),
  colorName: text('color_name'),
  colorCode: text('color_code'),
  diameter: numeric('diameter'),
  printTemp: text('print_temp'),
  totalWeight: numeric('total_weight').notNull(),
  remainingPercentage: numeric('remaining_percentage').notNull(),
  purchaseDate: date('purchase_date'),
  purchasePrice: numeric('purchase_price'),
  status: text('status'),
  spoolType: text('spool_type'),
  dryerCount: integer('dryer_count').default(0).notNull(),
  lastDryingDate: date('last_drying_date'),
  storageLocation: text('storage_location')
});

export const userSharing = pgTable('user_sharing', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  materialId: integer('material_id').references(() => materials.id, { onDelete: 'cascade' }),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// Zod schemas for validation
export const insertFilamentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  manufacturer: z.string().optional(),
  material: z.string().min(1, "Material is required"),
  colorName: z.string().optional(),
  colorCode: z.string().optional(),
  diameter: z.coerce.number().optional(),
  printTemp: z.string().optional(),
  totalWeight: z.coerce.number().min(0, "Weight must be positive"),
  remainingPercentage: z.coerce.number().min(0, "Remaining percentage must be between 0 and 100").max(100, "Remaining percentage must be between 0 and 100"),
  purchaseDate: z.coerce.date().optional(),
  purchasePrice: z.coerce.number().optional(),
  status: z.string().optional(),
  spoolType: z.string().optional(),
  dryerCount: z.coerce.number().int().default(0),
  lastDryingDate: z.coerce.date().optional(),
  storageLocation: z.string().optional()
});
