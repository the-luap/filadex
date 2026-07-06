import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { emailSettings, type EmailSettings } from "@shared/schema";
import { logger } from "./logger";

export async function getEmailSettings(): Promise<EmailSettings | undefined> {
  const [settings] = await db.select().from(emailSettings).where(eq(emailSettings.id, 1));
  return settings;
}

interface SendMailArgs {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email using the admin-configured SMTP settings. If email is not
 * enabled/configured (the default for self-hosted installs that never set up
 * SMTP), this silently no-ops rather than failing - callers must not depend
 * on email having actually been sent for their flow to succeed.
 */
export async function sendMail({ to, subject, html }: SendMailArgs): Promise<boolean> {
  const settings = await getEmailSettings();

  if (!settings?.enabled || !settings.smtpHost || !settings.fromEmail) {
    logger.debug(`Email sending is disabled or not configured; skipping email to ${to}`);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: settings.smtpSecure ?? true,
      auth: settings.smtpUser
        ? { user: settings.smtpUser, pass: settings.smtpPassword || undefined }
        : undefined,
    });

    await transporter.sendMail({
      from: settings.fromName ? `"${settings.fromName}" <${settings.fromEmail}>` : settings.fromEmail,
      to,
      subject,
      html,
    });

    return true;
  } catch (error) {
    logger.error(`Failed to send email to ${to}:`, error);
    return false;
  }
}
