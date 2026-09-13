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
