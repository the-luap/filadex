# Mobile-First Component Redesign & Overlaying Modal Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix mobile layout failures from PR #41 by replacing the auto-dismissing toast with a conscious-decision overlaying modal on top of `FilamentModal`, restyling candidate lists to match PR #40's mobile-first card pattern, polishing dialog/toast mobile responsiveness, establishing mobile-first guidelines in `AGENTS.md`, and adding mobile E2E tests.

**Architecture:** 
- Extract a reusable `CollectionSpoolCard` modeled on PR #40's `CommunityCatalogSearchResults` with color swatch, `min-w-0 break-words` title, material badge, and pill badge metadata row.
- In `FilamentModal`, replace the Priority 0 auto-dismissing toast with an overlaying `AlertDialog` (`collectionMatchPrompt`) that presents a preview card of the matched spool and forces a conscious choice: **"Use Collection Specs"**, **"Search Community Catalog instead"**, or **"Cancel"**.
- Standardize conflict candidate dialogs in `FilamentModal` and `Home` to use `CollectionSpoolCard` and include the community catalog escape hatch.
- Polish `Toast`, `DialogContent`, and `AlertDialogContent` to prevent horizontal overflow on narrow screens (360–390px).
- Add mobile viewport Playwright E2E tests verifying zero horizontal overflow (`scrollWidth <= clientWidth`), modal-on-modal stacking, and decision branching.
- Write a mandatory mobile-first component rule in `AGENTS.md` and reference in `CLAUDE.md`.

**Tech Stack:** React, Tailwind CSS, Radix UI, TypeScript, Vitest, Playwright E2E.

**Spec / Requirements:**
- PR #41 mobile usability bugfix
- User requirement: Replace toast with overlaying modal forcing conscious decision (modal on modal)
- User requirement: Follow PR #40 mobile-first component design style
- User requirement: Cover with E2E tests
- User requirement: Document rule in markdown file (`AGENTS.md`)

---

## Tasks

### Task 1: Reusable Mobile-First `CollectionSpoolCard` Component

**Files:**
- Create: `client/src/components/collection-spool-card.tsx`
- Test: `tests/components/collection-spool-card.test.tsx`

**Interfaces:**
```typescript
export interface CollectionSpoolCardProps {
  spool: Filament;
  onClick?: () => void;
  interactive?: boolean; // default true. If false, renders as non-button preview card
  className?: string;
}
```

- [ ] **Step 1: Write component unit tests for `CollectionSpoolCard`**
  - Verify rendering spool name, manufacturer, color swatch, material badge.
  - Verify rendering badge pills for spool type (`Refill` vs `Spooled`), weight (e.g. `1kg`), and print temp.
  - Verify interactive vs non-interactive modes.
  - Verify `min-w-0 break-words` text container to guarantee no horizontal overflow.

- [ ] **Step 2: Run test to verify failure**
  - Run: `npx vitest run tests/components/collection-spool-card.test.tsx`
  - Expected: FAIL (module not found).

- [ ] **Step 3: Implement `CollectionSpoolCard`**
  - Build `client/src/components/collection-spool-card.tsx` mirroring PR #40's `CommunityCatalogSearchResults`:
    - Rounded-lg card with dark/light borders and hover/active states.
    - Top line: Color swatch (`shrink-0`), Title (`min-w-0 break-words font-semibold text-sm`), Secondary text (`text-xs text-muted-foreground`), and Material badge (`badgeVariants({ variant: "secondary" }) uppercase shrink-0`).
    - Badges row: `flex flex-wrap items-center gap-1.5 pl-[26px] text-xs` containing Spool Type, Weight, Diameter, and Print Temp.
    - Minimum 44px touch target when interactive.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `npx vitest run tests/components/collection-spool-card.test.tsx`
  - Expected: PASS.

---

### Task 2: Overlaying Modal for Priority 0 Collection Match in `FilamentModal`

**Files:**
- Modify: `client/src/components/filament-modal.tsx`
- Modify: `client/src/i18n/locales/en.ts`
- Modify: `client/src/i18n/locales/pl.ts`
- Modify: `client/src/i18n/locales/de.ts`
- Test: `tests/lib/collection-scanner-translations.test.ts`
- Test: `tests/components/filament-modal-priority-0.test.tsx`

