---
status: accepted
date: 2026-09-15
---

# Priority 0 Barcode Resolution from Personal Collection Before Community Catalog

When scanning a barcode during spool entry, Filadex queries the user's personal collection first (Priority 0) to autofill product specifications from an existing spool, falling back to external community catalogs (Priority 1) only when no local match exists.

## Context

1. Users often purchase multiple identical spools of filament over time. When adding subsequent spools by scanning their retail packaging or vendor barcode, the user expects their existing custom settings (calibrated print temperatures, custom color names, custom density, and exact product naming) to be reused rather than overridden by external canonical catalog entries.
2. Previously, scanning inside the Add Spool modal queried the Community Catalog (Open Filament Database / SpoolmanDB) directly, ignoring existing spools in the user's inventory that already carried the same barcode.

## Decision

1. **Resolution Hierarchy**:
   - **Priority 0 (Personal Collection)**: Search the authenticated user's collection for existing spools sharing the barcode (evaluating exact matches and leading-zero normalized matches). If found, populate the Add Spool modal with product specifications (`name`, `manufacturer`, `material`, `colorName`, `colorCode`, `diameter`, `printTemp`, nominal `totalWeight`, `spoolType`). New spool instance fields reset to defaults (100% remaining, sealed status, empty location, current date, empty price, blank custom fields).
   - **Priority 1 (Community Catalog)**: If no match exists in the user's collection, query Open Filament Database and SpoolmanDB.
   - **Priority 2 (Manual Entry)**: If neither yields results, retain the scanned code in the barcode field for manual data entry.

2. **Disambiguation, Edit Mode Gating & Escape Hatch**:
   - If multiple spools match the barcode with the same product specifications (matching material type, diameter, print temp, nominal weight, and spool type), the most recent spool is cloned silently. If matches point to conflicting specifications or packaging variants, a candidate disambiguation dialog is shown; dismissing it leaves the barcode intact and fields blank.
   - In **Edit Spool** mode, scanning a barcode that matches another spool in the collection prompts the user to confirm whether to overwrite the edited spool's specifications or update only the barcode, preventing accidental overwrites.
   - When Priority 0 resolves a match, a toast notifies the user and offers a `"Search Community Catalog instead"` action to allow fetching fresh external specifications on demand (omitting matched spool form hints to keep the external query unbiased).

3. **Main Screen Scanner Integration**:
   - When a barcode scanned from the main collection screen matches an existing spool, the user is offered a choice: `"View in Collection"` (filters list) or `"Add Another Spool of This Filament"` (opens modal pre-filled via Priority 0).
