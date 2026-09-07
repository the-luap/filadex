import { test, expect, type Page } from "@playwright/test";

/**
 * The defect this pins:
 *
 * `POST /api/auth/register` resolved the new account's language with
 * `resolveLanguage(req)`, whose first priority is the stored preference of
 * whichever `token` cookie the browser happens to hold. `/register` is an
 * unguarded route - nothing redirects an authenticated visitor away - so a
 * signed-in user creating a second account stamped that account with their own
 * language and mailed it a verification link in a language its owner may not
 * read.
 *
 * The client half of the same finding: the selector on those pre-login screens
 * must not write to the account that still has a session, because the visitor
 * is choosing a language to read the form in, not editing someone's profile.
 *
 * Both halves need a real browser. The server-side test in
 * `tests/routes/auth.test.ts` can forge the cookie pair, but only the app
 * decides whether picking Polish on `/register` issues a
 * `POST /api/users/language` at all.
 *
 * Signs in as the seeded `bob`, whose stored language is `de` - so the account
 * preference and the request disagree, which is the only way to see which one
 * the server used. `bob` also keeps this spec off `alice`, whom
 * `login-language.spec.ts` leaves on `pl`, and off the admin the materials
 * specs drive.
 */
const BOB = { username: "bob", password: "demo-password" };
const ADMIN = { username: "admin", password: "demo-password" };

/** Unique per run: the account survives the spec, and CI retries the failures. */
const NEWCOMER = {
  username: `nowicjusz-${Date.now()}`,
  email: `nowicjusz-${Date.now()}@example.com`,
  password: "some-strong-password-123",
};

/** Signs in through the English form, whatever the session lands on afterwards. */
async function signInEnglish(page: Page, user: { username: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel(/username/i).fill(user.username);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /^login$/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** The admin's view of an account's stored language, by username. */
async function storedLanguageOf(adminPage: Page, username: string): Promise<string> {
  const users = await adminPage.evaluate(async () => {
    const response = await fetch("/api/users", { credentials: "include" });
    if (!response.ok) throw new Error(`GET /api/users -> ${response.status}`);
    return (await response.json()) as Array<{ username: string; language: string }>;
  });
  const match = users.find((user) => user.username === username);
  if (!match) throw new Error(`No account named ${username} in /api/users`);
  return match.language;
}

test.describe("registering while another account is signed in", () => {
  test("stamps the new account from the request, not from the session", async ({ page, browser }) => {
    await signInEnglish(page, BOB);
    // bob's account says German, and the app applies it - so there really is a
    // stored preference here for registration to have inherited.
    await expect(page.locator("html")).toHaveAttribute("lang", "de", { timeout: 30_000 });

    // Nothing redirects an authenticated visitor away from /register.
    await page.goto("/register");
    await expect(page.getByRole("button", { name: /language|sprache|język/i })).toBeVisible();

    await page.getByRole("button", { name: /language|sprache|język/i }).click();
    await page.getByRole("menuitem", { name: "Polski" }).click();
    await expect(page.getByText("Utwórz konto, aby zarządzać filamentami")).toBeVisible();

    // By placeholder, not label: the username field wraps its Input in the div
    // that carries the availability tick, so FormControl puts the id on the
    // wrapper and the label is not tied to the input. The email and password
    // fields on the same form are fine. Pre-existing, unrelated to language.
    await page.getByPlaceholder(/wprowadź nazwę użytkownika/i).fill(NEWCOMER.username);
    await page.getByLabel(/e-mail/i).fill(NEWCOMER.email);
    await page.getByLabel(/hasło/i).fill(NEWCOMER.password);
    await page.getByRole("button", { name: /^utwórz konto$/i }).click();
    await expect(page.getByText(/Konto utworzone!/)).toBeVisible({ timeout: 30_000 });

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      await signInEnglish(adminPage, ADMIN);

      // The request asked for Polish. Before the fix the new account got `de`,
      // inherited from the session that happened to be open in the browser.
      expect(await storedLanguageOf(adminPage, NEWCOMER.username)).toBe("pl");

      // And picking Polish on /register did not rewrite the signed-in account.
      expect(await storedLanguageOf(adminPage, BOB.username)).toBe("de");
    } finally {
      await adminContext.close();
    }
  });
});
