import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageContext } from "../../client/src/i18n";
import { FilamentModal, escapeRegex, findMatchingColor, findMatchingManufacturer, findMatchingMaterial, normalizeHexColor, stripParentheticalAnnotations } from "../../client/src/components/filament-modal";

// Mock Dialog so children are rendered in SSR / renderToString
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

// Mock Select so items are rendered in SSR / renderToString
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value }: any) => <div data-select-value={value}>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => <div data-select-item={value}>{children}</div>,
}));

// Mock toast
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function renderWithProviders(component: React.ReactElement, client?: QueryClient) {
  const queryClient = client || new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return renderToString(
    <QueryClientProvider client={queryClient}>
      <LanguageContext.Provider
        value={{
          language: "en",
          setLanguage: vi.fn(),
          t: (key: string) => key,
        }}
      >
        {component}
      </LanguageContext.Provider>
    </QueryClientProvider>
  );
}

describe("FilamentModal", () => {
  it("renders catalog source tabs (OFD & SpoolmanDB) when adding a filament", () => {
    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />
    );

    expect(html).toContain("settings.communityFilaments.sourceOfd");
    expect(html).toContain("settings.communityFilaments.sourceSpoolman");
  });

  it("renders barcode field in form", () => {
    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />
    );

    expect(html).toContain("filaments.barcode");
  });

  it("treats pre-filled template with id 0 as adding (not editing)", () => {
    const template: any = {
      id: 0,
      name: "Prusament PLA Galaxy Black",
      manufacturer: "Prusa",
      material: "PLA",
      barcode: "123456789",
    };

    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} filament={template} />
    );

    expect(html).toContain("filaments.addFilament");
    expect(html).not.toContain("filaments.editFilament");
    expect(html).toContain("settings.communityFilaments.sourceOfd");
  });

  it("does not duplicate materials when a database material matches a predefined material", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["/api/materials"], [{ id: 101, name: "PLA" }]);

    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />,
      queryClient
    );

    const plaMatches = html.match(/data-select-item="PLA"/g);
    expect(plaMatches).toHaveLength(1);
  });

  it("does not duplicate materials when database contains multiple materials with the same name (global and personal)", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["/api/materials"], [
      { id: 1, name: "PLA" },
      { id: 10, name: "PLA" },
    ]);

    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />,
      queryClient
    );

    const plaMatches = html.match(/data-select-item="PLA"/g);
    expect(plaMatches).toHaveLength(1);
  });

  it("does not duplicate materials when database material matches a predefined compound label like PA or PLA-CF", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["/api/materials"], [
      { id: 1, name: "PA" },
      { id: 2, name: "PLA-CF" },
    ]);

    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />,
      queryClient
    );

    const paMatches = html.match(/data-select-item="PA"/g);
    expect(paMatches).toHaveLength(1);
    const plaCfMatches = html.match(/data-select-item="PLA-CF"/g);
    expect(plaCfMatches).toHaveLength(1);
  });

  it("preserves both custom multi-word materials like 'PLA Silk' and standard 'PLA' without dropping either", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["/api/materials"], [
      { id: 1, name: "PLA Silk" },
      { id: 2, name: "PLA" },
    ]);

    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />,
      queryClient
    );

    const plaSilkMatches = html.match(/data-select-item="PLA Silk"/g);
    expect(plaSilkMatches).toHaveLength(1);
    const plaMatches = html.match(/data-select-item="PLA"/g);
    expect(plaMatches).toHaveLength(1);
    // Predefined PETG should also still be present (not suppressed)
    const petgMatches = html.match(/data-select-item="PETG"/g);
    expect(petgMatches).toHaveLength(1);
  });

  it("symmetrically prioritizes unannotated PA over PA (Nylon) regardless of database order", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    // PA (Nylon) placed before PA intentionally
    queryClient.setQueryData(["/api/materials"], [
      { id: 10, name: "PA (Nylon)" },
      { id: 5, name: "PA" },
    ]);

    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />,
      queryClient
    );

    const paMatches = html.match(/data-select-item="PA"/g);
    expect(paMatches).toHaveLength(1);
    expect(html).not.toContain('data-select-item="PA (Nylon)"');
  });

  it("canonicalizes colorName to matched catalog name (e.g. 'Black' for 'black' or 'Black (Bambu Lab)')", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["/api/colors"], [
      { id: 1, name: "Black", code: "#000000" },
    ]);

    const template: any = {
      id: 1,
      name: "PLA Basic Black",
      manufacturer: "Bambu Lab",
      material: "PLA",
      colorName: "Black (Bambu Lab)",
      colorCode: "#000000",
      totalWeight: 1,
      remainingPercentage: 100,
    };

    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} filament={template} />,
      queryClient
    );

    expect(html).toContain('data-select-value="Black"');
    expect(html).toContain('data-select-item="Black"');
  });

  it("auto-matches recognized color on scanned or templated filament", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["/api/colors"], [
      { id: 1, name: "Red", code: "#FF0000" },
    ]);

    const template: any = {
      id: 0,
      name: "PLA Basic Red",
      manufacturer: "Bambu Lab",
      material: "PLA",
      colorName: "Red",
      colorCode: "#FF0000",
      totalWeight: 1,
      remainingPercentage: 100,
    };

    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} filament={template} />,
      queryClient
    );

    expect(html).toContain('data-select-value="Red"');
    expect(html).not.toContain('filaments.customColorName');
  });

  it("selects Custom color and populates custom color name input when scanned color is unrecognized", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const template: any = {
      id: 0,
      name: "PLA Silk Sapphire",
      manufacturer: "Bambu Lab",
      material: "PLA",
      colorName: "Sapphire Blue",
      colorCode: "#0F52BA",
      totalWeight: 1,
      remainingPercentage: 100,
    };

    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} filament={template} />,
      queryClient
    );

    expect(html).toContain('data-select-value="Custom"');
    expect(html).toContain('filaments.customColorName');
    expect(html).toContain('value="Sapphire Blue"');
  });

  it("does not append manufacturer to name when pre-filled with manufacturer", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["/api/manufacturers"], [
      { id: 1, name: "Bambu Lab" },
    ]);

    const template: any = {
      id: 0,
      name: "PLA Basic Black",
      manufacturer: "Bambu Lab",
      material: "PLA",
      colorName: "Black",
      colorCode: "#000000",
      totalWeight: 1,
      remainingPercentage: 100,
    };

    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} filament={template} />,
      queryClient
    );

    expect(html).toContain('value="PLA Basic Black"');
    expect(html).not.toContain('value="PLA Basic Black (Bambu Lab)"');
    expect(html).not.toContain('value="PLA Basic Black Bambu Lab"');
    expect(html).toContain('data-select-value="Bambu Lab"');
    expect(html).not.toContain('filaments.customManufacturerName');
  });

  it("renders color field and color code field", () => {
    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />
    );

    expect(html).toContain("filaments.color");
    expect(html).toContain("filaments.colorCode");
  });

  it("selects 'Other' manufacturer and displays custom manufacturer input when manufacturer is not in database", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["/api/manufacturers"], [
      { id: 1, name: "Prusa" },
    ]);

    const template: any = {
      id: 1,
      name: "Special Spool",
      manufacturer: "UniqueManufacturerBrand",
      material: "PLA",
      colorCode: "#ff0000",
      totalWeight: 1,
      remainingPercentage: 100,
    };

    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} filament={template} />,
      queryClient
    );

    expect(html).toContain('data-select-value="Other"');
    expect(html).toContain('data-select-item="Other"');
    expect(html).toContain('filaments.customManufacturerName');
    expect(html).toContain('value="UniqueManufacturerBrand"');
    expect(html).toContain('filaments.saveManufacturerToCollection');
  });

  it("selects matched manufacturer from database and hides custom manufacturer input", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["/api/manufacturers"], [
      { id: 1, name: "Prusa" },
      { id: 2, name: "Bambu Lab" },
    ]);

    const template: any = {
      id: 1,
      name: "Galaxy Black Spool",
      manufacturer: "Prusa",
      material: "PLA",
      colorCode: "#ff0000",
      totalWeight: 1,
      remainingPercentage: 100,
    };

    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} filament={template} />,
      queryClient
    );

    expect(html).toContain('data-select-value="Prusa"');
    expect(html).not.toContain('filaments.customManufacturerName');
    expect(html).not.toContain('filaments.saveManufacturerToCollection');
  });

  it("selects Custom and shows custom material input and persistence checkbox when material is unrecognized", () => {
    const template: any = {
      id: 1,
      name: "Special Spool",
      manufacturer: "Bambu Lab",
      material: "PEEK-Custom",
      colorCode: "#ff0000",
      totalWeight: 1,
      remainingPercentage: 100,
    };

    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} filament={template} />
    );

    expect(html).toContain('data-select-value="Custom"');
    expect(html).toContain('data-select-item="Custom"');
    expect(html).toContain('filaments.customMaterialName');
    expect(html).toContain('value="PEEK-Custom"');
    expect(html).toContain('filaments.saveMaterialToCollection');
  });

  it("selects matched material and hides custom material input", () => {
    const template: any = {
      id: 1,
      name: "Special Spool",
      manufacturer: "Bambu Lab",
      material: "PETG",
      colorCode: "#ff0000",
      totalWeight: 1,
      remainingPercentage: 100,
    };

    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} filament={template} />
    );

    expect(html).toContain('data-select-value="PETG"');
    expect(html).not.toContain('filaments.customMaterialName');
    expect(html).not.toContain('filaments.saveMaterialToCollection');
  });
});

