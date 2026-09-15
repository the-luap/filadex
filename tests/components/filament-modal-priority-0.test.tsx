import { describe, expect, it } from "vitest";
import type { Filament } from "@shared/schema";
import { resolveCollectionBarcode, extractProductSpecsFromSpool } from "../../client/src/lib/collection-lookup";

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
});
