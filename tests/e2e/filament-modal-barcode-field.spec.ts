import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("Filament Modal – Barcode field", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto("/");
  });

  test("barcode field is visible on the Add Filament dialog", async ({ page }) => {
    await page.getByRole("button", { name: /add filament/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // The barcode input should exist and be empty by default
    const barcodeInput = dialog.getByLabel(/barcode/i);
    await expect(barcodeInput).toBeVisible();
    await expect(barcodeInput).toHaveValue("");
  });

  test("barcode value is saved with a new filament and shown when editing", async ({ page }) => {
    const uniqueName = `BarcodeE2E-${Date.now()}`;
    const testBarcode = "4006381333627";

    await page.getByRole("button", { name: /add filament/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Fill required fields
    await dialog.getByLabel(/material\*/i).click();
    await page.getByRole("option", { name: "PLA" }).first().click();

    await dialog.getByLabel(/color\*/i).click();
    await page.getByRole("option", { name: "Black" }).first().click();

    // Fill name after material/color to avoid auto-generation overwriting
    await dialog.getByLabel(/name\*/i).fill(uniqueName);

    // Fill barcode
    await dialog.getByLabel(/barcode/i).fill(testBarcode);

    // Select Packaging
    await dialog.getByLabel(/packaging/i).click();
    await page.getByRole("option", { name: /sealed|opened/i }).first().click();

    // Select Spool Type
    await dialog.getByLabel(/spool type/i).click();
    await page.getByRole("option", { name: /spooled|spoolless/i }).first().click();

    // Save
    await dialog.getByRole("button", { name: /^save$/i }).click();
    await expect(dialog).toBeHidden();

    // Verify the spool card appears
    await expect(page.getByText(uniqueName)).toBeVisible();

    // Find the spool card and click its edit button
    const spoolCard = page.locator(".filament-card").filter({ hasText: uniqueName });
    await expect(spoolCard).toBeVisible();
    await spoolCard.getByRole("button", { name: /edit/i }).click();

    const editDialog = page.getByRole("dialog");
    await expect(editDialog).toBeVisible();

    // The barcode field should contain the saved barcode
    await expect(editDialog.getByLabel(/barcode/i)).toHaveValue(testBarcode);
  });
});
