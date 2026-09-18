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
- Dialog containers should provide safe margins on narrow screens (e.g. `w-[calc(100vw-2rem)] sm:w-full max-w-lg` or `max-w-xl` for multi-action prompts).
- **Flex Gap Spacing:** Always use `gap-*` (e.g. `gap-2` or `sm:gap-2`) rather than margin-based sibling spacing (`space-x-*` / `space-y-*`). Margin-based space utilities break across wrapped rows (`flex-wrap`) and apply asymmetric margins when reversed (`flex-row-reverse`). `AlertDialogFooter` and `DialogFooter` default to `sm:gap-2`.

### 5. Text Containment & Overflow
- Ensure text containers inside flexbox or grid layouts use `min-w-0` and allow word breaking so user-provided titles, barcodes, or catalog descriptions do not cause horizontal blowout.

## UI Evidence & Pull Request Screenshots

All user-visible changes require visual verification under `CONTRIBUTING.md`. Follow these rules when capturing and linking screenshots.

### 1. Genuine Before/After Captures (No Reconstructions)
- **Capture Baseline First:** For any layout bugfix, redesign, or UI change, capture the genuine "before" state from the **unmodified base branch (`main`)** *before* touching code (or via a separate git worktree of `main`).
- **Do Not Reconstruct:** Never create synthetic comparison pages or side-by-side mockup components that emulate the old UI on the feature branch. Reviewers require genuine captures of the real running application to verify that the bug existed and has been resolved.
- **Identical Conditions:** Capture at both mobile (390px or narrower) and desktop (1280px) viewports using identical seed data and themes (light/dark if color or contrast changes).
- **Local Storage:** Store temporary captures locally in `.screenshots/` (gitignored).

### 2. PR Screenshot Hosting (Native User-Attachments)
- **Never Host on Git Branches:** Never serve PR screenshots from a git branch (such as a `media/*` branch or a fork repository). If the branch or fork is deleted or cleaned up later, the PR loses its visual history.
- **Upload to GitHub Attachments:** AI agents and contributors must upload images/videos directly to GitHub's native user-attachments storage using the helper script:
  ```bash
  npm run upload:pr-asset -- <screenshot1.png> [screenshot2.png ...]
  # or
  bash scripts/upload-pr-asset.sh <screenshot1.png> [screenshot2.png ...]
  ```
- Paste the returned canonical `https://github.com/user-attachments/assets/<uuid>` Markdown snippets directly into the PR description.
