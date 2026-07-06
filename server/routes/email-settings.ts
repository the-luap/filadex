import type { Express } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { emailSettings, updateEmailSettingsSchema } from "../../shared/schema";
import { authenticate, isAdmin } from "../auth";
import { sendMail, getEmailSettings } from "../utils/mailer";
import { logger as appLogger } from "../utils/logger";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export function registerEmailSettingsRoutes(app: Express): void {
  // Get current email settings (admin only). Never returns the SMTP password.
  app.get("/api/settings/email", authenticate, isAdmin, async (_req, res) => {
    try {
      const settings = await getEmailSettings();
      if (!settings) {
        return res.status(404).json({ message: "Email settings not found" });
      }
      const { smtpPassword, ...safeSettings } = settings;
      res.json({ ...safeSettings, hasPassword: !!smtpPassword });
    } catch (error) {
      appLogger.error("Error fetching email settings:", error);
      res.status(500).json({ message: "Failed to fetch email settings" });
    }
  });

  // Update email settings (admin only). Omit smtpPassword in the request to keep the existing one.
  app.put("/api/settings/email", authenticate, isAdmin, async (req, res) => {
    try {
      const validated = updateEmailSettingsSchema.partial().parse(req.body);

      const [updated] = await db
        .update(emailSettings)
        .set({ ...validated, updatedAt: new Date() })
        .where(eq(emailSettings.id, 1))
        .returning();

      const { smtpPassword, ...safeSettings } = updated;
      res.json({ ...safeSettings, hasPassword: !!smtpPassword });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      appLogger.error("Error updating email settings:", error);
      res.status(500).json({ message: "Failed to update email settings" });
    }
  });

  // Send a test email to confirm the configured SMTP settings actually work (admin only).
  app.post("/api/settings/email/test", authenticate, isAdmin, async (req, res) => {
    try {
      const to = req.body?.to || req.user?.username;
      if (!to || typeof to !== "string" || !to.includes("@")) {
        return res.status(400).json({ message: "A valid recipient email address is required" });
      }

      const sent = await sendMail({
        to,
        subject: "Filadex test email",
        html: "<p>This is a test email from your Filadex instance. If you received this, your SMTP settings are working.</p>",
      });

      if (!sent) {
        return res.status(400).json({ message: "Email is disabled or not fully configured, or sending failed - check the server logs" });
      }

      res.json({ message: "Test email sent" });
    } catch (error) {
      appLogger.error("Error sending test email:", error);
      res.status(500).json({ message: "Failed to send test email" });
    }
  });
}
