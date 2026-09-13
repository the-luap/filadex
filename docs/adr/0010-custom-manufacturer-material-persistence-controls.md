---
status: accepted
date: 2026-09-12
---

# User-Controlled Persistence and Custom Input for Manufacturers and Materials

This architecture decision records how Filadex provides dedicated user input fields
and explicit catalog persistence controls for non-catalog manufacturers and materials
during spool creation and editing.

## Context

1. **Automatic Personal Catalog Pollution**:
   Following [ADR 0003](0003-per-user-material-catalog.md) and [ADR 0008](0008-similarity-matching-and-catalog-auto-registration.md),
   any declared manufacturer or material that did not match an existing catalog entry was
   automatically inserted into the user's Personal Catalog (`user_id` set on `manufacturers`
   and `materials`). While this prevented foreign key resolution errors on scan imports,
   it caused unwanted side effects:
   - Typographical errors (e.g. typing "Prusa Reseach") were immediately committed to the
     user's catalog in Settings without confirmation.
   - One-off spools or transient names from external community imports permanently bloated
     the user's manufacturer and material dropdowns.
   - Users lacked visibility and consent regarding whether an unlisted entity was being
     saved permanently to their personal account collection.

2. **Inconsistent UI Treatment**:
   - Colors had a dedicated `"Custom"` option and explicit text input field.
   - Manufacturers and materials dynamically injected ad-hoc `<SelectItem>` options into the
     Radix UI dropdowns, creating confusing dropdown state where non-standard values
     masqueraded as predefined catalog items with no visible text field for editing.

## Decisions

### 1. Dedicated "Other" / "Custom" Select Options & Text Inputs

- **Manufacturer Select**: Contains an `"Other"` option (`filaments.otherManufacturer`).
  When selected (or auto-selected when an unrecognized manufacturer is scanned, imported,
  or loaded from an existing filament), a dedicated text input field is displayed below
  the dropdown, populated with the custom manufacturer's name.
- **Material Select**: Contains a `"Custom"` option (`common.custom`).
  When selected (or auto-selected when an unrecognized material is scanned, imported,
  or loaded from an existing filament), a dedicated text input field is displayed below
  the dropdown (`filaments.customMaterialName`).
- When a known catalog manufacturer or material is selected, custom input fields and their
  persistence controls are hidden.

### 2. User-Controlled Catalog Persistence Checkboxes

- When the custom manufacturer input is visible and has non-empty text, a checkbox is
  rendered directly beneath it:
  `[x] Save manufacturer to my collection` (`filaments.saveManufacturerToCollection`).
- When the custom material input is visible and has non-empty text, a checkbox is
  rendered directly beneath it:
  `[x] Save material to my collection` (`filaments.saveMaterialToCollection`).
- **Default State**: Both checkboxes default to checked (`true`), providing seamless
  continuation for users who wish to grow their Personal Catalog, while granting explicit
  power to uncheck the box for temporary or one-off entries.

### 3. API & Schema Flags

- [`shared/schema.ts`](../../shared/schema.ts): `filamentWriteSchema`, `filamentPatchSchema`,
  and `InsertFilament` accept optional boolean flags:
  - `saveManufacturer?: boolean`
  - `saveMaterial?: boolean`
- In [`server/routes/filaments.ts`](../../server/routes/filaments.ts), these flags are passed
  to `storage.createFilament` and `storage.updateFilament`.

### 4. Storage Decoupling

- In `server/storage.ts` (`findOrCreateFilamentType`):
  - **Manufacturer**:
    - If `saveManufacturer !== false`: calls `ensureDeclaredManufacturerResolves(userId, fields.manufacturer)`
      which inserts a row into `manufacturers` with `userId = req.userId`.
    - If `saveManufacturer === false`: skips `ensureDeclaredManufacturerResolves`. The manufacturer
      string is stored directly on `filament_types.manufacturer` without creating a row in
      the `manufacturers` table.
  - **Material**:
    - If `saveMaterial !== false`: calls `ensureDeclaredMaterialResolves(userId, fields.material, fields.density)`
      which inserts a row into `materials` with `userId = req.userId`.
    - If `saveMaterial === false`: skips `ensureDeclaredMaterialResolves`. The material string
      is stored directly on `filament_types.material` without creating a row in the `materials` table.
- Because `filaments` joins with `filament_types` via `filamentTypeId` rather than foreign keys to
  the `manufacturers` or `materials` tables, spools retain their full manufacturer and material
  identities regardless of whether the entity is persisted into the catalog tables.

## Consequences

- **User Autonomy**: Users have full control over what enters their Personal Catalog in Settings.
- **Clean Catalog Hygiene**: One-off spools and test imports no longer pollute personal catalog lists.
- **Consistent UX**: Manufacturer and Material selection follow the same intuitive pattern
  established for custom colors.
- **Backward Compatibility**: Existing API and CSV callers that do not send the `save...` flags
  continue to default to `true`, maintaining existing import behavior.
