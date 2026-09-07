export const SUPPORTED_LANGUAGES = ["en", "de", "pl"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export function isSupportedLanguage(lang: unknown): lang is Language {
  return typeof lang === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}

/** "'en', 'de' and 'pl'", for the language validation error message. */
export function formatSupportedLanguages(): string {
  const quoted = SUPPORTED_LANGUAGES.map((lang) => `'${lang}'`);
  return `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1]}`;
}
