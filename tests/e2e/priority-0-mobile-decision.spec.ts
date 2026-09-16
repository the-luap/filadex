import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("Mobile Viewport Priority 0 Scanner Decision Workflow", () => {
  // Mobile viewport: standard smartphone screen (390x844, iPhone 12/13/14 / Android standard)
  test.use({ viewport: { width: 390, height: 844 } });

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
      name: `MobileP0-SpoolA-${timestamp}`,
      manufacturer: "Prusa Research",
      material: "PLA",
      colorName: "Galaxy Black",
      colorCode: "#1a1a1a",
      barcode: `8594${timestamp.toString().slice(-8)}`,
      totalWeight: "1",
      remainingPercentage: "45",
    };
    seededSpoolB = {
      name: `MobileP0-SpoolB-${timestamp}`,
      manufacturer: "Polymaker",
      material: "PETG",
      colorName: "Teal",
      colorCode: "#008080",
      barcode: `6971${timestamp.toString().slice(-8)}`,
    };

    await signIn(page);
    await page.goto("/");

    // Seed test spools
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
          remainingPercentage: "90",
          status: "opened",
        }),
      });
    }, { spoolA: seededSpoolA, spoolB: seededSpoolB });

    await page.reload();
    await expect(page.getByText(seededSpoolA.name)).toBeVisible();
    await expect(page.getByText(seededSpoolB.name)).toBeVisible();
  });

  test("mobile: scanning in Add Modal opens overlaying modal-on-modal, stacks buttons vertically without horizontal overflow, and 'Use Collection Specs' autofills specs", async ({ page }) => {
    // Open Add Filament modal
    await page.getByRole("button", { name: /add filament/i }).click();
    const addDialog = page.getByRole("dialog");
    await expect(addDialog).toBeVisible();

    // Open scanner from inside the modal
    await addDialog.getByRole("button", { name: /scan qr/i }).click();
    await expect(page.getByRole("heading", { name: /scan qr code/i })).toBeVisible();

    // Scan Spool A's barcode
    await page.evaluate((code) => {
      window.dispatchEvent(new CustomEvent("filadex:scan", { detail: code }));
    }, seededSpoolA.barcode);

    // Overlaying prompt appears on top of Add modal
    const promptDialog = page.getByRole("alertdialog");
    await expect(promptDialog).toBeVisible();
    await expect(promptDialog.getByRole("heading", { name: /spool found in collection/i })).toBeVisible();

    // Verify preview card displays spool name, material badge, etc.
    await expect(promptDialog.getByText(seededSpoolA.name, { exact: true })).toBeVisible();
    await expect(promptDialog.getByText(seededSpoolA.manufacturer)).toBeVisible();
    await expect(promptDialog.getByText(seededSpoolA.material, { exact: true })).toBeVisible();

    // Verify no horizontal overflow across viewport
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Verify buttons are stacked vertically on mobile
    const useCollectionBtn = promptDialog.getByRole("button", { name: /use collection specs/i });
    const searchCommunityBtn = promptDialog.getByRole("button", { name: /search community catalog instead/i });
    await expect(useCollectionBtn).toBeVisible();
    await expect(searchCommunityBtn).toBeVisible();

    const useBox = await useCollectionBtn.boundingBox();
    const searchBox = await searchCommunityBtn.boundingBox();
    expect(useBox).toBeTruthy();
    expect(searchBox).toBeTruthy();
    // In mobile vertical stack, one is below the other (Y difference >= 30px)
    expect(Math.abs(useBox!.y - searchBox!.y)).toBeGreaterThan(30);

    // Choose "Use Collection Specs"
    await useCollectionBtn.click();
    await expect(promptDialog).toBeHidden();

    // Add Filament modal must now be filled with Spool A specs
    await expect(addDialog.getByLabel(/name\*/i)).toHaveValue(seededSpoolA.name);
    await expect(addDialog.getByRole("combobox", { name: /manufacturer/i })).toHaveText(
      new RegExp(seededSpoolA.manufacturer, "i")
    );
    await expect(addDialog.getByRole("combobox", { name: /material/i })).toHaveText(
      new RegExp(seededSpoolA.material, "i")
    );
    await expect(addDialog.getByLabel(/barcode/i)).toHaveValue(seededSpoolA.barcode);
  });

  test("mobile: choosing 'Search Community Catalog instead' in overlay modal keeps barcode and queries catalog without copying local specs", async ({ page }) => {
    // Open Add Filament modal
    await page.getByRole("button", { name: /add filament/i }).click();
    const addDialog = page.getByRole("dialog");
    await expect(addDialog).toBeVisible();

    // Open scanner from inside the modal
    await addDialog.getByRole("button", { name: /scan qr/i }).click();
    await expect(page.getByRole("heading", { name: /scan qr code/i })).toBeVisible();

    // Scan Spool A's barcode
    await page.evaluate((code) => {
      window.dispatchEvent(new CustomEvent("filadex:scan", { detail: code }));
    }, seededSpoolA.barcode);

    // Prompt appears
    const promptDialog = page.getByRole("alertdialog");
    await expect(promptDialog).toBeVisible();

    // Click "Search Community Catalog instead"
    const searchCommunityBtn = promptDialog.getByRole("button", { name: /search community catalog instead/i });
    await searchCommunityBtn.click();
    await expect(promptDialog).toBeHidden();

    // Barcode field has the scanned barcode
    await expect(addDialog.getByLabel(/barcode/i)).toHaveValue(seededSpoolA.barcode);

    // Name field is NOT filled with Spool A's local collection name
    await expect(addDialog.getByLabel(/name\*/i)).not.toHaveValue(seededSpoolA.name);
  });

  test("mobile: conflict candidates dialog renders mobile-first cards and fits within viewport without overflow", async ({ page }) => {
    // Seed a second spool with the EXACT SAME barcode as Spool A, but different material to trigger conflict
    const timestamp = Date.now();
    const conflictBarcode = `999000${timestamp.toString().slice(-6)}`;

    await page.evaluate(async (code) => {
      await fetch("/api/filaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: "Conflict Spool PLA",
          manufacturer: "FormFutura",
          material: "PLA",
          colorName: "Silver",
          colorCode: "#C0C0C0",
          barcode: code,
          totalWeight: "1",
          remainingPercentage: "100",
        }),
      });
      await fetch("/api/filaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: "Conflict Spool PETG",
          manufacturer: "FormFutura",
          material: "PETG",
          colorName: "Silver",
          colorCode: "#C0C0C0",
          barcode: code,
          totalWeight: "1",
          remainingPercentage: "100",
        }),
      });
    }, conflictBarcode);

    await page.reload();

    // Open Add Filament modal
    await page.getByRole("button", { name: /add filament/i }).click();
    const addDialog = page.getByRole("dialog");
    await expect(addDialog).toBeVisible();

    // Open scanner inside the modal
    await addDialog.getByRole("button", { name: /scan qr/i }).click();
    await expect(page.getByRole("heading", { name: /scan qr code/i })).toBeVisible();

    // Scan conflicting barcode
    await page.evaluate((code) => {
      window.dispatchEvent(new CustomEvent("filadex:scan", { detail: code }));
    }, conflictBarcode);

    // Conflict dialog appears
    const conflictDialog = page.getByRole("dialog").filter({ hasText: /multiple matching spools found/i });
    await expect(conflictDialog).toBeVisible();

    // Verify both candidates are rendered with CollectionSpoolCard
    await expect(conflictDialog.getByText("Conflict Spool PLA")).toBeVisible();
    await expect(conflictDialog.getByText("Conflict Spool PETG")).toBeVisible();

    // Verify no horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Click "Conflict Spool PETG"
    await conflictDialog.getByText("Conflict Spool PETG").click();
    await expect(conflictDialog).toBeHidden();

    // Add modal populated with selected candidate
    await expect(addDialog.getByLabel(/name\*/i)).toHaveValue("Conflict Spool PETG");
    await expect(addDialog.getByRole("combobox", { name: /material/i })).toHaveText(/petg/i);
  });

  test("mobile: toast renders within mobile viewport without horizontal overflow and close button is touch accessible", async ({ page }) => {
    const unknownBarcode = "9999999999999";

    // Open Add Filament modal
    await page.getByRole("button", { name: /add filament/i }).click();
    const addDialog = page.getByRole("dialog");
    await expect(addDialog).toBeVisible();

    // Open scanner from inside the modal
    await addDialog.getByRole("button", { name: /scan qr/i }).click();
    await expect(page.getByRole("heading", { name: /scan qr code/i })).toBeVisible();

    // Scan an unknown barcode to trigger the long error toast
    await page.evaluate((code) => {
      window.dispatchEvent(new CustomEvent("filadex:scan", { detail: code }));
    }, unknownBarcode);

    // Toast appears with long text
    const toastItem = page.locator("li").filter({ hasText: /not recognized \(searched Filadex QR/i }).first();
    await expect(toastItem).toBeVisible();

    // Wait for slide-in animation to settle
    await page.waitForTimeout(500);

    // Verify viewport and document bounds - zero horizontal overflow
    const overflowCheck = await page.evaluate(() => {
      const docOverflow = document.documentElement.scrollWidth > window.innerWidth;
      const toastEl = document.querySelector("[toast-close]")?.closest("li");
      if (!toastEl) return { docOverflow, toastOverflow: false, details: null };
      const rect = toastEl.getBoundingClientRect();
      const toastOverflow = rect.right > window.innerWidth + 2 || rect.left < -2;
      return {
        docOverflow,
        toastOverflow,
        details: { left: rect.left, right: rect.right, width: rect.width, innerWidth: window.innerWidth }
      };
    });

    expect(overflowCheck.docOverflow).toBe(false);
    expect(overflowCheck.toastOverflow, JSON.stringify(overflowCheck.details)).toBe(false);

    // Verify close button is visible and dismisses the toast
    const closeBtn = toastItem.locator("[toast-close]");
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(toastItem).toBeHidden();
  });
});
