export const SUPPORTED_LANGUAGES = ["en", "de", "pl"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export function isSupportedLanguage(lang: unknown): lang is Language {
  return typeof lang === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}
