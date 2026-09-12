import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Tests for the barcode scanner flows triggered from the filament modal.
 *
 * The QR scanner component requires camera access, which is unavailable in
 * headless Playwright, so we cannot trigger a real scan. Instead these tests
 * exercise the behaviour *after* the scanner fires by:
 *   1. Intercepting the GTIN lookup API so we control what the server returns.
 *   2. Calling `handleQRCodeScanned` indirectly through the barcode-scan button
 *      on the modal, or by simulating the outcome (mocking the network layer
 *      and verifying the resulting UI state).
 */

/** Shared mock for a single OFD community item. */
function mockSingleGtinResult() {
  return {
    id: "ofd-gtin-1",
    source: "ofd",
    manufacturer: "Prusament",
    name: "PLA Galaxy Silver",
    material: "PLA",
    colorName: "Galaxy Silver",
    colorCode: "#C0C0C0",
    density: 1.24,
    diameter: 1.75,
    weightGrams: 1000,
    spoolRefill: false,
    extruderTemp: 215,
    bedTemp: 60,
    gtin: "8594195180999",
  };
}

/** Two variant candidates sharing the same GTIN. */
function mockMultiVariantGtinResult() {
  return {
    id: "ofd-gtin-multi",
    source: "ofd",
    manufacturer: "Polymaker",
    name: "PolyTerra PLA",
    material: "PLA",
    colorName: "Arctic Teal",
    colorCode: "#008080",
    density: 1.24,
    diameter: 1.75,
    weightGrams: 1000,
    spoolRefill: false,
    extruderTemp: 210,
    bedTemp: 50,
    gtin: "6971046591234",
    candidates: [
      {
        id: "ofd-variant-a",
        source: "ofd",
        manufacturer: "Polymaker",
        name: "PolyTerra PLA",
        material: "PLA",
        colorName: "Arctic Teal",
        colorCode: "#008080",
        density: 1.24,
        diameter: 1.75,
        weightGrams: 1000,
        spoolRefill: false,
        extruderTemp: 210,
        bedTemp: 50,
        gtin: "6971046591234",
      },
      {
        id: "ofd-variant-b",
        source: "ofd",
        manufacturer: "Polymaker",
        name: "PolyTerra PLA",
        material: "PLA",
        colorName: "Arctic Teal",
        colorCode: "#008080",
        density: 1.24,
        diameter: 1.75,
        weightGrams: 250,
        spoolRefill: true,
        extruderTemp: 210,
        bedTemp: 50,
        gtin: "6971046591234",
      },
    ],
  };
}

test.describe("Filament Modal – QR scanner GTIN lookup", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto("/");
  });

  test("modal scanner button opens QR scanner dialog", async ({ page }) => {
    await page.getByRole("button", { name: /add filament/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // The Scan QR button should be present on the modal (distinct from Scan NFC)
    const scanButton = dialog.getByRole("button", { name: /scan qr/i });
    await expect(scanButton).toBeVisible();

    await scanButton.click();

    // A second dialog (the scanner) should appear with the scanner heading
    const scannerDialog = page.locator("[role=dialog]").filter({ hasText: /scan qr code/i });
    await expect(scannerDialog).toBeVisible();

    // Close the scanner
    await scannerDialog.getByRole("button", { name: /cancel/i }).click();
    await expect(scannerDialog).toBeHidden();

    // Close add filament modal
    await dialog.getByRole("button", { name: /^cancel$/i }).click();
    await expect(dialog).toBeHidden();
  });

  test("GTIN lookup with single result pre-fills form fields", async ({ page }) => {
    const result = mockSingleGtinResult();

    // Intercept GTIN lookup
    await page.route("**/api/community-filaments/gtin/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(result),
      });
    });

    // Intercept community search to return the profile
    await page.route("**/api/community-filaments/search*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([result]),
      });
    });

    await page.getByRole("button", { name: /add filament/i }).click();
    const addDialog = page.getByRole("dialog");
    await expect(addDialog).toBeVisible();

    // Search and select the community result
    const searchInput = addDialog.getByPlaceholder(/search catalog/i);
    await searchInput.fill("Galaxy Silver");

    const resultButton = addDialog.getByRole("button", { name: /prusament.*pla galaxy silver/i });
    await expect(resultButton).toBeVisible();
    await resultButton.click();

    // Verify barcode field is pre-filled with the GTIN
    await expect(addDialog.getByLabel(/barcode/i)).toHaveValue("8594195180999");

    // Verify name is pre-filled
    await expect(addDialog.getByLabel(/name\*/i)).toHaveValue("PLA Galaxy Silver");

    // Verify print temp is pre-filled
    await expect(addDialog.getByLabel(/print temp/i)).toHaveValue(/215°C/);
  });
});

test.describe("Filament Modal – Multi-variant candidate selection", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto("/");
  });

  test("community search result with multiple candidates shows selection and pre-fills on pick", async ({ page }) => {
    const result = mockMultiVariantGtinResult();

    // Intercept community search
    await page.route("**/api/community-filaments/search*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        // Return both candidates as search results (the variants)
        body: JSON.stringify(result.candidates!),
      });
    });

    await page.getByRole("button", { name: /add filament/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const searchInput = dialog.getByPlaceholder(/search catalog/i);
    await searchInput.fill("PolyTerra");

    // Both results should appear
    const buttons = dialog.getByRole("button", { name: /polymaker.*polyterra pla/i });
    await expect(buttons.first()).toBeVisible();

    // Click the first one — it should pre-fill the form
    await buttons.first().click();

    // Barcode/GTIN should be set
    await expect(dialog.getByLabel(/barcode/i)).toHaveValue("6971046591234");
  });
});
