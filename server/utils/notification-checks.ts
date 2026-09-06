import { storage } from "../storage";
import { sendMail } from "./mailer";
import { lowStockEmail, dryingReminderEmail } from "./email-templates";
import { logger } from "./logger";
import { isOneOfMaterials } from "./materials";

const DRYING_REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000; // at most one reminder/day per spool

function daysAgo(dateStr: string | Date): number {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000);
}

/**
 * Runs the low-stock and drying-reminder checks for every user with the
 * corresponding preference enabled, and emails a single batched summary per
 * user per run. Called on a timer from server/index.ts - not a request
 * handler, since there's no external trigger for "check periodically".
 */
export async function runScheduledChecks(): Promise<void> {
  const allUsers = await storage.getVerifiedUsers();

  for (const user of allUsers) {
    if (!user.email) continue;
    if (!user.notifyLowStock && !user.notifyDryingReminder) continue;

    // Via storage, not a raw db query: filaments no longer carries `material`
    // directly (see IMPLEMENTATION_PLAN.md #9) - storage.getFilaments joins it
    // back in from filamentTypes.
    const userFilaments = await storage.getFilaments(user.id);
    const language = user.language === "de" || user.language === "pl" ? user.language : "en";

    if (user.notifyLowStock) {
      const threshold = user.lowStockThresholdPercent ?? 15;
      const lowStockCandidates = userFilaments.filter(
        (f) => f.lowStockNotifiedAt === null && Number(f.remainingPercentage) <= threshold
      );

      if (lowStockCandidates.length > 0) {
        const { subject, html } = lowStockEmail(language, lowStockCandidates.map((f) => f.name));
        await sendMail({ to: user.email, subject, html });

        await storage.markLowStockNotified(lowStockCandidates.map((f) => f.id));
        logger.info(`Sent low-stock email to user ${user.id} for ${lowStockCandidates.length} spool(s)`);
      }
    }

    if (user.notifyDryingReminder) {
      // Per user: a material one user marks hygroscopic in their Personal
      // Catalog must not start flagging every user's Spools.
      const isHygroscopic = isOneOfMaterials(await storage.getHygroscopicMaterialNames(user.id));
      const reminderDays = user.dryingReminderDays ?? 30;
      const dryingCandidates = userFilaments.filter((f) => {
        if (!isHygroscopic(f.material)) return false;
        if (
          f.dryingReminderNotifiedAt &&
          Date.now() - f.dryingReminderNotifiedAt.getTime() < DRYING_REMINDER_COOLDOWN_MS
        ) {
          return false;
        }
        const referenceDate = f.lastDryingDate ?? f.purchaseDate;
        if (!referenceDate) return false;
        return daysAgo(referenceDate) >= reminderDays;
      });

      if (dryingCandidates.length > 0) {
        const { subject, html } = dryingReminderEmail(language, dryingCandidates.map((f) => f.name));
        await sendMail({ to: user.email, subject, html });

        await storage.markDryingReminderNotified(dryingCandidates.map((f) => f.id));
        logger.info(`Sent drying-reminder email to user ${user.id} for ${dryingCandidates.length} spool(s)`);
      }
    }
  }
}
