# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Quelle: https://github.com/forrestchang/andrej-karpathy-skills

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## 5. Know Which Test Suite Fits

**This project has two. Check both before concluding something is untestable.**

- **`npx vitest run`** — unit and HTTP-level tests (`tests/`), against a real
  database. `tests/routes/*` mount the real route modules through
  `tests/helpers/app.ts`. This is the default and the fast one.
- **`npm run build && npm run test:e2e`** — Playwright (`tests/e2e/`), driving
  the real bundle in Chromium against a temp-file SQLite database seeded by
  `scripts/seed.ts --demo`. The build is deliberately not implicit; the config
  fails loudly if `dist/` is stale. `npx playwright install chromium` once.

Reach for Playwright when the behaviour only exists in a real browser: effect
ordering and remounts, navigation, cookies and `<html lang>`, browser input
quirks. `tests/components/*` use `renderToString`, which runs **no effects** —
a passing component test proves nothing about `useEffect` behaviour, and there
is no jsdom or `@testing-library` here.

Notes for writing e2e specs:
- `workers: 1` and one shared database, so specs are not isolated from each
  other. The materials specs sign in as `admin`; if a spec mutates account
  state, use a different seeded user (`alice`, `bob`, `carol`) so it does not
  leak sideways.
- Sign in through the form (`tests/e2e/helpers.ts`), never by minting a cookie.
- Anything asserted right after a client-side navigation can be observed
  mid-transition. `AuthProvider` unmounts its children while it re-checks the
  session on every route change, so wait for the settled fact (the API's view)
  before asserting the DOM's.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
