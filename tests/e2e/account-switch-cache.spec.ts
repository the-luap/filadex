import { test, expect } from "@playwright/test";
import { DEMO_ADMIN, signIn } from "./helpers";

/**
 * Signing out and back in as somebody else never shows the first account's
 * spools.
 *
 * The SPA keeps one QueryClient for the whole page, and private queries are
 * keyed by endpoint alone - ['/api/filaments'], ['/api/statistics']. Logging in
 * as a second account used to leave the first account's rows in that cache, and
 * the inventory renders whatever it has while its own request is in flight, so
 * alice's spools appeared under the next session. Only a browser can show this:
 * the server answers both requests correctly, and the disclosure happens
 * between the two.
 *
 * alice is the first account because the demo fixture gives her the spools;
 * the second is the seeded admin, who has none in that fixture - so anything
 * named below could only have come from the cache. Neither account is mutated.
 */
const alice = { username: "alice", password: "demo-password" }; // ggignore: throwaway test fixture credential

test("a second account never renders the first account's inventory", async ({ page }) => {
  // Two sign-ins plus a deliberately held request do not fit the default budget.
  test.setTimeout(90_000);

  await signIn(page, alice);
  await expect(page.getByText("Jade White #1")).toBeVisible();

  await page.getByRole("button", { name: /^account$/i }).click();
  await page.getByRole("menuitem", { name: /logout|sign out|abmelden/i }).click();
  await expect(page).toHaveURL(/\/login/);

  // Hold the second account's private requests open - all but the session check
  // itself, which has to answer for the app to render at all. That wait is the
  // window the stale cache used to fill, because every view renders what it
  // already has until its own request answers.
  await page.route("**/api/**", async (route) => {
    if (route.request().url().includes("/api/auth/")) {
      return route.continue();
    }
    await new Promise((resolve) => setTimeout(resolve, 8_000));
    await route.continue();
  });

  // Signed in by hand rather than through the helper: the helper waits for the
  // header before returning, and the stale render happens before that.
  await page.getByLabel(/username/i).fill(DEMO_ADMIN.username);
  await page.getByLabel(/password/i).fill(DEMO_ADMIN.password);
  await page.getByRole("button", { name: /login|sign in|anmelden/i }).click();

  // Sampled rather than awaited: a retrying assertion would pass the moment the
  // held request finally answered and replaced the stale rows, which is exactly
  // the disclosure this is about. The question is whether alice's spools are
  // ever on screen, not whether they are gone by the end.
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    expect(await page.getByText("Jade White #1").count()).toBe(0);
    expect(await page.getByText("Orange PETG (low)").count()).toBe(0);
    await page.waitForTimeout(250);
  }

  await page.unroute("**/api/**");
});
