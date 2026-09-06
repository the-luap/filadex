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

  it("uses document.documentElement.lang if localStorage and cookie are empty", () => {
    const lang = resolveClientLanguage({
      localStorage: null,
      cookie: null,
      documentLang: "pl",
      browserLanguage: "en",
    });
    expect(lang).toBe("pl");
  });

  it("uses browserLanguage if storage, cookie, and docLang are empty", () => {
    const lang = resolveClientLanguage({
      localStorage: null,
      cookie: null,
      documentLang: null,
      browserLanguage: "de",
    });
    expect(lang).toBe("de");
  });

  it("uses defaultLanguage if provided when other sources are empty", () => {
    const lang = resolveClientLanguage({
      localStorage: null,
      cookie: null,
      documentLang: null,
      browserLanguage: null,
      defaultLanguage: "pl",
    });
    expect(lang).toBe("pl");
  });

  it("defaults to 'en' when all sources are empty or unsupported", () => {
    const lang = resolveClientLanguage({
      localStorage: "fr",
      cookie: "es",
      documentLang: "it",
      browserLanguage: "ja",
    });
    expect(lang).toBe("en");
  });

  it("extracts language cookie from cookie string with getCookie", async () => {
    const { getCookie } = await import("../../client/src/i18n/resolve-language");
    // in Node environment without document
    expect(getCookie("language")).toBeNull();
  });
});
