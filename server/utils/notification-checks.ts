import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, materials, filaments } from "@shared/schema";
import { storage } from "../storage";
import { sendMail } from "./mailer";
import { lowStockEmail, dryingReminderEmail } from "./email-templates";
import { logger } from "./logger";

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
  const allUsers = await db.select().from(users).where(eq(users.emailVerified, true));

  const hygroscopicMaterials = await db.select({ name: materials.name })
    .from(materials)
    .where(eq(materials.isHygroscopic, true));
  const hygroscopicNames = new Set(hygroscopicMaterials.map((m) => m.name));

  for (const user of allUsers) {
    if (!user.email) continue;
    if (!user.notifyLowStock && !user.notifyDryingReminder) continue;

    // Via storage, not a raw db query: filaments no longer carries `material`
    // directly (see IMPLEMENTATION_PLAN.md #9) - storage.getFilaments joins it
    // back in from filamentTypes.
    const userFilaments = await storage.getFilaments(user.id);
    const language = user.language === "de" ? "de" : "en";

    if (user.notifyLowStock) {
      const threshold = user.lowStockThresholdPercent ?? 15;
      const lowStockCandidates = userFilaments.filter(
        (f) => f.lowStockNotifiedAt === null && Number(f.remainingPercentage) <= threshold
      );

      if (lowStockCandidates.length > 0) {
        const { subject, html } = lowStockEmail(language, lowStockCandidates.map((f) => f.name));
        await sendMail({ to: user.email, subject, html });

        for (const f of lowStockCandidates) {
          await db.update(filaments).set({ lowStockNotifiedAt: new Date() }).where(eq(filaments.id, f.id));
        }
        logger.info(`Sent low-stock email to user ${user.id} for ${lowStockCandidates.length} spool(s)`);
      }
    }

    if (user.notifyDryingReminder) {
      const reminderDays = user.dryingReminderDays ?? 30;
      const dryingCandidates = userFilaments.filter((f) => {
        if (!hygroscopicNames.has(f.material)) return false;
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

        for (const f of dryingCandidates) {
          await db.update(filaments).set({ dryingReminderNotifiedAt: new Date() }).where(eq(filaments.id, f.id));
        }
        logger.info(`Sent drying-reminder email to user ${user.id} for ${dryingCandidates.length} spool(s)`);
      }
    }
  }
}