- [ ] **Step 1: Update locale test with `useCollectionSpecs` key**
  - In `tests/lib/collection-scanner-translations.test.ts`, add `"useCollectionSpecs"` to `requiredKeys`.
  - Run `npx vitest run tests/lib/collection-scanner-translations.test.ts` to verify it passes with the added translations.

- [ ] **Step 2: Replace the Priority 0 toast with an overlaying `AlertDialog`**
  - In `client/src/components/filament-modal.tsx`:
    - Add state: `const [collectionMatchPrompt, setCollectionMatchPrompt] = useState<{ spool: Filament; code: string } | null>(null);`
    - In `handleQRCodeScanned`: When `collectionLookup.type === "single"` and `!isEditing`:
      - Remove the `toast({ ... action: <ToastAction> ... })`.
      - Trigger `setCollectionMatchPrompt({ spool: collectionLookup.spool, code })`.
    - Render overlaying `AlertDialog` for `collectionMatchPrompt`:
      - Title: `t('scanner.spoolMatchedActionTitle')`
      - Description: `t('scanner.spoolMatchedActionDescription', { name: spool.name, code })`
      - Preview: `<CollectionSpoolCard spool={collectionMatchPrompt.spool} interactive={false} />`
      - Actions in mobile-first column (`flex-col sm:flex-row-reverse gap-2`):
        - **"Use Collection Specs"** (`useCollectionSpecs`) -> calls `applyCollectionSpoolData(spool, code)` and dismisses prompt.
        - **"Search Community Catalog instead"** (`searchCommunityCatalogInstead`) -> sets barcode in form, queries `queryCommunityCatalogGtin(code, { ignoreFormHints: true })`, and dismisses prompt.
        - **"Cancel"** (`common.cancel`) -> sets barcode in form for manual entry (Priority 2 fallback) and dismisses prompt.
    - In `overwriteSpecsPrompt` (edit mode):
      - Remove the post-action toast.
      - Add `CollectionSpoolCard` preview.
      - Add option: "Search Community Catalog instead".

- [ ] **Step 3: Verify with component tests**
  - Run `npx vitest run tests/components/filament-modal-priority-0.test.tsx`.

---

### Task 3: Mobile-First Conflict Candidate Dialogs in `FilamentModal` and `Home`

**Files:**
- Modify: `client/src/components/filament-modal.tsx`
- Modify: `client/src/pages/home.tsx`

- [ ] **Step 1: Refactor `collectionCandidates` Dialog in `FilamentModal`**
  - Replace the crude inline button loop with `CollectionSpoolCard` components.
  - In the dialog footer, add an escape hatch button: **"Search Community Catalog instead"** (`t('scanner.searchCommunityCatalogInstead')`).
  - Style footer with mobile-first stacked actions (`flex-col sm:flex-row gap-2`).

- [ ] **Step 2: Refactor `collectionConflictPrompt` and `matchedCollectionSpoolPrompt` in `Home`**
  - In `client/src/pages/home.tsx`:
    - Use `CollectionSpoolCard` for candidate items in `collectionConflictPrompt`.
    - Add preview `CollectionSpoolCard` in `matchedCollectionSpoolPrompt`.
    - Mobile-first button stacking: Primary button on top for quick thumb reach, Cancel at bottom.

- [ ] **Step 3: Run existing unit/component tests**
  - Run: `npx vitest run tests/components/`

---

### Task 4: Responsive Mobile Polish for Dialogs, Alert Dialogs, and Toast

**Files:**
- Modify: `client/src/components/ui/dialog.tsx`
- Modify: `client/src/components/ui/alert-dialog.tsx`
- Modify: `client/src/components/ui/toast.tsx`
- Modify: `client/src/components/ui/toaster.tsx`

- [ ] **Step 1: Ensure Dialogs do not overflow on narrow mobile screens (320–390px)**
  - In `client/src/components/ui/dialog.tsx` and `alert-dialog.tsx`:
    - Update `DialogContent` and `AlertDialogContent` width: `w-[calc(100vw-2rem)] sm:w-full max-w-lg`.
    - Ensure `max-h-[90vh]` with safe padding and scrollable interior.

