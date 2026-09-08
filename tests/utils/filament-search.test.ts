import { describe, expect, it } from "vitest";
import Fuse from "fuse.js";
import type { Filament } from "@shared/schema";

describe("Filament search matching by barcode", () => {
  const sampleFilaments: Filament[] = [
    {
      id: 1,
      name: "PLA Basic Black",
      manufacturer: "Bambu Lab",
      material: "pla",
      colorName: "Black",
      colorCode: "#000000",
      diameter: "1.75",
      barcode: "6975337031901",
      userId: 1,
      totalWeight: "1",
      remainingPercentage: "80",
      status: "sealed",
      dryerCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Filament,
    {
      id: 2,
      name: "PETG Red",
      manufacturer: "Prusament",
      material: "petg",
      colorName: "Carmine Red",
      colorCode: "#FF0000",
      diameter: "1.75",
      barcode: "8594195180123",
      userId: 1,
      totalWeight: "1",
      remainingPercentage: "50",
      status: "opened",
      dryerCount: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Filament,
  ];

  function matchFilaments(filaments: Filament[], searchTerm: string): number[] {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return filaments.map(f => f.id);

    const fuse = new Fuse(filaments, {
      keys: ["name", "manufacturer", "material", "colorName", "barcode"],
      threshold: 0.35,
      ignoreLocation: true,
    });

    const matches = new Set(fuse.search(searchTerm).map(r => r.item.id));
    for (const f of filaments) {
      if (f.barcode && f.barcode.toLowerCase().includes(term)) {
        matches.add(f.id);
      }
    }
    return Array.from(matches);
  }

  it("finds filament by full barcode", () => {
    const results = matchFilaments(sampleFilaments, "6975337031901");
    expect(results).toContain(1);
    expect(results).not.toContain(2);
  });

  it("finds filament by partial barcode substring", () => {
    const results = matchFilaments(sampleFilaments, "5180123");
    expect(results).toContain(2);
    expect(results).not.toContain(1);
  });
});
