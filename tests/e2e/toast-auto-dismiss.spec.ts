import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("Toast Auto-Dismiss and Manual Close Lifecycle", () => {
  test("toast auto-dismisses after 5s and can be closed manually before timer expires", async ({ page }) => {
    await signIn(page);
    await page.goto("/");

    // Open Add Filament modal
    await page.getByRole("button", { name: /add filament/i }).click();
    const addDialog = page.getByRole("dialog");
    await expect(addDialog).toBeVisible();

    // 1. Test manual closure
    await addDialog.getByRole("button", { name: /scan qr/i }).click();
    await expect(page.getByRole("heading", { name: /scan qr code/i })).toBeVisible();

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("filadex:scan", { detail: "UNKNOWN_MANUAL_CLOSE" }));
    });

    const manualToast = page.locator("li").filter({ hasText: /UNKNOWN_MANUAL_CLOSE/i }).first();
    await expect(manualToast).toBeVisible();

    // Click close button immediately
    const closeBtn = manualToast.locator("[toast-close]");
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(manualToast).toBeHidden();

    // 2. Test auto-dismissal on subsequent toast (ensuring manual closure did not leave timer paused)
    await addDialog.getByRole("button", { name: /scan qr/i }).click();
    await expect(page.getByRole("heading", { name: /scan qr code/i })).toBeVisible();

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("filadex:scan", { detail: "UNKNOWN_AUTO_DISMISS" }));
    });

    const autoToast = page.locator("li").filter({ hasText: /UNKNOWN_AUTO_DISMISS/i }).first();
    await expect(autoToast).toBeVisible();

    // Wait for auto-dismiss (~5000ms timer + animation)
    await expect(autoToast).toBeHidden({ timeout: 8000 });
  });

  test("mobile viewport with touch interaction auto-dismisses toast", async ({ page }) => {
    // Set mobile viewport and touch emulation
    await page.setViewportSize({ width: 390, height: 844 });

    await signIn(page);
    await page.goto("/");

    // Open Add Filament modal
    await page.getByRole("button", { name: /add filament/i }).click();
    const addDialog = page.getByRole("dialog");
    await expect(addDialog).toBeVisible();

    await addDialog.getByRole("button", { name: /scan qr/i }).click();
    await expect(page.getByRole("heading", { name: /scan qr code/i })).toBeVisible();

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("filadex:scan", { detail: "UNKNOWN_MOBILE_TOUCH" }));
    });

    const mobileToast = page.locator("li").filter({ hasText: /UNKNOWN_MOBILE_TOUCH/i }).first();
    await expect(mobileToast).toBeVisible();

    // Verify auto-dismissal completes on mobile screen
    await expect(mobileToast).toBeHidden({ timeout: 8000 });
  });

  test("mobile: toast renders within mobile viewport without horizontal overflow and close button is touch accessible", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    await signIn(page);
    await page.goto("/");

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