- [ ] **Step 2: Make Toast and Toaster Mobile-First**
  - In `client/src/components/ui/toast.tsx`:
    - `toastVariants`: Change from rigid row to `flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 pr-9 sm:p-5 sm:pr-8`.
    - `ToastAction`: Change to `w-full sm:w-auto shrink-0 min-h-[36px] py-1.5 px-3 text-xs sm:text-sm font-medium`.
    - `ToastClose`: Change to `opacity-80 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 touch-manipulation` so touch users can easily see and tap it without hover.
    - `ToastViewport`: `p-3 sm:p-4 max-w-[100vw] sm:max-w-[420px]`.
  - In `client/src/components/ui/toaster.tsx`:
    - Add `w-full min-w-0 flex-1` and word-break to title and description containers.

- [ ] **Step 3: Verify changes**
  - Run: `npx vitest run`

---

### Task 5: Document Mobile-First Design Rule in `AGENTS.md` and `CLAUDE.md`

**Files:**
- Create: `AGENTS.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write `AGENTS.md`**
  - Document the mandatory **Mobile-First UI Design Standard**:
    1. **Mobile-First Rule**: Every visual component, dialog, modal, form, and list must be designed for small mobile viewports (360px–390px width) first before desktop progressive enhancement.
    2. **No Auto-Dismissing Decision Points**: Never use transient notifications (toasts) for workflows requiring user choices or actions. Use persistent in-context modals or prompts.
    3. **Reference Implementation**: Cite PR #40 (`client/src/components/community-catalog-search-results.tsx`) and `client/src/components/collection-spool-card.tsx` as the canonical style for cards, swatch layouts, and badges.
    4. **Touch Targets & Spacing**: Minimum 44x44px (or 40px with generous margin) for interactive buttons. No `opacity-0` hover-only controls on touch devices.
    5. **Text & Flexbox Safety**: Always include `min-w-0` and `break-words` on flex children holding user or catalog text to prevent horizontal overflow.
    6. **Button Stacking**: Dialog and modal footers must stack vertically on mobile (`flex-col sm:flex-row`), putting the primary action within easy thumb reach.

- [ ] **Step 2: Reference `AGENTS.md` in `CLAUDE.md`**
  - Add a pointer under UI Guidelines in `CLAUDE.md` directing contributors and AI assistants to `AGENTS.md`.

---

### Task 6: Comprehensive Mobile Viewport E2E Tests

**Files:**
- Create / Modify: `tests/e2e/priority-0-barcode-lookup.spec.ts`

- [ ] **Step 1: Write Mobile E2E Test Suite**
  - Test 1: **Mobile viewport Add Modal scan -> Modal-on-Modal decision prompt appears**:
    - Set viewport: `390x844`.
    - Open Add Filament modal.
    - Click scan QR -> scan Spool A's barcode.
    - Scanner closes; overlaying prompt dialog ("Spool Found in Collection") appears ON TOP of Add Filament modal.
    - Verify preview card rendered with color swatch, name, and material badge.
    - Assert no horizontal overflow: `await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)`.
    - Assert prompt dialog buttons stack vertically and have `min-height >= 36px`.
    - Click "Use Collection Specs" -> prompt closes, Add Filament modal is prefilled with Spool A specs.
  - Test 2: **Mobile decision "Search Community Catalog instead"**:
    - Open Add modal on mobile viewport.
    - Scan Spool A's barcode.
    - In the overlay prompt, click "Search Community Catalog instead".
    - Prompt closes; triggers community catalog lookup with the barcode without filling from collection.
  - Test 3: **Mobile Conflict Candidate Dialog**:
    - Seed two spools with same barcode but different specs.
    - Open Add modal, scan barcode.
    - Conflict dialog appears with multiple `CollectionSpoolCard` items.
    - Assert `scrollWidth <= clientWidth`.
    - Click candidate -> fills specs from selected candidate.
  - Test 4: **Toast mobile responsiveness**:
    - Trigger a toast with long text and action on mobile viewport.
    - Verify toast stays within viewport bounds without horizontal scrolling.

- [ ] **Step 2: Run E2E tests**
  - Run: `npm run build:e2e && npm run test:e2e tests/e2e/priority-0-barcode-lookup.spec.ts`
  - Expected: PASS.

---

### Task 7: Full Verification Suite

- [ ] **Step 1: Run full TypeScript check**
  - Run: `npm run check` and `npm run check:sqlite`
  - Expected: Clean, 0 errors.

- [ ] **Step 2: Run full Vitest suite**
  - Run: `npx vitest run`
  - Expected: All 54 test files passing.

- [ ] **Step 3: Run full Playwright E2E suite**
  - Run: `npm run build:e2e && npm run test:e2e`
  - Expected: All specs passing.
