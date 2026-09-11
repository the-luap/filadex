import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageContext } from "../../client/src/i18n";
import { FilamentModal, escapeRegex, normalizeHexColor } from "../../client/src/components/filament-modal";

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

  it("renders color field and color code field", () => {
    const html = renderWithProviders(
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />
    );

    expect(html).toContain("filaments.color");
    expect(html).toContain("filaments.colorCode");
  });

  it("renders select item for a manufacturer not yet present in predefined list", () => {
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
      <FilamentModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} filament={template} />
    );

    expect(html).toContain('data-select-item="UniqueManufacturerBrand"');
  });

  it("renders select item for a custom material not yet present in predefined list", () => {
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

    expect(html).toContain('data-select-item="PEEK-Custom"');
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
});

