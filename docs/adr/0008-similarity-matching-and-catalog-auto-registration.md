---
status: accepted
date: 2026-09-10
---

# Manufacturer and Material Auto-Registration, Similarity Matching, and Responsive Filament Management

Filadex simplifies spool onboarding by importing filament metadata from barcodes,
NFC tags, and community catalogs (Open Filament Database and SpoolmanDB). This
architecture decision records how Filadex handles unrecognized manufacturers and
materials, fuzzy similarity resolution, color template selection, and mobile chart
presentation.

## Context

1. **Unsaved Manufacturers from Scans**: When scanning barcodes or importing from
   community databases, imported manufacturers not previously present in the user's
   `manufacturers` table were discarded upon saving because foreign resolution failed.
2. **Duplicate Material Entries in Modal**: Predefined default material types
   (`PLA`, `PETG`, `ABS`, etc.) duplicated existing database rows in the modal
   dropdown, causing duplicate entries and synchronized dual-selection glitches in
   Radix UI comboboxes.
3. **Disconnected Color Inputs**: The modal presented two separate, uncoordinated
   color fields (a generic select and a hex input), leading to ambiguity about which
   value was recorded and what defined a spool's color identity.
4. **Mobile Layout Degradation on Round Graphs**: The circular material color chart
   rendered floating SVG text labels on arc slices that clipped outside the screen
   boundaries on mobile viewports (< 768px).
5. **Similarity Ambiguity in Scanned Data**: Community catalogs frequently use
   slight variations of existing manufacturers (e.g. "Prusa" vs "Prusament") or
   specialized material designations (e.g. "PLA+", "PLA-CF" vs base "PLA").
   Blindly creating new entries led to catalog fragmentation, while silently
   coercing values risked losing user intent.

## Decisions

### 1. Auto-Registration of Unknown Entities on Save

- **Manufacturers**: `manufacturers` gains a nullable `user_id` owner column
  (where `NULL` represents the curated Global Catalog and set values represent a user's
  Personal Catalog), exactly mirroring `materials` from [ADR 0003](file:///home/przemek/work/priv/filadex-oryginal/docs/adr/0003-per-user-material-catalog.md).
  When saving a spool, `ensureDeclaredManufacturerResolves` in [`server/storage.ts`](file:///home/przemek/work/priv/filadex-oryginal/server/storage.ts)
  checks both Global and the declaring user's Personal Catalog case-insensitively.
  If no match exists, the new manufacturer is auto-registered into the declaring
  user's **Personal Catalog** (`userId = declaringUser.id`). Non-admin users cannot
  write to the shared Global Catalog, protecting global catalogs from uncontrolled
  population while guaranteeing all declared manufacturers resolve to catalog entities.
  Uniqueness is enforced via two partial case-insensitive unique indexes on `lower(name)`:
  one for the Global Catalog (`user_id IS NULL`) and one per Personal Catalog (`user_id IS NOT NULL`).
  During schema migration (PostgreSQL `0012` and SQLite `0006`), any pre-existing case-variant
  duplicate manufacturers are automatically deduplicated to `min(id)`, allowing smooth upgrades
  from older releases that permitted exact-case duplicate entries without leaving orphan spools.
- **Materials**: Following [ADR 0003](file:///home/przemek/work/priv/filadex-oryginal/docs/adr/0003-per-user-material-catalog.md),
  any novel material declared on a spool is auto-registered into the declaring
  user's Personal Catalog (`materials`).
- **Scanned Density Persistence**: When a community result or scan payload
  contains material density, that density is validated as a positive numeric format
  in the filament payload and saved directly into the newly created `materials` row,
  avoiding blank density defaults on known catalog imports.

### 2. Multi-Tier Fuzzy Similarity Matching

- Extracted and generalized similarity logic into [`shared/similarity.ts`](file:///home/przemek/work/priv/filadex-oryginal/shared/similarity.ts)
  (`findSimilarItems`, `findSimilarManufacturers`, `findSimilarMaterials`).
- Similarity rules evaluate:
  - Unicode-aware alphanumeric equality (`/[^\p{L}\p{N}]/gu`, e.g. "PET-G" matching "PETG").
  - Token overlap for significant tokens (length >= 3 and common 2-letter polymers: `PA`, `PC`, `PP`, `PE`, `PI`, `PS`, `PU`).
  - Prefix and suffix containment (e.g. "Prusa Research" vs "Prusa", "PLA-CF" vs "PLA").
  - Levenshtein edit distance <= 2 for strings with length >= 4.
- **Trigger Scope**: Similarity prompts are reserved exclusively for external
  imports (barcode scan, NFC scan, community catalog search). Manual freeform typing
  in the form creates the entity smoothly on save without intrusive modal prompts.
- **Sequential Conflict Resolution**: If both manufacturer and material have
  similarities, prompts are shown sequentially. Dismissing or canceling an alert
  keeps the scanned value as-is and continues the flow. Choosing an existing entity
  replaces occurrences across both the field and the generated spool name.

### 3. Material Deduplication in the UI

- In [`client/src/components/filament-modal.tsx`](file:///home/przemek/work/priv/filadex-oryginal/client/src/components/filament-modal.tsx),
  predefined materials that already exist in the database (compared case-insensitively)
  are filtered out from the default options list.
- Fallback `<SelectItem>` rendering and form reset canonicalization ensure Radix UI
  Select triggers never fail to display due to case differences.

### 4. Color Template and Hex Code Handling

- The color dropdown provides predefined template colors and sets the color code accordingly.
- The `colorName` field remains required (`color*`), agreeing with the server schema without boundary fallbacks.
- If the user manually tweaks the hex code or color picker, the selected color
  name is retained, allowing custom shades while preserving familiar color names.
- Color codes accept existing data lengths (`max(20)`, optional) and normalise hex
  formats on read (e.g. expanding 3-digit `#RGB` or truncating 8-digit `#RRGGBBAA` to `#RRGGBB`),
  avoiding form validation errors when editing existing spools imported from external sources.

### 5. Responsive Mobile Chart Presentation

- In [`client/src/components/material-color-chart.tsx`](file:///home/przemek/work/priv/filadex-oryginal/client/src/components/material-color-chart.tsx),
  floating slice labels are suppressed on screens narrower than 768px.
- A responsive flex-wrap badge list (`data-testid="mobile-chart-labels"`) is rendered
  below the graph, displaying color dots, material names, and percentages cleanly
  without viewport clipping.

## Consequences

- **No Data Loss on Barcode Import**: Scanned spools reliably save their
  manufacturer and material attributes without requiring prior manual setup in
  Settings.
- **Strict Scope Isolation**: Auto-registered manufacturers are scoped to the
  declaring user's Personal Catalog. A user can manage and delete their own
  manufacturers in Settings; another user never sees them in dropdowns or lists.
  Global manufacturer additions remain admin-curated via Settings or Catalog Requests.
- **Clean Catalog Hygiene**: Users are prompted before accidental near-duplicate
  manufacturers or materials enter their database.
- **Mobile First Accessibility**: Spool charts and modal dialogs fit within mobile
  screen dimensions with dedicated E2E test coverage (`tests/e2e/mobile.spec.ts`).
- **Database Efficiency**: Targeted SQL lookups replace full-table scans during
  entity resolution.
