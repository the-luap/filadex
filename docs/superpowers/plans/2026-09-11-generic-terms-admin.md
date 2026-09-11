# Generic Terms Admin + Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-managed generic terms table to reduce similarity matching false positives, fix word-boundary replacement bugs, and fix concurrent manufacturer resolution casing.

**Architecture:** New `generic_terms` DB table + CRUD API + settings UI tab (admin-only) following the existing manufacturers pattern. The `findSimilarItems` function gains an optional `stopWords` parameter. Two minor fixes in `filament-modal.tsx` and `server/storage.ts`.

**Tech Stack:** TypeScript, Drizzle ORM (Postgres + SQLite), React, TanStack Query, Radix UI, Zod, Vitest

**Spec:** Decisions documented in `docs/adr/0008-admin-managed-generic-terms.md` and the grilling session in this conversation.

## Global Constraints

- Dual-dialect migrations: every schema change needs `npm run db:generate` AND `npm run db:generate:sqlite`
- Follow existing CRUD patterns exactly (schema → storage interface → storage impl → route registration → settings component)
- i18n keys in all three locales: `en.ts`, `de.ts`, `pl.ts`
- Store generic term words lowercase; compare lowercase
- No `sortOrder` column; display alphabetically
- Seed guard: `COALESCE(max(id), 0) = 0` — don't re-seed after manual deletion

---

### Task 1: Schema, Storage, and API for Generic Terms

**Files:**
- Modify: `shared/schema.ts` (add table + insert schema + types, around line 480)
- Modify: `server/storage.ts` (add interface methods ~line 397, add implementation ~line 984)
- Modify: `server/routes/settings.ts` (register CRUD routes ~line 33)
- Modify: `client/src/components/settings/settings-types.ts` (add client type + validation schema)
- Test: `tests/routes/generic-terms.test.ts`

**Interfaces:**
- Consumes: `table`, `t`, `createInsertSchema` from `@shared/columns`; `registerCrudSettingsRoutes`, `simpleNameParseLine` from `server/utils/settings-crud`
- Produces:
  - Table: `genericTerms` (columns: `id`, `word` text not null unique, `createdAt`)
  - Types: `GenericTerm`, `InsertGenericTerm`, `insertGenericTermSchema`
  - Storage methods: `getGenericTerms(): Promise<GenericTerm[]>`, `createGenericTerm(term: InsertGenericTerm): Promise<GenericTerm>`, `deleteGenericTerm(id: number): Promise<boolean>`
  - API: `GET/POST/DELETE /api/generic-terms` (admin-only for POST/DELETE)
  - Client type: `GenericTerm { id: number; word: string; createdAt: string }` + `createGenericTermSchema`

- [ ] **Step 1: Add the `generic_terms` table to the schema**

In `shared/schema.ts`, after the `storageLocations` table (around line 480), add:

```typescript
export const genericTerms = table("generic_terms", {
  id: t.pk("id"),
  word: t.text("word").notNull().unique("generic_terms_word_key"),
  createdAt: t.timestamptz("created_at").defaultNow().notNull()
});
```

After the `insertStorageLocationSchema` (around line 521), add:

```typescript
export const insertGenericTermSchema = createInsertSchema(genericTerms).omit({
  id: true,
  createdAt: true,
});
```

After the existing type exports (around line 550), add:

```typescript
export type InsertGenericTerm = z.infer<typeof insertGenericTermSchema>;
export type GenericTerm = typeof genericTerms.$inferSelect;
```

- [ ] **Step 2: Generate migrations for both dialects**

Run:
```bash
npm run db:generate
npm run db:generate:sqlite
```

Verify new `.sql` files appear in `migrations/pg/` and `migrations/sqlite/`.

- [ ] **Step 3: Add storage interface methods**

In `server/storage.ts`, in the `IStorage` interface after the storage location operations (~line 415), add:

