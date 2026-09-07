import type { Request } from "express";
import { type Language as ResolvedLanguage, isSupportedLanguage } from "@shared/languages";
import { verifyToken } from "../auth";
import { storage } from "../storage";

export type { ResolvedLanguage };

// Work out which UI language the initial HTML should declare, mirroring the
// client's resolution order as closely as the server can:
//   1. the logged-in user's stored preference
//   2. the `language` cookie the client writes when a language is active
//   3. the Accept-Language header
//   4. English
export async function resolveLanguage(req: Request): Promise<ResolvedLanguage> {
  const userId = verifyToken(req.cookies?.token);
  if (userId !== null) {
    try {
      const user = await storage.getUser(userId);
      if (isSupportedLanguage(user?.language)) {
        return user.language;
      }
    } catch {
      // fall through to cookie / header / default
    }
  }

  if (isSupportedLanguage(req.cookies?.language)) {
    return req.cookies.language;
  }

  const acceptLanguage = req.headers["accept-language"];
  if (acceptLanguage) {
    for (const part of acceptLanguage.split(",")) {
      const tag = part.split(";")[0].trim().split("-")[0].toLowerCase();
      if (isSupportedLanguage(tag)) {
        return tag;
      }
    }
  }

  return "en";
}

export function setHtmlLang(html: string, lang: ResolvedLanguage): string {
  return html.replace(/<html lang="[^"]*">/i, `<html lang="${lang}">`);
}
