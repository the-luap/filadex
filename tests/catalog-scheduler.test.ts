import { describe, expect, it, vi, afterEach } from "vitest";
import {
  isCatalogSyncDue,
  runScheduledCatalogSync,
} from "../server/catalog-scheduler";
import { communityCatalog } from "../server/services/community-catalog";

describe("catalog-scheduler", () => {
  describe("isCatalogSyncDue", () => {
    it("returns true when lastUpdated is null", () => {
      expect(isCatalogSyncDue(null)).toBe(true);
    });

    it("returns false when lastUpdated is within 24 hours", () => {
      const now = new Date("2026-09-08T12:00:00Z");
      const recent = new Date("2026-09-08T06:00:00Z").toISOString();
      expect(isCatalogSyncDue(recent, now)).toBe(false);
    });

    it("returns true when lastUpdated is older than 24 hours", () => {
      const now = new Date("2026-09-08T12:00:00Z");
      const stale = new Date("2026-09-07T11:00:00Z").toISOString();
      expect(isCatalogSyncDue(stale, now)).toBe(true);
    });
  });

  describe("runScheduledCatalogSync", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("triggers syncOfd and syncSpoolmanDb when due", async () => {
      vi.spyOn(communityCatalog, "getStatus").mockReturnValue({
        ofd: { count: 0, lastUpdated: null },
        spoolmandb: { count: 0, lastUpdated: null },
      });
      const ofdSpy = vi.spyOn(communityCatalog, "syncOfd").mockResolvedValue(100);
      const spoolmanSpy = vi.spyOn(communityCatalog, "syncSpoolmanDb").mockResolvedValue(50);

      await runScheduledCatalogSync();

      expect(ofdSpy).toHaveBeenCalledTimes(1);
      expect(spoolmanSpy).toHaveBeenCalledTimes(1);
    });

    it("does not trigger sync when catalogs are fresh (<24h)", async () => {
      const freshDate = new Date().toISOString();
      vi.spyOn(communityCatalog, "getStatus").mockReturnValue({
        ofd: { count: 100, lastUpdated: freshDate },
        spoolmandb: { count: 50, lastUpdated: freshDate },
      });
      const ofdSpy = vi.spyOn(communityCatalog, "syncOfd").mockResolvedValue(100);
      const spoolmanSpy = vi.spyOn(communityCatalog, "syncSpoolmanDb").mockResolvedValue(50);

      await runScheduledCatalogSync();

      expect(ofdSpy).not.toHaveBeenCalled();
      expect(spoolmanSpy).not.toHaveBeenCalled();
    });
  });
});
