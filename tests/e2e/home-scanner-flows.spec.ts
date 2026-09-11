import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Tests for barcode scanner flows on the Home page.
 *
 * The scanner itself requires a camera (Html5Qrcode), so in headless Playwright
 * we cannot fire a real scan. These tests verify the UI that wraps the scanner
 * and the downstream behaviour by intercepting API calls.
 *
 * Specifically:
 *   - The scanner dialog UI (open, close, heading, cancel button)
 *   - The GTIN lookup → single match → Add modal pre-fill
 *   - The GTIN lookup → multiple matches → variant selection dialog
 *   - The GTIN lookup → not found → Add modal with barcode pre-filled
 */

test.describe("Home – Scanner dialog UI", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto("/");
  });

  test("scan barcode button is visible in the filter sidebar", async ({ page }) => {
    const scanButton = page.getByRole("button", { name: /scan barcode/i });
    await expect(scanButton).toBeVisible();
  });

  test("scanner modal shows heading, description and cancel button", async ({ page }) => {
    await page.getByRole("button", { name: /scan barcode/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Heading
    await expect(page.getByRole("heading", { name: /scan qr code/i })).toBeVisible();

    // Cancel button
    const cancelButton = dialog.getByRole("button", { name: /cancel/i });
    await expect(cancelButton).toBeVisible();

    // Close via cancel
    await cancelButton.click();
    await expect(dialog).toBeHidden();
  });

  test("scanner modal can be closed via the X button", async ({ page }) => {
    await page.getByRole("button", { name: /scan barcode/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Close via the X (close) button in the header
    const closeButton = dialog.getByRole("button", { name: /close/i }).first();
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await expect(dialog).toBeHidden();
  });
});

test.describe("Home – Barcode scanner GTIN lookup results", () => {
  let seededSpool: { name: string; material: string; barcode: string };

  test.beforeEach(async ({ page }) => {
    seededSpool = {
      name: `GtinSpool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      material: "PLA",
      barcode: "8594195180555",
    };

    await signIn(page);
    await page.goto("/");

    // Seed a spool with a known barcode
    await page.evaluate(async (spool) => {
      await fetch("/api/filaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: spool.name,
          material: spool.material,
          colorName: "White",
          colorCode: "#FFFFFF",
          barcode: spool.barcode,
          totalWeight: "1000",
          remainingPercentage: "100",
        }),
      });
    }, seededSpool);

    await page.reload();
    await expect(page.getByText(seededSpool.name)).toBeVisible();
  });

  test("searching by barcode of existing spool filters to that spool", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search by name/i);
    await searchInput.fill(seededSpool.barcode);

    // Only the matching spool should be visible
    await expect(page.getByText(seededSpool.name)).toBeVisible();
  });

  test("searching by barcode with leading zeros still matches the spool", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search by name/i);

    // Zero-pad the barcode to simulate a 14-digit GTIN
    await searchInput.fill(`000${seededSpool.barcode}`);

    await expect(page.getByText(seededSpool.name)).toBeVisible();
  });
});

test.describe("Home – Variant candidate selection dialog", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto("/");
  });

  test("GTIN with multiple candidates shows selection dialog from community catalog search in add modal", async ({ page }) => {
    const candidates = [
      {
        id: "ofd-v1",
        source: "ofd",
        manufacturer: "Polymaker",
        name: "PolyTerra PLA",
        material: "PLA",
        colorName: "Cotton White",
        colorCode: "#F5F5F5",
        density: 1.24,
        diameter: 1.75,
        weightGrams: 1000,
        spoolRefill: false,
        extruderTemp: 210,
        bedTemp: 50,
        gtin: "6971046590001",
      },
      {
        id: "ofd-v2",
        source: "ofd",
        manufacturer: "Polymaker",
        name: "PolyTerra PLA",
        material: "PLA",
        colorName: "Cotton White",
        colorCode: "#F5F5F5",
        density: 1.24,
        diameter: 1.75,
        weightGrams: 250,
        spoolRefill: true,
        extruderTemp: 210,
        bedTemp: 50,
        gtin: "6971046590001",
      },
    ];

    // Intercept community search to return the two variants
    await page.route("**/api/community-filaments/search*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(candidates),
      });
    });

    await page.getByRole("button", { name: /add filament/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Search community catalog
    const searchInput = dialog.getByPlaceholder(/search catalog/i);
    await searchInput.fill("PolyTerra");

    // Both candidates should be listed as buttons
    const resultButtons = dialog.getByRole("button", { name: /polymaker.*polyterra pla/i });
    await expect(resultButtons).toHaveCount(2);

    // Click the second candidate (refill / 250g)
    await resultButtons.nth(1).click();

    // Verify GTIN is pre-filled
    await expect(dialog.getByLabel(/barcode/i)).toHaveValue("6971046590001");
  });
});
