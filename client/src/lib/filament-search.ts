import Fuse from "fuse.js";
import type { Filament } from "@shared/schema";

export function getFilamentSearchMatchIds(
  filaments: Filament[],
  searchTerm: string,
  fuse?: Fuse<Filament>
): Set<number> | null {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return null;

  const fuseInstance =
    fuse ||
    new Fuse(filaments, {
      keys: ["name", "manufacturer", "material", "colorName", "barcode"],
      threshold: 0.35,
      ignoreLocation: true,
    });

  const matches = new Set(fuseInstance.search(searchTerm).map((r) => r.item.id));
  const normTerm = term.replace(/^0+/, "");

  for (const f of filaments) {
    if (f.barcode) {
      const lowerBarcode = f.barcode.toLowerCase();
      const normBarcode = lowerBarcode.replace(/^0+/, "");
      if (
        lowerBarcode.includes(term) ||
        (normTerm && (normBarcode.includes(normTerm) || normTerm.includes(normBarcode)))
      ) {
        matches.add(f.id);
      }
    }
  }

  return matches;
}
