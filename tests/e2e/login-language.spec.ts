import { test, expect } from "@playwright/test";

/**
 * The defect this pins:
 *
 * The language selector on the pre-login screens had nowhere to write to.
 * `setLanguage` reached `localStorage` and the `language` cookie, but skipped
 * `POST /api/users/language` because there was no session yet. Logging in then
 * undid the choice: `/api/auth/me` returned the account's stored `language`
 * (`en`, the schema default), `LanguageProvider`'s `[userData]` effect applied
 * it before consulting `localStorage`, and the `[language]` effect rewrote
 * `<html lang>` and the cookie back to `en`. The one thing the selector was
 * added for did not survive the login it existed to precede.
 *
 * It needs a real browser and a real login: the bug is the order two React
 * effects run in once the session query resolves, against the real bundle.
 * `renderToString`, which the component tests use, runs no effects at all.
 *
 * Signs in as alice, not the admin the other specs use: this writes a language
 * preference to the account, and alice is seeded `language: "en"` - the exact
 * schema default the bug turned on - while leaving the admin the materials
 * specs depend on untouched.
 */
const ALICE = { username: "alice", password: "demo-password" };

/** What the account itself holds, which is what has to change. */
async function storedLanguage(page: import("@playwright/test").Page): Promise<string> {
  return await page.evaluate(async () => {
    const response = await fetch("/api/auth/me", { credentials: "include" });
    if (!response.ok) throw new Error(`GET /api/auth/me -> ${response.status}`);
    return ((await response.json()) as { language: string }).language;
  });
}

test.describe("a language chosen on the login screen", () => {
  test("survives logging in, and is written to the account", async ({ page }) => {
    await page.goto("/login");

    // The server stamps the shell before any script runs, and Playwright asks
    // for English, so this starts in English - the state the bug needs.
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.getByRole("button", { name: /language/i }).click();
    await page.getByRole("menuitem", { name: "Polski" }).click();

    // The form the visitor is about to fill in is now Polish...
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
    await expect(page.getByText("Zaloguj się, aby zarządzać filamentami")).toBeVisible();

    // ...so they log in through it.
    await page.getByLabel(/nazwa użytkownika/i).fill(ALICE.username);
    await page.getByLabel(/hasło/i).fill(ALICE.password);
    await page.getByRole("button", { name: /^zaloguj się$/i }).click();
    await expect(page).not.toHaveURL(/\/login/);

    // The account said `en`. Before the fix that value came back from
    // /api/auth/me and won, reverting the choice.
    //
    // Asserted before the document attribute deliberately: the provider remounts
    // across this navigation and starts from localStorage, so `<html lang>` reads
    // `pl` for a moment whether or not the account was ever told. Waiting for the
    // account first means the attribute is checked after the session query has
    // resolved and had its chance to overwrite it.
    await expect.poll(() => storedLanguage(page), { timeout: 30_000 }).toBe("pl");
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");

    // And it holds across a reload, which is the whole point of persisting it:
    // the server now stamps `pl` from the stored preference.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  });
});
