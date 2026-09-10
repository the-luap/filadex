import { communityCatalog } from "./services/community-catalog";
import { logger } from "./utils/logger";

const CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const FAILURE_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes cooldown after failure

const lastFailureTime: Record<"ofd" | "spoolmandb", number> = {
  ofd: 0,
  spoolmandb: 0,
};

export function _resetFailureCooldownForTesting(): void {
  lastFailureTime.ofd = 0;
  lastFailureTime.spoolmandb = 0;
}

export function isCatalogSyncDue(lastUpdatedIso: string | null, now: Date = new Date()): boolean {
  if (!lastUpdatedIso) {
    return true;
  }
  const lastUpdated = new Date(lastUpdatedIso);
  if (isNaN(lastUpdated.getTime())) {
    return true;
  }
  return now.getTime() - lastUpdated.getTime() >= SYNC_INTERVAL_MS;
}

let running = false;

export async function runScheduledCatalogSync(now: Date = new Date()): Promise<void> {
  if (running || communityCatalog.isSyncing()) {
    logger.debug("Catalog sync check already running or catalog is syncing; skipping.");
    return;
  }

  running = true;
  try {
    const status = communityCatalog.getStatus();
    const nowMs = now.getTime();

    if (isCatalogSyncDue(status.ofd.lastUpdated, now)) {
      if (nowMs - lastFailureTime.ofd < FAILURE_COOLDOWN_MS) {
        logger.debug("Scheduled OFD catalog sync is within failure cooldown; skipping.");
      } else {
        logger.info("Executing scheduled Open Filament Database catalog sync...");
        try {
          const count = await communityCatalog.syncOfd();
          logger.info(`Scheduled OFD catalog sync completed: ${count} variants loaded.`);
          lastFailureTime.ofd = 0;
        } catch (err) {
          lastFailureTime.ofd = nowMs;
          logger.error("Scheduled OFD catalog sync failed:", err);
        }
      }
    }

    if (isCatalogSyncDue(status.spoolmandb.lastUpdated, now)) {
      if (nowMs - lastFailureTime.spoolmandb < FAILURE_COOLDOWN_MS) {
        logger.debug("Scheduled SpoolmanDB catalog sync is within failure cooldown; skipping.");
      } else {
        logger.info("Executing scheduled SpoolmanDB catalog sync...");
        try {
          const count = await communityCatalog.syncSpoolmanDb();
          logger.info(`Scheduled SpoolmanDB catalog sync completed: ${count} filaments loaded.`);
          lastFailureTime.spoolmandb = 0;
        } catch (err) {
          lastFailureTime.spoolmandb = nowMs;
          logger.error("Scheduled SpoolmanDB catalog sync failed:", err);
        }
      }
    }
  } finally {
    running = false;
  }
}

export function startCatalogScheduler(): NodeJS.Timeout {
  // Trigger initial check shortly after startup
  setTimeout(() => {
    runScheduledCatalogSync().catch((err) => {
      logger.error("Error during initial catalog sync:", err);
    });
  }, 5000);

  return setInterval(() => {
    runScheduledCatalogSync().catch((err) => {
      logger.error("Error during scheduled catalog sync:", err);
    });
  }, CHECK_INTERVAL_MS);
}
