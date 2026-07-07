import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireApiToken } from "../auth";
import type { Filament } from "@shared/schema";
import { logger as appLogger } from "../utils/logger";
import { validateId } from "../utils/validation";

/**
 * Phase B of the printer integration (see IMPLEMENTATION_PLAN.md #5):
 * implements the subset of Spoolman's REST API that Moonraker's `[spoolman]`
 * config module calls, mapped onto Filadex's own filaments/filament_usage_log
 * tables. Lets Filadex act as a drop-in Moonraker spoolman endpoint without
 * any change on the Klipper/Mainsail/Fluidd side - point Moonraker's
 * `server` config at this base URL with an API token (see requireApiToken).
 *
 * Best-effort compatibility, not a full Spoolman API implementation: only
 * the fields Moonraker's integration actually reads/writes are covered.
 */

function toSpoolmanShape(filament: Filament) {
  const totalWeightGrams = Number(filament.totalWeight) * 1000;
  const remainingWeightGrams = (totalWeightGrams * Number(filament.remainingPercentage)) / 100;

  return {
    id: filament.id,
    registered: filament.purchaseDate ?? null,
    price: filament.purchasePrice ? Number(filament.purchasePrice) : null,
    initial_weight: totalWeightGrams,
    remaining_weight: remainingWeightGrams,
    used_weight: totalWeightGrams - remainingWeightGrams,
    location: filament.storageLocation ?? null,
    archived: false,
    filament: {
      id: filament.id,
      name: filament.name,
      material: filament.material,
      price: filament.purchasePrice ? Number(filament.purchasePrice) : null,
      diameter: filament.diameter ? Number(filament.diameter) : 1.75,
      color_hex: filament.colorCode ? filament.colorCode.replace(/^#/, "") : null,
      vendor: filament.manufacturer ? { name: filament.manufacturer } : null,
    },
  };
}

async function handleUse(req: Request, res: Response) {
  try {
    const id = validateId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "Invalid spool id" });
    }

    const filament = await storage.getFilament(id, req.userId);
    if (!filament) {
      return res.status(404).json({ error: "Spool not found" });
    }

    const useWeight: number | undefined = req.body.use_weight;
    if (typeof useWeight !== "number") {
      return res.status(400).json({ error: "use_weight (grams) is required" });
    }

    const totalWeightGrams = Number(filament.totalWeight) * 1000;
    const oldPercentage = Number(filament.remainingPercentage);
    const deltaPercentage = totalWeightGrams > 0 ? (-useWeight / totalWeightGrams) * 100 : 0;
    const newPercentage = Math.min(100, Math.max(0, oldPercentage + deltaPercentage));

    const updatedFilament = await storage.updateFilament(
      id,
      { remainingPercentage: newPercentage.toString() },
      req.userId
    );
    if (!updatedFilament) {
      return res.status(404).json({ error: "Spool not found" });
    }

    await storage.createFilamentUsageLog({
      filamentId: id,
      userId: req.userId,
      deltaWeight: (-useWeight).toString(),
      remainingPercentageAfter: updatedFilament.remainingPercentage,
      source: "printer",
    });

    res.json(toSpoolmanShape(updatedFilament));
  } catch (error) {
    appLogger.error("Error handling spoolman-compat /use:", error);
    res.status(500).json({ error: "Failed to record spool usage" });
  }
}

export function registerSpoolmanCompatRoutes(app: Express): void {
  app.get("/api/spoolman-compat/v1/spool/:id", requireApiToken, async (req, res) => {
    try {
      const id = validateId(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: "Invalid spool id" });
      }

      const filament = await storage.getFilament(id, req.userId);
      if (!filament) {
        return res.status(404).json({ error: "Spool not found" });
      }

      res.json(toSpoolmanShape(filament));
    } catch (error) {
      appLogger.error("Error fetching spoolman-compat spool:", error);
      res.status(500).json({ error: "Failed to fetch spool" });
    }
  });

  app.get("/api/spoolman-compat/v1/spool", requireApiToken, async (req, res) => {
    try {
      const filaments = await storage.getFilaments(req.userId);
      res.json(filaments.map(toSpoolmanShape));
    } catch (error) {
      appLogger.error("Error listing spoolman-compat spools:", error);
      res.status(500).json({ error: "Failed to list spools" });
    }
  });

  app.patch("/api/spoolman-compat/v1/spool/:id", requireApiToken, async (req, res) => {
    try {
      const id = validateId(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: "Invalid spool id" });
      }

      const filament = await storage.getFilament(id, req.userId);
      if (!filament) {
        return res.status(404).json({ error: "Spool not found" });
      }

      const updateData: { remainingPercentage?: string } = {};
      if (typeof req.body.remaining_weight === "number") {
        const totalWeightGrams = Number(filament.totalWeight) * 1000;
        const newPercentage = totalWeightGrams > 0
          ? Math.min(100, Math.max(0, (req.body.remaining_weight / totalWeightGrams) * 100))
          : 0;
        updateData.remainingPercentage = newPercentage.toString();
      }

      const updatedFilament = await storage.updateFilament(id, updateData, req.userId);
      if (!updatedFilament) {
        return res.status(404).json({ error: "Spool not found" });
      }

      res.json(toSpoolmanShape(updatedFilament));
    } catch (error) {
      appLogger.error("Error updating spoolman-compat spool:", error);
      res.status(500).json({ error: "Failed to update spool" });
    }
  });

  // Spoolman's OpenAPI spec uses PUT for /use; hedge with POST too since some
  // Moonraker versions have called it differently.
  app.put("/api/spoolman-compat/v1/spool/:id/use", requireApiToken, handleUse);
  app.post("/api/spoolman-compat/v1/spool/:id/use", requireApiToken, handleUse);
}
