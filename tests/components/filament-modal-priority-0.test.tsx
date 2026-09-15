import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Filament } from "@shared/schema";
import { LanguageContext } from "../../client/src/i18n";
import { FilamentModal } from "../../client/src/components/filament-modal";
import { resolveCollectionBarcode, extractProductSpecsFromSpool } from "../../client/src/lib/collection-lookup";

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

const mockSpool = (overrides: Partial<Filament> = {}): Filament => ({
  id: 1,
  userId: 1,
  filamentTypeId: 10,
  name: "PolyLite PLA Teal",
  manufacturer: "Polymaker",
  material: "PLA",
  colorName: "Teal",
  colorCode: "#008080",
  diameter: "1.75",
  printTemp: "210",
  totalWeight: "1",
  remainingPercentage: "80",
  purchaseDate: "2026-01-01" as any,
  purchasePrice: "19.99" as any,
  status: "opened",
  spoolType: "spooled",
  dryerCount: 1,
  lastDryingDate: null,
  storageLocation: "Box 2",
  barcode: "123456",
  lowStockNotifiedAt: null,
  dryingReminderNotifiedAt: null,
  customFieldValues: { customLot: "LOT-123" },
  ...overrides,
});

describe("Priority 0 Barcode Resolution in Add Spool Modal", () => {
  it("resolves from personal collection first (Priority 0) before community catalog", () => {
    const collection = [mockSpool({ id: 10, barcode: "123456" })];
    const lookup = resolveCollectionBarcode("123456", collection);

    expect(lookup.type).toBe("single");
    if (lookup.type === "single") {
      expect(lookup.spool.id).toBe(10);
      const specs = extractProductSpecsFromSpool(lookup.spool);
      expect(specs.name).toBe("PolyLite PLA Teal");
      expect(specs.manufacturer).toBe("Polymaker");
      expect(specs.material).toBe("PLA");
      expect(specs.colorName).toBe("Teal");
      expect(specs.colorCode).toBe("#008080");
      expect(specs.diameter).toBe(1.75);
      expect(specs.printTemp).toBe("210");
      expect(specs.totalWeight).toBe(1);
      expect(specs.spoolType).toBe("spooled");
    }
  });

  it("handles multiple matching spools with conflicting specifications via candidates", () => {
    const spoolA = mockSpool({
      id: 1,
      barcode: "998877",
      filamentTypeId: 1,
      name: "eSun PLA+ Black",
      material: "PLA+",
    });
    const spoolB = mockSpool({
      id: 2,
      barcode: "998877",
      filamentTypeId: 2,
      name: "eSun PETG Black",
      material: "PETG",
    });

    const lookup = resolveCollectionBarcode("998877", [spoolA, spoolB]);
    expect(lookup.type).toBe("conflict");
    if (lookup.type === "conflict") {
      expect(lookup.candidates).toHaveLength(2);
      expect(lookup.candidates.map((c) => c.material)).toEqual(["PETG", "PLA+"]);
    }
  });

  it("extracts clean product specs without instance metadata", () => {
    const spool = mockSpool({
      remainingPercentage: "25",
      purchasePrice: "34.50" as any,
      storageLocation: "Shelf Top",
      customFieldValues: { invoice: "INV-999" },
    });

    const specs = extractProductSpecsFromSpool(spool);
    expect(specs.name).toBe(spool.name);
    expect(specs.manufacturer).toBe(spool.manufacturer);
    expect((specs as any).remainingPercentage).toBeUndefined();
    expect((specs as any).purchasePrice).toBeUndefined();
    expect((specs as any).storageLocation).toBeUndefined();
    expect((specs as any).customFieldValues).toBeUndefined();
  });

  it("renders modal in Add mode with pre-populated specs from collection spool draft (id: 0)", () => {
    const existingSpool = mockSpool({
      id: 42,
      name: "Prusament PLA Galaxy Black",
      manufacturer: "Prusa Research",
      material: "PLA",
      colorName: "Galaxy Black",
      colorCode: "#1a1a1a",
      diameter: "1.75",
      printTemp: "215",
      barcode: "8594173870001",
      storageLocation: "Drybox 1",
      remainingPercentage: "40",
    });

    const specs = extractProductSpecsFromSpool(existingSpool);

    // Draft created for "Add Another Spool" from collection match
    const draftSpool: any = {
      id: 0,
      name: specs.name,
      manufacturer: specs.manufacturer,
      material: specs.material,
      colorName: specs.colorName,
      colorCode: specs.colorCode || "#000000",
      diameter: specs.diameter ? String(specs.diameter) : "1.75",
      printTemp: specs.printTemp || "",
      barcode: "8594173870001",
      spoolType: specs.spoolType || "spooled",
      totalWeight: specs.totalWeight ? String(specs.totalWeight) : "1",
      remainingPercentage: "100",
      status: "sealed",
    };

    const html = renderWithProviders(
      <FilamentModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        filament={draftSpool}
        collectionFilaments={[existingSpool]}
      />
    );

    // Should be in Add mode (id: 0)
    expect(html).toContain("filaments.addFilament");
    expect(html).not.toContain("filaments.editFilament");
    // Pre-filled specs should be present
    expect(html).toContain("Prusament PLA Galaxy Black");
    expect(html).toContain("8594173870001");
  });

  it("filters out self when editing an existing spool so it does not match itself", () => {
    const activeSpool = mockSpool({
      id: 55,
      barcode: "8594173870001",
      name: "Original Spool",
    });

    const allSpools = [activeSpool];
    const isEditing = true;

    // Filter used inside FilamentModal
    const filteredCollection = isEditing && activeSpool.id
      ? allSpools.filter((f) => f.id !== activeSpool.id)
      : allSpools;

    expect(filteredCollection).toHaveLength(0);
    const result = resolveCollectionBarcode("8594173870001", filteredCollection);
    expect(result.type).toBe("not_found");
  });
});
