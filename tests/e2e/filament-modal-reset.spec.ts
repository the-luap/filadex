import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("Filament Modal – Form reset on cancel and save", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto("/");
  });

  test("values and dropdowns are cleared when canceling and reopening the add filament modal", async ({ page }) => {
    // Open Add Filament modal
    await page.getByRole("button", { name: /add filament/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Fill some values and selects
    const barcodeInput = dialog.getByLabel(/barcode/i);
    const nameInput = dialog.getByLabel(/name\*/i);

    await barcodeInput.fill("987654321");
    await nameInput.fill("Temporary Cancel Test");

    await dialog.getByLabel(/material\*/i).click();
    await page.getByRole("option", { name: "PLA" }).first().click();

    await dialog.getByLabel(/color\*/i).click();
    await page.getByRole("option", { name: "Black" }).first().click();

    // Click Cancel
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).toBeHidden();

    // Reopen Add Filament modal
    await page.getByRole("button", { name: /add filament/i }).click();
    await expect(dialog).toBeVisible();

    // Values and dropdowns must be cleared
    await expect(dialog.getByLabel(/barcode/i)).toHaveValue("");
    await expect(dialog.getByLabel(/name\*/i)).toHaveValue("");
    await expect(dialog.getByLabel(/material\*/i)).not.toHaveText("PLA");
    await expect(dialog.getByLabel(/color\*/i)).not.toHaveText("Black");
  });

  test("values are cleared when dismissing the add filament modal via Escape key", async ({ page }) => {
    // Open Add Filament modal
    await page.getByRole("button", { name: /add filament/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Fill barcode
    const barcodeInput = dialog.getByLabel(/barcode/i);
    await barcodeInput.fill("1122334455");

    // Press Escape
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Reopen Add Filament modal
    await page.getByRole("button", { name: /add filament/i }).click();
    await expect(dialog).toBeVisible();

    // Values must be cleared
    await expect(dialog.getByLabel(/barcode/i)).toHaveValue("");
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
    await expect(dialog.getByLabel(/material\*/i)).not.toHaveText("PLA");
    await expect(dialog.getByLabel(/color\*/i)).not.toHaveText("Black");
  });

  test("values are cleared when reopening add filament modal after copying an existing filament and saving", async ({ page }) => {
    const uniqueCopyName = `CopiedSpool-${Date.now()}`;

    // Find any existing spool card and click copy
    const spoolCard = page.locator(".filament-card").first();
    await expect(spoolCard).toBeVisible();
    await spoolCard.getByRole("button", { name: /copy/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Give it a distinct name and save
    const nameInput = dialog.getByLabel(/name\*/i);
    await nameInput.fill(uniqueCopyName);

    await dialog.getByRole("button", { name: /^save$/i }).click();
    await expect(dialog).toBeHidden();

    // Verify newly copied spool is displayed
    await expect(page.getByText(uniqueCopyName)).toBeVisible();

    // Open Add Filament modal from header
    await page.getByRole("button", { name: /add filament/i }).click();
    await expect(dialog).toBeVisible();

    // The modal must not retain the copied filament's data
    await expect(dialog.getByLabel(/name\*/i)).toHaveValue("");
    await expect(dialog.getByLabel(/barcode/i)).toHaveValue("");
  });
});
