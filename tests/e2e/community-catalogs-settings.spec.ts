import { test, expect } from "@playwright/test";
import { signIn, openSettingsTab } from "./helpers";

test.describe("Community Catalogs Settings", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await openSettingsTab(page, /community catalogs/i);
  });

  test("displays status cards for Open Filament Database and SpoolmanDB", async ({ page }) => {
    // Check main community catalogs title and description
    await expect(page.getByRole("heading", { name: /^community catalogs$/i })).toBeVisible();
    await expect(page.getByText(/caches of vendor filament profiles from open filament database and spoolmandb/i)).toBeVisible();

    // Check individual catalog cards
    await expect(page.getByRole("heading", { name: /open filament database \(ofd\)/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^spoolmandb$/i })).toBeVisible();

    // Check refresh buttons
    await expect(page.getByRole("button", { name: /refresh all catalogs/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /refresh ofd/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /refresh spoolmandb/i })).toBeVisible();
  });

  test("refresh buttons trigger refresh mutation and update UI", async ({ page }) => {
    // Intercept refresh call to return a mock success response so we don't depend on external network in test
    await page.route("**/api/community-filaments/refresh", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          count: 1234,
          source: "all",
          durationMs: 150,
        }),
      });
    });

    const refreshButton = page.getByRole("button", { name: /refresh all catalogs/i });
    await refreshButton.click();

    // Verify toast notification appears with count
    await expect(page.getByText(/community catalogs refreshed/i).first()).toBeVisible();
    await expect(page.getByText(/cached 1234 filament profiles/i).first()).toBeVisible();
  });
});
