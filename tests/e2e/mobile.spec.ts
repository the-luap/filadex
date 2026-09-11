import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("Mobile viewport experience", () => {
  // Use a standard mobile screen size (375x667, iPhone SE / standard mobile)
  test.use({ viewport: { width: 375, height: 667 } });

  let spoolA: { name: string; material: string; barcode: string };
  let spoolB: { name: string; material: string; barcode: string };

  test.beforeEach(async ({ page }) => {
    spoolA = {
      name: `AlphaPLA-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      material: "PLA",
      barcode: "5901234567890",
    };
    spoolB = {
      name: `OmegaPETG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      material: "PETG",
      barcode: "5909876543210",
    };

    await signIn(page);
    await page.goto("/");

    // Seed test spools with PLA and PETG via API to ensure chart data exists
    await page.evaluate(async (spools) => {
      for (const s of spools) {
        await fetch("/api/filaments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: s.name,
            material: s.material,
            colorName: "Black",
            colorCode: "#000000",
            barcode: s.barcode,
            totalWeight: "1000",
            remainingPercentage: "100",
          }),
        });
      }
    }, [spoolA, spoolB]);

    await page.reload();
    await expect(page.getByText(spoolA.name)).toBeVisible();
    await expect(page.getByText(spoolB.name)).toBeVisible();
  });

  test("displays mobile chart labels below the circle graph and toggles with viewport size", async ({ page }) => {
    // On mobile (375px), mobile-chart-labels should be visible
    const mobileChartLabels = page.getByTestId("mobile-chart-labels");
    await expect(mobileChartLabels).toBeVisible();

    // Verify it lists the materials present in inventory
    await expect(mobileChartLabels.getByText("PLA", { exact: true })).toBeVisible();
    await expect(mobileChartLabels.getByText("PETG", { exact: true })).toBeVisible();

    // Switch to desktop viewport (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });

    // The mobile labels should be hidden on desktop (md:hidden)
    await expect(mobileChartLabels).toBeHidden();

    // Switch back to mobile viewport (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(mobileChartLabels).toBeVisible();
  });

  test("header adapts to mobile layout and menus are accessible", async ({ page }) => {
    // On mobile, text labels in header buttons are hidden (hidden sm:inline), but icons/buttons are accessible
    const settingsBtn = page.getByRole("button", { name: /^settings$/i });
    const toolsBtn = page.getByRole("button", { name: /^tools$/i });
    const accountBtn = page.getByRole("button", { name: /^account$/i });
    const addFilamentBtn = page.getByRole("button", { name: /add filament/i });

    await expect(settingsBtn).toBeVisible();
    await expect(toolsBtn).toBeVisible();
    await expect(accountBtn).toBeVisible();
    await expect(addFilamentBtn).toBeVisible();

    // Open settings dropdown on mobile
    await settingsBtn.click();
    await expect(page.getByRole("menuitem", { name: /theme/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /general settings|list management/i })).toBeVisible();
    // Close by pressing Escape
    await page.keyboard.press("Escape");

    // Open tools dropdown on mobile
    await toolsBtn.click();
    await expect(page.getByRole("menuitem", { name: /shared.*collection/i })).toBeVisible();
    await page.keyboard.press("Escape");

    // Open account dropdown on mobile
    await accountBtn.click();
    await expect(page.getByRole("menuitem", { name: /change password/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /logout/i })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("can open Add Filament modal, select material, color, and save on mobile", async ({ page }) => {
    const newSpoolName = `MobileCreatedSpool-${Date.now()}`;

    await page.getByRole("button", { name: /add filament/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /add filament/i })).toBeVisible();

    // Select Material
    await dialog.getByLabel(/material\*/i).click();
    await page.getByRole("option", { name: "PLA" }).first().click();

    // Select Color (e.g. "Black") and verify color code hex auto-populates
    await dialog.getByLabel(/^color\*/i).click();
    await page.getByRole("option", { name: "Black" }).first().click();
    await expect(dialog.getByLabel(/color code/i)).toHaveValue("#000000");

    // Fill Name after material/color so auto-generation does not overwrite it
    await dialog.getByLabel(/name\*/i).fill(newSpoolName);

    // Select Packaging
    await dialog.getByLabel(/packaging/i).click();
    await page.getByRole("option", { name: /sealed|opened/i }).first().click();

    // Select Spool Type
    await dialog.getByLabel(/spool type/i).click();
    await page.getByRole("option", { name: /spooled|spoolless/i }).first().click();

    // Submit form (Save)
    await dialog.getByRole("button", { name: /^save$/i }).click();

    // Dialog closes and new spool appears in collection
    await expect(dialog).toBeHidden();
    await expect(page.getByText(newSpoolName)).toBeVisible();
  });

  test("mobile filter search and barcode scanner work on mobile viewport", async ({ page }) => {
    // Search for Spool A on mobile
    const searchInput = page.getByPlaceholder(/search by name/i);
    await expect(searchInput).toBeVisible();

    await searchInput.fill(spoolA.name);
    await expect(page.getByText(spoolA.name)).toBeVisible();
    await expect(page.getByText(spoolB.name)).toBeHidden();

    await searchInput.fill("");
    await expect(page.getByText(spoolA.name)).toBeVisible();
    await expect(page.getByText(spoolB.name)).toBeVisible();

    // Barcode scanner button in mobile filter sidebar
    const scanButton = page.getByRole("button", { name: /scan barcode/i });
    await expect(scanButton).toBeVisible();
    await scanButton.click();

    // Scanner modal opens
    const scanDialog = page.getByRole("dialog");
    await expect(scanDialog).toBeVisible();
    await expect(scanDialog.getByRole("heading", { name: /scan qr code/i })).toBeVisible();

    // Close scanner modal
    await scanDialog.getByRole("button", { name: /^cancel$/i }).click();
    await expect(scanDialog).toBeHidden();
  });
});
