import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("Filament Modal – Form reset on cancel and save", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto("/");
  });

  test("values are cleared when canceling and reopening the add filament modal", async ({ page }) => {
    // Open Add Filament modal
    await page.getByRole("button", { name: /add filament/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Fill some values
    const barcodeInput = dialog.getByLabel(/barcode/i);
    const nameInput = dialog.getByLabel(/name\*/i);

    await barcodeInput.fill("987654321");
    await nameInput.fill("Temporary Cancel Test");

    // Click Cancel
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).toBeHidden();

    // Reopen Add Filament modal
    await page.getByRole("button", { name: /add filament/i }).click();
    await expect(dialog).toBeVisible();

    // Values must be cleared
    await expect(dialog.getByLabel(/barcode/i)).toHaveValue("");
    await expect(dialog.getByLabel(/name\*/i)).toHaveValue("");
  });

  test("values are cleared after saving and reopening the add filament modal", async ({ page }) => {
    const uniqueName = `SaveResetE2E-${Date.now()}`;
    const testBarcode = "555666777888";

    // Open Add Filament modal
    await page.getByRole("button", { name: /add filament/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Fill required fields
    await dialog.getByLabel(/material\*/i).click();
    await page.getByRole("option", { name: "PLA" }).first().click();

    await dialog.getByLabel(/color\*/i).click();
    await page.getByRole("option", { name: "Black" }).first().click();

    await dialog.getByLabel(/name\*/i).fill(uniqueName);
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

    // Verify created filament is visible
    await expect(page.getByText(uniqueName)).toBeVisible();

    // Reopen Add Filament modal
    await page.getByRole("button", { name: /add filament/i }).click();
    await expect(dialog).toBeVisible();

    // Values must be cleared, not retaining the previous values
    await expect(dialog.getByLabel(/barcode/i)).toHaveValue("");
    await expect(dialog.getByLabel(/name\*/i)).toHaveValue("");
  });
});
