import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Tests for Priority 0 barcode resolution from personal collection.
 * Exercises:
 *   1. Home scanner -> match existing spool -> prompt "Add Another Spool" ->
 *      pre-fills modal with product specs while resetting remaining % to 100%.
 *   2. Edit modal scanner -> scan another collection spool's barcode ->
 *      prompts for confirmation before overwriting specs, allowing "Update Barcode Only".
 */

test.describe("Priority 0 Barcode Resolution from Personal Collection", () => {
  let seededSpoolA: {
    name: string;
    manufacturer: string;
    material: string;
    colorName: string;
    colorCode: string;
    barcode: string;
    totalWeight: string;
    remainingPercentage: string;
  };
  let seededSpoolB: {
    name: string;
    manufacturer: string;
    material: string;
    colorName: string;
    colorCode: string;
    barcode: string;
  };

  test.beforeEach(async ({ page }) => {
    const timestamp = Date.now();
    seededSpoolA = {
      name: `Priority0-SpoolA-${timestamp}`,
      manufacturer: "Prusa Research",
      material: "PLA",
      colorName: "Galaxy Black",
      colorCode: "#1a1a1a",
      barcode: `8594${timestamp.toString().slice(-8)}`,
      totalWeight: "1",
      remainingPercentage: "35",
    };
    seededSpoolB = {
      name: `Priority0-SpoolB-${timestamp}`,
      manufacturer: "Polymaker",
      material: "PETG",
      colorName: "Teal",
      colorCode: "#008080",
      barcode: `6971${timestamp.toString().slice(-8)}`,
    };

    await signIn(page);
    await page.goto("/");

    // Seed both spools into user's collection
    await page.evaluate(async ({ spoolA, spoolB }) => {
      await fetch("/api/filaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: spoolA.name,
          manufacturer: spoolA.manufacturer,
          material: spoolA.material,
          colorName: spoolA.colorName,
          colorCode: spoolA.colorCode,
          barcode: spoolA.barcode,
          totalWeight: spoolA.totalWeight,
          remainingPercentage: spoolA.remainingPercentage,
          status: "opened",
        }),
      });
      await fetch("/api/filaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: spoolB.name,
          manufacturer: spoolB.manufacturer,
          material: spoolB.material,
          colorName: spoolB.colorName,
          colorCode: spoolB.colorCode,
          barcode: spoolB.barcode,
          totalWeight: "1",
          remainingPercentage: "80",
          status: "opened",
        }),
      });
    }, { spoolA: seededSpoolA, spoolB: seededSpoolB });

    await page.reload();
    await expect(page.getByText(seededSpoolA.name)).toBeVisible();
    await expect(page.getByText(seededSpoolB.name)).toBeVisible();
  });

  test("main screen scan -> Add Another Spool carries specs and resets remaining percentage to 100%", async ({ page }) => {
    // Open scanner from sidebar
    const scanButton = page.getByRole("button", { name: /scan barcode/i });
    await scanButton.click();

    // Verify scanner modal is visible
    const scannerHeading = page.getByRole("heading", { name: /scan qr code/i });
    await expect(scannerHeading).toBeVisible();

    // Dispatch scan of spool A's barcode
    await page.evaluate((code) => {
      window.dispatchEvent(new CustomEvent("filadex:scan", { detail: code }));
    }, seededSpoolA.barcode);

    // Prompt dialog appears: Spool Found in Collection
    const promptDialog = page.getByRole("alertdialog");
    await expect(promptDialog).toBeVisible();
    await expect(promptDialog.getByRole("heading", { name: /spool found in collection/i })).toBeVisible();

    // Click "Add Another Spool"
    const addAnotherButton = promptDialog.getByRole("button", { name: /add another spool/i });
    await addAnotherButton.click();

    // The Add Filament modal opens
    const addDialog = page.getByRole("dialog");
    await expect(addDialog).toBeVisible();
    await expect(addDialog.getByRole("heading", { name: /add filament/i })).toBeVisible();

    // Product specifications must be populated
    await expect(addDialog.getByLabel(/name\*/i)).toHaveValue(seededSpoolA.name);
    await expect(addDialog.getByRole("combobox", { name: /manufacturer/i })).toHaveText(
      new RegExp(seededSpoolA.manufacturer, "i")
    );
    await expect(addDialog.getByRole("combobox", { name: /material/i })).toHaveText(
      new RegExp(seededSpoolA.material, "i")
    );
    await expect(addDialog.getByLabel(/barcode/i)).toHaveValue(seededSpoolA.barcode);

    // Remaining percentage must reset to default (100%), NOT the original spool's 35%
    await expect(addDialog.getByText("100%")).toBeVisible();
    await expect(addDialog.getByText("35%")).not.toBeVisible();
  });

  test("scanning another spool's barcode while editing prompts before overwriting specs", async ({ page }) => {
    // Click edit on Spool A
    const spoolCard = page.locator(".filament-card").filter({ hasText: seededSpoolA.name });
    await expect(spoolCard).toBeVisible();
    await spoolCard.getByRole("button", { name: /edit/i }).click();

    const editDialog = page.getByRole("dialog");
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByRole("heading", { name: /edit filament/i })).toBeVisible();

    // Open scanner inside the modal
    await editDialog.getByRole("button", { name: /scan qr/i }).click();
    await expect(page.getByRole("heading", { name: /scan qr code/i })).toBeVisible();

    // Scan Spool B's barcode
    await page.evaluate((code) => {
      window.dispatchEvent(new CustomEvent("filadex:scan", { detail: code }));
    }, seededSpoolB.barcode);

    // Confirmation prompt appears
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByRole("heading", { name: /overwrite spool specifications\?/i })).toBeVisible();

    // Choose "Update Barcode Only"
    await confirmDialog.getByRole("button", { name: /update barcode only/i }).click();
    await expect(confirmDialog).toBeHidden();

    // Identity fields must remain Spool A's
    await expect(editDialog.getByLabel(/name\*/i)).toHaveValue(seededSpoolA.name);
    await expect(editDialog.getByRole("combobox", { name: /material/i })).toHaveText(
      new RegExp(seededSpoolA.material, "i")
    );

    // Barcode field must have updated to Spool B's scanned barcode
    await expect(editDialog.getByLabel(/barcode/i)).toHaveValue(seededSpoolB.barcode);
  });
});
