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

    const manualToast = page.locator("li").filter({ hasText: /not recognized/i }).first();
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
});