describe("findMatchingMaterial", () => {
  const materials = [
    { id: 1, value: "PLA", label: "PLA" },
    { id: 2, value: "PETG", label: "PETG" },
    { id: 3, value: "PA", label: "PA (Nylon)" },
  ];

  it("matches exact name case-insensitively", () => {
    expect(findMatchingMaterial("pla", materials)?.value).toBe("PLA");
    expect(findMatchingMaterial("PETG", materials)?.value).toBe("PETG");
  });

  it("matches stripping parenthetical annotations", () => {
    expect(findMatchingMaterial("PA (Nylon)", materials)?.value).toBe("PA");
    expect(findMatchingMaterial("pa", materials)?.value).toBe("PA");
  });

  it("matches parenthesized material names properly", () => {
    const parenthesizedMaterials = [
      ...materials,
      { id: 4, value: "(Generic)", label: "(Generic)" },
      { id: 5, value: "(Custom Grade)", label: "(Custom Grade)" },
    ];
    expect(findMatchingMaterial("(Generic)", parenthesizedMaterials)?.value).toBe("(Generic)");
    expect(findMatchingMaterial("(Custom Grade)", parenthesizedMaterials)?.value).toBe("(Custom Grade)");
  });

  it("returns undefined for unknown material", () => {
    expect(findMatchingMaterial("WoodPLA", materials)).toBeUndefined();
    expect(findMatchingMaterial(null, materials)).toBeUndefined();
    expect(findMatchingMaterial("Custom", materials)).toBeUndefined();
  });
});

