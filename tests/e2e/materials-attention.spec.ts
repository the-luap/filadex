import { test, expect } from "@playwright/test";
import { signIn, openMaterialsSettings } from "./helpers";

/**
 * The second behaviour #12 named (fixed in #10, `3d57f16`, also uncovered).
 *
 * A Personal Catalog material auto-registered by declaring it on a spool has no
 * density and is not hygroscopic, which is indistinguishable from one nobody
 * has looked at - so the "needs attention" prompt would sit on the row forever.
 * Dismissing it is click -> PUT -> refetch -> the row re-renders without the
 * notice, and only the last step tells you the round trip actually worked.
 */
test.describe("the needs-attention prompt", () => {
  const material = "MoonPLA";

  test.beforeEach(async ({ page }) => {
    await signIn(page);

    // Declaring a material that resolves to nothing is what auto-registers it
    // into the signed-in user's Personal Catalog in exactly the state the
    // prompt is for - no density, not hygroscopic. Created through the API so
    // the spec drives the prompt rather than the spool form.
    await page.goto("/");
    const created = await page.evaluate(async (name) => {
      const response = await fetch("/api/filaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: `${name} spool`,
          material: name,
          colorName: "Black",
          totalWeight: "1000",
          remainingPercentage: "100",
        }),
      });
      return { ok: response.ok, status: response.status, body: await response.text() };
    }, material);
    expect(created.ok, `POST /api/filaments -> ${created.status} ${created.body}`).toBeTruthy();

    await openMaterialsSettings(page);
  });

  test("is shown on an auto-registered material, and dismissing it sticks", async ({ page }) => {
    const row = page.getByRole("row").filter({ has: page.getByText(material, { exact: true }) });
    await expect(row).toBeVisible();

    const notice = row.getByText(/needs attention/i);
    await expect(notice).toBeVisible();

    await row.getByRole("button", { name: /dismiss this reminder/i }).click();

    // Gone after the refetch, not merely hidden optimistically...
    await expect(notice).toBeHidden();

    // ...and still gone once the dialog is reopened from a fresh page load,
    // which is what distinguishes a persisted dismissal from local state.
    await page.reload();
    await openMaterialsSettings(page);
    const rowAgain = page.getByRole("row").filter({ has: page.getByText(material, { exact: true }) });
    await expect(rowAgain).toBeVisible();
    await expect(rowAgain.getByText(/needs attention/i)).toBeHidden();
  });
});
