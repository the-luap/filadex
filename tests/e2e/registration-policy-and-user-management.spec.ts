import { test, expect } from "@playwright/test";
import { signIn, DEMO_ADMIN } from "./helpers";

// Throwaway test credentials for seeded demo database (safe for git, annotated for GitGuardian)
const ALICE = { username: "alice", password: "demo-password" }; // ggignore: throwaway test fixture credential

test.describe("Header navigation and role-based visibility", () => {
  test("displays 'General Settings' menu item in settings dropdown", async ({ page }) => {
    await signIn(page, DEMO_ADMIN);

    const settingsBtn = page.getByRole("button", { name: /^settings$/i });
    await expect(settingsBtn).toBeVisible({ timeout: 30_000 });
    await settingsBtn.click();

    const generalSettingsItem = page.getByRole("menuitem", { name: /^general settings$/i });
    await expect(generalSettingsItem).toBeVisible();

    // Clicking it opens the Settings Dialog
    await generalSettingsItem.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: /^settings$/i })).toBeVisible();
  });

  test("hides 'User Management' from Tools menu for non-admin users", async ({ page }) => {
    await signIn(page, ALICE);

    const toolsBtn = page.getByRole("button", { name: /^tools$/i });
    await expect(toolsBtn).toBeVisible({ timeout: 30_000 });
    await toolsBtn.click();

    await expect(page.getByRole("menuitem", { name: /user management/i })).not.toBeVisible();
  });

  test("shows 'User Management' in Tools menu for admin and opens UserManagementModal with cards and switch", async ({ page }) => {
    await signIn(page, DEMO_ADMIN);

    const toolsBtn = page.getByRole("button", { name: /^tools$/i });
    await expect(toolsBtn).toBeVisible({ timeout: 30_000 });
    await toolsBtn.click();

    const userManagementItem = page.getByRole("menuitem", { name: /user management/i });
    await expect(userManagementItem).toBeVisible();
    await userManagementItem.click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("heading", { name: /user management/i })).toBeVisible();

    // Verify registration policy switch card
    await expect(modal.getByText("Allow new user registration")).toBeVisible();
    await expect(
      modal.getByText("When disabled, new accounts can only be created manually by an administrator.")
    ).toBeVisible();
    const toggle = modal.getByRole("switch", { name: /allow new user registration/i });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    // Verify user list cards with badges and action buttons
    await expect(modal.getByText("admin", { exact: true })).toBeVisible();
    await expect(modal.getByText("Admin", { exact: true })).toBeVisible();

    await expect(modal.getByText("alice", { exact: true })).toBeVisible();
    await expect(modal.getByText("User", { exact: true }).first()).toBeVisible();

    // Verify Edit User and Delete User buttons on user cards
    const editBtn = modal.getByRole("button", { name: /edit user/i }).first();
    await expect(editBtn).toBeVisible();
    const deleteBtn = modal.getByRole("button", { name: /delete user/i }).first();
    await expect(deleteBtn).toBeVisible();

    // Clicking Edit switches to the Edit User tab with user data
    await editBtn.click();
    await expect(modal.getByRole("tab", { name: /edit user/i })).toBeVisible();
    await expect(modal.getByRole("button", { name: /update user/i })).toBeVisible();
  });
});

test.describe("Registration policy toggle and public page impact", () => {
  test("toggling registration off hides register link and blocks /register page, then re-enabling restores it", async ({
    page,
    browser,
  }) => {
    // 1. Sign in as admin and open User Management modal
    await signIn(page, DEMO_ADMIN);

    const toolsBtn = page.getByRole("button", { name: /^tools$/i });
    await expect(toolsBtn).toBeVisible({ timeout: 30_000 });
    await toolsBtn.click();
    await page.getByRole("menuitem", { name: /user management/i }).click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    const toggle = modal.getByRole("switch", { name: /allow new user registration/i });
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    // 2. Disable registration
    await toggle.click();
    await expect(page.getByText(/user updated successfully|success/i).first()).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    // 3. In unauthenticated visitor context, verify /login and /register
    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();

    try {
      // Check /login: "Create account" link should be hidden
      await visitorPage.goto("/login");
      await expect(visitorPage.getByLabel(/username/i)).toBeVisible({ timeout: 30_000 });
      await expect(visitorPage.getByRole("link", { name: /create account/i })).not.toBeVisible();

      // Check /register: Should show disabled notice and "Back to login" button
      await visitorPage.goto("/register");
      await expect(visitorPage.getByText(/registration is currently disabled/i)).toBeVisible();
      await expect(
        visitorPage.getByText(/when disabled, new accounts can only be created manually by an administrator/i)
      ).toBeVisible();
      await expect(visitorPage.getByRole("button", { name: /create account/i })).not.toBeVisible();

      // Clicking "Back to login" navigates to /login
      const backButton = visitorPage.getByRole("button", { name: /back to login/i });
      await expect(backButton).toBeVisible();
      await backButton.click();
      await expect(visitorPage).toHaveURL(/\/login/);

      // 4. Re-enable registration in admin page
      await toggle.click();
      await expect(page.getByText(/user updated successfully|success/i).first()).toBeVisible();
      await expect(toggle).toHaveAttribute("aria-checked", "true");

      // 5. In visitor context, verify registration is restored
      await visitorPage.goto("/login");
      await expect(visitorPage.getByRole("link", { name: /create account/i })).toBeVisible();

      await visitorPage.goto("/register");
      await expect(visitorPage.getByRole("button", { name: /create account/i })).toBeVisible();
      await expect(visitorPage.getByPlaceholder(/username/i)).toBeVisible();
      await expect(visitorPage.getByLabel(/email/i)).toBeVisible();
      await expect(visitorPage.getByLabel(/password/i)).toBeVisible();
    } finally {
      await visitorContext.close();
      // Safety guarantee: ensure toggle is left in enabled state if test failed midway
      const isChecked = await toggle.getAttribute("aria-checked");
      if (isChecked === "false") {
        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-checked", "true");
      }
    }
  });
});
