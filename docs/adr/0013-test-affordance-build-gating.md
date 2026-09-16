---
status: accepted
date: 2026-09-16
---

# Gating Test Affordances from Production Bundles via Build-Time Environment Flags

This architecture decision records how Filadex strips browser test affordances (such as simulated barcode scanning listeners) from production release builds while preserving them for end-to-end (E2E) testing against built bundles.

## Context

1. **Headless Browser Testing and Camera Simulation**:
   - The E2E test suite (`tests/e2e/priority-0-barcode-lookup.spec.ts`) exercises barcode resolution flows by driving the application in a headless Chromium browser.
   - Because headless CI environments do not possess physical cameras or barcode-scannable video feeds, [`QRScanner`](file:///client/src/components/qr-scanner.tsx) provided a custom window event listener (`filadex:scan`) to simulate scan completions directly.

2. **The Production Bundle Constraint**:
   - As documented in `playwright.config.ts`, Filadex deliberately runs E2E tests against the built distribution (`dist/`) under `NODE_ENV=production` rather than using the Vite dev server, verifying the actual minified bundle and server SQLite migration/seed scripts.
   - Because the E2E suite drives the production bundle, conventional development checks like `if (import.meta.env.DEV)` would disable the affordance exactly where the E2E tests need it.
   - Leaving the listener unconditionally in shipped code meant test-only affordances shipped to real production deployments (Docker, Synology, and release tarballs).

## Decision

### 1. Build-Time Flag Gating (`VITE_TEST_AFFORDANCES`)

- Test-specific browser affordances are gated behind the compile-time flag `import.meta.env.VITE_TEST_AFFORDANCES === "true"`.
- In standard production builds (`npm run build`), `VITE_TEST_AFFORDANCES` is unset (`undefined`). Vite statically inlines this value, and Rollup's dead-code elimination (DCE) strips the test code and strings from the output bundles.

### 2. Isolation via Helper Component for Dead-Code Elimination and Hook Integrity

- To avoid conditional React hook calls (which violate the Rules of Hooks and fail ESLint), test event listeners are isolated inside a dedicated component (e.g. `<E2EScanAffordance />`):
  ```tsx
  {import.meta.env.VITE_TEST_AFFORDANCES === "true" && (
    <E2EScanAffordance onScan={handleScanSuccess} />
  )}
  ```
- When `VITE_TEST_AFFORDANCES` is not `"true"`, the entire JSX expression evaluates to `false` at build time, allowing the minifier to eliminate the component reference and prune its definition completely.

### 3. Dedicated E2E Build Script

- `package.json` provides:
  - `"build"`: Standard production build with zero test affordances (used by Dockerfile, Synology, and release builds).
  - `"build:e2e"`: `VITE_TEST_AFFORDANCES=true npm run build`, compiling minified production bundles with test affordances enabled for E2E runs.
- CI E2E workflows (`.github/workflows/test.yml`) run `npm run build:e2e && npm run test:e2e`.

### 4. Automated Bundle Leak Prevention & CI Verification

- Filadex provides `npm run verify:bundle` (`scripts/verify-bundle-affordances.ts`), which inspects compiled client assets in `dist/public/assets/*.js` and asserts that no test affordance identifiers (such as `"filadex:scan"` or `"E2EScanAffordance"`) leaked into the bundle.
- A dedicated CI job (`build` in `.github/workflows/test.yml`) compiles the standard release bundle via `npm run build` and runs `npm run verify:bundle` on every push and PR, ensuring that release builds never break and never leak test code.
- To prevent developer confusion when alternating between standard and E2E builds, `playwright.config.ts` inspects built client assets at startup and fails fast with an explanatory error if assets were built without test affordances.

## Consequences

- Real production bundles contain no test affordances or test event listeners.
- E2E tests continue to run against minified production bundles with fast, deterministic barcode simulation.
- Any future test-only browser affordance follows this same pattern (`VITE_TEST_AFFORDANCES` + DCE verification).
