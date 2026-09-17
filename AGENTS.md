# AGENTS.md

Instructions and guidelines for AI coding assistants and developers working on Filadex.

## Mobile-First UI Design Principles

All visual components, dialogs, modals, forms, and lists in Filadex should follow these mobile-first design principles.

### 1. Viewport Foundation
- Design for small touchscreen viewports (360px–390px width) first before progressively enhancing for larger desktop screens (`sm:`, `md:`, `lg:`).
- Verify layouts down to 320px width to ensure no horizontal overflow occurs (`scrollWidth <= clientWidth`).

### 2. No Transient Notifications for Interactive Decisions
- Never use auto-dismissing notifications (`toast`) for workflows that require user choices or decisions (e.g. choosing between collection specs vs community catalog).
- Toasts auto-dismiss after a few seconds, preventing touch users from having adequate time to read, decide, and tap.
- Use persistent, in-context modals or dialogs (`Dialog` / `AlertDialog`) that require a conscious user action.

### 3. Touch Targets & Accessibility
- All clickable elements (buttons, card actions, icons) must provide a minimum touch target of **44x44px** (or minimum 36px with generous surrounding spacing).
- Never hide interactive controls behind desktop-only `:hover` pseudo-classes without fallback (`opacity-0 group-hover:opacity-100`). Touchscreens do not have hover states; interactive controls must be visible and accessible on mobile or gated using `@media(hover:hover)`.

### 4. Dialog & Modal Action Stacking
- Dialog footers with multiple action buttons should stack vertically on mobile (e.g. `flex-col sm:flex-row-reverse gap-2`), placing primary action buttons within easy thumb reach.
- Dialog containers should provide safe margins on narrow screens (e.g. `w-[calc(100vw-2rem)] sm:w-full max-w-lg`).

### 5. Text Containment & Overflow
- Ensure text containers inside flexbox or grid layouts use `min-w-0` and allow word breaking so user-provided titles, barcodes, or catalog descriptions do not cause horizontal blowout.
