import type { Express } from "express";
import { storage } from "../storage";
import { logger as appLogger } from "../utils/logger";
import { validateId } from "../utils/validation";
import { isOneOfMaterials } from "../utils/materials";
import { publicReadLimiter } from "../utils/rate-limits";
import type { Filament } from "@shared/schema";

// What a share shows: the product, not the purchase. The row also carries the
// price, the purchase date, the storage location, the custom-field values and
// the notification timestamps, none of which the public page renders - so the
// owner had no way to know they were public.
function publicFilament(filament: Filament) {
  return {
    id: filament.id,
    name: filament.name,
    manufacturer: filament.manufacturer,
    material: filament.material,
    colorName: filament.colorName,
    colorCode: filament.colorCode,
    diameter: filament.diameter,
    printTemp: filament.printTemp,
    remainingPercentage: filament.remainingPercentage,
  };
}

// One answer for "no such user" and "shares nothing", so the endpoint cannot be
// used to list which ids are accounts.
const NOTHING_SHARED = { message: "No public filaments found" };

export function registerPublicRoutes(app: Express): void {
  // Get public filaments for a specific user by ID
  app.get("/api/public/filaments/:userId", publicReadLimiter, async (req, res) => {
    try {
      const userId = validateId(req.params.userId);
      if (userId === null) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Get user information
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json(NOTHING_SHARED);
      }

      // Get user's sharing settings
      const sharingSettings = await storage.getPublicUserSharing(userId);

      // Check if user has any public filaments
      if (sharingSettings.length === 0) {
        return res.status(404).json(NOTHING_SHARED);
      }

      // Check if user has global sharing enabled
      const hasGlobalSharing = sharingSettings.some((s) => s.materialId === null);

      // Get all filaments for this user
      const filaments = await storage.getFilaments(userId);

      let publicFilaments = filaments;
      if (!hasGlobalSharing) {
        // userSharing.materialId is a FK into the materials catalog table,
        // while filament.material is the material's name (e.g. "PETG") -
        // resolve the shared ids to names before comparing.
        const sharedMaterialIds = sharingSettings
          .filter((s) => s.materialId !== null)
          .map((s) => s.materialId as number);

        const sharedMaterials = await storage.getMaterialsByIds(sharedMaterialIds);
        const isShared = isOneOfMaterials(sharedMaterials.map((m) => m.name));

        publicFilaments = filaments.filter((filament) => isShared(filament.material));
      }

      // Return filaments with user information
      res.json({
        filaments: publicFilaments.map(publicFilament),
        user: {
          id: user.id,
          username: user.username
        }
      });
    } catch (error) {
      appLogger.error("Get public filaments error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
}

