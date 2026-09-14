---
status: accepted
date: 2026-09-14
---

# Preserving Scanned or User-Entered Barcodes When Selecting Community Catalog Filaments

This architecture decision records how Filadex preserves scanned or user-entered barcodes when selecting a match from the community catalog, avoiding unintended barcode erasure.

## Context

1. **Barcode Scanning with Fallback Search Workflow**:
   - A primary user workflow when adding a spool on mobile is scanning the physical barcode on the spool or packaging.
   - If the scanned barcode is not yet indexed in the community catalog (e.g. Open Filament Database or SpoolmanDB), the barcode input field in the "Add Filament" modal is populated with the scanned value.
   - The user then performs a community catalog search by typing the filament's manufacturer, material, or color name to find matching specifications (print temperatures, density, nominal diameter, and color codes).

2. **Unconditional Overwrite Issue**:
   - Prior to this architecture, picking a community catalog search result unconditionally set `barcode` to the catalog item's GTIN (`result.gtin`).
   - This wiped out the user's scanned physical barcode, forcing them to re-scan or re-type it, or inadvertently saving the catalog's canonical GTIN rather than the actual barcode printed on their spool.

3. **External Review Feedback**:
   - During code review of PR #40, maintainers observed that choosing "Keep existing barcode" allows a spool's metadata (manufacturer, material, color) to be populated from catalog item B while carrying barcode A.
   - This document formalizes that this is an intentional design capability: users frequently have spools with custom inventory tags, retailer barcodes, or vendor variations that they deliberately want associated with catalog filament specifications.

## Decisions

### 1. Barcode Overwrite Confirmation Dialog

When the modal's barcode input already contains a value and a community catalog entry with a different GTIN is selected:
- Filadex renders an `AlertDialog` asking whether to keep the existing barcode or overwrite it with the catalog GTIN.
- **Keep Existing Barcode**: Applies all physical specifications from the community catalog (manufacturer, material, color, temperatures, density, diameter) while preserving the scanned/entered barcode in the form.
- **Overwrite with Barcode**: Overwrites the barcode field with the incoming catalog GTIN alongside the rest of the specifications.

### 2. Multi-GTIN Awareness & Normalized Comparisons

- **Merged GTIN Preservation**: Community catalog items can aggregate multiple GTINs across equivalent variants. If the entered barcode matches *any* of the item's merged GTINs (evaluated with leading-zero normalization), no prompt is displayed and the scanned barcode is preserved as-is.
- **Self-Replacement Prevention**: An early check ensures that identical barcodes (`current === incoming` or normalized leading-zero equivalents like `684620401324` vs `0684620401324`) return action `none`, preventing redundant prompts that ask the user to overwrite a code with itself.
- **Explicit Chip Selection**: Clicking a specific GTIN chip on a multi-GTIN card switches directly to that GTIN without prompting if the existing barcode belongs to the item's merged set.

### 3. Dialog Gating and Sequential Focus Management

To prevent competing focus traps and simultaneous dialog mounting:
- The barcode overwrite dialog is gated behind variant selection and similarity prompts:
  `!variantCandidates && !similarManufacturerPrompt && !similarMaterialPrompt && overwriteBarcodePrompt`
- Dialogs resolve in strict sequence:
  1. Variant candidate selection (if a scan matches multiple catalog variants).
  2. Manufacturer similarity matching.
  3. Material similarity matching.
  4. Barcode overwrite confirmation.

## Consequences

- Users can reliably scan an unlisted spool barcode, search the community catalog for specifications, and keep their scanned barcode linked to the rich catalog data.
- Accidental barcode overrides are prevented without impeding users who genuinely want catalog GTINs to populate an empty or outdated field.
