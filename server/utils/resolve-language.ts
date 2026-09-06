import type { Request } from "express";
import { verifyToken } from "../auth";
import { storage } from "../storage";

// Keep in sync with the client's Language type (client/src/i18n/index.ts).
const SUPPORTED = ["en", "de", "pl"] as const;
export type ResolvedLanguage = (typeof SUPPORTED)[number];

function isSupported(value: unknown): value is ResolvedLanguage {
  return typeof value === "string" && (SUPPORTED as readonly string[]).includes(value);
}

// Work out which UI language the initial HTML should declare, mirroring the
// client's resolution order as closely as the server can:
//   1. the `language` cookie the client writes when a language is active
//   2. the logged-in user's stored preference
//   3. the Accept-Language header
//   4. English
export async function resolveLanguage(req: Request): Promise<ResolvedLanguage> {
  if (isSupported(req.cookies?.language)) {
    return req.cookies.language;
  }

  const userId = verifyToken(req.cookies?.token);
  if (userId !== null) {
    try {
      const user = await storage.getUser(userId);
      if (isSupported(user?.language)) {
        return user.language;
      }
    } catch {
      // fall through to header / default
    }
  }

  const acceptLanguage = req.headers["accept-language"];
  if (acceptLanguage) {
    for (const part of acceptLanguage.split(",")) {
      const tag = part.split(";")[0].trim().split("-")[0].toLowerCase();
      if (isSupported(tag)) {
        return tag;
      }
    }
  }

  return "en";
}

export function setHtmlLang(html: string, lang: ResolvedLanguage): string {
  return html.replace(/<html lang="[^"]*">/i, `<html lang="${lang}">`);
}
