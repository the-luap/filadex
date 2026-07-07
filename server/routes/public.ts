import type { Express } from "express";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { db } from "../db";
import { users, userSharing, materials } from "../../shared/schema";
import { authenticate } from "../auth";
import { storage } from "../storage";
import { logger as appLogger } from "../utils/logger";
import { validateId } from "../utils/validation";

export function registerPublicRoutes(app: Express): void {
  // Get public filaments for a specific user by ID
  app.get("/api/public/filaments/:userId", async (req, res) => {
    try {
      const userId = validateId(req.params.userId);
      if (userId === null) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Get user information
      const [user] = await db.select().from(users).where(eq(users.id, userId));

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user's sharing settings
      const sharingSettings = await db.select().from(userSharing)
        .where(and(
          eq(userSharing.userId, userId),
          eq(userSharing.isPublic, true)
        ));

      // Check if user has any public filaments
      if (sharingSettings.length === 0) {
        return res.status(404).json({ message: "No public filaments found" });
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

        const sharedMaterials = sharedMaterialIds.length > 0
          ? await db.select().from(materials).where(inArray(materials.id, sharedMaterialIds))
          : [];
        const sharedMaterialNames = new Set(sharedMaterials.map((m) => m.name));

        publicFilaments = filaments.filter((filament) => sharedMaterialNames.has(filament.material));
      }

      // Return filaments with user information
      res.json({
        filaments: publicFilaments,
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

  // User sharing routes
  app.post("/api/sharing", authenticate, async (req, res) => {
    try {
      const { materialId, isPublic } = req.body;

      // Check if sharing already exists
      const existingSharing = await db.select()
        .from(userSharing)
        .where(
          materialId
            ? and(eq(userSharing.userId, req.userId), eq(userSharing.materialId, materialId))
            : and(eq(userSharing.userId, req.userId), isNull(userSharing.materialId))
        );

      if (existingSharing.length > 0) {
        // Update existing sharing
        const [updated] = await db.update(userSharing)
          .set({ isPublic })
          .where(eq(userSharing.id, existingSharing[0].id))
          .returning();

        return res.json(updated);
      }

      // Create new sharing
      const [newSharing] = await db.insert(userSharing)
        .values({
          userId: req.userId,
          materialId: materialId || null,
          isPublic
        })
        .returning();

      res.status(201).json(newSharing);
    } catch (error) {
      appLogger.error("Error updating sharing:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/sharing", authenticate, async (req, res) => {
    try {
      const sharingSettings = await db.select().from(userSharing)
        .where(eq(userSharing.userId, req.userId));

      res.json(sharingSettings);
    } catch (error) {
      appLogger.error("Error fetching sharing:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
}

