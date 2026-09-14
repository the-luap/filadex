import type { CommunityCatalogItem } from "./schema";

/**
 * Deduplicates community catalog items.
 *
 * If two items are identical across all key properties (source, manufacturer,
 * material, name, colorName, colorCode, density, diameter, weightGrams,
 * spoolRefill, extruderTemp, bedTemp) but differ in GTIN, their GTINs are merged
 * into a single record with an array of unique `gtins`.
 */
export function mergeCatalogItems<T extends CommunityCatalogItem>(items: T[]): T[] {
  const map = new Map<string, T>();

  for (const item of items) {
    const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();
    const key = [
      item.source,
      norm(item.manufacturer),
      norm(item.material),
      norm(item.name),
      norm(item.colorName),
      norm(item.colorCode),
      item.density != null ? Number(item.density).toFixed(3) : "",
      item.diameter != null ? Number(item.diameter).toFixed(2) : "",
      item.weightGrams != null ? String(item.weightGrams) : "",
      item.spoolRefill != null ? String(item.spoolRefill) : "",
      item.extruderTemp != null ? String(item.extruderTemp) : "",
      item.bedTemp != null ? String(item.bedTemp) : "",
    ].join("|");

    const existing = map.get(key);
    if (!existing) {
      const gtins: string[] = [];
      if (item.gtin && String(item.gtin).trim()) {
        gtins.push(String(item.gtin).trim());
      }
      if (Array.isArray(item.gtins)) {
        for (const g of item.gtins) {
          const trimmed = g != null ? String(g).trim() : "";
          if (trimmed && !gtins.includes(trimmed)) {
            gtins.push(trimmed);
          }
        }
      }
      map.set(key, {
        ...item,
        gtin: gtins[0] ?? null,
        gtins: gtins.length > 0 ? gtins : undefined,
      });
    } else {
      const allGtins = existing.gtins ? [...existing.gtins] : (existing.gtin ? [existing.gtin] : []);
      const newGtins = item.gtins && item.gtins.length > 0
        ? item.gtins
        : (item.gtin ? [item.gtin] : []);
      for (const g of newGtins) {
        const trimmed = g != null ? String(g).trim() : "";
        if (trimmed && !allGtins.includes(trimmed)) {
          allGtins.push(trimmed);
        }
      }
      existing.gtin = allGtins[0] ?? null;
      existing.gtins = allGtins.length > 0 ? allGtins : undefined;
    }
  }

  return Array.from(map.values());
}
