import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { communityFilamentCache } from "@shared/schema";
import { authenticate, isAdmin } from "../auth";
import { refreshCommunityFilamentCache, searchCommunityFilaments } from "../utils/spoolmandb-sync";
import { logger as appLogger } from "../utils/logger";

export function registerCommunityFilamentRoutes(app: Express): void {
  app.get("/api/community-filaments/search", authenticate, async (req, res) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      if (!q) {
        return res.json([]);
      }
      const results = await searchCommunityFilaments(q);
      res.json(results);
    } catch (error) {
      appLogger.error("Error searching community filaments:", error);
      res.status(500).json({ message: "Failed to search community filaments" });
    }
  });

  app.get("/api/community-filaments/status", authenticate, isAdmin, async (_req, res) => {
    try {
      const [row] = await db.select({
        count: sql<number>`count(*)`,
        lastUpdated: sql<string | null>`max(${communityFilamentCache.updatedAt})`,
      }).from(communityFilamentCache);
      res.json({ count: Number(row?.count ?? 0), lastUpdated: row?.lastUpdated ?? null });
    } catch (error) {
      appLogger.error("Error fetching community filament cache status:", error);
      res.status(500).json({ message: "Failed to fetch community filament cache status" });
    }
  });

  app.post("/api/community-filaments/refresh", authenticate, isAdmin, async (_req, res) => {
    try {
      const count = await refreshCommunityFilamentCache();
      res.json({ count });
    } catch (error) {
      appLogger.error("Error refreshing community filament cache:", error);
      res.status(500).json({ message: "Failed to refresh community filament cache" });
    }
  });
}
