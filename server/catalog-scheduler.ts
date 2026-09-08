import { communityCatalog } from "./services/community-catalog";
import { logger } from "./utils/logger";

const CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
  if (running) {
    logger.debug("Catalog sync check already running; skipping.");
    return;
  }

  running = true;
  try {
    const status = communityCatalog.getStatus();

    if (isCatalogSyncDue(status.ofd.lastUpdated, now)) {
      logger.info("Executing scheduled Open Filament Database catalog sync...");
      try {
        const count = await communityCatalog.syncOfd();
        logger.info(`Scheduled OFD catalog sync completed: ${count} variants loaded.`);
      } catch (err) {
        logger.error("Scheduled OFD catalog sync failed:", err);
      }
    }

    if (isCatalogSyncDue(status.spoolmandb.lastUpdated, now)) {
      logger.info("Executing scheduled SpoolmanDB catalog sync...");
      try {
        const count = await communityCatalog.syncSpoolmanDb();
        logger.info(`Scheduled SpoolmanDB catalog sync completed: ${count} filaments loaded.`);
      } catch (err) {
        logger.error("Scheduled SpoolmanDB catalog sync failed:", err);
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
