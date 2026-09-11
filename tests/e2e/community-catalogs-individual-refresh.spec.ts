import { test, expect } from "@playwright/test";
import { signIn, openSettingsTab } from "./helpers";

/**
 * Tests for the individual OFD and SpoolmanDB refresh buttons on the
 * Community Catalogs settings tab. The existing spec covers "Refresh All";
 * these cover the per-source buttons and their visual feedback.
 */

test.describe("Community Catalogs Settings – Individual refresh", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await openSettingsTab(page, /community catalogs/i);
  });

  test("OFD refresh button triggers source-specific refresh", async ({ page }) => {
    await page.route("**/api/community-filaments/refresh", async (route) => {
      const body = await route.request().postDataJSON();
      expect(body.source).toBe("ofd");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          count: 567,
          source: "ofd",
          durationMs: 80,
        }),
      });
    });

    const ofdRefresh = page.getByRole("button", { name: /refresh ofd/i });
    await expect(ofdRefresh).toBeVisible();
    await ofdRefresh.click();

    // Toast confirms success
    await expect(page.getByText(/community catalogs refreshed/i).first()).toBeVisible();
    await expect(page.getByText(/cached 567 filament profiles/i).first()).toBeVisible();
  });

  test("SpoolmanDB refresh button triggers source-specific refresh", async ({ page }) => {
    await page.route("**/api/community-filaments/refresh", async (route) => {
      const body = await route.request().postDataJSON();
      expect(body.source).toBe("spoolmandb");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          count: 890,
          source: "spoolmandb",
          durationMs: 120,
        }),
      });
    });

    const spoolmanRefresh = page.getByRole("button", { name: /refresh spoolmandb/i });
    await expect(spoolmanRefresh).toBeVisible();
    await spoolmanRefresh.click();

    await expect(page.getByText(/community catalogs refreshed/i).first()).toBeVisible();
    await expect(page.getByText(/cached 890 filament profiles/i).first()).toBeVisible();
  });

  test("refresh buttons are disabled while a refresh is in progress", async ({ page }) => {
    // Make the refresh slow so we can observe the disabled state
    await page.route("**/api/community-filaments/refresh", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, count: 100, source: "all", durationMs: 2000 }),
      });
    });

    const refreshAll = page.getByRole("button", { name: /refresh all catalogs/i });
    const ofdRefresh = page.getByRole("button", { name: /refresh ofd/i });
    const spoolmanRefresh = page.getByRole("button", { name: /refresh spoolmandb/i });

    await refreshAll.click();

    // All three buttons should be disabled during refresh
    await expect(refreshAll).toBeDisabled();
    await expect(ofdRefresh).toBeDisabled();
    await expect(spoolmanRefresh).toBeDisabled();

    // Wait for the request to complete
    await expect(refreshAll).toBeEnabled({ timeout: 5000 });
    await expect(ofdRefresh).toBeEnabled();
    await expect(spoolmanRefresh).toBeEnabled();
  });

  test("cached count and last-updated timestamp are displayed for each catalog", async ({ page }) => {
    // The status endpoint is called automatically on tab open. Intercept
    // it to return deterministic data.
    await page.route("**/api/community-filaments/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          count: 1500,
          lastUpdated: "2026-09-01T10:00:00Z",
          ofd: { count: 800, lastUpdated: "2026-09-01T10:00:00Z" },
          spoolmandb: { count: 700, lastUpdated: "2026-09-01T09:00:00Z" },
        }),
      });
    });

    // Navigate back to the settings tab to pick up the mocked status
    await openSettingsTab(page, /community catalogs/i);
    await expect(page.getByRole("heading", { name: /^community catalogs$/i })).toBeVisible({ timeout: 30_000 });

    // Verify cached counts are displayed
    await expect(page.getByText("800 profiles cached")).toBeVisible();
    await expect(page.getByText("700 profiles cached")).toBeVisible();
    await expect(page.getByText("1500 profiles cached")).toBeVisible();
  });
});