```typescript
  // Generic term operations
  getGenericTerms(): Promise<GenericTerm[]>;
  createGenericTerm(term: InsertGenericTerm): Promise<GenericTerm>;
  deleteGenericTerm(id: number): Promise<boolean>;
```

Add `GenericTerm, InsertGenericTerm, genericTerms` to the imports from `@shared/schema`.

- [ ] **Step 4: Add storage implementation**

In `server/storage.ts`, in the `DatabaseStorage` class after the storage location methods, add:

```typescript
  // Generic term implementations
  async getGenericTerms(): Promise<GenericTerm[]> {
    return await db.select().from(genericTerms).orderBy(genericTerms.word);
  }

  async createGenericTerm(insertTerm: InsertGenericTerm): Promise<GenericTerm> {
    const [term] = await db
      .insert(genericTerms)
      .values({ ...insertTerm, word: insertTerm.word.trim().toLowerCase() })
      .returning();
    return term;
  }

  async deleteGenericTerm(id: number): Promise<boolean> {
    const [deleted] = await db
      .delete(genericTerms)
      .where(eq(genericTerms.id, id))
      .returning();
    return !!deleted;
  }
```

- [ ] **Step 5: Register CRUD routes**

In `server/routes/settings.ts`, add `insertGenericTermSchema, type GenericTerm` to the imports from `@shared/schema`.

After the storage locations route registration, add:

```typescript
  registerCrudSettingsRoutes<GenericTerm, { word: string }>(app, {
    entityName: "generic term",
    basePath: "/api/generic-terms",
    csvFilename: "generic-terms.csv",
    insertSchema: insertGenericTermSchema,
    storage: {
      getAll: () => storage.getGenericTerms(),
      create: (data) => storage.createGenericTerm(data),
      delete: (id) => storage.deleteGenericTerm(id),
    },
    csv: {
      exportHeader: "word",
      exportRow: (item) => `${escapeCsvField(item.word)}\n`,
      isHeaderRow: (line) => /word|term|generic/i.test(line),
      parseLine: (line) => {
        const word = line.trim().toLowerCase();
        return word ? { word } : null;
      },
    },
    duplicateOf: (item, data) => item.word === data.word.trim().toLowerCase(),
  });
```

- [ ] **Step 6: Add client-side type and validation schema**

In `client/src/components/settings/settings-types.ts`, add:

```typescript
export interface GenericTerm {
  id: number;
  word: string;
  createdAt: string;
}

export const createGenericTermSchema = (t: (key: string) => string) => z.object({
  word: z.string().min(1, t('settings.genericTerms.wordRequired'))
});
```

- [ ] **Step 7: Write the route test**

Create `tests/routes/generic-terms.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createTestClient, loginAsAdmin } from "../test-utils";

describe("GET /api/generic-terms", () => {
  it("returns generic terms for authenticated users", async () => {
    const client = await createTestClient();
    await loginAsAdmin(client);
    const res = await client.get("/api/generic-terms");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST /api/generic-terms", () => {
  it("creates a generic term as admin", async () => {
    const client = await createTestClient();
    await loginAsAdmin(client);
    const res = await client.post("/api/generic-terms").send({ word: "testword" });
    expect(res.status).toBe(201);
    expect(res.body.word).toBe("testword");
  });

  it("lowercases the word on creation", async () => {
    const client = await createTestClient();
    await loginAsAdmin(client);
    const res = await client.post("/api/generic-terms").send({ word: "TestWord" });
    expect(res.status).toBe(201);
    expect(res.body.word).toBe("testword");
  });
});
```

Note: adapt the test utilities import to match the exact helpers available in the test suite. Check `tests/test-utils.ts` or `tests/routes/filaments.test.ts` for the actual import pattern.

- [ ] **Step 8: Run tests**

Run: `npx vitest run tests/routes/generic-terms.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add generic_terms table, storage, API routes, and route tests"
```

---

