import { describe, expect, it } from "vitest";
import {
  formatWeightGrams,
  formatDiameter,
  formatPrintTemps,
  deduplicateCommunityResults,
} from "../../client/src/lib/community-catalog";
import type { CommunityCatalogItem } from "@shared/schema";

describe("community-catalog helpers", () => {
  describe("formatWeightGrams", () => {
    it("formats weights in kg or g appropriately", () => {
      expect(formatWeightGrams(1000)).toBe("1 kg");
      expect(formatWeightGrams(500)).toBe("500 g");
      expect(formatWeightGrams(250)).toBe("250 g");
      expect(formatWeightGrams(2000)).toBe("2 kg");
      expect(formatWeightGrams(750)).toBe("750 g");
      expect(formatWeightGrams(1250)).toBe("1.25 kg");
      expect(formatWeightGrams(null)).toBeNull();
      expect(formatWeightGrams(undefined)).toBeNull();
      expect(formatWeightGrams(0)).toBeNull();
    });
  });

  describe("formatDiameter", () => {
    it("formats diameter with mm unit", () => {
      expect(formatDiameter(1.75)).toBe("1.75 mm");
      expect(formatDiameter(2.85)).toBe("2.85 mm");
      expect(formatDiameter(null)).toBeNull();
      expect(formatDiameter(undefined)).toBeNull();
    });
  });

  describe("formatPrintTemps", () => {
    it("formats temperatures concisely", () => {
      expect(formatPrintTemps(230, 70)).toBe("230°C / Bed 70°C");
      expect(formatPrintTemps(210, null)).toBe("210°C");
      expect(formatPrintTemps(null, null)).toBeNull();
    });
  });

  describe("deduplicateCommunityResults", () => {
    it("deduplicates identical items and merges multiple GTINs", () => {
      const item1: CommunityCatalogItem = {
        id: "ofd-1",
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
        gtin: "5901111111111",
      };
      const item2: CommunityCatalogItem = {
        ...item1,
        id: "ofd-2",
        gtin: "5902222222222",
      };
      const item3: CommunityCatalogItem = {
        ...item1,
        id: "ofd-3",
        gtin: null,
      };

      const deduplicated = deduplicateCommunityResults([item1, item2, item3]);
      expect(deduplicated.length).toBe(1);
      expect(deduplicated[0].gtin).toBe("5901111111111");
      expect(deduplicated[0].gtins).toEqual(["5901111111111", "5902222222222"]);
    });

    it("keeps distinct spool sizes as distinct items", () => {
      const item1kg: CommunityCatalogItem = {
        id: "ofd-1",
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
        gtin: "5901111111111",
      };
      const item500g: CommunityCatalogItem = {
        ...item1kg,
        id: "ofd-500g",
        weightGrams: 500,
      };

      const deduplicated = deduplicateCommunityResults([item1kg, item500g]);
      expect(deduplicated.length).toBe(2);
      expect(deduplicated[0].weightGrams).toBe(1000);
      expect(deduplicated[1].weightGrams).toBe(500);
    });
  });
});
