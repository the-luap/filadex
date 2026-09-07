import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getBrowserLanguages,
  getLanguageCookie,
  getStorageLanguage,
  resolveClientLanguage,
  type ClientLanguageSources,
} from "../../client/src/i18n/resolve-language";
import { formatSupportedLanguages } from "../../shared/languages";

/** Every source absent, so each case states only what it is actually about. */
const noSources: ClientLanguageSources = {
  localStorage: null,
  cookie: null,
  browserLanguages: null,
  defaultLanguage: null,
  documentLang: null,
};

describe("resolveClientLanguage", () => {
  it("prefers localStorage language if supported", () => {
    const lang = resolveClientLanguage({
      ...noSources,
      localStorage: "pl",
      cookie: "de",
      documentLang: "de",
      browserLanguages: ["en"],
    });
    expect(lang).toBe("pl");
  });

  it("uses cookie language if localStorage is empty", () => {
    const lang = resolveClientLanguage({
      ...noSources,
      cookie: "de",
      documentLang: "en",
      browserLanguages: ["en"],
    });
    expect(lang).toBe("de");
  });

  it("uses the server's <html lang> stamp if localStorage and cookie are empty", () => {
    // The stamp is the only source that has seen the logged-in user's stored
    // preference. A fresh profile asking for German must not drag an account
    // set to Polish over to German — on /public/* routes, where the account is
    // never fetched, that would be permanent.
    const lang = resolveClientLanguage({
      ...noSources,
      documentLang: "pl",
      browserLanguages: ["de-DE", "de"],
      defaultLanguage: "de",
    });
    expect(lang).toBe("pl");
  });

  it("uses browser languages if storage, cookie and the stamp are empty", () => {
    const lang = resolveClientLanguage({
      ...noSources,
      browserLanguages: ["de"],
    });
    expect(lang).toBe("de");
  });

  it("uses defaultLanguage if no browser language is supported", () => {
    const lang = resolveClientLanguage({
      ...noSources,
      browserLanguages: ["fr"],
      defaultLanguage: "pl",
    });
    expect(lang).toBe("pl");
  });

  it("defaults to 'en' when all sources are empty or unsupported", () => {
    const lang = resolveClientLanguage({
      ...noSources,
      localStorage: "fr",
      cookie: "es",
      browserLanguages: ["ja"],
      documentLang: "it",
    });
    expect(lang).toBe("en");
  });

  it("takes the first supported entry from the ranked browser list", () => {
    // navigator.languages = fr first, de second. The server scans the whole
    // Accept-Language header and stamps `de`; the client must agree, rather
    // than giving up at the unsupported `fr` and falling to defaultLanguage.
    const lang = resolveClientLanguage({
      ...noSources,
      browserLanguages: ["fr-FR", "fr", "de-AT"],
      defaultLanguage: "en",
    });
    expect(lang).toBe("de");
  });

  it("falls back to navigator.language semantics for a single-entry list", () => {
    const lang = resolveClientLanguage({
      ...noSources,
      browserLanguages: ["de-DE"],
    });
    expect(lang).toBe("de");
  });

  it("ignores an empty or missing browser list", () => {
    expect(
      resolveClientLanguage({ ...noSources, browserLanguages: [], defaultLanguage: "pl" }),
    ).toBe("pl");
    expect(
      resolveClientLanguage({ ...noSources, browserLanguages: null, defaultLanguage: "pl" }),
    ).toBe("pl");
  });
});

describe("getBrowserLanguages", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the whole ranked list, not just the first entry", () => {
    vi.stubGlobal("navigator", { languages: ["fr-FR", "de-AT", "en"], language: "fr-FR" });
    // Reading only `navigator.language` would yield ["fr-FR"] and stop there,
    // which is what made the client disagree with the server's header scan.
    expect(getBrowserLanguages()).toEqual(["fr-FR", "de-AT", "en"]);
  });

  it("falls back to navigator.language where the list is unavailable", () => {
    vi.stubGlobal("navigator", { languages: [], language: "de-DE" });
    expect(getBrowserLanguages()).toEqual(["de-DE"]);
  });

  it("returns an empty list when navigator exposes no language at all", () => {
    vi.stubGlobal("navigator", { languages: [], language: "" });
    expect(getBrowserLanguages()).toEqual([]);
  });

  it("returns an empty list outside a browser", () => {
    vi.stubGlobal("navigator", undefined);
    expect(getBrowserLanguages()).toEqual([]);
  });
});

describe("getLanguageCookie", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null without a document", () => {
    expect(getLanguageCookie()).toBeNull();
  });

  it("reads the language cookie out of a cookie string", () => {
    vi.stubGlobal("document", { cookie: "theme=dark; language=pl; token=abc" });
    expect(getLanguageCookie()).toBe("pl");
  });

  it("returns null when no language cookie is set", () => {
    vi.stubGlobal("document", { cookie: "theme=dark; token=abc" });
    expect(getLanguageCookie()).toBeNull();
  });

  it("does not match a cookie whose name merely ends in 'language'", () => {
    vi.stubGlobal("document", { cookie: "fallback_language=de" });
    expect(getLanguageCookie()).toBeNull();
  });

  it("does not throw on a value that is not valid percent-encoding", () => {
    // This runs inside LanguageProvider's useState initializer and there is no
    // error boundary in the tree: throwing here blanks every route, /login
    // included, until the user clears their cookies.
    vi.stubGlobal("document", { cookie: "language=%E0" });
    expect(() => getLanguageCookie()).not.toThrow();
    expect(getLanguageCookie()).toBe("%E0");
  });
});

describe("getStorageLanguage", () => {
  it("safely handles a missing window/localStorage", () => {
    expect(getStorageLanguage()).toBeNull();
  });
});

describe("formatSupportedLanguages", () => {
  it("formats the supported languages for the validation message", () => {
    expect(formatSupportedLanguages()).toBe("'en', 'de' and 'pl'");
  });
});
