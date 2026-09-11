import { describe, expect, it } from "vitest";
import { findSimilarManufacturers, findSimilarMaterials, levenshteinDistance } from "../../shared/similarity";

describe("findSimilarManufacturers", () => {
  const existing = [
    { id: 1, name: "Bambu" },
    { id: 2, name: "Prusa Research" },
    { id: 3, name: "eSUN" },
    { id: 4, name: "Polymaker" },
    { id: 5, name: "Sunlu" },
  ];

  it("returns exact match when name matches case-insensitively", () => {
    const result = findSimilarManufacturers("esun", existing);
    expect(result.exactMatch).toBeDefined();
    expect(result.exactMatch?.name).toBe("eSUN");
    expect(result.similarMatches).toHaveLength(0);
  });

  it("returns similar match when scanned name contains existing name as word/substring", () => {
    const result = findSimilarManufacturers("Bambu Lab", existing);
    expect(result.exactMatch).toBeUndefined();
    expect(result.similarMatches.map((m) => m.name)).toContain("Bambu");
  });

  it("returns similar match when existing name contains scanned name", () => {
    const result = findSimilarManufacturers("Prusa", existing);
    expect(result.exactMatch).toBeUndefined();
    expect(result.similarMatches.map((m) => m.name)).toContain("Prusa Research");
  });

  it("returns similar match for minor typos using Levenshtein distance", () => {
    const result = findSimilarManufacturers("Polymakr", existing);
    expect(result.exactMatch).toBeUndefined();
    expect(result.similarMatches.map((m) => m.name)).toContain("Polymaker");
  });

  it("returns empty similar matches when no similar names exist", () => {
    const result = findSimilarManufacturers("Formlabs", existing);
    expect(result.exactMatch).toBeUndefined();
    expect(result.similarMatches).toHaveLength(0);
  });

  it("detects normalized matches without spaces or punctuation", () => {
    const list = [{ id: 10, name: "Form Labs" }];
    const result = findSimilarManufacturers("FormLabs", list);
    expect(result.similarMatches.map((m) => m.name)).toContain("Form Labs");
  });
});

describe("findSimilarMaterials", () => {
  const existingMaterials = [
    { id: 1, name: "PLA" },
    { id: 2, name: "PETG" },
    { id: 3, name: "ABS" },
    { id: 4, name: "TPU" },
    { id: 5, name: "Carbon Fiber" },
  ];

  it("returns exact match when material matches case-insensitively", () => {
    const result = findSimilarMaterials("pla", existingMaterials);
    expect(result.exactMatch).toBeDefined();
    expect(result.exactMatch?.name).toBe("PLA");
    expect(result.similarMatches).toHaveLength(0);
  });

  it("finds PLA for PLA+", () => {
    const result = findSimilarMaterials("PLA+", existingMaterials);
    expect(result.exactMatch).toBeUndefined();
    expect(result.similarMatches.map((m) => m.name)).toContain("PLA");
  });

  it("finds PETG for PET-G", () => {
    const result = findSimilarMaterials("PET-G", existingMaterials);
    expect(result.exactMatch).toBeUndefined();
    expect(result.similarMatches.map((m) => m.name)).toContain("PETG");
  });

  it("finds TPU for TPU 95A", () => {
    const result = findSimilarMaterials("TPU 95A", existingMaterials);
    expect(result.exactMatch).toBeUndefined();
    expect(result.similarMatches.map((m) => m.name)).toContain("TPU");
  });

  it("returns empty when material is completely unknown", () => {
    const result = findSimilarMaterials("PEEK", existingMaterials);
    expect(result.exactMatch).toBeUndefined();
    expect(result.similarMatches).toHaveLength(0);
  });

  it("does not trigger prefix match on 2-letter codes like PE vs PETG", () => {
    const materialsWithPE = [{ id: 10, name: "PE" }];
    const result = findSimilarMaterials("PETG", materialsWithPE);
    expect(result.exactMatch).toBeUndefined();
    expect(result.similarMatches).toHaveLength(0);
  });
});

describe("levenshteinDistance", () => {
  it("computes distance between two strings", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
    expect(levenshteinDistance("esun", "esun")).toBe(0);
    expect(levenshteinDistance("polymaker", "polymakr")).toBe(1);
  });
});

describe("generic terms filtering", () => {
  const genericTerms = new Set(["lab", "filament"]);

  it("does not match on a generic token when it is configured as a generic term", () => {
    const result = findSimilarManufacturers("Bambu Lab", [{ name: "Form Lab" }], genericTerms);
    expect(result.similarMatches).toHaveLength(0);
  });

  it("still matches on non-generic tokens", () => {
    const result = findSimilarManufacturers("Bambu Lab", [{ name: "Bambu Studio" }], genericTerms);
    expect(result.similarMatches.length).toBeGreaterThan(0);
  });

  it("still matches via other similarity rules (alphanumeric, prefix, levenshtein)", () => {
    const result = findSimilarManufacturers("Prusament", [{ name: "Prusa" }], genericTerms);
    expect(result.similarMatches.length).toBeGreaterThan(0);
  });

  it("works with no generic terms (backward compatible)", () => {
    const result = findSimilarManufacturers("Bambu Lab", [{ name: "Form Lab" }]);
    expect(result.similarMatches.length).toBeGreaterThan(0);
  });

  it("filters generic terms case-insensitively", () => {
    const mixedGenericTerms = new Set(["LAB"]);
    const result = findSimilarManufacturers("Bambu Lab", [{ name: "Form Lab" }], mixedGenericTerms);
    expect(result.similarMatches).toHaveLength(0);
  });
});


