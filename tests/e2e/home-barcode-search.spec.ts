import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("Home barcode scanning and search", () => {
  let spoolA: { name: string; material: string; barcode: string };
  let spoolB: { name: string; material: string; barcode: string };

  test.beforeEach(async ({ page }) => {
    spoolA = {
      name: `SpoolA-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      material: "PLA",
      barcode: "8594195180999",
    };
    spoolB = {
      name: `SpoolB-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      material: "PETG",
      barcode: "6975337039888",
    };

    await signIn(page);
    await page.goto("/");

    // Seed test spools with distinct barcodes via API
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

  test("displays barcode scanner button in filter sidebar and opens scanner modal", async ({ page }) => {
    const scanButton = page.getByRole("button", { name: /scan barcode/i });
    await expect(scanButton).toBeVisible();

    await scanButton.click();

    // Scanner modal opens
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: /scan qr code/i })).toBeVisible();

    // Close scanner modal
    await page.getByRole("dialog").getByRole("button", { name: /^cancel$/i }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("filters spools by full barcode and zero-padded barcode", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search by name/i);

    // Search by exact barcode of Spool A
    await searchInput.fill(spoolA.barcode);
    await expect(page.getByText(spoolA.name)).toBeVisible();
    await expect(page.getByText(spoolB.name)).toBeHidden();

    // Search by zero-padded GTIN (e.g. 14 digits) of Spool A
    await searchInput.fill(`00${spoolA.barcode}`);
    await expect(page.getByText(spoolA.name)).toBeVisible();
    await expect(page.getByText(spoolB.name)).toBeHidden();

    // Search by exact barcode of Spool B
    await searchInput.fill(spoolB.barcode);
    await expect(page.getByText(spoolB.name)).toBeVisible();
    await expect(page.getByText(spoolA.name)).toBeHidden();

    // Clear search shows both spools
    await searchInput.fill("");
    await expect(page.getByText(spoolA.name)).toBeVisible();
    await expect(page.getByText(spoolB.name)).toBeVisible();
  });
});
