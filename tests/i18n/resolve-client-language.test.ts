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

  it("uses browser languages if localStorage and cookie are empty", () => {
    const lang = resolveClientLanguage({
      ...noSources,
      browserLanguages: ["de"],
      documentLang: "en",
    });
    expect(lang).toBe("de");
  });

  it("uses defaultLanguage if no browser language is supported", () => {
    const lang = resolveClientLanguage({
      ...noSources,
      browserLanguages: ["fr"],
      defaultLanguage: "pl",
      documentLang: "en",
    });
    expect(lang).toBe("pl");
  });

  it("uses document.documentElement.lang if storage, cookie, browser and defaultLanguage are empty", () => {
    const lang = resolveClientLanguage({
      ...noSources,
      browserLanguages: ["fr"],
      documentLang: "pl",
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
      documentLang: "de",
    });
    expect(lang).toBe("de");
  });

  it("falls back to navigator.language semantics for a single-entry list", () => {
    const lang = resolveClientLanguage({
      ...noSources,
      browserLanguages: ["de-DE"],
      documentLang: "en",
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
});

describe("getStorageLanguage", () => {
  it("safely handles a missing window/localStorage", () => {
    expect(getStorageLanguage()).toBeNull();
  });
});

describe("formatSupportedLanguages", () => {
  it("formats default supported languages", () => {
    expect(formatSupportedLanguages()).toBe("'en', 'de' and 'pl'");
  });

  it("handles empty, single, pair, and multiple language arrays", () => {
    expect(formatSupportedLanguages([])).toBe("");
    expect(formatSupportedLanguages(["en"])).toBe("'en'");
    expect(formatSupportedLanguages(["en", "de"])).toBe("'en' and 'de'");
    expect(formatSupportedLanguages(["en", "de", "pl", "fr"])).toBe("'en', 'de', 'pl' and 'fr'");
  });
});
