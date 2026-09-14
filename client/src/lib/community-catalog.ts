import type { CommunityCatalogItem } from "@shared/schema";

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function hasWord(text: string, term: string): boolean {
  if (!text || !term) return false;
  const bStart = /^\w/.test(term) ? '\\b' : '';
  const bEnd = /\w$/.test(term) ? '\\b' : '';
  return new RegExp(`${bStart}${escapeRegex(term)}${bEnd}`, 'i').test(text);
}

/**
 * Formats a filament name from community catalog data according to Option 2:
 * - Omits manufacturer prefix from the name
 * - Prepends material if not already present as a distinct word
 * - Appends colorName if not already present as a distinct word
 */
export function formatCommunityCatalogFilamentName(result: Partial<CommunityCatalogItem>): string {
  let baseName = (result.name || '').trim();
  const manufacturer = (result.manufacturer || '').trim();
  const material = (result.material || '').trim();
  const colorName = (result.colorName || '').trim();

  // Strip leading manufacturer if present in baseName on a delimiter boundary
  if (manufacturer && baseName.toLowerCase().startsWith(manufacturer.toLowerCase())) {
    const rest = baseName.slice(manufacturer.length);
    if (!rest || /^[\s\-_/]/.test(rest)) {
      baseName = rest.replace(/^[\s\-_/]+/, '').trim();
    }
  }

  // Prepend material if not already present as a distinct word
  const hasMaterial = Boolean(material && hasWord(baseName, material));
  const nameWithMaterial = (!hasMaterial && material)
    ? `${material} ${baseName}`.trim()
    : baseName;

  // Append colorName if not already present as a distinct word
  const hasColor = Boolean(colorName && hasWord(nameWithMaterial, colorName));
  const cleanName = (!hasColor && colorName)
    ? `${nameWithMaterial} ${colorName}`.trim()
    : nameWithMaterial;

  return cleanName;
}

export function formatWeightGrams(weightGrams: number | null | undefined): string | null {
  if (weightGrams == null || isNaN(weightGrams) || weightGrams <= 0) {
    return null;
  }
  if (weightGrams >= 1000) {
    const kg = weightGrams / 1000;
    return `${Number(kg.toFixed(2))} kg`;
  }
  return `${Math.round(weightGrams)} g`;
}

export function formatDiameter(diameter: number | null | undefined): string | null {
  if (diameter == null || isNaN(diameter) || diameter <= 0) {
    return null;
  }
  return `${Number(diameter.toFixed(2))} mm`;
}

export function formatPrintTemps(
  extruderTemp: number | null | undefined,
  bedTemp: number | null | undefined
): string | null {
  if (extruderTemp != null && bedTemp != null) {
    return `${extruderTemp}°C / Bed ${bedTemp}°C`;
  }
  if (extruderTemp != null) {
    return `${extruderTemp}°C`;
  }
  return null;
}

export function deduplicateCommunityResults(results: CommunityCatalogItem[]): CommunityCatalogItem[] {
  const map = new Map<string, CommunityCatalogItem>();

  for (const item of results) {
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
        gtin: gtins[0] ?? (item.gtin ? String(item.gtin).trim() : null),
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