### Task 2: Settings UI Tab for Generic Terms

**Files:**
- Create: `client/src/components/settings/settings-generic-terms.tsx`
- Modify: `client/src/components/settings-dialog.tsx` (add tab + content ~lines 106–117, 175–179)
- Modify: `client/src/i18n/locales/en.ts` (add `settings.genericTerms` keys)
- Modify: `client/src/i18n/locales/de.ts` (add `settings.genericTerms` keys)
- Modify: `client/src/i18n/locales/pl.ts` (add `settings.genericTerms` keys)
- Test: `tests/components/settings-generic-terms.test.tsx`

**Interfaces:**
- Consumes: `GenericTerm`, `createGenericTermSchema` from `./settings-types`; `SettingsCrudList` from `./settings-crud-list`; i18n `useTranslation`
- Produces: `<GenericTermsList />` React component

- [ ] **Step 1: Create the settings component**

Create `client/src/components/settings/settings-generic-terms.tsx`:

```tsx
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TableCell } from "@/components/ui/table";
import { useTranslation } from "@/i18n";
import { GenericTerm, createGenericTermSchema } from "./settings-types";
import { SettingsCrudList } from "./settings-crud-list";

const GENERIC_TERMS_CSV_FORMAT = `word
lab
filament
3d
...`;

export function GenericTermsList() {
  const { t } = useTranslation();

  return (
    <SettingsCrudList<GenericTerm, { word: string }>
      entityKey="generic-terms"
      endpoint="/api/generic-terms"
      entityType="generic term"
      schema={createGenericTermSchema}
      defaultValues={{ word: "" }}
      layout="table"
      columnHeaders={[t("settings.genericTerms.word")]}
      emptyLabelSuffix="noGenericTerms"
      getSearchText={(item) => item.word}
      renderAddFields={(form) => (
        <FormField
          control={form.control}
          name="word"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("settings.genericTerms.word")}</FormLabel>
              <FormControl>
                <Input placeholder={t("settings.genericTerms.wordPlaceholder")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      renderItemCells={(item) => (
        <TableCell className="py-1 truncate">
          <div className="max-w-full truncate" title={item.word}>
            {item.word}
          </div>
        </TableCell>
      )}
      csvFormat={GENERIC_TERMS_CSV_FORMAT}
      csvFields={["word"]}
    />
  );
}
```

- [ ] **Step 2: Add the tab to settings-dialog.tsx**

In `client/src/components/settings-dialog.tsx`:

Add the import at the top:
```typescript
import { GenericTermsList } from "./settings/settings-generic-terms";
```

In the `TabsList`, after the community-filaments trigger (~line 113), add:
```tsx
              {isAdmin && (
                <TabsTrigger value="generic-terms" className="text-xs sm:text-sm whitespace-nowrap">{t('settings.genericTerms.title')}</TabsTrigger>
              )}
```

In the `TabsContent` section, after the community-filaments content (~line 179), add:
```tsx
          {isAdmin && (
            <TabsContent value="generic-terms">
              <GenericTermsList />
            </TabsContent>
          )}
```

- [ ] **Step 3: Add English i18n keys**

In `client/src/i18n/locales/en.ts`, in the `settings` object after the `communityFilaments` section (or alongside other entity sections), add:

