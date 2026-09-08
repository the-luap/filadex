import type { Express } from "express";
import { authenticate, isAdmin } from "../auth";
import { communityCatalog } from "../services/community-catalog";
import { logger as appLogger } from "../utils/logger";
import { sensitiveActionLimiter } from "../utils/rate-limits";

export function registerCommunityFilamentRoutes(app: Express): void {
  app.get("/api/community-filaments/search", authenticate, async (req, res) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      if (!q) {
        return res.json([]);
      }
      const source = req.query.source === "ofd" || req.query.source === "spoolmandb" ? req.query.source : undefined;
      let limit: number | undefined;
      if (req.query.limit) {
        const rawLimit = parseInt(String(req.query.limit), 10);
        limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
      }
      const results = communityCatalog.search(q, { source, limit });
      res.json(results);
    } catch (error) {
      appLogger.error("Error searching community filaments:", error);
      res.status(500).json({ message: "Failed to search community filaments" });
    }
  });

  app.get("/api/community-filaments/gtin/:code", authenticate, async (req, res) => {
    try {
      const code = req.params.code?.trim();
      if (!code) {
        return res.status(400).json({ message: "Invalid GTIN code" });
      }
      const item = communityCatalog.lookupGtin(code);
      if (!item) {
        return res.status(404).json({ message: "Filament not found in community catalog" });
      }
      res.json(item);
    } catch (error) {
      appLogger.error("Error looking up GTIN:", error);
      res.status(500).json({ message: "Failed to look up GTIN" });
    }
  });

  app.get("/api/community-filaments/status", authenticate, isAdmin, async (_req, res) => {
    try {
      const status = communityCatalog.getStatus();
      const dates = [status.ofd.lastUpdated, status.spoolmandb.lastUpdated].filter(Boolean) as string[];
      dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      const lastUpdated = dates[0] || null;

      res.json({
        ofd: status.ofd,
        spoolmandb: status.spoolmandb,
        count: status.ofd.count + status.spoolmandb.count,
        lastUpdated,
      });
    } catch (error) {
      appLogger.error("Error fetching community filament cache status:", error);
      res.status(500).json({ message: "Failed to fetch community filament cache status" });
    }
  });

  app.post("/api/community-filaments/refresh", authenticate, isAdmin, sensitiveActionLimiter, async (req, res) => {
    try {
      if (communityCatalog.isSyncing()) {
        return res.status(409).json({ message: "Catalog synchronization is already in progress" });
      }

      const source = req.body?.source as "ofd" | "spoolmandb" | "all" | undefined;
      let ofdCount = 0;
      let spoolmanCount = 0;

      if (source === "ofd") {
        ofdCount = await communityCatalog.syncOfd();
      } else if (source === "spoolmandb") {
        spoolmanCount = await communityCatalog.syncSpoolmanDb();
      } else {
        ofdCount = await communityCatalog.syncOfd();
        spoolmanCount = await communityCatalog.syncSpoolmanDb();
      }

      res.json({
        ofdCount,
        spoolmanCount,
        count: ofdCount + spoolmanCount,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already in progress")) {
        return res.status(409).json({ message: error.message });
      }
      appLogger.error("Error refreshing community filament cache:", error);
      res.status(500).json({ message: "Failed to refresh community filament cache" });
    }
  });
}
