import type { Language } from "./index";

export const SUPPORTED_LANGUAGES: readonly Language[] = ["en", "de", "pl"] as const;

export function isSupportedLanguage(lang: unknown): lang is Language {
  return typeof lang === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}

export interface ClientLanguageSources {
  localStorage?: string | null;
  cookie?: string | null;
  documentLang?: string | null;
  browserLanguage?: string | null;
  defaultLanguage?: string | null;
}

/**
 * Resolves the client's language according to:
 * 1. localStorage (user's explicit client preference)
 * 2. language cookie (set by client, recognized by server)
 * 3. document.documentElement.lang (stamped by server via resolveLanguage)
 * 4. browser language (navigator.language)
 * 5. defaultLanguage (e.g. VITE_DEFAULT_LANGUAGE)
 * 6. 'en' (default fallback)
 */
export function resolveClientLanguage(sources: ClientLanguageSources): Language {
  if (isSupportedLanguage(sources.localStorage)) {
    return sources.localStorage;
  }

  if (isSupportedLanguage(sources.cookie)) {
    return sources.cookie;
  }

  if (isSupportedLanguage(sources.documentLang)) {
    return sources.documentLang;
  }

  if (sources.browserLanguage) {
    const code = sources.browserLanguage.split("-")[0].toLowerCase();
    if (isSupportedLanguage(code)) {
      return code;
    }
  }

  if (isSupportedLanguage(sources.defaultLanguage)) {
    return sources.defaultLanguage;
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
 * Reads the initial language in browser context synchronously.
 */
export function getInitialClientLanguage(): Language {
  if (typeof window === "undefined") return "en";

  const storageLang = (() => {
    try {
      return localStorage.getItem("language");
    } catch {
      return null;
    }
  })();

  const cookieLang = getCookie("language");
  const docLang = typeof document !== "undefined" ? document.documentElement?.lang : null;
  const browserLang = typeof navigator !== "undefined" ? navigator.language : null;
  const envLang = typeof import.meta !== "undefined" && import.meta.env?.VITE_DEFAULT_LANGUAGE
    ? String(import.meta.env.VITE_DEFAULT_LANGUAGE)
    : null;

  return resolveClientLanguage({
    localStorage: storageLang,
    cookie: cookieLang,
    documentLang: docLang,
    browserLanguage: browserLang,
    defaultLanguage: envLang,
  });
}