```typescript
    genericTerms: {
      title: 'Generic Terms',
      description: 'Common words ignored during similarity matching to reduce false positives',
      add: 'Add Generic Term',
      addTitle: 'Add Generic Term',
      addDescription: 'Add a word to ignore during similarity comparison',
      addButton: 'Add Generic Term',
      word: 'Word',
      wordPlaceholder: 'e.g. lab, filament, 3d',
      edit: 'Edit Generic Term',
      delete: 'Delete Generic Term',
      deleteAll: 'Delete All Generic Terms',
      noGenericTerms: 'No generic terms configured',
      searchPlaceholder: 'Search generic terms...',
      loading: 'Loading data...',
      wordRequired: 'Word is required',
      addSuccess: 'Generic term added',
      addSuccessDescription: 'The generic term was successfully added.',
      addError: 'The generic term could not be added.',
      deleteSuccess: 'Generic term deleted',
      deleteSuccessDescription: 'The generic term was successfully deleted.',
      deleteError: 'The generic term could not be deleted.',
      deleteErrorTitle: 'Error deleting',
      deleteAllConfirmTitle: 'Delete all generic terms?',
      deleteAllConfirmDescription: 'This action cannot be undone. Are you sure you want to delete all {{count}} generic terms?',
      deleteAllConfirm: 'Delete all',
      deleteAllSuccess: 'Generic terms deleted',
      deleteAllSuccessDescription: 'All generic terms were successfully deleted.',
      deleteAllError: 'Not all generic terms could be deleted. Please try again.',
      importExport: 'Generic Terms Import/Export',
    },
```

- [ ] **Step 4: Add German i18n keys**

In `client/src/i18n/locales/de.ts`, add the equivalent `genericTerms` section:

```typescript
    genericTerms: {
      title: 'Allgemeine Begriffe',
      description: 'Häufige Wörter, die beim Ähnlichkeitsvergleich ignoriert werden, um Fehlalarme zu reduzieren',
      add: 'Begriff hinzufügen',
      addTitle: 'Allgemeinen Begriff hinzufügen',
      addDescription: 'Ein Wort hinzufügen, das beim Ähnlichkeitsvergleich ignoriert wird',
      addButton: 'Begriff hinzufügen',
      word: 'Wort',
      wordPlaceholder: 'z.B. lab, filament, 3d',
      edit: 'Begriff bearbeiten',
      delete: 'Begriff löschen',
      deleteAll: 'Alle Begriffe löschen',
      noGenericTerms: 'Keine allgemeinen Begriffe konfiguriert',
      searchPlaceholder: 'Begriffe suchen...',
      loading: 'Daten werden geladen...',
      wordRequired: 'Wort ist erforderlich',
      addSuccess: 'Begriff hinzugefügt',
      addSuccessDescription: 'Der allgemeine Begriff wurde erfolgreich hinzugefügt.',
      addError: 'Der Begriff konnte nicht hinzugefügt werden.',
      deleteSuccess: 'Begriff gelöscht',
      deleteSuccessDescription: 'Der allgemeine Begriff wurde erfolgreich gelöscht.',
      deleteError: 'Der Begriff konnte nicht gelöscht werden.',
      deleteErrorTitle: 'Fehler beim Löschen',
      deleteAllConfirmTitle: 'Alle Begriffe löschen?',
      deleteAllConfirmDescription: 'Diese Aktion kann nicht rückgängig gemacht werden. Möchten Sie wirklich alle {{count}} Begriffe löschen?',
      deleteAllConfirm: 'Alle löschen',
      deleteAllSuccess: 'Begriffe gelöscht',
      deleteAllSuccessDescription: 'Alle allgemeinen Begriffe wurden erfolgreich gelöscht.',
      deleteAllError: 'Nicht alle Begriffe konnten gelöscht werden. Bitte versuchen Sie es erneut.',
      importExport: 'Begriffe Import/Export',
    },
```

- [ ] **Step 5: Add Polish i18n keys**

In `client/src/i18n/locales/pl.ts`, add the equivalent `genericTerms` section:

