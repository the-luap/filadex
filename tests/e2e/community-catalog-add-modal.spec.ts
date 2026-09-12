import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("Community Catalog on Add Filament Modal", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto("/");
  });

  test("toggles between OFD and SpoolmanDB and persists selection in localStorage", async ({ page }) => {
    // Open Add Filament modal
    await page.getByRole("button", { name: /add filament/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const ofdTab = page.getByRole("tab", { name: /open filament database/i });
    const spoolmanTab = page.getByRole("tab", { name: /^spoolmandb$/i });

    await expect(ofdTab).toBeVisible();
    await expect(spoolmanTab).toBeVisible();

    // Default selection is OFD
    await expect(ofdTab).toHaveAttribute("data-state", "active");

    // Click SpoolmanDB
    await spoolmanTab.click();
    await expect(spoolmanTab).toHaveAttribute("data-state", "active");

    // Verify localStorage has "spoolmandb"
    const storedSource = await page.evaluate(() => localStorage.getItem("filament_catalog_source"));
    expect(storedSource).toBe("spoolmandb");

    // Close and reopen modal, verify SpoolmanDB is still active
    await page.getByRole("button", { name: /^cancel$/i }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByRole("button", { name: /add filament/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("tab", { name: /^spoolmandb$/i })).toHaveAttribute("data-state", "active");

    // Switch back to OFD
    await page.getByRole("tab", { name: /open filament database/i }).click();
    const storedSourceOfd = await page.evaluate(() => localStorage.getItem("filament_catalog_source"));
    expect(storedSourceOfd).toBe("ofd");
  });

  test("searches community catalog and pre-fills form fields including barcode", async ({ page }) => {
    // Intercept community search to return consistent mock items
    await page.route("**/api/community-filaments/search*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "ofd-test-1",
            source: "ofd",
            manufacturer: "Polymaker",
            name: "PolyTerra PLA",
            material: "PLA",
            colorName: "Sapphire Blue",
            colorCode: "#0000FF",
            density: 1.25,
            diameter: 1.75,
            weightGrams: 1000,
            spoolRefill: false,
            extruderTemp: 210,
            bedTemp: 50,
            gtin: "6975337039999",
          },
        ]),
      });
    });

    await page.getByRole("button", { name: /add filament/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Search community filaments
    const searchInput = dialog.getByPlaceholder(/search catalog/i);
    await searchInput.fill("PolyTerra");

    // Click the result in the dropdown
    const resultButton = dialog.getByRole("button", { name: /polymaker.*polyterra pla.*sapphire blue/i });
    await expect(resultButton).toBeVisible();
    await resultButton.click();

    // Verify fields are pre-filled
    await expect(dialog.getByLabel(/name\*/i)).toHaveValue("PolyTerra PLA Sapphire Blue");
    await expect(dialog.getByLabel(/barcode/i)).toHaveValue("6975337039999");
    await expect(dialog.getByLabel(/print temp/i)).toHaveValue("210°C / Bed 50°C");
  });

  test("can enter barcode directly and saves with barcode", async ({ page }) => {
    const uniqueSpoolName = `BarcodeSpool-${Date.now()}`;
    const testBarcode = "7788990011223";

    await page.getByRole("button", { name: /add filament/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Select Material
    await dialog.getByLabel(/material\*/i).click();
    await page.getByRole("option", { name: "PLA" }).first().click();

    // Select Color
    await dialog.getByLabel(/color template|color\*/i).click();
    await page.getByRole("option", { name: "Black" }).first().click();

    // Fill Name after material/color so auto-generation does not overwrite custom name
    await dialog.getByLabel(/name\*/i).fill(uniqueSpoolName);

    // Enter Barcode
    await dialog.getByLabel(/barcode/i).fill(testBarcode);

    // Select Packaging
    await dialog.getByLabel(/packaging/i).click();
    await page.getByRole("option", { name: /sealed|opened/i }).first().click();

    // Select Spool Type
    await dialog.getByLabel(/spool type/i).click();
    await page.getByRole("option", { name: /spooled|spoolless/i }).first().click();

    // Submit form (Save)
    await dialog.getByRole("button", { name: /^save$/i }).click();

    // Dialog closes and spool appears in collection
    await expect(dialog).toBeHidden();
    await expect(page.getByText(uniqueSpoolName)).toBeVisible();
  });

  test("shows similarity alert when community filament has a similar material", async ({ page }) => {
    await page.route("**/api/community-filaments/search*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "ofd-test-mat-sim",
            source: "ofd",
            manufacturer: "Bambu Lab",
            name: "eSUN PLA+",
            material: "PLA+",
            colorName: "Black",
            colorCode: "#000000",
            density: 1.24,
            diameter: 1.75,
            weightGrams: 1000,
            spoolRefill: false,
            extruderTemp: 215,
            bedTemp: 55,
            gtin: "6975337038888",
          },
        ]),
      });
    });

    await page.getByRole("button", { name: /add filament/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const searchInput = dialog.getByPlaceholder(/search catalog/i);
    await searchInput.fill("PLA+");

    const resultButton = dialog.getByRole("button", { name: /esun pla\+/i });
    await expect(resultButton).toBeVisible();
    await resultButton.click();

    // Similar material alert appears
    await expect(page.getByRole("heading", { name: /similar material found/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /use "pla"/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /create "pla\+"/i })).toBeVisible();

    // Click 'Use "PLA"'
    await page.getByRole("button", { name: /use "pla"/i }).click();

    // Verify material in dialog is now PLA
    await expect(dialog.getByRole("combobox", { name: /material\*/i })).toHaveText(/pla/i);
  });

  test("shows similarity alert when community filament has a similar manufacturer and updates fields", async ({ page }) => {
    // Mock manufacturers list to include Prusament
    await page.route("**/api/manufacturers", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: 101, name: "Prusament" },
        ]),
      });
    });

    await page.route("**/api/community-filaments/search*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "ofd-test-mfg-sim",
            source: "ofd",
            manufacturer: "Prusa",
            name: "Galaxy Black",
            material: "PLA",
            colorName: "Galaxy Black",
            colorCode: "#111111",
            density: 1.24,
            diameter: 1.75,
            weightGrams: 1000,
            spoolRefill: false,
            extruderTemp: 215,
            bedTemp: 60,
            gtin: "6975337037777",
          },
        ]),
      });
    });

    await page.getByRole("button", { name: /add filament/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const searchInput = dialog.getByPlaceholder(/search catalog/i);
    await searchInput.fill("Prusa");

    const resultButton = dialog.getByRole("button", { name: /prusa.*galaxy black/i });
    await expect(resultButton).toBeVisible();
    await resultButton.click();

    // Similar manufacturer alert appears
    await expect(page.getByRole("heading", { name: /similar manufacturer found/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /use "prusament"/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /create "prusa"/i })).toBeVisible();

    // Click 'Use "Prusament"'
    await page.getByRole("button", { name: /use "prusament"/i }).click();

    // Verify manufacturer in dialog is now Prusament
    await expect(dialog.getByRole("combobox", { name: /manufacturer/i })).toHaveText(/prusament/i);
    // Verify filament name is PLA Galaxy Black (material + name, no manufacturer)
    await expect(dialog.getByLabel(/name\*/i)).toHaveValue("PLA Galaxy Black");
  });
});

