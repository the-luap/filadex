import { test, expect, type Page } from "@playwright/test";

// Throwaway test credentials for seeded demo database (safe for git, annotated for GitGuardian)
const BOB = { username: "bob", password: "demo-password" }; // ggignore: throwaway test fixture credential

/** What the account itself holds, which is what has to change. */
async function storedLanguage(page: Page): Promise<string> {
  return await page.evaluate(async () => {
    const response = await fetch("/api/auth/me", { credentials: "include" });
    if (!response.ok) throw new Error(`GET /api/auth/me -> ${response.status}`);
    return ((await response.json()) as { language: string }).language;
  });
}

test.describe("language persistence during forced password change", () => {
  test("flushes login language selection and preserves it on change-password screen", async ({ page }) => {
    try {
      await page.goto("/login");

      // The server stamps the shell before any script runs, starting in English
      await expect(page.locator("html")).toHaveAttribute("lang", "en");

      // Select Polish on login screen
      await page.getByRole("button", { name: /language/i }).click();
      await page.getByRole("menuitem", { name: "Polski" }).click();

      await expect(page.locator("html")).toHaveAttribute("lang", "pl");
      await expect(page.getByText("Zaloguj się, aby zarządzać filamentami")).toBeVisible();

      // Log in as bob, seeded with forceChangePassword: true and language: "de"
      await page.getByLabel(/nazwa użytkownika/i).fill(BOB.username);
      await page.getByLabel(/hasło/i).fill(BOB.password);
      await page.getByRole("button", { name: /^zaloguj się$/i }).click();

      // Redirects to /change-password
      await expect(page).toHaveURL(/\/change-password/);
      await expect(page.locator("html")).toHaveAttribute("lang", "pl");
      await expect(page.getByText("Zaktualizuj hasło, aby kontynuować")).toBeVisible();

      // LanguageSelector is rendered in the card header
      await expect(page.getByRole("button", { name: /język|language/i })).toBeVisible();

      // Bug 1 fix: pending language choice was flushed to the account (previously rejected with 403)
      await expect.poll(() => storedLanguage(page), { timeout: 30_000 }).toBe("pl");

      // Bug 1 fix: reload retains Polish from the database rather than reverting to seeded default
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("lang", "pl");
      await expect(page.getByText("Zaktualizuj hasło, aby kontynuować")).toBeVisible();
    } finally {
      // Restore bob's language back to German (seeded value) so other specs remain isolated.
      // bob's password was not changed, so no password reset or admin API is needed.
      await page.evaluate(async () => {
        await fetch("/api/users/language", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ language: "de" }),
        });
      });
    }
  });
});
