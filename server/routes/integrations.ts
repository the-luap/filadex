import type { Express } from "express";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { storage } from "../storage";
import { authenticate, requireApiToken, generateApiToken } from "../auth";
import { insertApiTokenSchema, printerUsageEventSchema } from "@shared/schema";
import { logger as appLogger } from "../utils/logger";
import { validateId } from "../utils/validation";

/**
 * Phase A of the printer integration (see IMPLEMENTATION_PLAN.md #5): a
 * generic, ecosystem-agnostic ingestion endpoint any print server can push
 * usage events to, plus the API token management a user needs to authorize
 * that print server. Phase B (server/routes/spoolman-compat.ts) builds
 * Moonraker compatibility on top of the same filament_usage_log writes.
 */
export function registerIntegrationRoutes(app: Express): void {
  app.get("/api/api-tokens", authenticate, async (req, res) => {
    try {
      const tokens = await storage.getApiTokens(req.userId);
      res.json(tokens.map(({ tokenHash, ...rest }) => rest));
    } catch (error) {
      appLogger.error("Error fetching API tokens:", error);
      res.status(500).json({ message: "Failed to fetch API tokens" });
    }
  });

  app.post("/api/api-tokens", authenticate, async (req, res) => {
    try {
      const { label } = insertApiTokenSchema.parse(req.body);
      const { plaintext, hash } = generateApiToken();
      const created = await storage.createApiToken(req.userId, hash, label);
      // The plaintext token is only ever returned here - it can't be recovered afterwards.
      res.status(201).json({ id: created.id, label: created.label, createdAt: created.createdAt, token: plaintext });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      appLogger.error("Error creating API token:", error);
      res.status(500).json({ message: "Failed to create API token" });
    }
  });

  app.delete("/api/api-tokens/:id", authenticate, async (req, res) => {
    try {
      const id = validateId(req.params.id);
      if (id === null) {
        return res.status(400).json({ message: "Invalid API token ID" });
      }

      const success = await storage.deleteApiToken(id, req.userId);
      if (!success) {
        return res.status(404).json({ message: "API token not found" });
      }

      res.status(204).end();
    } catch (error) {
      appLogger.error("Error deleting API token:", error);
      res.status(500).json({ message: "Failed to delete API token" });
    }
  });

  app.post("/api/integrations/usage", requireApiToken, async (req, res) => {
    try {
      const event = printerUsageEventSchema.parse(req.body);

      const filament = await storage.getFilament(event.filamentId, req.userId);
      if (!filament) {
        return res.status(404).json({ message: "Filament not found" });
      }

      // totalWeight is stored in kg; deltaWeight (from the print server) is in grams.
      const totalWeightGrams = Number(filament.totalWeight) * 1000;
      const oldPercentage = Number(filament.remainingPercentage);
      const deltaPercentage = totalWeightGrams > 0 ? (event.deltaWeight / totalWeightGrams) * 100 : 0;
      const newPercentage = Math.min(100, Math.max(0, oldPercentage + deltaPercentage));

      const updatedFilament = await storage.updateFilament(
        event.filamentId,
        {
          remainingPercentage: newPercentage.toString(),
          ...(newPercentage > oldPercentage ? { lowStockNotifiedAt: null } : {}),
        },
        req.userId
      );
      if (!updatedFilament) {
        return res.status(404).json({ message: "Filament not found" });
      }

      await storage.createFilamentUsageLog({
        filamentId: event.filamentId,
        userId: req.userId,
        deltaWeight: event.deltaWeight.toString(),
        remainingPercentageAfter: updatedFilament.remainingPercentage,
        note: event.externalJobId ? `Print job ${event.externalJobId}` : undefined,
        source: "printer",
      });

      res.json(updatedFilament);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      appLogger.error("Error recording printer usage event:", error);
      res.status(500).json({ message: "Failed to record printer usage event" });
    }
  });
}
