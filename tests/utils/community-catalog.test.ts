import { describe, expect, it, beforeEach } from "vitest";
import {
  CommunityCatalogService,
  type CommunityCatalogItem,
  type OfdDataset,
  type SpoolmanDbVendorFile,
} from "../../server/services/community-catalog";

describe("CommunityCatalogService", () => {
  let service: CommunityCatalogService;

  beforeEach(() => {
    service = new CommunityCatalogService();
  });

  describe("search", () => {
    const sampleItems: CommunityCatalogItem[] = [
      {
        id: "ofd-1",
        source: "ofd",
        manufacturer: "Bambu Lab",
        material: "PLA",
        name: "PLA Basic",
        colorName: "Jade White",
        colorCode: "#FFFFFF",
        density: 1.24,
        diameter: 1.75,
        weightGrams: 1000,
        spoolRefill: false,
        extruderTemp: 220,
        bedTemp: 55,
        gtin: "6975337031901",
      },
      {
        id: "ofd-2",
        source: "ofd",
        manufacturer: "Bambu Lab",
        material: "PLA",
        name: "PLA Basic",
        colorName: "Bambu Green",
        colorCode: "#00AE42",
        density: 1.24,
        diameter: 1.75,
        weightGrams: 1000,
        spoolRefill: true,
        extruderTemp: 220,
        bedTemp: 55,
        gtin: "6975337031918",
      },
      {
        id: "spoolman-1",
        source: "spoolmandb",
        manufacturer: "Prusament",
        material: "PETG",
        name: "Prusament PETG",
        colorName: "Jet Black",
        colorCode: "#111111",
        density: 1.27,
        diameter: 1.75,
        weightGrams: 1000,
        spoolRefill: false,
        extruderTemp: 250,
        bedTemp: 80,
        gtin: null,
      },
    ];

    beforeEach(() => {
      service.setItems(sampleItems);
    });

    it("returns empty array for empty query", () => {
      expect(service.search("")).toEqual([]);
      expect(service.search("   ")).toEqual([]);
    });

    it("searches across manufacturer, product name, and color name case-insensitively", () => {
      const results = service.search("bambu");
      expect(results.length).toBe(2);
      expect(results.map((r) => r.colorName)).toContain("Jade White");
      expect(results.map((r) => r.colorName)).toContain("Bambu Green");

      const greenResults = service.search("green");
      expect(greenResults.length).toBe(1);
      expect(greenResults[0].colorName).toBe("Bambu Green");

      const prusaResults = service.search("prusament");
      expect(prusaResults.length).toBe(1);
      expect(prusaResults[0].manufacturer).toBe("Prusament");
    });

    it("filters by source when specified", () => {
      expect(service.search("bambu", { source: "ofd" }).length).toBe(2);
      expect(service.search("bambu", { source: "spoolmandb" }).length).toBe(0);
      expect(service.search("prusa", { source: "spoolmandb" }).length).toBe(1);
    });

    it("respects limit option", () => {
      const results = service.search("bambu", { limit: 1 });
      expect(results.length).toBe(1);
    });

    it("supports multi-word queries across manufacturer, name, material, and color", () => {
      const results = service.search("bambu white");
      expect(results.length).toBe(1);
      expect(results[0].colorName).toBe("Jade White");

      const plaGreen = service.search("bambu pla green");
      expect(plaGreen.length).toBe(1);
      expect(plaGreen[0].colorName).toBe("Bambu Green");

      const prusaPetg = service.search("prusament black");
      expect(prusaPetg.length).toBe(1);
      expect(prusaPetg[0].manufacturer).toBe("Prusament");
    });
  });

  describe("lookupGtin", () => {
    const itemWithGtin: CommunityCatalogItem = {
      id: "ofd-1",
      source: "ofd",
      manufacturer: "Bambu Lab",
      material: "PLA",
      name: "PLA Basic",
      colorName: "Jade White",
      colorCode: "#FFFFFF",
      density: 1.24,
      diameter: 1.75,
      weightGrams: 1000,
      spoolRefill: false,
      extruderTemp: 220,
      bedTemp: 55,
      gtin: "6975337031901",
    };

    beforeEach(() => {
      service.setItems([itemWithGtin]);
    });

    it("finds item by exact GTIN", () => {
      const found = service.lookupGtin("6975337031901");
      expect(found).not.toBeNull();
      expect(found?.name).toBe("PLA Basic");
      expect(found?.colorName).toBe("Jade White");
      expect(found?.spoolRefill).toBe(false);
    });

    it("finds item ignoring leading zeros / padding up to 14 digits", () => {
      const foundWithPad = service.lookupGtin("06975337031901");
      expect(foundWithPad).not.toBeNull();
      expect(foundWithPad?.colorName).toBe("Jade White");
    });

    it("returns null for unknown GTIN", () => {
      expect(service.lookupGtin("0000000000000")).toBeNull();
      expect(service.lookupGtin("")).toBeNull();
    });
  });

  describe("parseOfdDataset", () => {
    it("transforms OFD all.json hierarchy into flat CommunityCatalogItems", () => {
      const mockOfd: OfdDataset = {
        version: "2026.09.08",
        generated_at: "2026-09-08T00:00:00Z",
        brands: [
          { id: "b1", name: "Bambu Lab", slug: "bambu_lab" },
        ],
        filaments: [
          {
            id: "f1",
            brand_id: "b1",
            name: "PLA Basic",
            material: "PLA",
            density: 1.24,
            slicer_settings: {
              bambustudio: { extruder_temp: 220, bed_temp: 55 },
            },
          },
        ],
        variants: [
          {
            id: "v1",
            filament_id: "f1",
            name: "Bambu Green",
            color_hex: "#00AE42",
          },
        ],
        sizes: [
          {
            id: "s1",
            variant_id: "v1",
            diameter: 1.75,
            filament_weight: 1000,
            spool_refill: false,
            gtin: "6975337031901",
          },
        ],
      };

      const items = service.parseOfdDataset(mockOfd);
      expect(items.length).toBe(1);
      expect(items[0]).toMatchObject({
        source: "ofd",
        manufacturer: "Bambu Lab",
        material: "PLA",
        name: "PLA Basic",
        colorName: "Bambu Green",
        colorCode: "#00AE42",
        density: 1.24,
        diameter: 1.75,
        weightGrams: 1000,
        spoolRefill: false,
        gtin: "6975337031901",
        extruderTemp: 220,
        bedTemp: 55,
      });
    });
  });

  describe("parseSpoolmanDbVendorFiles", () => {
    it("transforms SpoolmanDB vendor file into CommunityCatalogItems", () => {
      const mockVendorFile: SpoolmanDbVendorFile = {
        manufacturer: "Polymaker",
        filaments: [
          {
            name: "PolyLite PLA {color_name}",
            material: "PLA",
            density: 1.24,
            diameters: [1.75],
            extruder_temp: 210,
            bed_temp: 50,
            colors: [
              { name: "Teal", hex: "008080" },
            ],
          },
        ],
      };

      const items = service.parseSpoolmanDbVendorFiles([mockVendorFile]);
      expect(items.length).toBe(1);
      expect(items[0]).toMatchObject({
        source: "spoolmandb",
        manufacturer: "Polymaker",
        material: "PLA",
        name: "PolyLite PLA Teal",
        colorName: "Teal",
        colorCode: "#008080",
        density: 1.24,
        diameter: 1.75,
        extruderTemp: 210,
        bedTemp: 50,
        gtin: null,
      });
    });
  });

  describe("status", () => {
    it("reports catalog status with counts and lastUpdated timestamps", () => {
      service.setItems([
        {
          id: "ofd-1",
          source: "ofd",
          manufacturer: "Bambu Lab",
          material: "PLA",
          name: "PLA Basic",
          colorName: "Jade White",
          colorCode: "#FFFFFF",
          density: 1.24,
          diameter: 1.75,
          weightGrams: 1000,
          spoolRefill: false,
          extruderTemp: 220,
          bedTemp: 55,
          gtin: "6975337031901",
        },
      ]);
      service.setStatus("ofd", { count: 1, lastUpdated: "2026-09-08T12:00:00Z" });
      service.setStatus("spoolmandb", { count: 0, lastUpdated: null });

      const status = service.getStatus();
      expect(status.ofd.count).toBe(1);
      expect(status.ofd.lastUpdated).toBe("2026-09-08T12:00:00Z");
      expect(status.spoolmandb.count).toBe(0);
      expect(status.spoolmandb.lastUpdated).toBeNull();
    });
  });
});
