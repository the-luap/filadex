import { describe, expect, it } from "vitest";
import { resolveClientLanguage } from "../../client/src/i18n/resolve-language";

describe("resolveClientLanguage", () => {
  it("prefers localStorage language if supported", () => {
    const lang = resolveClientLanguage({
      localStorage: "pl",
      cookie: "de",
      documentLang: "de",
      browserLanguages: ["en"],
    });
    expect(lang).toBe("pl");
  });

  it("uses cookie language if localStorage is empty", () => {
    const lang = resolveClientLanguage({
      localStorage: null,
      cookie: "de",
      documentLang: "en",
      browserLanguages: ["en"],
    });
    expect(lang).toBe("de");
  });

  it("uses browser languages if localStorage and cookie are empty", () => {
    const lang = resolveClientLanguage({
      localStorage: null,
      cookie: null,
      browserLanguages: ["de"],
      documentLang: "en",
    });
    expect(lang).toBe("de");
  });

  it("uses defaultLanguage if no browser language is supported", () => {
    const lang = resolveClientLanguage({
      localStorage: null,
      cookie: null,
      browserLanguages: ["fr"],
      defaultLanguage: "pl",
      documentLang: "en",
    });
    expect(lang).toBe("pl");
  });

  it("uses document.documentElement.lang if storage, cookie, browser and defaultLanguage are empty", () => {
    const lang = resolveClientLanguage({
      localStorage: null,
      cookie: null,
      browserLanguages: ["fr"],
      defaultLanguage: null,
      documentLang: "pl",
    });
    expect(lang).toBe("pl");
  });

  it("defaults to 'en' when all sources are empty or unsupported", () => {
    const lang = resolveClientLanguage({
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
      localStorage: null,
      cookie: null,
      browserLanguages: ["fr-FR", "fr", "de-AT"],
      defaultLanguage: "en",
      documentLang: "de",
    });
    expect(lang).toBe("de");
  });

  it("falls back to navigator.language semantics for a single-entry list", () => {
    const lang = resolveClientLanguage({
      localStorage: null,
      cookie: null,
      browserLanguages: ["de-DE"],
      documentLang: "en",
    });
    expect(lang).toBe("de");
  });

  it("ignores an empty or missing browser list", () => {
    expect(
      resolveClientLanguage({ browserLanguages: [], defaultLanguage: "pl" }),
    ).toBe("pl");
    expect(
      resolveClientLanguage({ browserLanguages: null, defaultLanguage: "pl" }),
    ).toBe("pl");
  });

  it("reads the whole ranked list from navigator with getBrowserLanguages", async () => {
    const { getBrowserLanguages } = await import("../../client/src/i18n/resolve-language");
    // Node exposes a global navigator, so this exercises the populated branch:
    // the full `languages` list, not just the single `language`.
    expect(getBrowserLanguages()).toEqual(Array.from(navigator.languages));
  });

  it("extracts language cookie from cookie string with getCookie", async () => {
    const { getCookie } = await import("../../client/src/i18n/resolve-language");
    // in Node environment without document
    expect(getCookie("language")).toBeNull();
  });

  it("safely handles getStorageLanguage when window/localStorage is missing", async () => {
    const { getStorageLanguage } = await import("../../client/src/i18n/resolve-language");
    expect(getStorageLanguage()).toBeNull();
  });
});
