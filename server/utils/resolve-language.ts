import type { Request } from "express";
import { type Language, isSupportedLanguage } from "@shared/languages";
import { verifyToken } from "../auth";
import { storage } from "../storage";

// The sources a request carries about itself, with no session lookup:
//   1. the `language` cookie the client writes when a language is active
//   2. the Accept-Language header
//   3. English
//
// This is the whole answer for anyone who is not the owner of the `token`
// cookie in the browser — a visitor registering a second account, say.
export function resolveAnonymousLanguage(req: Request): Language {
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

// True for requests that are about to be answered with the SPA shell. Every
// other request that reaches the catch-all — a POST to a mistyped API path, an
// asset fetch, a scanner — gets the same HTML but nobody reads its <html lang>,
// so it is not worth a JWT verify and a full user-row read to pick en/de/pl.
function wantsHtmlDocument(req: Request): boolean {
  return req.method === "GET" && Boolean(req.accepts?.("html"));
}

// Work out which UI language the initial HTML should declare, mirroring the
// client's resolution order as closely as the server can:
//   1. the logged-in user's stored preference
//   2. everything resolveAnonymousLanguage knows
export async function resolveLanguage(req: Request): Promise<Language> {
  if (wantsHtmlDocument(req)) {
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
  }

  return resolveAnonymousLanguage(req);
}

export function setHtmlLang(html: string, lang: Language): string {
  return html.replace(/<html lang="[^"]*">/i, `<html lang="${lang}">`);
}
