import type { Express } from "express";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { storage } from "../storage";
import { authenticate } from "../auth";
import { insertCustomFieldDefinitionSchema } from "@shared/schema";
import { logger as appLogger } from "../utils/logger";
import { validateId } from "../utils/validation";

/**
 * Custom field definitions are per-user (not shared/admin-only like the
 * catalog tables): a user's own tracked attributes on their own filaments.
 */
export function registerCustomFieldRoutes(app: Express): void {
  app.get("/api/custom-fields", authenticate, async (req, res) => {
    try {
      const definitions = await storage.getCustomFieldDefinitions(req.userId);
      res.json(definitions);
    } catch (error) {
      appLogger.error("Error fetching custom field definitions:", error);
      res.status(500).json({ message: "Failed to fetch custom field definitions" });
    }
  });

  app.post("/api/custom-fields", authenticate, async (req, res) => {
    try {
      const validatedData = insertCustomFieldDefinitionSchema.parse(req.body);
      const created = await storage.createCustomFieldDefinition(req.userId, validatedData);
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      appLogger.error("Error creating custom field definition:", error);
      res.status(500).json({ message: "Failed to create custom field definition" });
    }
  });

  app.delete("/api/custom-fields/:id", authenticate, async (req, res) => {
    try {
      const id = validateId(req.params.id);
      if (id === null) {
        return res.status(400).json({ message: "Invalid custom field ID" });
      }

      const success = await storage.deleteCustomFieldDefinition(id, req.userId);
      if (!success) {
        return res.status(404).json({ message: "Custom field definition not found" });
      }

      res.status(204).end();
    } catch (error) {
      appLogger.error("Error deleting custom field definition:", error);
      res.status(500).json({ message: "Failed to delete custom field definition" });
    }
  });
}