describe("escapeRegex and word-boundary replacement in similarity prompts", () => {
  it("escapes all regex special characters", () => {
    const specialChars = ".*+?^${}()|[]\\";
    const escaped = escapeRegex(specialChars);
    expect(escaped).toBe("\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\");
  });

  it("safely creates a regex with escaped characters without throwing", () => {
    const dangerous = "Brand [Plus] (v1.0) {Test}? *+$^|\\";
    const escaped = escapeRegex(dangerous);
    expect(() => new RegExp(escaped)).not.toThrow();
  });

  it("replaces exact word boundaries without corrupting substrings", () => {
    const scannedManufacturer = "Sun";
    const replacement = "Sunlu";
    const currentName = "Sunny Yellow (Sun) Sunlu";

    const pattern = new RegExp(`\\b${escapeRegex(scannedManufacturer)}\\b`, "gi");
    expect(pattern.test(currentName)).toBe(true);
    pattern.lastIndex = 0;
    const result = currentName.replace(pattern, replacement);

    // "Sunny" should remain "Sunny", existing "Sunlu" should not become "Sunlulu", only standalone "Sun" becomes "Sunlu"
    expect(result).toBe("Sunny Yellow (Sunlu) Sunlu");
  });

  it("handles case-insensitive word boundary replacement", () => {
    const scannedMaterial = "pla";
    const replacement = "PLA";
    const currentName = "My pla spool (PLA-CF)";

    const pattern = new RegExp(`\\b${escapeRegex(scannedMaterial)}\\b`, "gi");
    expect(pattern.test(currentName)).toBe(true);
    pattern.lastIndex = 0;
    const result = currentName.replace(pattern, replacement);

    expect(result.startsWith("My PLA spool")).toBe(true);
  });

  it("replaces names with trailing symbols like PLA+ without word-boundary failure", () => {
    const scanned = "PLA+";
    const replacement = "PLA";
    const currentName = "eSUN PLA+ Black";

    const bStart = /^\w/.test(scanned) ? '\\b' : '';
    const bEnd = /\w$/.test(scanned) ? '\\b' : '';
    const pattern = new RegExp(`${bStart}${escapeRegex(scanned)}${bEnd}`, 'gi');
    expect(pattern.test(currentName)).toBe(true);
    pattern.lastIndex = 0;
    const result = currentName.replace(pattern, () => replacement);

    expect(result).toBe("eSUN PLA Black");
  });

  it("safely replaces when replacement string contains dollar signs", () => {
    const scanned = "PLA";
    const replacement = "$100 PLA";
    const currentName = "Generic PLA Black";

    const bStart = /^\w/.test(scanned) ? '\\b' : '';
    const bEnd = /\w$/.test(scanned) ? '\\b' : '';
    const pattern = new RegExp(`${bStart}${escapeRegex(scanned)}${bEnd}`, 'gi');
    expect(pattern.test(currentName)).toBe(true);
    pattern.lastIndex = 0;
    const result = currentName.replace(pattern, () => replacement);

    expect(result).toBe("Generic $100 PLA Black");
  });
});

describe("normalizeHexColor and colorCode handling", () => {
  it("normalises 3-digit hex codes to 6-digit uppercase hex", () => {
    expect(normalizeHexColor("#FFF")).toBe("#FFFFFF");
    expect(normalizeHexColor("#abc")).toBe("#AABBCC");
    expect(normalizeHexColor("123")).toBe("#112233");
  });

  it("truncates 8-digit hex codes to 6-digit uppercase hex", () => {
    expect(normalizeHexColor("#11223344")).toBe("#112233");
    expect(normalizeHexColor("#AABBCCDD")).toBe("#AABBCC");
  });

  it("handles 4-digit hex codes with alpha", () => {
    expect(normalizeHexColor("#abcd")).toBe("#AABBCC");
  });

  it("leaves standard 6-digit hex uppercase and returns empty on blank input", () => {
    expect(normalizeHexColor("#1a2b3c")).toBe("#1A2B3C");
    expect(normalizeHexColor("")).toBe("");
    expect(normalizeHexColor(null)).toBe("");
    expect(normalizeHexColor(undefined)).toBe("");
  });

  it("renders without error when editing an existing spool with a 3-digit hex color code", () => {
    const spoolWith3DigitHex: any = {
      id: 99,
      name: "Short Hex Spool",
      manufacturer: "Prusa",
      material: "PLA",
      colorName: "White",
      colorCode: "#FFF",
      totalWeight: 1,
      remainingPercentage: 50,
    };

    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} filament={spoolWith3DigitHex} />
    );

    expect(html).toContain("Short Hex Spool");
  });

  describe("stripParentheticalAnnotations", () => {
    it("strips parenthetical content from material and color names", () => {
      expect(stripParentheticalAnnotations("PA (Nylon)")).toBe("PA");
      expect(stripParentheticalAnnotations("Black (Bambu Lab)")).toBe("Black");
      expect(stripParentheticalAnnotations("PLA (Polylactic Acid)")).toBe("PLA");
      expect(stripParentheticalAnnotations("PETG")).toBe("PETG");
      expect(stripParentheticalAnnotations("PLA Silk")).toBe("PLA Silk");
      expect(stripParentheticalAnnotations("(Custom Grade)")).toBe("");
      expect(stripParentheticalAnnotations("(Generic)")).toBe("");
    });
  });

  describe("findMatchingColor", () => {
    const dbColors = [
      { id: 1, name: "Jet Black", code: "#000000" },
      { id: 2, name: "Signal White", code: "#FFFFFF" },
    ];
    const preColors = [
      { name: "Traffic Red", code: "#FF0000" },
      { name: "Black (Bambu Lab)", code: "#111111" },
    ];

    it("matches exact name case-insensitively in DB colors", () => {
      expect(findMatchingColor("jet black", dbColors, preColors)?.name).toBe("Jet Black");
      expect(findMatchingColor("SIGNAL WHITE", dbColors, preColors)?.code).toBe("#FFFFFF");
    });

    it("matches exact name case-insensitively in predefined colors", () => {
      expect(findMatchingColor("traffic red", dbColors, preColors)?.name).toBe("Traffic Red");
    });

    it("matches stripping parenthetical annotations", () => {
      expect(findMatchingColor("Black", dbColors, preColors)?.name).toBe("Black (Bambu Lab)");
    });

    it("returns undefined for unrecognized color or empty/null input", () => {
      expect(findMatchingColor("Electric Lime", dbColors, preColors)).toBeUndefined();
      expect(findMatchingColor("", dbColors, preColors)).toBeUndefined();
      expect(findMatchingColor(null, dbColors, preColors)).toBeUndefined();
      expect(findMatchingColor(undefined, dbColors, preColors)).toBeUndefined();
    });
  });

  describe("findMatchingManufacturer", () => {
    const dbManufacturers = [
      { id: 1, name: "Prusa Research" },
      { id: 2, name: "Bambu Lab" },
      { id: 3, name: "eSUN" },
    ];

    it("matches exact name case-insensitively", () => {
      expect(findMatchingManufacturer("bambu lab", dbManufacturers)?.name).toBe("Bambu Lab");
      expect(findMatchingManufacturer("ESUN", dbManufacturers)?.name).toBe("eSUN");
    });

    it("matches stripping parenthetical annotations", () => {
      const dbWithParens = [{ id: 1, name: "Prusa (Research)" }];
      expect(findMatchingManufacturer("Prusa", dbWithParens)?.name).toBe("Prusa (Research)");
      expect(findMatchingManufacturer("Prusa (Research)", [{ id: 1, name: "Prusa" }])?.name).toBe("Prusa");
    });

    it("returns undefined for unknown manufacturer or empty/null input", () => {
      expect(findMatchingManufacturer("NonExistentMfg", dbManufacturers)).toBeUndefined();
      expect(findMatchingManufacturer("", dbManufacturers)).toBeUndefined();
      expect(findMatchingManufacturer(null, dbManufacturers)).toBeUndefined();
      expect(findMatchingManufacturer(undefined, dbManufacturers)).toBeUndefined();
    });
  });
});

