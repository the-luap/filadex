/**
 * Matching a declared material against the catalog, ignoring case.
 *
 * A Spool's declared material is free text (`filament_types.material`); a
 * Catalog Material is a row in `materials`. Nothing links them, so the two are
 * matched by name - and every place that does this has to agree on how. They
 * did not: public sharing and the drying reminder each compared names their own
 * way, and each was a separate bug where a Spool silently failed to match.
 *
 * Resolution proper - case-insensitive, Personal Catalog before Global, and
 * guaranteeing the row exists - lives in `storage.resolveMaterial`, because it
 * needs the database. What is left here is the name-set predicate for callers
 * that have already loaded a set of catalog names: `server/routes/public.ts`
 * and the drying-reminder check in `server/utils/notification-checks.ts`.
 */

/**
 * A material name reduced to what the catalog actually matches on: surrounding
 * whitespace trimmed off, since it is not part of the name.
 *
 * A trailing space out of a CSV column or a paste is enough to make `" PETG"`
 * miss the curated `PETG` it obviously means, and the miss is silent - the
 * spool loses the curated density and the hygroscopic flag, and the owner's
 * Personal Catalog gains a row that looks identical to one already in the list.
 * The partial unique indexes cannot catch that, because `lower(name)` genuinely
 * differs between `"PETG"` and `" PETG"`.
 *
 * Case is deliberately not folded in here - `foldMaterialName` does that, and
 * the two are separate because the stored name keeps the spelling the user
 * typed while only the comparison is folded.
 */
export function catalogName(name: string): string {
  return name.trim();
}

/**
 * The catalog's idea of "the same material name": trimmed, NFC-normalised and
 * lowercased, in JS.
 *
 * Folding happens here rather than in SQL for the reason `foldUsername` exists
 * (shared/schema.ts): SQLite's `LOWER()` folds ASCII only, so `LOWER('Äbs')` is
 * `'Äbs'` there and `'äbs'` on Postgres. Left to the database, a user declaring
 * `Äbs` against a catalog holding `äbs` resolves to nothing on SQLite, gains a
 * second Personal Catalog row that looks identical to the first, and the spool
 * inherits neither the density nor the hygroscopic flag - while the Add
 * Material form, which compares in JS, answers 409 for the same pair. Two paths
 * disagreeing about one question is what ADR-0003 set out to remove.
 *
 * `ß` does not fold to `ss`, the same deliberate limit `foldUsername` documents.
 *
 * The partial unique indexes on `lower(name)` stay as they are. They remain a
 * backstop for the ASCII case on both engines; this is the rule the application
 * enforces.
 */
export function foldMaterialName(name: string): string {
  return catalogName(name).normalize("NFC").toLowerCase();
}

/**
 * Builds a test for whether a declared material is one of these catalog
 * material names, ignoring case.
 */
export function isOneOfMaterials(catalogNames: string[]): (material: string) => boolean {
  const names = new Set(catalogNames.map(foldMaterialName));
  return (material) => names.has(foldMaterialName(material));
}
