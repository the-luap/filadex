import type { Express } from "express";
import { updateSystemSettingsSchema } from "../../shared/schema";
import { authenticate, isAdmin } from "../auth";
import { storage } from "../storage";
import { logger as appLogger } from "../utils/logger";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export function registerSystemSettingsRoutes(app: Express): void {
  // Public system settings available to unauthenticated visitors
  app.get("/api/system/public-settings", async (_req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json({
        registrationEnabled: settings.registrationEnabled ?? true,
      });
    } catch (error) {
      appLogger.error("Error fetching public system settings:", error);
      res.status(500).json({ message: "Failed to fetch system settings" });
    }
  });

  // Get full system settings (admin only)
  app.get("/api/settings/system", authenticate, isAdmin, async (_req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json(settings);
    } catch (error) {
      appLogger.error("Error fetching system settings:", error);
      res.status(500).json({ message: "Failed to fetch system settings" });
    }
  });

  // Update system settings (admin only)
  app.put("/api/settings/system", authenticate, isAdmin, async (req, res) => {
    try {
      const validated = updateSystemSettingsSchema.partial().parse(req.body);
      const updated = await storage.updateSystemSettings(validated);
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      appLogger.error("Error updating system settings:", error);
      res.status(500).json({ message: "Failed to update system settings" });
    }
  });
}
