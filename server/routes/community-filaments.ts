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
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      const results = communityCatalog.search(q, { source, limit });
      res.json(results);
    } catch (error) {
      appLogger.error("Error searching community filaments:", error);
      res.status(500).json({ message: "Failed to search community filaments" });
    }
  });

  app.get("/api/community-filaments/gtin/:code", authenticate, async (req, res) => {
    try {
      const code = req.params.code;
      const item = communityCatalog.lookupGtin(code);
      if (!item) {
        return res.status(404).json({ message: "GTIN not found in catalog" });
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
      res.json({
        ofd: status.ofd,
        spoolmandb: status.spoolmandb,
        count: status.ofd.count + status.spoolmandb.count,
        lastUpdated: status.ofd.lastUpdated || status.spoolmandb.lastUpdated,
      });
    } catch (error) {
      appLogger.error("Error fetching community filament cache status:", error);
      res.status(500).json({ message: "Failed to fetch community filament cache status" });
    }
  });

  app.post("/api/community-filaments/refresh", authenticate, isAdmin, sensitiveActionLimiter, async (req, res) => {
    try {
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
      appLogger.error("Error refreshing community filament cache:", error);
      res.status(500).json({ message: "Failed to refresh community filament cache" });
    }
  });
}
