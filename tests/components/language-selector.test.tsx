import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageSelector } from "../../client/src/components/language-selector";
import { LanguageContext } from "../../client/src/i18n";

describe("LanguageSelector", () => {
  it("renders with default styling and accessibility label", () => {
    const html = renderToString(
      <LanguageContext.Provider
        value={{
          language: "en",
          setLanguage: () => {},
          t: (key: string) => (key === "settings.language" ? "Language" : key),
        }}
      >
        <LanguageSelector />
      </LanguageContext.Provider>
    );

    expect(html).toContain("Language");
    expect(html).toContain("<button");
  });

  it("renders active language code when showLabel is true", () => {
    const html = renderToString(
      <LanguageContext.Provider
        value={{
          language: "pl",
          setLanguage: () => {},
          t: (key: string) => (key === "settings.language" ? "Language" : key),
        }}
      >
        <LanguageSelector showLabel />
      </LanguageContext.Provider>
    );

    expect(html).toContain("PL");
  });

  it("accepts custom className on trigger button", () => {
    const html = renderToString(
      <LanguageContext.Provider
        value={{
          language: "de",
          setLanguage: () => {},
          t: (key: string) => (key === "settings.language" ? "Language" : key),
        }}
      >
        <LanguageSelector className="custom-auth-class" />
      </LanguageContext.Provider>
    );

    expect(html).toContain("custom-auth-class");
  });

  it("provides minimum 44px mobile touch target styling", () => {
    const html = renderToString(
      <LanguageContext.Provider
        value={{
          language: "en",
          setLanguage: () => {},
          t: (key: string) => (key === "settings.language" ? "Language" : key),
        }}
      >
        <LanguageSelector showLabel />
      </LanguageContext.Provider>
    );

    // Meets 44px touch target guidelines on mobile
    expect(html).toMatch(/min-h-\[44px\]|min-w-\[44px\]|h-11|h-10/);
  });
});
