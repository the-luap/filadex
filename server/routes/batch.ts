import type { Express } from "express";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { storage } from "../storage";
import { authenticate } from "../auth";
import { InsertFilament, filamentPatchSchema } from "@shared/schema";
import { logger as appLogger } from "../utils/logger";
import { validateBatchIds } from "../utils/batch-operations";

export function registerBatchRoutes(app: Express): void {
  // BATCH DELETE multiple filaments
  app.delete("/api/filaments/batch", authenticate, async (req, res) => {
    try {
      appLogger.debug("Batch delete request", { ids: req.body.ids });
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Invalid request: ids must be a non-empty array" });
      }

      const validIds = validateBatchIds(ids);

      if (validIds.length === 0) {
        return res.status(400).json({ message: "No valid filament IDs provided" });
      }

      const deletedCount = await storage.batchDeleteFilaments(validIds, req.userId);

      appLogger.info(`Batch delete completed: ${deletedCount} out of ${validIds.length} filaments deleted`);

      res.json({
        message: `Successfully deleted ${deletedCount} filaments`,
        deletedCount
      });
    } catch (error) {
      appLogger.error("Error batch deleting filaments:", error);
      res.status(500).json({ message: "Failed to delete filaments" });
    }
  });

  // BATCH UPDATE multiple filaments (original endpoint)
  app.patch("/api/filaments/batch", authenticate, async (req, res) => {
    try {
      appLogger.debug("Batch update request", { userId: req.userId });
      const { ids, updates } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Invalid request: ids must be a non-empty array" });
      }

      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ message: "Invalid request: updates must be an object" });
      }

      const validIds = validateBatchIds(ids);

      if (validIds.length === 0) {
        return res.status(400).json({ message: "No valid filament IDs provided" });
      }

      // The same shape a single PATCH accepts. The fields a caller must not set
      // - owner, type, the notification latches - are not in the schema.
      const data = filamentPatchSchema.parse(updates ?? {});
      const updateData: Partial<InsertFilament> = {
        ...data,
        diameter: data.diameter === undefined ? undefined : data.diameter === null ? null : data.diameter.toString(),
      };

      const updatedCount = await storage.batchUpdateFilaments(validIds, updateData, req.userId);

      appLogger.info(`Batch update completed: ${updatedCount} out of ${validIds.length} filaments updated`);

      res.json({
        message: `Successfully updated ${updatedCount} filaments`,
        updatedCount
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      appLogger.error("Error batch updating filaments:", error);
      res.status(500).json({ message: "Failed to update filaments" });
    }
  });
}