```typescript
    genericTerms: {
      title: 'Ogólne terminy',
      description: 'Popularne słowa ignorowane podczas porównywania podobieństwa, aby zmniejszyć fałszywe alarmy',
      add: 'Dodaj termin',
      addTitle: 'Dodaj ogólny termin',
      addDescription: 'Dodaj słowo ignorowane podczas porównywania podobieństwa',
      addButton: 'Dodaj termin',
      word: 'Słowo',
      wordPlaceholder: 'np. lab, filament, 3d',
      edit: 'Edytuj termin',
      delete: 'Usuń termin',
      deleteAll: 'Usuń wszystkie terminy',
      noGenericTerms: 'Brak skonfigurowanych ogólnych terminów',
      searchPlaceholder: 'Szukaj terminów...',
      loading: 'Ładowanie danych...',
      wordRequired: 'Słowo jest wymagane',
      addSuccess: 'Termin dodany',
      addSuccessDescription: 'Ogólny termin został pomyślnie dodany.',
      addError: 'Nie udało się dodać terminu.',
      deleteSuccess: 'Termin usunięty',
      deleteSuccessDescription: 'Ogólny termin został pomyślnie usunięty.',
      deleteError: 'Nie udało się usunąć terminu.',
      deleteErrorTitle: 'Błąd usuwania',
      deleteAllConfirmTitle: 'Usunąć wszystkie terminy?',
      deleteAllConfirmDescription: 'Tej czynności nie można cofnąć. Czy na pewno chcesz usunąć wszystkie {{count}} terminów?',
      deleteAllConfirm: 'Usuń wszystkie',
      deleteAllSuccess: 'Terminy usunięte',
      deleteAllSuccessDescription: 'Wszystkie ogólne terminy zostały pomyślnie usunięte.',
      deleteAllError: 'Nie wszystkie terminy mogły zostać usunięte. Spróbuj ponownie.',
      importExport: 'Import/Eksport terminów',
    },
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Generic Terms admin settings tab with i18n support"
```

---

### Task 3: Seed Pre-Population for Generic Terms

**Files:**
- Modify: `scripts/seed.ts` (add `seedGenericTerms()` function ~line 78, call it from `main`)
- Modify: `shared/schema.ts` import in seed.ts (add `genericTerms`)

**Interfaces:**
- Consumes: `genericTerms` table from `@shared/schema`; `db` instance from seed.ts
- Produces: 12 default rows in `generic_terms` on first launch only

- [ ] **Step 1: Add the seed function**

In `scripts/seed.ts`, after the `seedStarter()` function (around line 78), add:

```typescript
async function seedGenericTerms(): Promise<void> {
  // Don't re-seed if any row has ever existed — even if the admin deleted them
  // all. Auto-increment IDs are never reused, so max(id) > 0 means the table
  // was populated at some point.
  const [{ maxId }] = await db.select({ maxId: sql<number>`coalesce(max(${genericTerms.id}), 0)` }).from(genericTerms);
  if (Number(maxId) > 0) {
    return;
  }

  console.log("Adding default generic terms for similarity matching...");
  const defaults = [
    "lab", "labs", "filament", "filaments", "3d", "polymers",
    "material", "materials", "printing", "print", "studio", "maker",
  ];
  await db.insert(genericTerms)
    .values(defaults.map((word) => ({ word })))
    .onConflictDoNothing();
  console.log(`Inserted ${defaults.length} default generic terms.`);
}
```

Add `genericTerms` to the imports from `@shared/schema` at the top of the file.

- [ ] **Step 2: Call the seed function**

In the main execution block of `scripts/seed.ts`, after the `seedStarter()` call (or alongside it), add:

```typescript
await seedGenericTerms();
```

This should run regardless of whether `seedStarter` skipped (existing install) or ran (fresh install).

- [ ] **Step 3: Test the seed locally**

Run:
```bash
npm run seed -- --starter
```

