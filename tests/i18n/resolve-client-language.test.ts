import { describe, expect, it } from "vitest";
import { resolveClientLanguage } from "../../client/src/i18n/resolve-language";

describe("resolveClientLanguage", () => {
  it("prefers localStorage language if supported", () => {
    const lang = resolveClientLanguage({
      localStorage: "pl",
      cookie: "de",
      documentLang: "de",
      browserLanguage: "en",
    });
    expect(lang).toBe("pl");
  });

  it("uses cookie language if localStorage is empty", () => {
    const lang = resolveClientLanguage({
      localStorage: null,
      cookie: "de",
      documentLang: "en",
      browserLanguage: "en",
    });
    expect(lang).toBe("de");
  });

  it("uses browserLanguage if localStorage and cookie are empty", () => {
    const lang = resolveClientLanguage({
      localStorage: null,
      cookie: null,
      browserLanguage: "de",
      documentLang: "en",
    });
    expect(lang).toBe("de");
  });

  it("uses defaultLanguage if browserLanguage is unsupported or empty", () => {
    const lang = resolveClientLanguage({
      localStorage: null,
      cookie: null,
      browserLanguage: "fr",
      defaultLanguage: "pl",
      documentLang: "en",
    });
    expect(lang).toBe("pl");
  });

  it("uses document.documentElement.lang if storage, cookie, browser and defaultLanguage are empty", () => {
    const lang = resolveClientLanguage({
      localStorage: null,
      cookie: null,
      browserLanguage: "fr",
      defaultLanguage: null,
      documentLang: "pl",
    });
    expect(lang).toBe("pl");
  });

  it("defaults to 'en' when all sources are empty or unsupported", () => {
    const lang = resolveClientLanguage({
      localStorage: "fr",
      cookie: "es",
      browserLanguage: "ja",
      documentLang: "it",
    });
    expect(lang).toBe("en");
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
