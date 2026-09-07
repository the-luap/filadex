import { logger } from "./logger";

/**
 * The address this install is reached at, for links that leave the browser.
 *
 * Emailed links used to be built from the request's Host header. Nothing
 * validates that header, so a forged request to forgot-password produced a
 * genuine Filadex email whose link pointed at the attacker's host and carried
 * the victim's live reset token. The only safe origin for such a link is one
 * the operator configured, which is APP_URL.
 *
 * Returns null when unset or unusable; callers then decline to send the
 * email rather than guess.
 */
export function getAppUrl(): string | null {
  const raw = process.env.APP_URL?.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    logger.warn(`APP_URL is not a valid URL: ${raw}`);
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    logger.warn(`APP_URL must start with http:// or https://: ${raw}`);
    return null;
  }
  // origin + path without a trailing slash, so `${appUrl}/reset-password` is
  // right whether the operator wrote the slash or not.
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}
