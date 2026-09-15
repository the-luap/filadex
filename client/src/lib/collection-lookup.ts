import type { Filament } from "@shared/schema";

export interface ExtractedProductSpecs {
  name: string;
  manufacturer: string;
  material: string;
  colorName: string;
  colorCode?: string | null;
  diameter?: number | null;
  printTemp?: string | null;
  totalWeight?: number | null;
  spoolType?: string | null;
  barcode?: string | null;
}

export type CollectionLookupResult =
  | { type: "not_found" }
  | { type: "single"; spool: Filament; matchedSpools: Filament[] }
  | { type: "conflict"; candidates: Filament[]; matchedSpools: Filament[] };

/**
 * Normalizes a barcode by trimming whitespace and stripping leading zeros,
 * preserving a single zero if the barcode consists entirely of zeros.
 */
export function normalizeBarcode(code: string | null | undefined): string {
  if (!code) return "";
  const trimmed = code.trim();
  const stripped = trimmed.replace(/^0+/, "");
  return stripped.length > 0 ? stripped : (trimmed.length > 0 ? "0" : "");
}

/**
 * Checks whether two spools share the same filament product specifications.
 */
export function haveSameProductSpecs(a: Filament, b: Filament): boolean {
  if (a.filamentTypeId && b.filamentTypeId && a.filamentTypeId === b.filamentTypeId) {
    return true;
  }
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
  const numEq = (x: any, y: any) => {
    if (x == null && y == null) return true;
    if (x == null || y == null) return false;
    return Number(x) === Number(y);
  };

  return (
    norm(a.manufacturer) === norm(b.manufacturer) &&
    norm(a.material) === norm(b.material) &&
    norm(a.colorName) === norm(b.colorName) &&
    norm(a.colorCode) === norm(b.colorCode) &&
    numEq(a.diameter, b.diameter) &&
    norm(a.printTemp) === norm(b.printTemp)
  );
}

/**
 * Resolves a scanned barcode against the user's personal collection.
 * Evaluates exact matches and leading-zero normalized matches.
 */
export function resolveCollectionBarcode(
  code: string,
  collection: Filament[]
): CollectionLookupResult {
  const trimmedCode = (code || "").trim();
  if (!trimmedCode) return { type: "not_found" };

  const normCode = normalizeBarcode(trimmedCode);

  const matches = collection.filter((f) => {
    if (!f.barcode) return false;
    const trimmedSpoolBarcode = f.barcode.trim();
    if (trimmedSpoolBarcode.toLowerCase() === trimmedCode.toLowerCase()) {
      return true;
    }
    const normSpoolBarcode = normalizeBarcode(trimmedSpoolBarcode);
    return normCode && normSpoolBarcode === normCode;
  });

  if (matches.length === 0) {
    return { type: "not_found" };
  }

  // Sort matches by newest first (descending id)
  const sortedMatches = [...matches].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));

  // Check if all matches share the same product specifications
  const first = sortedMatches[0];
  const allSameSpec = sortedMatches.every((item) => haveSameProductSpecs(first, item));

  if (allSameSpec) {
    return {
      type: "single",
      spool: first,
      matchedSpools: sortedMatches,
    };
  }

  // Group into unique candidate specs
  const uniqueCandidates: Filament[] = [];
  for (const match of sortedMatches) {
    if (!uniqueCandidates.some((c) => haveSameProductSpecs(c, match))) {
      uniqueCandidates.push(match);
    }
  }

  return {
    type: "conflict",
    candidates: uniqueCandidates,
    matchedSpools: sortedMatches,
  };
}

/**
 * Extracts product specifications from an existing spool to populate a new spool.
 * New spool instance fields (remaining percentage, purchase price, location, etc.)
 * are deliberately omitted so they reset to default values.
 */
export function extractProductSpecsFromSpool(spool: Filament): ExtractedProductSpecs {
  return {
    name: spool.name,
    manufacturer: spool.manufacturer || "",
    material: spool.material || "",
    colorName: spool.colorName || "",
    colorCode: spool.colorCode || null,
    diameter: spool.diameter != null ? Number(spool.diameter) : null,
    printTemp: spool.printTemp || null,
    totalWeight: spool.totalWeight != null ? Number(spool.totalWeight) : null,
    spoolType: spool.spoolType || "spooled",
    barcode: spool.barcode || null,
  };
}
