/**
 * Computes the Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = [];

  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

export interface SimilarityItem {
  id?: number;
  name: string;
}

export type ManufacturerItem = SimilarityItem;
export type MaterialItem = SimilarityItem;

export interface SimilarityResult<T extends SimilarityItem> {
  exactMatch?: T;
  similarMatches: T[];
}

const TWO_LETTER_POLYMERS = new Set(["pa", "pc", "pp", "pe", "pi", "ps", "pu"]);
const isSignificantToken = (t: string) => t.length >= 3 || TWO_LETTER_POLYMERS.has(t);

/**
 * Finds exact or similar items (manufacturers, materials) from an existing list.
 * Similarity considers:
 * - Normalized alphanumeric equality (Unicode aware, e.g. "PET-G" vs "PETG", "FormLabs" vs "Form Labs")
 * - Shared significant tokens (including common 2-letter polymers like PA, PC, PP)
 * - Clean prefix containment (e.g. "PLA+" matching "PLA", "Prusa Research" matching "Prusa")
 * - Levenshtein edit distance <= 2 for strings with length >= 4
 */
export function findSimilarItems<T extends SimilarityItem>(
  scannedName: string,
  existingItems: T[]
): SimilarityResult<T> {
  const trimmed = scannedName.trim();
  const lower = trimmed.toLowerCase();
  if (!lower) {
    return { similarMatches: [] };
  }

  // 1. Check for exact match (case-insensitive)
  const exact = existingItems.find(
    (m) => m.name.trim().toLowerCase() === lower
  );
  if (exact) {
    return { exactMatch: exact, similarMatches: [] };
  }

  const cleanScanned = lower.replace(/[^\p{L}\p{N}]/gu, "");
  const scannedTokens = lower.split(/[\s\-_./+]+/).filter(isSignificantToken);

  const similarMatches: T[] = [];

  for (const item of existingItems) {
    const itemTrimmed = item.name.trim();
    const itemLower = itemTrimmed.toLowerCase();
    const itemClean = itemLower.replace(/[^\p{L}\p{N}]/gu, "");
    const itemTokens = itemLower.split(/[\s\-_./+]+/).filter(isSignificantToken);

    // a. Clean alphanumeric equality (e.g. "PET-G" -> "petg" === "PETG" -> "petg", "FormLabs" === "Form Labs")
    if (cleanScanned && itemClean && cleanScanned === itemClean) {
      similarMatches.push(item);
      continue;
    }

    // b. Token overlap (e.g. "TPU 95A" contains "tpu", "Bambu Lab" contains "bambu", "PA-CF" contains "pa")
    const hasSharedToken = scannedTokens.some((st) => itemTokens.includes(st));
    if (hasSharedToken) {
      similarMatches.push(item);
      continue;
    }

    // c. Clean prefix or suffix containment
    if (
      cleanScanned.length >= 2 &&
      itemClean.length >= 2 &&
      (cleanScanned.startsWith(itemClean) || itemClean.startsWith(cleanScanned))
    ) {
      similarMatches.push(item);
      continue;
    }

    // d. Levenshtein distance for minor typos
    const minLen = Math.min(lower.length, itemLower.length);
    const maxLen = Math.max(lower.length, itemLower.length);
    if (Math.abs(lower.length - itemLower.length) <= 3 && minLen >= 4) {
      const distance = levenshteinDistance(lower, itemLower);
      if (distance <= (maxLen <= 5 ? 1 : 2)) {
        similarMatches.push(item);
        continue;
      }
    }
  }

  return { similarMatches };
}

export const findSimilarManufacturers = findSimilarItems;
export const findSimilarMaterials = findSimilarItems;

