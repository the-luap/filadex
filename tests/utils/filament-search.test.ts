import { describe, expect, it } from "vitest";
import type { Filament } from "@shared/schema";
import { getFilamentSearchMatchIds } from "../../client/src/lib/filament-search";

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
    {
      id: 3,
      name: "PETG Zero Padded",
      manufacturer: "Generic",
      material: "petg",
      colorName: "White",
      colorCode: "#FFFFFF",
      diameter: "1.75",
      barcode: "00001234567890",
      userId: 1,
      totalWeight: "1",
      remainingPercentage: "100",
      status: "sealed",
      dryerCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Filament,
    {
      id: 4,
      name: "All Zero Barcode",
      manufacturer: "Generic",
      material: "abs",
      colorName: "Blue",
      colorCode: "#0000FF",
      diameter: "1.75",
      barcode: "0000",
      userId: 1,
      totalWeight: "1",
      remainingPercentage: "100",
      status: "sealed",
      dryerCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Filament,
    {
      id: 5,
      name: "Short Barcode Spool",
      manufacturer: "Generic",
      material: "abs",
      colorName: "Yellow",
      colorCode: "#FFFF00",
      diameter: "1.75",
      barcode: "123",
      userId: 1,
      totalWeight: "1",
      remainingPercentage: "100",
      status: "sealed",
      dryerCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Filament,
  ];

  it("returns null for empty search term", () => {
    expect(getFilamentSearchMatchIds(sampleFilaments, "")).toBeNull();
    expect(getFilamentSearchMatchIds(sampleFilaments, "   ")).toBeNull();
  });

  it("finds filament by full barcode", () => {
    const matches = getFilamentSearchMatchIds(sampleFilaments, "6975337031901");
    expect(matches).not.toBeNull();
    expect(matches?.has(1)).toBe(true);
    expect(matches?.has(2)).toBe(false);
  });

  it("finds filament by partial barcode substring", () => {
    const matches = getFilamentSearchMatchIds(sampleFilaments, "5180123");
    expect(matches).not.toBeNull();
    expect(matches?.has(2)).toBe(true);
    expect(matches?.has(1)).toBe(false);
  });

  it("matches when search term has leading zeros (e.g. GTIN-14 scan of EAN-13 barcode)", () => {
    const matches = getFilamentSearchMatchIds(sampleFilaments, "06975337031901");
    expect(matches).not.toBeNull();
    expect(matches?.has(1)).toBe(true);
  });

  it("matches when stored barcode has leading zeros and query is unpadded", () => {
    const matches = getFilamentSearchMatchIds(sampleFilaments, "1234567890");
    expect(matches).not.toBeNull();
    expect(matches?.has(3)).toBe(true);
  });

  it("does not match all-zero barcode when searching for unrelated terms", () => {
    const matches = getFilamentSearchMatchIds(sampleFilaments, "Prusament");
    expect(matches).not.toBeNull();
    expect(matches?.has(2)).toBe(true);
    expect(matches?.has(4)).toBe(false); // All-zero barcode must NOT match
  });

  it("does not match short barcode when search term merely contains the barcode digits", () => {
    const matches = getFilamentSearchMatchIds(sampleFilaments, "Carmine");
    expect(matches).not.toBeNull();
    expect(matches?.has(2)).toBe(true);
    expect(matches?.has(5)).toBe(false); // "123" must not match
  });
});
