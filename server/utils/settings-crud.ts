/**
 * Generic CRUD route factory for the simple reference-data settings entities
 * (manufacturers, materials, colors, diameters, storage locations). Each of
 * these previously had its own ~130-line copy of the same
 * list+CSV-export / create+CSV-import / delete-with-usage-check / reorder
 * routes; this factory keeps that logic in one place and lets each entity
 * plug in only what actually differs (schema, storage calls, CSV format,
 * and how to tell if a filament is using it).
 */
import type { Express } from "express";
import { ZodError, ZodType } from "zod";
import { fromZodError } from "zod-validation-error";
import { storage } from "../storage";
import { authenticate, isAdmin } from "../auth";
import { logger as appLogger } from "./logger";
import { validateId } from "./validation";
import { parseCSVLine } from "./csv-parser";
import type { Filament } from "@shared/schema";

type ImportOutcome<InsertT> =
  | { kind: "create"; data: InsertT }
  | { kind: "duplicate" }
  | { kind: "skip" }
  | { kind: "error" };

export interface CrudEntityConfig<T extends { id: number; userId?: number | null }, InsertT> {
  /** Singular lowercase name used in log/error messages, e.g. "manufacturer" */
  entityName: string;
  /** e.g. "/api/manufacturers" */
  basePath: string;
  /** CSV attachment filename, e.g. "manufacturers.csv" */
  csvFilename: string;
  insertSchema: ZodType<InsertT>;
  /**
   * When set, this entity is a Global Catalog (rows owned by nobody, `userId`
   * NULL) plus a Personal Catalog per user. GET lists the global rows and the
   * caller's own; DELETE lets a user remove a row they own, while removing a
   * global row - and reordering - stay admin-only. Creation stays admin-only and
   * global regardless. Only `materials` sets this.
   */
  userScoped?: true;
  storage: {
    // `userId` is the caller; only a `userScoped` entity reads it, to list the
    // Global Catalog plus that user's Personal Catalog.
    getAll: (userId: number) => Promise<T[]>;
    create: (data: InsertT) => Promise<T>;
    delete: (id: number) => Promise<boolean>;
    updateOrder?: (id: number, newOrder: number) => Promise<T | undefined>;
  };
  /**
   * Optional PUT /:id capability for filling in fields on a row that already
   * exists (distinct from `storage.create`, which always makes a new one).
   * The body schema and the write are one property because neither is any use
   * without the other. Only `materials` sets this.
   */
  update?: {
    schema: ZodType<Partial<InsertT>>;
    apply: (id: number, data: Partial<InsertT>) => Promise<T | undefined>;
  };
  csv: {
    exportHeader: string;
    exportRow: (item: T) => string;
    isHeaderRow: (firstLine: string) => boolean;
    parseLine: (line: string, existing: T[]) => ImportOutcome<InsertT>;
  };
  /** Whether a given filament is using this settings item (blocks delete) */
  isInUse?: (filament: Filament, item: T) => boolean;
  /**
   * Whether an existing row already holds what a create is asking for, so POST
   * can answer 409 instead of letting the database's unique index surface as a
   * 500. Only `materials` sets this, because it is the only entity whose
   * uniqueness is case-insensitive - the others' indexes are case-sensitive, so
   * adding the check there would newly reject creates that succeed today.
   */
  duplicateOf?: (item: T, data: InsertT) => boolean;
}

// Ownership rule for a userScoped entity: a Personal Catalog row (`userId`
// set) may be acted on by the user who owns it; a Global Catalog row
// (`userId` null) only by an admin. Shared by DELETE and PUT so the rule
// lives in one place.
//
// Admin is read off `role`, not the `is_admin` mirror: shared/schema.ts names
// role the source of truth, every other gate in the codebase is
// requireRole("admin"), and a user where the two disagree would otherwise get
// edit and delete rights over the Global Catalog.
function ownsOrIsAdmin(item: { userId?: number | null }, caller: Express.Request["user"], callerId: number | undefined): boolean {
  const ownsIt = item.userId !== null && item.userId !== undefined && item.userId === callerId;
  return ownsIt || caller?.role === "admin";
}

