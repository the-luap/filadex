import { type Language, SUPPORTED_LANGUAGES, isSupportedLanguage } from "@shared/languages";
export type { Language };
export { SUPPORTED_LANGUAGES, isSupportedLanguage };

export interface ClientLanguageSources {
  localStorage?: string | null;
  cookie?: string | null;
  browserLanguages?: readonly string[] | null;
  defaultLanguage?: string | null;
  documentLang?: string | null;
}

/**
 * Resolves the client's language according to:
 * 1. localStorage (user's explicit client preference)
 * 2. language cookie (set by client, recognized by server)
 * 3. browser languages (navigator.languages, first supported wins)
 * 4. defaultLanguage (e.g. VITE_DEFAULT_LANGUAGE)
 * 5. document.documentElement.lang (stamped by server via resolveLanguage)
 * 6. 'en' (default fallback)
 */
export function resolveClientLanguage(sources: ClientLanguageSources): Language {
  if (isSupportedLanguage(sources.localStorage)) {
    return sources.localStorage;
  }

  if (isSupportedLanguage(sources.cookie)) {
    return sources.cookie;
  }

  // Scan the whole ranked list, like the server does with Accept-Language: a
  // user whose first choice is unsupported still gets their second.
  for (const tag of sources.browserLanguages ?? []) {
    const code = tag.split("-")[0].toLowerCase();
    if (isSupportedLanguage(code)) {
      return code;
    }
  }

  if (isSupportedLanguage(sources.defaultLanguage)) {
    return sources.defaultLanguage;
  }

  if (isSupportedLanguage(sources.documentLang)) {
    return sources.documentLang;
  }

  return "en";
}

/**
 * Reads cookie value by name in browser context.
 */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Safely reads the language from localStorage.
 */
export function getStorageLanguage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("language");
  } catch {
    return null;
  }
}

/**
 * Reads the browser's ranked language list, falling back to the single
 * `navigator.language` where `navigator.languages` is unavailable.
 */
export function getBrowserLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  if (navigator.languages?.length) return navigator.languages;
  return navigator.language ? [navigator.language] : [];
}

/**
 * Reads the initial language in browser context synchronously.
 */
export function getInitialClientLanguage(): Language {
  if (typeof window === "undefined") return "en";

  const storageLang = getStorageLanguage();
  const cookieLang = getCookie("language");
  const docLang = typeof document !== "undefined" ? document.documentElement?.lang : null;
  const envLang = typeof import.meta !== "undefined" && import.meta.env?.VITE_DEFAULT_LANGUAGE
    ? String(import.meta.env.VITE_DEFAULT_LANGUAGE)
    : null;

  return resolveClientLanguage({
    localStorage: storageLang,
    cookie: cookieLang,
    browserLanguages: getBrowserLanguages(),
    defaultLanguage: envLang,
    documentLang: docLang,
  });
}
