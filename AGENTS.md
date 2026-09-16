# AGENTS.md

Instructions and architectural rules for AI coding assistants and developers working on Filadex.

## Mobile-First UI Design Standard

All visual components, dialogs, modals, forms, and lists in Filadex MUST be designed and implemented with a **Mobile-First** approach.

### 1. Mobile-First Foundation
- Design for small touchscreen viewports (360px–390px width) first before progressively enhancing for larger desktop screens (`sm:`, `md:`, `lg:`).
- Test layouts down to 320px width to ensure no horizontal overflow occurs (`scrollWidth <= clientWidth`).

### 2. No Transient Toasts for Interactive Decisions
- **NEVER** use auto-dismissing notifications (`toast`) for workflows that require user choices or decisions (e.g. asking the user to choose between collection specs vs community catalog).
- Toasts auto-dismiss after a few seconds, preventing users from having adequate time to read, decide, and tap.
- Use persistent, in-context overlaying modals/dialogs (`Dialog` / `AlertDialog`) that require a conscious user decision.

### 3. Canonical Reference Implementation
- Refer to PR #40 (`client/src/components/community-catalog-search-results.tsx`) and `client/src/components/collection-spool-card.tsx` as the canonical style for list cards, color swatches, and badge rows:
  - **Color Swatches**: `w-4 h-4 rounded-full border shrink-0 mt-0.5 shadow-sm`.
  - **Text Truncation & Wrapping**: Always wrap user or catalog text containers in `min-w-0` and use `break-words` on titles to prevent horizontal blowout on mobile viewports.
  - **Badges**: Use `badgeVariants({ variant: "secondary" })` for primary classifications (e.g. material) and `flex flex-wrap items-center gap-1.5 pl-[26px]` with `badgeVariants({ variant: "outline" })` for secondary metadata pills (e.g. spool type, weight, diameter, temperatures).

### 4. Touch Targets & Accessibility
- All clickable elements (buttons, card actions, icons) must provide a minimum touch target of **44x44px** (or minimum 36px with generous spacing).
- Never hide dismiss or action buttons behind desktop-only `:hover` pseudo-classes (`opacity-0 group-hover:opacity-100`). Touchscreens do not support hover states; interactive controls must be visible and accessible on mobile.

### 5. Dialog & Modal Stacking on Mobile
- Dialog footers with multiple action buttons must stack vertically on mobile (`flex flex-col sm:flex-row-reverse gap-2 sm:gap-2`), placing primary action buttons within easy thumb reach.
- Dialog containers must include padding and safety margins on narrow screens: `w-[calc(100vw-2rem)] sm:w-full max-w-lg`.
