import { describe, expect, it } from "vitest";
import type { Filament } from "@shared/schema";
import {
  normalizeBarcode,
  resolveCollectionBarcode,
  extractProductSpecsFromSpool,
} from "../../client/src/lib/collection-lookup";

const mockSpool = (overrides: Partial<Filament> = {}): Filament => ({
  id: 1,
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
  remainingPercentage: "65",
  purchaseDate: "2026-01-01" as any,
  purchasePrice: "24.99" as any,
  status: "opened",
  spoolType: "spooled",
  dryerCount: 2,
  lastDryingDate: "2026-02-01" as any,
  storageLocation: "Shelf A",
  barcode: "123456",
  lowStockNotifiedAt: null,
  dryingReminderNotifiedAt: null,
  customFieldValues: { batch: "B-998" },
  ...overrides,
});

describe("collection-lookup", () => {
  describe("normalizeBarcode", () => {
    it("strips leading zeros and trims whitespace", () => {
      expect(normalizeBarcode("000123456")).toBe("123456");
      expect(normalizeBarcode("  0123456  ")).toBe("123456");
      expect(normalizeBarcode("123456")).toBe("123456");
      expect(normalizeBarcode("0")).toBe("0");
      expect(normalizeBarcode("000")).toBe("0");
      expect(normalizeBarcode("")).toBe("");
    });
  });

  describe("resolveCollectionBarcode", () => {
    it("returns not_found when collection is empty or barcode does not match", () => {
      const result = resolveCollectionBarcode("999999", [mockSpool()]);
      expect(result.type).toBe("not_found");

      const emptyResult = resolveCollectionBarcode("123456", []);
      expect(emptyResult.type).toBe("not_found");
    });

    it("matches exact barcode and returns single spool when unique", () => {
      const spool = mockSpool({ id: 5, barcode: "123456" });
      const result = resolveCollectionBarcode("123456", [spool]);

      expect(result.type).toBe("single");
      if (result.type === "single") {
        expect(result.spool.id).toBe(5);
      }
    });

    it("matches leading-zero normalized barcode (e.g. 0123456 vs 123456)", () => {
      const spool = mockSpool({ id: 7, barcode: "123456" });
      const result = resolveCollectionBarcode("000123456", [spool]);

      expect(result.type).toBe("single");
      if (result.type === "single") {
        expect(result.spool.id).toBe(7);
      }

      const spoolWithLeadingZero = mockSpool({ id: 8, barcode: "000123456" });
      const result2 = resolveCollectionBarcode("123456", [spoolWithLeadingZero]);
      expect(result2.type).toBe("single");
      if (result2.type === "single") {
        expect(result2.spool.id).toBe(8);
      }
    });

    it("returns latest spool when multiple spools share the same filament specs", () => {
      const olderSpool = mockSpool({ id: 1, barcode: "123456" });
      const newerSpool = mockSpool({ id: 2, barcode: "123456" });

      const result = resolveCollectionBarcode("123456", [olderSpool, newerSpool]);
      expect(result.type).toBe("single");
      if (result.type === "single") {
        expect(result.spool.id).toBe(2);
      }
    });

    it("returns conflict when multiple spools with the same barcode have different product specs", () => {
      const spoolPLA = mockSpool({
        id: 1,
        barcode: "123456",
        filamentTypeId: 10,
        name: "PolyLite PLA Black",
        material: "PLA",
      });
      const spoolPETG = mockSpool({
        id: 2,
        barcode: "123456",
        filamentTypeId: 20,
        name: "PolyMax PETG Black",
        material: "PETG",
      });

      const result = resolveCollectionBarcode("123456", [spoolPLA, spoolPETG]);
      expect(result.type).toBe("conflict");
      if (result.type === "conflict") {
        expect(result.candidates).toHaveLength(2);
        expect(result.candidates.map((c) => c.material)).toEqual(["PETG", "PLA"]);
      }
    });
  });

  describe("extractProductSpecsFromSpool", () => {
    it("extracts physical product specifications and resets instance fields to defaults", () => {
      const spool = mockSpool({
        name: "Galaxy Black",
        manufacturer: "Prusa",
        material: "PLA",
        colorName: "Galaxy Black",
        colorCode: "#111111",
        diameter: "1.75",
        printTemp: "215",
        totalWeight: "0.75",
        spoolType: "spooled",
        remainingPercentage: "40",
        purchasePrice: "29.99" as any,
        storageLocation: "Drawer 3",
        customFieldValues: { lot: "4412" },
      });

      const specs = extractProductSpecsFromSpool(spool);

      expect(specs.name).toBe("Galaxy Black");
      expect(specs.manufacturer).toBe("Prusa");
      expect(specs.material).toBe("PLA");
      expect(specs.colorName).toBe("Galaxy Black");
      expect(specs.colorCode).toBe("#111111");
      expect(specs.diameter).toBe(1.75);
      expect(specs.printTemp).toBe("215");
      expect(specs.totalWeight).toBe(0.75);
      expect(specs.spoolType).toBe("spooled");

      // Instance fields must NOT be in extracted product specs
      expect((specs as any).remainingPercentage).toBeUndefined();
      expect((specs as any).purchasePrice).toBeUndefined();
      expect((specs as any).storageLocation).toBeUndefined();
      expect((specs as any).customFieldValues).toBeUndefined();
    });
  });
});
