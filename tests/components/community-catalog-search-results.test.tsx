import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import enTranslations from "../../client/src/i18n/locales/en";
import { getTranslation, interpolate, LanguageContext } from "../../client/src/i18n";
import { CommunityCatalogSearchResults } from "../../client/src/components/community-catalog-search-results";
import type { CommunityCatalogItem } from "@shared/schema";

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

describe("CommunityCatalogSearchResults", () => {
  const sampleItem: CommunityCatalogItem = {
    id: "ofd-nebula-1",
    source: "ofd",
    manufacturer: "Nebula",
    material: "PETG",
    name: "PETG Premium",
    colorName: "Military Green",
    colorCode: "#4B5320",
    density: 1.27,
    diameter: 1.75,
    weightGrams: 1000,
    spoolRefill: false,
    extruderTemp: 230,
    bedTemp: 70,
    gtin: "5901234567890",
  };

  it("renders empty state when results list is empty", () => {
    const html = renderWithProviders(
      <CommunityCatalogSearchResults results={[]} onSelectResult={vi.fn()} />
    );
    expect(html).toContain("No matches found");
  });

  it("renders rich card with details, badges, and color dot", () => {
    const html = renderWithProviders(
      <CommunityCatalogSearchResults results={[sampleItem]} onSelectResult={vi.fn()} />
    );

    expect(html).toContain("Nebula — PETG Premium");
    expect(html).toContain("Military Green");
    expect(html).toContain("PETG");
    expect(html).toContain("1 kg");
    expect(html).toContain("1.75 mm");
    expect(html).toContain("Spooled (standard)");
    expect(html).toContain("230°C / Bed 70°C");
    expect(html).toContain("5901234567890");
    expect(html).toContain("background-color:#4B5320");
  });

  it("renders multiple GTINs with translated aria-labels when filament has merged barcodes", () => {
    const multiGtinItem: CommunityCatalogItem = {
      ...sampleItem,
      gtin: "5901234567890",
      gtins: ["5901234567890", "5909876543210"],
    };

    const html = renderWithProviders(
      <CommunityCatalogSearchResults results={[multiGtinItem]} onSelectResult={vi.fn()} />
    );

    expect(html).toContain("5901234567890");
    expect(html).toContain("5909876543210");
    expect(html).toContain('aria-label="Select GTIN 5909876543210"');
  });

  it("renders spoolless badge and bed-only temperature badge", () => {
    const spoollessItem: CommunityCatalogItem = {
      ...sampleItem,
      id: "spoolless-1",
      spoolRefill: true,
      extruderTemp: null,
      bedTemp: 60,
    };

    const html = renderWithProviders(
      <CommunityCatalogSearchResults results={[spoollessItem]} onSelectResult={vi.fn()} />
    );

    expect(html).toContain("Spoolless");
    expect(html).toContain("Bed 60°C");
  });

  it("deduplicates identical search results before rendering cards", () => {
    const duplicateItem: CommunityCatalogItem = {
      ...sampleItem,
      id: "ofd-nebula-2",
    };

    const html = renderWithProviders(
      <CommunityCatalogSearchResults
        results={[sampleItem, duplicateItem]}
        onSelectResult={vi.fn()}
      />
    );

    // Should only have 1 occurrence of the title
    const matches = html.match(/Nebula — PETG Premium/g);
    expect(matches?.length).toBe(1);
  });
});