export function registerCrudSettingsRoutes<T extends { id: number; userId?: number | null }, InsertT>(
  app: Express,
  config: CrudEntityConfig<T, InsertT>
): void {
  const { entityName, basePath, csvFilename, insertSchema, update, storage: entityStorage, csv, isInUse, userScoped, duplicateOf } = config;
  const label = entityName.charAt(0).toUpperCase() + entityName.slice(1);

  app.get(basePath, authenticate, async (req, res) => {
    try {
      const items = await entityStorage.getAll(req.userId);

      if (req.query.export === "csv") {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="${csvFilename}"`);
        const csvContent = `${csv.exportHeader}\n` + items.map(csv.exportRow).join("");
        return res.send(csvContent);
      }

      res.json(items);
    } catch (error) {
      appLogger.error(`Error fetching ${entityName}s:`, error);
      res.status(500).json({ message: `Failed to fetch ${entityName}s` });
    }
  });

  // The rows a create could collide with. Creation writes Global Catalog rows,
  // so it dedupes against those only - a Personal Catalog entry (userId set)
  // with the same name is a different row, and the two partial unique indexes
  // let them coexist. The Global Catalog is in scope for every caller, so
  // listing as the caller and dropping the owned rows yields exactly it.
  const creatableRowsFor = async (userId: number) =>
    (await entityStorage.getAll(userId)).filter((item) => !userScoped || item.userId === null);

  // Direct create/import is admin-only: the shared catalog stays global, and
  // non-admins can only propose additions via POST /api/catalog-requests for
  // an admin to approve (see settings-crud-list.tsx on the client). This holds
  // for a userScoped entity too - a user never creates a Catalog Material
  // directly; they declare one on a Spool (which auto-registers it into their
  // Personal Catalog) or submit a Catalog Request. POST here always writes a
  // Global Catalog row.
  app.post(basePath, authenticate, isAdmin, async (req, res) => {
    try {
      if (req.query.import === "csv" && req.body.csvData) {
        const results = { created: 0, duplicates: 0, errors: 0 };
        const csvLines: string[] = req.body.csvData.split("\n");
        const startIndex = csvLines[0] && csv.isHeaderRow(csvLines[0]) ? 1 : 0;
        const existing = await creatableRowsFor(req.userId);

        for (let i = startIndex; i < csvLines.length; i++) {
          const line = csvLines[i].trim();
          if (!line) continue;

          try {
            const outcome = csv.parseLine(line, existing);
            if (outcome.kind === "skip") continue;
            if (outcome.kind === "error") {
              results.errors++;
              continue;
            }
            if (outcome.kind === "duplicate") {
              results.duplicates++;
              continue;
            }

            const validatedData = insertSchema.parse(outcome.data);
            const created = await entityStorage.create(validatedData);
            existing.push(created);
            results.created++;
          } catch (err) {
            appLogger.error(`Error importing ${entityName} at line ${i + 1}:`, err);
            results.errors++;
          }
        }

        return res.status(201).json(results);
      }

      const validatedData = insertSchema.parse(req.body);

      // The same duplicate check the CSV branch gets from csv.parseLine. Every
      // install is seeded with a handful of rows, so retyping one in the Add
      // form is the ordinary case - and without this it reaches the unique
      // index and comes back as a bare 500.
      if (duplicateOf) {
        const existing = await creatableRowsFor(req.userId);
        if (existing.some((item) => duplicateOf(item, validatedData))) {
          return res.status(409).json({ message: `${label} already exists` });
        }
      }

      const created = await entityStorage.create(validatedData);
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      appLogger.error(`Error creating ${entityName}:`, error);
      res.status(500).json({ message: `Failed to create ${entityName}` });
    }
  });

  // A userScoped entity can't gate DELETE and PUT on isAdmin alone: a user may
  // act on a row they own. The ownership check is done per row below instead.
  const ownerOrAdminGuards = userScoped ? [authenticate] : [authenticate, isAdmin];
  app.delete(`${basePath}/:id`, ...ownerOrAdminGuards, async (req, res) => {
    try {
      const id = validateId(req.params.id);
      if (id === null) {
        return res.status(400).json({ message: `Invalid ${entityName} ID` });
      }

      const items = await entityStorage.getAll(req.userId);
      const item = items.find((i) => i.id === id);

      if (!item) {
        return res.status(404).json({ message: `${label} not found` });
      }

      if (userScoped && !ownsOrIsAdmin(item, req.user, req.userId)) {
        return res.status(403).json({ message: `Cannot delete a ${entityName} you do not own` });
      }

      // A Global Catalog row - every row of a non-scoped entity, and a
      // materials row nobody owns - is shared by every user, so every user's
      // spools decide whether it is in use. Checking only the admin's own let
      // a material other people's spools referenced be deleted, and its
      // cascade took their per-material sharing rows with it.
      if (isInUse) {
        const isGlobalRow = !userScoped || (item as { userId?: number | null }).userId == null;
        const filaments = isGlobalRow
          ? await storage.getFilamentsOfAllUsers()
          : await storage.getFilaments(req.userId);
        if (filaments.some((f) => isInUse(f, item))) {
          return res.status(400).json({
            message: `Cannot delete ${entityName} that is in use by filaments`,
          });
        }
      }

      const success = await entityStorage.delete(id);
      if (!success) {
        return res.status(404).json({ message: `${label} not found` });
      }

      res.status(204).end();
    } catch (error) {
      appLogger.error(`Error deleting ${entityName}:`, error);
      res.status(500).json({ message: `Failed to delete ${entityName}` });
    }
  });

  if (update) {
    app.put(`${basePath}/:id`, ...ownerOrAdminGuards, async (req, res) => {
      try {
        const id = validateId(req.params.id);
        if (id === null) {
          return res.status(400).json({ message: `Invalid ${entityName} ID` });
        }

        const items = await entityStorage.getAll(req.userId);
        const item = items.find((i) => i.id === id);
        if (!item) {
          return res.status(404).json({ message: `${label} not found` });
        }

        if (userScoped && !ownsOrIsAdmin(item, req.user, req.userId)) {
          return res.status(403).json({ message: `Cannot edit a ${entityName} you do not own` });
        }

        const validatedData = update.schema.parse(req.body);
        if (Object.keys(validatedData as object).length === 0) {
          return res.status(400).json({ message: "No fields to update" });
        }

        const updated = await update.apply(id, validatedData);
        if (!updated) {
          return res.status(404).json({ message: `${label} not found` });
        }

        res.json(updated);
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(400).json({ message: fromZodError(error).message });
        }
        appLogger.error(`Error updating ${entityName}:`, error);
        res.status(500).json({ message: `Failed to update ${entityName}` });
      }
    });
  }

  const updateOrder = entityStorage.updateOrder;
  if (updateOrder) {
    app.patch(`${basePath}/:id/order`, authenticate, isAdmin, async (req, res) => {
      try {
        const id = validateId(req.params.id);
        if (id === null) {
          return res.status(400).json({ message: `Invalid ${entityName} ID` });
        }

        const { newOrder } = req.body;
        if (typeof newOrder !== "number") {
          return res.status(400).json({ message: "newOrder must be a number" });
        }

        // Resolved through the caller's own list, the way DELETE and PUT are.
        // Without it this is an unscoped write by id: on a userScoped entity an
        // admin would rewrite sort_order on a Personal Catalog row that is not
        // in their list and that they cannot see. For the other entities
        // getAll ignores the caller and returns everything, so nothing changes.
        const items = await entityStorage.getAll(req.userId);
        if (!items.some((i) => i.id === id)) {
          return res.status(404).json({ message: `${label} not found` });
        }

        const updated = await updateOrder(id, newOrder);
        if (!updated) {
          return res.status(404).json({ message: `${label} not found` });
        }

        res.json(updated);
      } catch (error) {
        appLogger.error(`Error updating ${entityName} order:`, error);
        res.status(500).json({ message: `Failed to update ${entityName} order` });
      }
    });
  }
}

/** Shared parseLine for the simple single-field (name) entities */
export function simpleNameParseLine<T extends { name: string }>(
  line: string,
  existing: T[]
): ImportOutcome<{ name: string }> {
  const [rawName] = parseCSVLine(line);
  const name = rawName?.trim();
  if (!name) return { kind: "skip" };
  if (existing.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
    return { kind: "duplicate" };
  }
  return { kind: "create", data: { name } };
}
