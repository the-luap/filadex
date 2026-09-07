import { type Language, isSupportedLanguage } from "@shared/languages";
export { isSupportedLanguage };

export interface ClientLanguageSources {
  localStorage: string | null;
  cookie: string | null;
  browserLanguages: readonly string[] | null;
  defaultLanguage: string | null;
  documentLang: string | null;
}

/**
 * Resolves the client's language according to:
 * 1. localStorage (user's explicit client preference)
 * 2. language cookie (set by client, recognized by server)
 * 3. document.documentElement.lang (stamped by the server, which has already
 *    weighed the stored account preference, the cookie and Accept-Language)
 * 4. browser languages (navigator.languages, first supported wins)
 * 5. defaultLanguage (e.g. VITE_DEFAULT_LANGUAGE)
 * 6. 'en' (default fallback)
 *
 * The stamp outranks the browser list because it is the only source that can
 * see the logged-in user's stored preference: a user whose account says `pl`,
 * on a fresh profile whose browser asks for `de`, must not be dragged to `de`
 * — on /public/* routes, where the account is never fetched, that would stick.
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

  return "en";
}

/**
 * Reads the `language` cookie in browser context.
 *
 * The value is used raw: this cookie only ever holds a bare language code,
 * written by us and read undecoded by the server. Running decodeURIComponent
 * over it would throw on a hand-edited value like `language=%E0`, and this
 * runs in LanguageProvider's useState initializer — with no error boundary in
 * the tree, that would blank every route, /login included.
 */
export function getLanguageCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)language=([^;]+)/);
  return match ? match[1] : null;
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
  const cookieLang = getLanguageCookie();
  const docLang = typeof document !== "undefined" ? document.documentElement?.lang ?? null : null;
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
