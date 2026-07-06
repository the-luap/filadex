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

export interface CrudEntityConfig<T extends { id: number }, InsertT> {
  /** Singular lowercase name used in log/error messages, e.g. "manufacturer" */
  entityName: string;
  /** e.g. "/api/manufacturers" */
  basePath: string;
  /** CSV attachment filename, e.g. "manufacturers.csv" */
  csvFilename: string;
  insertSchema: ZodType<InsertT>;
  storage: {
    getAll: () => Promise<T[]>;
    create: (data: InsertT) => Promise<T>;
    delete: (id: number) => Promise<boolean>;
    updateOrder?: (id: number, newOrder: number) => Promise<T | undefined>;
  };
  csv: {
    exportHeader: string;
    exportRow: (item: T) => string;
    isHeaderRow: (firstLine: string) => boolean;
    parseLine: (line: string, existing: T[]) => ImportOutcome<InsertT>;
  };
  /** Whether a given filament is using this settings item (blocks delete) */
  isInUse: (filament: Filament, item: T) => boolean;
}

export function registerCrudSettingsRoutes<T extends { id: number }, InsertT>(
  app: Express,
  config: CrudEntityConfig<T, InsertT>
): void {
  const { entityName, basePath, csvFilename, insertSchema, storage: entityStorage, csv, isInUse } = config;
  const label = entityName.charAt(0).toUpperCase() + entityName.slice(1);

  app.get(basePath, authenticate, async (req, res) => {
    try {
      const items = await entityStorage.getAll();

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

  // Direct create/import is admin-only: the shared catalog stays global, and
  // non-admins can only propose additions via POST /api/catalog-requests for
  // an admin to approve (see settings-crud-list.tsx on the client).
  app.post(basePath, authenticate, isAdmin, async (req, res) => {
    try {
      if (req.query.import === "csv" && req.body.csvData) {
        const results = { created: 0, duplicates: 0, errors: 0 };
        const csvLines: string[] = req.body.csvData.split("\n");
        const startIndex = csvLines[0] && csv.isHeaderRow(csvLines[0]) ? 1 : 0;
        const existing = await entityStorage.getAll();

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

  app.delete(`${basePath}/:id`, authenticate, isAdmin, async (req, res) => {
    try {
      const id = validateId(req.params.id);
      if (id === null) {
        return res.status(400).json({ message: `Invalid ${entityName} ID` });
      }

      const items = await entityStorage.getAll();
      const item = items.find((i) => i.id === id);

      if (!item) {
        return res.status(404).json({ message: `${label} not found` });
      }

      const filaments = await storage.getFilaments(req.userId);
      if (filaments.some((f) => isInUse(f, item))) {
        return res.status(400).json({
          message: `Cannot delete ${entityName} that is in use by filaments`,
        });
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
