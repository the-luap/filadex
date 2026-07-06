import type { Express } from "express";
import { storage } from "../storage";
import { authenticate } from "../auth";
import { InsertFilament } from "@shared/schema";
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

      // Prepare update data
      const updateData: Partial<InsertFilament> = {};

      // Process each field, ensuring proper type conversion
      if (updates.name !== undefined) updateData.name = String(updates.name);
      if (updates.manufacturer !== undefined) updateData.manufacturer = String(updates.manufacturer);
      if (updates.material !== undefined) updateData.material = String(updates.material);
      if (updates.colorName !== undefined) updateData.colorName = String(updates.colorName);
      if (updates.colorCode !== undefined) updateData.colorCode = String(updates.colorCode);
      if (updates.printTemp !== undefined) updateData.printTemp = String(updates.printTemp);

      // Numeric values stored as strings
      if (updates.diameter !== undefined) updateData.diameter = String(updates.diameter);
      if (updates.totalWeight !== undefined) updateData.totalWeight = String(updates.totalWeight);
      if (updates.remainingPercentage !== undefined) updateData.remainingPercentage = String(updates.remainingPercentage);

      // Additional fields
      if (updates.purchaseDate !== undefined) updateData.purchaseDate = updates.purchaseDate;
      if (updates.purchasePrice !== undefined) updateData.purchasePrice = String(updates.purchasePrice);
      if (updates.status !== undefined) updateData.status = String(updates.status);
      if (updates.spoolType !== undefined) updateData.spoolType = String(updates.spoolType);
      if (updates.dryerCount !== undefined) updateData.dryerCount = Number(updates.dryerCount);
      if (updates.lastDryingDate !== undefined) updateData.lastDryingDate = updates.lastDryingDate;
      if (updates.storageLocation !== undefined) updateData.storageLocation = String(updates.storageLocation);

      const updatedCount = await storage.batchUpdateFilaments(validIds, updateData, req.userId);

      appLogger.info(`Batch update completed: ${updatedCount} out of ${validIds.length} filaments updated`);

      res.json({
        message: `Successfully updated ${updatedCount} filaments`,
        updatedCount
      });
    } catch (error) {
      appLogger.error("Error batch updating filaments:", error);
      res.status(500).json({ message: "Failed to update filaments" });
    }
  });
}

