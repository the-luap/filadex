import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * The demo fixture seeds its materials into the Global Catalog, and only an
 * admin may edit those (settings-materials.tsx `ownsOrIsAdmin`), so these specs
 * sign in as the seeded admin rather than as alice.
 */
export const DEMO_ADMIN = { username: "admin", password: "demo-password" };

/**
 * Signs in through the form rather than minting a cookie.
 *
 * Authentication is a JWT in an httpOnly cookie (server/auth.ts), so a token
 * built in the test would have to reproduce the server's signing and cookie
 * flags to be accepted - a second implementation of the thing under test. The
 * form costs a few hundred milliseconds and cannot drift.
 */
export async function signIn(page: Page, user = DEMO_ADMIN): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/username/i).fill(user.username);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /login|sign in|anmelden/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
  // Leaving /login only means the redirect happened; the header renders once the
  // session query resolves, and everything after this looks for a control inside
  // it. Waiting here makes that one wait rather than a race repeated at every
  // call site - which is what timed out in CI on the first spec to run, while
  // later specs passed against an already-warm app.
  await expect(settingsButton(page)).toBeVisible({ timeout: 30_000 });
}

/** The header control every settings interaction starts from. */
function settingsButton(page: Page) {
  return page.getByRole("button", { name: /^settings$/i });
}

/**
 * Opens a specific tab in the Settings dialog.
 */
export async function openSettingsTab(page: Page, tabName: string | RegExp): Promise<void> {
  await page.goto("/");
  await expect(settingsButton(page)).toBeVisible({ timeout: 30_000 });
  await settingsButton(page).click();
  await page.getByRole("menuitem", { name: /general settings|list management/i }).click();
  await page.getByRole("tab", { name: tabName }).click();
}

/**
 * Opens the Materials tab, where both specs act.
 *
 * There is no /settings route - settings is a dialog behind the header's
 * Settings dropdown ("List Management"), so this walks the same path a user
 * does rather than deep-linking to something that does not exist.
 */
export async function openMaterialsSettings(page: Page): Promise<void> {
  await openSettingsTab(page, /^materials$/i);
  await expect(page.getByRole("table")).toBeVisible();
}

/**
 * The density input on a named material's row.
 *
 * Located by row rather than by label: every row's input carries the same
 * aria-label ("Density"), so the label alone is ambiguous across the table.
 */
export function densityInput(page: Page, material: string) {
  return page
    .getByRole("row")
    .filter({ has: page.getByText(material, { exact: true }) })
    .getByLabel(/density/i);
}

/**
 * The density the API currently holds for a material, by name.
 *
 * Fetched from inside the page rather than through `page.request`, which keeps
 * its own credential handling and does not carry the session cookie the app
 * signed in with - the same reason it answers 401 there and 200 here.
 */
export async function densityOf(page: Page, name: string): Promise<string | null> {
  const materials = await page.evaluate(async () => {
    const response = await fetch("/api/materials", { credentials: "include" });
    if (!response.ok) throw new Error(`GET /api/materials -> ${response.status}`);
    return (await response.json()) as Array<{ name: string; density: string | null }>;
  });
  const match = materials.find((m) => m.name === name);
  if (!match) throw new Error(`No material named ${name} in /api/materials`);
  return match.density;
}
