export const SUPPORTED_LANGUAGES = ["en", "de", "pl"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export function isSupportedLanguage(lang: unknown): lang is Language {
  return typeof lang === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}

export function formatSupportedLanguages(languages: readonly string[] = SUPPORTED_LANGUAGES): string {
  const formatted = languages.map((lang) => `'${lang}'`);
  if (formatted.length === 0) return "";
  if (formatted.length === 1) return formatted[0];
  return `${formatted.slice(0, -1).join(", ")} and ${formatted[formatted.length - 1]}`;
}

