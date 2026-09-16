import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import enTranslations from "../../client/src/i18n/locales/en";
import { getTranslation, interpolate, LanguageContext } from "../../client/src/i18n";
import { CollectionSpoolCard } from "../../client/src/components/collection-spool-card";
import type { Filament } from "@shared/schema";

function renderWithProviders(component: React.ReactElement) {
  return renderToString(
    <LanguageContext.Provider
      value={{
        language: "en",
        setLanguage: vi.fn(),
        t: (key: string, params?: Record<string, string | number>) => {
          const raw = getTranslation(enTranslations as any, key);
          return params ? interpolate(raw, params) : raw;
        },
      }}
    >
      {component}
    </LanguageContext.Provider>
  );
}

describe("CollectionSpoolCard", () => {
  const sampleSpool: Filament = {
    id: 42,
    userId: 1,
    filamentTypeId: 10,
    name: "PolyLite PLA Black",
    manufacturer: "Polymaker",
    material: "PLA",
    colorName: "Black",
    colorCode: "#000000",
    diameter: "1.75",
    printTemp: "210",
    totalWeight: "1",
    remainingPercentage: "80",
    purchaseDate: null,
    purchasePrice: null,
    status: "opened",
    spoolType: "spooled",
    dryerCount: 0,
    lastDryingDate: null,
    storageLocation: "Shelf 1",
    barcode: "123456",
    lowStockNotifiedAt: null,
    dryingReminderNotifiedAt: null,
    customFieldValues: null,
  };

  it("renders spool details, badges, and color dot", () => {
    const html = renderWithProviders(
      <CollectionSpoolCard spool={sampleSpool} />
    );

    expect(html).toContain("PolyLite PLA Black");
    expect(html).toContain("Polymaker");
    expect(html).toContain("Black");
    expect(html).toContain("PLA");
    expect(html).toContain("1kg");
    expect(html).toContain("Spooled");
    expect(html).toContain("1.75mm");
    expect(html).toContain("210°C");
    expect(html).toContain("background-color:#000000");
  });

  it("renders refill spool type with green badge", () => {
    const refillSpool: Filament = {
      ...sampleSpool,
      spoolType: "spoolless",
    };

    const html = renderWithProviders(
      <CollectionSpoolCard spool={refillSpool} />
    );

    expect(html).toContain("Spoolless");
    expect(html).toContain("border-emerald-500/30");
  });

  it("renders non-interactive card when interactive is false", () => {
    const html = renderWithProviders(
      <CollectionSpoolCard spool={sampleSpool} interactive={false} />
    );

    expect(html).toContain("PolyLite PLA Black");
    // Should render as div rather than clickable button
    expect(html).not.toContain("<button");
  });
});
