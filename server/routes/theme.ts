import type { Express } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, updateThemeSchema } from "@shared/schema";
import { authenticate } from "../auth";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { logger as appLogger } from "../utils/logger";

/**
 * Per-user theme preferences (accent color, light/dark appearance). Used to
 * be a single global theme.json file that any visitor could read/write and
 * every user shared - see migrations/add_user_theme_preferences.ts.
 */
export function registerThemeRoutes(app: Express): void {
  app.get("/api/theme", authenticate, async (req, res) => {
    try {
      const [user] = await db.select({
        variant: users.themeVariant,
        primary: users.themePrimary,
        appearance: users.themeAppearance,
        radius: users.themeRadius,
      }).from(users).where(eq(users.id, req.userId));

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      appLogger.error("Error fetching theme:", error);
      res.status(500).json({ message: "Failed to read theme" });
    }
  });

  app.post("/api/theme", authenticate, async (req, res) => {
    try {
      const data = updateThemeSchema.parse(req.body);
      const updateData: Record<string, unknown> = {};
      if (data.variant !== undefined) updateData.themeVariant = data.variant;
      if (data.primary !== undefined) updateData.themePrimary = data.primary;
      if (data.appearance !== undefined) updateData.themeAppearance = data.appearance;
      if (data.radius !== undefined) updateData.themeRadius = data.radius.toString();

      if (Object.keys(updateData).length > 0) {
        await db.update(users).set(updateData).where(eq(users.id, req.userId));
      }

      res.json({ message: "Theme updated successfully" });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      appLogger.error("Error updating theme:", error);
      res.status(500).json({ message: "Failed to update theme" });
    }
  });
}