Verify output includes "Adding default generic terms" on first run, and skips on second run.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: pre-populate default generic terms on first launch"
```

---

### Task 4: Wire Generic Terms into Similarity Matching

**Files:**
- Modify: `shared/similarity.ts` (add `stopWords` parameter to `findSimilarItems` ~line 54)
- Modify: `client/src/components/filament-modal.tsx` (fetch generic terms, pass to `findSimilarItems` ~lines 168, 476, 495, 590, 604)
- Modify: `tests/utils/similarity.test.ts` (add tests for stop word filtering)

**Interfaces:**
- Consumes: `findSimilarItems` signature; `/api/generic-terms` endpoint; `useQuery` from TanStack Query
- Produces: Updated `findSimilarItems<T>(scannedName: string, existingItems: T[], stopWords?: Set<string>): SimilarityResult<T>`

- [ ] **Step 1: Write failing tests for stop word filtering**

In `tests/utils/similarity.test.ts`, add:

```typescript
describe("stop words filtering", () => {
  const stopWords = new Set(["lab", "filament"]);

  it("does not match on a generic token when it is a stop word", () => {
    const result = findSimilarManufacturers("Bambu Lab", [{ name: "Form Lab" }], stopWords);
    expect(result.similarMatches).toHaveLength(0);
  });

  it("still matches on non-stop-word tokens", () => {
    const result = findSimilarManufacturers("Bambu Lab", [{ name: "Bambu Studio" }], stopWords);
    expect(result.similarMatches.length).toBeGreaterThan(0);
  });

  it("still matches via other similarity rules (alphanumeric, prefix, levenshtein)", () => {
    const result = findSimilarManufacturers("Prusament", [{ name: "Prusa" }], stopWords);
    expect(result.similarMatches.length).toBeGreaterThan(0);
  });

  it("works with no stop words (backward compatible)", () => {
    const result = findSimilarManufacturers("Bambu Lab", [{ name: "Form Lab" }]);
    expect(result.similarMatches.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/utils/similarity.test.ts`
Expected: The stop words tests FAIL (signature doesn't accept third arg, and no filtering).

- [ ] **Step 3: Update `findSimilarItems` to accept stop words**

In `shared/similarity.ts`, update the function signature at line 54:

```typescript
export function findSimilarItems<T extends SimilarityItem>(
  scannedName: string,
  existingItems: T[],
  stopWords?: Set<string>
): SimilarityResult<T> {
```

Update the `isSignificantToken` usage. Replace the module-level `isSignificantToken` with a local function inside `findSimilarItems` that respects stop words:

Replace the token overlap section (around line 89-94):
```typescript
    // b. Token overlap (e.g. "TPU 95A" contains "tpu", "Bambu Lab" contains "bambu", "PA-CF" contains "pa")
    const isSignificant = (tok: string) =>
      (tok.length >= 3 || TWO_LETTER_POLYMERS.has(tok)) && (!stopWords || !stopWords.has(tok));
    const scannedSignificant = scannedTokens.filter(isSignificant);
    const itemSignificant = itemTokens.filter(isSignificant);
    const hasSharedToken = scannedSignificant.some((st) => itemSignificant.includes(st));
```

Move the token splitting to use the same `isSignificant` filter. The `scannedTokens` (line 73) should remain unfiltered for the split, but filtering should happen at comparison time. So the token lines at 73 and 81 stay as-is (they split on delimiters), and only the overlap check uses `isSignificant`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/utils/similarity.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Fetch generic terms in filament-modal and pass to similarity**

In `client/src/components/filament-modal.tsx`, add the query near the other `useQuery` calls:

```typescript
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Inside the component:
const { data: genericTermsData = [] } = useQuery({
  queryKey: ["/api/generic-terms"],
  queryFn: () => apiRequest<{ id: number; word: string }[]>("/api/generic-terms"),
});
const genericStopWords = useMemo(
  () => new Set(genericTermsData.map((t) => t.word)),
  [genericTermsData]
);
```

Add `useMemo` to React imports if not already there.

Then update all four call sites to pass the stop words:

Line 476: `const match = findSimilarManufacturers(result.manufacturer, manufacturers, genericStopWords);`
Line 495: `const matMatch = findSimilarMaterials(result.material, allAvailableMaterials, genericStopWords);`
Line 590: `const match = findSimilarManufacturers(data.manufacturer, manufacturers, genericStopWords);`
Line 604: `const matMatch = findSimilarMaterials(data.material, allAvailableMaterials, genericStopWords);`

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire admin-managed generic terms into similarity matching"
```

---

### Task 5: Fix Word Boundary Replacement in Similarity Prompts

**Files:**
- Modify: `client/src/components/filament-modal.tsx` (~lines 1736-1739 and 1796-1799)

**Interfaces:**
- Consumes: `similarManufacturerPrompt.scannedManufacturer`, `similarMaterialPrompt.scannedMaterial`
- Produces: Word-boundary-safe replacement in spool name

- [ ] **Step 1: Add a regex escape helper**

At the top of `client/src/components/filament-modal.tsx` (or in a utils file), add:

```typescript
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

- [ ] **Step 2: Fix manufacturer name replacement**

At ~line 1736-1739, replace:

```tsx
const currentName = form.getValues('name');
if (currentName.includes(similarManufacturerPrompt.scannedManufacturer)) {
  form.setValue('name', currentName.replaceAll(similarManufacturerPrompt.scannedManufacturer, sim.name));
}
```

With:

```tsx
const currentName = form.getValues('name');
const mfgPattern = new RegExp(`\\b${escapeRegex(similarManufacturerPrompt.scannedManufacturer)}\\b`, 'gi');
if (mfgPattern.test(currentName)) {
  mfgPattern.lastIndex = 0; // reset after test()
  form.setValue('name', currentName.replace(mfgPattern, sim.name));
}
```

- [ ] **Step 3: Fix material name replacement**

At ~line 1796-1799, replace:

```tsx
const currentName = form.getValues('name');
if (currentName.includes(similarMaterialPrompt.scannedMaterial)) {
  form.setValue('name', currentName.replaceAll(similarMaterialPrompt.scannedMaterial, sim.name));
}
```

With:

```tsx
const currentName = form.getValues('name');
const matPattern = new RegExp(`\\b${escapeRegex(similarMaterialPrompt.scannedMaterial)}\\b`, 'gi');
if (matPattern.test(currentName)) {
  matPattern.lastIndex = 0;
  form.setValue('name', currentName.replace(matPattern, sim.name));
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/components/filament-modal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix: use word boundaries for similarity name replacement to prevent substring corruption"
```

---

### Task 6: Fix Concurrent Manufacturer Resolution Casing

**Files:**
- Modify: `server/storage.ts` (~lines 230-247, `ensureDeclaredManufacturerResolves`)

**Interfaces:**
- Consumes: `manufacturers` table, `db` instance
- Produces: Returns canonical casing from DB after concurrent insert conflict

- [ ] **Step 1: Fix the function**

In `server/storage.ts`, replace `ensureDeclaredManufacturerResolves` (lines 230-247):

```typescript
async function ensureDeclaredManufacturerResolves(declared: string | null | undefined): Promise<string | null | undefined> {
  if (!declared) return declared;
  const name = declared.trim();
  if (name === "") return name;

  const [existing] = await db
    .select({ name: manufacturers.name })
    .from(manufacturers)
    .where(sql`lower(${manufacturers.name}) = lower(${name})`)
    .limit(1);

  if (existing) return existing.name;

  await db.insert(manufacturers)
    .values({ name })
    .onConflictDoNothing();

  // If a concurrent request inserted the same name with different casing,
  // onConflictDoNothing silently skipped our insert. Fetch the canonical
  // name from whoever won the race rather than returning our input casing.
  const [canonical] = await db
    .select({ name: manufacturers.name })
    .from(manufacturers)
    .where(sql`lower(${manufacturers.name}) = lower(${name})`)
    .limit(1);

  return canonical?.name ?? name;
}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/routes/filaments.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "fix: fetch canonical manufacturer casing after concurrent insert conflict"
```
